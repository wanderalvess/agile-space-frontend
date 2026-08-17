import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs, doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// Inicialização segura para ambiente Server (Next.js Edge/Node)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firestore = getFirestore(app);

// Define o runtime como nodejs para acessar o file system local
export const runtime = 'nodejs';

// Cache em memória para o contexto da Base de Conhecimento
let serverContextCache = {
  data: "",
  lastFetch: 0
};
const CONTEXT_CACHE_TTL = 1000 * 60 * 15; // 15 minutos

export async function POST(req: Request) {
  try {
    const { messages: uiMessages, apiKey: clientApiKey, userId } = await req.json();

    // 0. Validar Chave de API (BYOK - Bring Your Own Key)
    if (!clientApiKey) {
      return new Response(JSON.stringify({ 
        error: "Configuração Necessária", 
        message: "Chave de API do Google não detectada. Por favor, configure sua chave nas definições do Conhecimento." 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Configura o provedor Google usando a chave enviada pelo cliente.
    const google = createGoogleGenerativeAI({ apiKey: clientApiKey });

    // 1. Carregar Contexto Expandido (Wide-Context RAG) com Cache
    let context = "";
    const now = Date.now();
    
    if (serverContextCache.data && (now - serverContextCache.lastFetch < CONTEXT_CACHE_TTL)) {
      console.log('⚡ [API] Usando Contexto em Cache (Server-side)');
      context = serverContextCache.data;
    } else {
      console.log('🔄 [API] Cache Expirado ou Vazio. Lendo Firestore...');
      try {
        const q = query(collection(firestore, 'knowledge_kb'), orderBy('updatedAt', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          context = "AVISO: NENHUM DOCUMENTO LOCALIZADO NA BASE DE CONHECIMENTO CADASTRADA.";
        } else {
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            // Ignorar documentos na lixeira
            if (data.status === 'trash') return;
            
            context += `\n--- DOCUMENTO: ${data.title} (${data.fullPath || data.category}) ---\n${data.content}\n`;
          });
          
          // Atualiza cache global
          serverContextCache = {
            data: context,
            lastFetch: now
          };
        }
      } catch (dbError: any) {
        console.error("Erro ao buscar contexto:", dbError);
        context = `ERRO DE PERMISSÃO: Não foi possível acessar o Firestore. Detalhe: ${dbError.message}`;
      }
    }

    const systemPrompt = `Você é o Assistente de Agilidade, o Guardião do Conhecimento da Espaço Ágil.

REGRAS DE OURO COMPORTAMENTAIS:
1. RESPOSTA RESTRITA: Responda APENAS com informações contidas no CONTEXTO DA BASE DE CONHECIMENTO fornecido abaixo.
2. ZERO ALUCINAÇÃO: Se a informação exata (nomes de tabelas, processos, campos) não estiver no contexto, você DEVE dizer: "Esta informação ainda não consta na minha Base de Conhecimento."
3. PROIBIDO CONHECIMENTO GERAL: Não use dados técnicos gerais (como tabelas padrão de outros ERPs) se não estiverem citados aqui.
4. IDENTIFICAÇÃO DE FONTE: Comece ou termine a resposta indicando o [Caminho do Documento] utilizado.

CONTEXTO DA BASE DE CONHECIMENTO:
${context}

Responda sempre em Markdown com foco técnico e precisão cirúrgica.`;

    // 2. Converter mensagens UI para o formato do modelo manualmente para evitar falhas de SDK
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

    // 3. Chamar o provedor de IA (Non-streaming para compatibilidade direta com fetch)
    const { text, usage } = await generateText({
      model: google('gemini-2.5-flash'), // Atualizado para a versão estável de 2026 conforme documentação
      system: systemPrompt,
      messages: modelMessages,
    });
    // 4. Retornar dados com usage (O registro agora é feito via Client-side para garantir permissão)
    return new Response(JSON.stringify({ 
      content: text,
      usage: usage // Retorna estatísticas de tokens para o cliente registrar
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Erro na API de Chat:', error);
    const errorMessage = error.message || 'Erro interno no motor de processamento';
    
    // Retorna o erro detalhado para o cliente diagnosticar
    return new Response(JSON.stringify({ 
      error: "Falha na Geração", 
      message: errorMessage 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
