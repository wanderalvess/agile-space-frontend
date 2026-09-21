import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import { ruleBasedExtract, type DailyDigestResult } from '@/lib/dailyDigestExtract';

export const runtime = 'nodejs';

const DigestSchema = z.object({
  entries: z.array(
    z.object({
      name: z.string(),
      today: z.string(),
      blockers: z.string(),
      hasBlocker: z.boolean(),
    })
  ),
  actionItems: z.array(
    z.object({
      text: z.string(),
      jiraKey: z.string().nullable(),
    })
  ),
});

/**
 * "lynn" aqui é a MESMA credencial global de empresa usada em /api/ai/chat (env var,
 * não BYOK) — e, como o contrato real da Lynn ainda não foi entregue pela TOTVS, é
 * também o jeito mais simples de testar com uma IA local: apontar LYNN_BASE_URL pra
 * um Ollama rodando em http://localhost:11434/v1 já funciona sem alterar nada aqui.
 */
function resolveModel(clientApiKey?: string): { model: LanguageModel } | { error: string } {
  const lynnKey = process.env.LYNN_API_KEY;
  const lynnBaseURL = process.env.LYNN_BASE_URL;
  if (lynnKey && lynnBaseURL) {
    const lynn = createOpenAICompatible({ name: 'lynn', apiKey: lynnKey, baseURL: lynnBaseURL });
    return { model: lynn(process.env.LYNN_MODEL || 'lynn') };
  }

  const geminiKey = clientApiKey
    || process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    return { model: google('gemini-2.5-flash') };
  }

  return { error: 'Nenhum provedor de IA configurado (LYNN_BASE_URL/LYNN_API_KEY ou chave Gemini).' };
}

export async function POST(req: Request) {
  try {
    const { rawText, useAi, apiKey } = await req.json();

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return Response.json({ error: 'rawText é obrigatório.' }, { status: 400 });
    }

    const ruleResult = ruleBasedExtract(rawText);

    if (!useAi) {
      return Response.json({ source: 'rules', ...ruleResult } satisfies { source: string } & DailyDigestResult);
    }

    const resolved = resolveModel(apiKey);
    if ('error' in resolved) {
      // Sem IA disponível: devolve o resultado por regra mesmo assim, sem quebrar o fluxo.
      return Response.json({ source: 'rules', warning: resolved.error, ...ruleResult });
    }

    try {
      const { object } = await generateObject({
        model: resolved.model,
        schema: DigestSchema,
        prompt: `Você é um assistente que organiza a nota de uma reunião de daily (standup) de um time ágil.
Extraia, a partir do texto abaixo, um resumo estruturado por pessoa (o que ela relatou de andamento em "today"
e qualquer bloqueio/impedimento em "blockers", marcando hasBlocker=true nesse caso) e uma lista de action items
gerais (com a chave do Jira citada em "jiraKey", se houver, formato PROJ-123, senão null). Não invente nomes ou
tarefas que não estejam no texto. Se uma pessoa não tiver bloqueio, deixe "blockers" vazio e hasBlocker=false.

TEXTO DA NOTA:
"""
${rawText}
"""`,
      });
      return Response.json({ source: 'ai', ...object });
    } catch (aiError) {
      console.warn('Falha ao usar IA para extrair digest, caindo para extração por regra:', aiError);
      return Response.json({ source: 'rules', warning: 'IA indisponível, usando extração por regra.', ...ruleResult });
    }
  } catch (err) {
    console.error('Erro ao processar daily digest:', err);
    return Response.json({ error: 'Erro ao processar a nota.' }, { status: 500 });
  }
}
