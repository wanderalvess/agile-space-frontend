import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// Inicialização segura para ambiente Server (Next.js Edge/Node)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);

export const runtime = 'nodejs';

let serverContextCache = {
  data: "",
  lastFetch: 0
};
const CONTEXT_CACHE_TTL = 1000 * 60 * 15; // 15 minutos

export async function POST(req: Request) {
  try {
    const { messages: uiMessages, apiKey: clientApiKey, userId, contextDocuments } = await req.json();

    // 0. Validar Chave de API (BYOK ou Variáveis de Ambiente)
    const apiKey = clientApiKey 
      || process.env.GEMINI_API_KEY 
      || process.env.GOOGLE_API_KEY 
      || process.env.NEXT_PUBLIC_GEMINI_API_KEY 
      || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: "Configuração Necessária", 
        message: "Chave de API do Gemini/Google não detectada. Por favor, configure sua chave nas definições ou variáveis de ambiente." 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const google = createGoogleGenerativeAI({ apiKey });

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
        // Tenta carregar do Spring Boot / PostgreSQL
        try {
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
          const res = await fetch(`${backendUrl}/knowledge?size=50`);
          if (res.ok) {
            const page = await res.json();
            const docs = page.content || (Array.isArray(page) ? page : []);
            if (docs.length > 0) {
              context = docs.map((d: any) => `--- DOCUMENTO: ${d.title} (${d.fullPath || d.category || ''}) ---\n${d.content}\n`).join('\n');
              serverContextCache = { data: context, lastFetch: now };
            }
          }
        } catch (err) {
          console.warn('[API] Erro ao buscar conhecimento via Spring Boot PostgreSQL:', err);
        }

        // Fallback para Firestore se o contexto continuar vazio
        if (!context) {
          try {
            const q = query(collection(firestore, 'knowledge_kb'), orderBy('updatedAt', 'desc'), limit(50));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
              snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.status !== 'trash') {
                  context += `\n--- DOCUMENTO: ${data.title} (${data.fullPath || data.category}) ---\n${data.content}\n`;
                }
              });
              serverContextCache = { data: context, lastFetch: now };
            }
          } catch (dbError: any) {
            console.error("[API] Erro ao buscar contexto Firestore:", dbError);
          }
        }
      }
    }

    if (!context) {
      context = "AVISO: NENHUM DOCUMENTO LOCALIZADO NA BASE DE CONHECIMENTO CADASTRADA.";
    }

    const systemPrompt = `Você é o Assistente Especialista da Espaço Ágil (RAG Guardião do Conhecimento).

REGRAS DE OURO COMPORTAMENTAIS:
1. RESPOSTA BASEADA EM CONTEXTO (RAG): Analise a dúvida do usuário utilizando prioritariamente o CONTEXTO DA BASE DE CONHECIMENTO fornecido abaixo.
2. PRECISÃO E CLAREZA: Se a informação exata (nomes de APIs, tabelas, serviços ou rotas) constar no contexto, explique detalhadamente de forma direta.
3. QUANDO INDISPONÍVEL: Se o termo ou conceito não estiver presente na Base de Conhecimento, explique o que falta e sugira cadastrar ou importar do TDN (Confluence).
4. IDENTIFICAÇÃO DE FONTE: Cite o nome do documento ou fonte de onde extraiu as informações.

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
        model: google('gemini-2.5-flash'),
        system: systemPrompt,
        messages: modelMessages,
      });
    } catch (modelError: any) {
      // Fallback para modelo estável gemini-1.5-flash caso o gemini-2.5-flash ainda não esteja registrado na versão do SDK
      result = await generateText({
        model: google('gemini-1.5-flash'),
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
