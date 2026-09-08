import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, type LanguageModel } from 'ai';

export const runtime = 'nodejs';

let serverContextCache = {
  data: "",
  lastFetch: 0
};
const CONTEXT_CACHE_TTL = 1000 * 60 * 15; // 15 minutos

type AiProvider = 'gemini' | 'lynn';

interface TaskContext {
  title?: string;
  description?: string;
  jiraLink?: string;
  acceptanceCriteria?: string;
  devNotes?: string;
  qaNotes?: string;
}

/**
 * Resolve o model da IA pro provider pedido. "lynn" é credencial global da empresa
 * (env var, não BYOK por usuário — decisão registrada no plano desta feature), e
 * assume compatibilidade OpenAI (createOpenAICompatible) por ser o formato mais comum
 * em gateways corporativos de IA — a TOTVS ainda não entregou o contrato real da Lynn,
 * então só a instanciação do client muda quando isso acontecer, não esta função inteira.
 */
function resolveModel(provider: AiProvider, clientApiKey?: string): { model: LanguageModel; fallbackModel?: LanguageModel } | { error: string } {
  if (provider === 'lynn') {
    const apiKey = process.env.LYNN_API_KEY;
    const baseURL = process.env.LYNN_BASE_URL;
    if (!apiKey || !baseURL) {
      return { error: 'Lynn não configurada — defina LYNN_API_KEY e LYNN_BASE_URL no ambiente do servidor.' };
    }
    const lynn = createOpenAICompatible({ name: 'lynn', apiKey, baseURL });
    const modelName = process.env.LYNN_MODEL || 'lynn';
    return { model: lynn(modelName) };
  }

  // gemini (padrão) — BYOK do usuário ou variáveis de ambiente, comportamento inalterado.
  const apiKey = clientApiKey
    || process.env.GEMINI_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return { error: 'Chave de API do Gemini/Google não detectada. Por favor, configure sua chave nas definições ou variáveis de ambiente.' };
  }

  const google = createGoogleGenerativeAI({ apiKey });
  return { model: google('gemini-2.5-flash'), fallbackModel: google('gemini-1.5-flash') };
}

function formatTaskContext(taskContext?: TaskContext): string {
  if (!taskContext) return '';
  const lines = [
    taskContext.title ? `Título: ${taskContext.title}` : '',
    taskContext.description ? `Descrição: ${taskContext.description}` : '',
    taskContext.acceptanceCriteria ? `Critérios de aceite: ${taskContext.acceptanceCriteria}` : '',
    taskContext.devNotes ? `Notas técnicas (dev): ${taskContext.devNotes}` : '',
    taskContext.qaNotes ? `Notas de QA: ${taskContext.qaNotes}` : '',
    taskContext.jiraLink ? `Link Jira: ${taskContext.jiraLink}` : '',
  ].filter(Boolean);
  if (lines.length === 0) return '';
  return `\n--- TAREFA EM REFINAMENTO/VOTAÇÃO ---\n${lines.join('\n')}\n`;
}

export async function POST(req: Request) {
  try {
    const {
      messages: uiMessages,
      apiKey: clientApiKey,
      userId,
      contextDocuments,
      provider: rawProvider,
      taskContext,
    } = await req.json();

    const provider: AiProvider = rawProvider === 'lynn' ? 'lynn' : 'gemini';

    const resolved = resolveModel(provider, clientApiKey);
    if ('error' in resolved) {
      return new Response(JSON.stringify({
        error: "Configuração Necessária",
        message: resolved.error
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { model, fallbackModel } = resolved;

    // 1. Carregar Contexto RAG (da requisição, do PostgreSQL ou do Firestore)
    let context = "";
    if (Array.isArray(contextDocuments) && contextDocuments.length > 0) {
      context = contextDocuments.map((doc: any) => 
        `--- DOCUMENTO: ${doc.title || doc.name} (${doc.fullPath || doc.category || ''}) ---\n${doc.content || ''}\n`
      ).join('\n');
    } else {
      const now = Date.now();
      if (serverContextCache.data && (now - serverContextCache.lastFetch < CONTEXT_CACHE_TTL)) {
        context = serverContextCache.data;
      } else {
        // Carrega o contexto RAG do Spring Boot / PostgreSQL (única fonte —
        // o fallback direto ao Firestore foi removido).
        try {
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
          const authHeader = req.headers.get('authorization');
          const res = await fetch(`${backendUrl}/knowledge?size=50`, {
            headers: authHeader ? { Authorization: authHeader } : {},
          });
          if (res.ok) {
            const page = await res.json();
            const docs = page.content || (Array.isArray(page) ? page : []);
            if (docs.length > 0) {
              context = docs.map((d: any) => `--- DOCUMENTO: ${d.title} (${d.fullPath || d.category || ''}) ---\n${d.content}\n`).join('\n');
              serverContextCache = { data: context, lastFetch: now };
            }
          } else {
            console.warn(`[API] Base de Conhecimento REST retornou status ${res.status}`);
          }
        } catch (err) {
          console.warn('[API] Erro ao buscar conhecimento via Spring Boot PostgreSQL:', err);
        }
      }
    }

    if (!context) {
      context = "AVISO: NENHUM DOCUMENTO LOCALIZADO NA BASE DE CONHECIMENTO CADASTRADA.";
    }

    const taskContextBlock = formatTaskContext(taskContext);

    const systemPrompt = `Você é o Assistente Especialista da Espaço Ágil (RAG Guardião do Conhecimento).

REGRAS DE OURO COMPORTAMENTAIS:
1. RESPOSTA BASEADA EM CONTEXTO (RAG): Analise a dúvida do usuário utilizando prioritariamente o CONTEXTO DA BASE DE CONHECIMENTO fornecido abaixo${taskContextBlock ? ' e os dados da TAREFA EM REFINAMENTO/VOTAÇÃO, quando presentes' : ''}.
2. PRECISÃO E CLAREZA: Se a informação exata (nomes de APIs, tabelas, serviços ou rotas) constar no contexto, explique detalhadamente de forma direta.
3. QUANDO INDISPONÍVEL: Se o termo ou conceito não estiver presente no contexto fornecido, diga isso claramente em vez de inventar — não existe conhecimento externo além do que está aqui.
4. IDENTIFICAÇÃO DE FONTE: Cite o nome do documento ou fonte de onde extraiu as informações.
${taskContextBlock}
CONTEXTO DA BASE DE CONHECIMENTO:
${context}

Responda sempre em Markdown limpo, profissional e estruturado.`;

    if (!Array.isArray(uiMessages)) {
      return new Response(JSON.stringify({
        error: "Requisição Inválida",
        message: "O campo 'messages' deve ser uma lista de mensagens."
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const modelMessages: any[] = uiMessages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    let result;
    try {
      result = await generateText({
        model,
        system: systemPrompt,
        messages: modelMessages,
      });
    } catch (modelError: any) {
      if (!fallbackModel) throw modelError;
      // Fallback para modelo estável gemini-1.5-flash caso o gemini-2.5-flash ainda não esteja registrado na versão do SDK
      result = await generateText({
        model: fallbackModel,
        system: systemPrompt,
        messages: modelMessages,
      });
    }

    return new Response(JSON.stringify({ 
      content: result.text,
      usage: result.usage
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Erro na API de Chat:', error);
    const errorMessage = error.message || 'Erro interno no motor de processamento RAG';
    
    return new Response(JSON.stringify({ 
      error: "Falha na Geração", 
      message: errorMessage 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
