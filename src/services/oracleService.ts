import { knowledgeApi } from '@/app/knowledge/api';
import { KnowledgeDocument } from '@/lib/knowledge-types';
import { useKnowledgeStore } from '@/lib/knowledge-store';

// Perguntas em português raramente aparecem verbatim nos documentos ("Quais os
// critérios de aceite?" vs. um doc que fala em "critério de aceite"), então
// comparar a frase inteira como substring falhava quase sempre. Stopwords
// filtradas aqui pra sobrar só as palavras que carregam significado da busca.
const STOPWORDS = new Set([
  'que', 'com', 'para', 'como', 'existe', 'algum', 'alguma', 'algum', 'sobre',
  'este', 'esta', 'isso', 'esse', 'essa', 'qual', 'quais', 'quando', 'onde',
  'tem', 'ter', 'uma', 'um', 'dos', 'das', 'nos', 'nas', 'por', 'seu', 'sua',
  'ela', 'ele', 'the', 'and', 'for', 'are', 'was', 'were', 'what', 'which',
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, ''); // remove acentos
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

// Singular/plural em PT/EN costuma ser só o 's' final ("critérios" vs.
// "critério") — sem trazer uma lib de stemming, checar o token sem o 's'
// final cobre a maioria dos casos reais sem falsos positivos relevantes.
function fieldMatchesToken(field: string, token: string): boolean {
  if (field.includes(token)) return true;
  if (token.endsWith('s') && field.includes(token.slice(0, -1))) return true;
  return false;
}

/**
 * Busca local (client-side) na base de conhecimento, com cache em memória via
 * Zustand para não bater na API a cada tecla.
 *
 * O primeiro parâmetro é um resquício da era Firestore (antes recebia a
 * instância do `firestore`) e não é mais utilizado — mantido apenas para não
 * quebrar chamadores que ainda não migraram nesta leva de mudanças. Pode ser
 * removido quando todos os call sites pararem de passá-lo.
 */
export const searchKnowledgeBase = async (_legacyFirestoreArg: unknown, searchTerm: string): Promise<KnowledgeDocument[]> => {
  if (!searchTerm || searchTerm.length < 3) return [];

  const state = useKnowledgeStore.getState();
  const CACHE_TTL = 1000 * 60 * 10; // 10 minutos

  let allDocs = state.documents;
  const isCacheExpired = !state.lastDocsFetch || (Date.now() - state.lastDocsFetch > CACHE_TTL);

  try {
    // Se o cache estiver vazio ou expirado, busca da API REST (Spring Boot / PostgreSQL)
    if (allDocs.length === 0 || isCacheExpired) {
      console.log('🔄 Cache KB vazio ou expirado. Buscando via API...');
      const response = await knowledgeApi.listDocuments(undefined, undefined, 0, 500);
      const fetchedDocs = response.content;

      state.setDocuments(fetchedDocs);
      allDocs = fetchedDocs;
    } else {
      console.log('⚡ Usando cache local para busca na KB');
    }

    const searchLower = normalize(searchTerm);
    const tokens = tokenize(searchTerm);
    // Pergunta só com stopwords/palavras curtas (ex: "e agora?") — cai de
    // volta pra frase inteira em vez de não buscar nada.
    const effectiveTokens = tokens.length > 0 ? tokens : [searchLower];

    const scored: { doc: KnowledgeDocument; score: number }[] = [];

    allDocs.forEach((data) => {
      // Filtro de status: Apenas documentos publicados ou indexados
      if (data.status !== 'published' && data.status !== 'indexed') return;

      const title = normalize(data.title || '');
      const content = normalize(data.content || '');
      const tags = (data.tags || []).map(normalize);

      let score = 0;
      let matchedTokens = 0;
      effectiveTokens.forEach(token => {
        let tokenMatched = false;
        if (fieldMatchesToken(title, token)) { score += 2; tokenMatched = true; }
        if (fieldMatchesToken(content, token)) { score += 1; tokenMatched = true; }
        if (tags.some(tag => fieldMatchesToken(tag, token))) { score += 1; tokenMatched = true; }
        if (tokenMatched) matchedTokens++;
      });

      if (score > 0) {
        scored.push({ doc: data, score: score + matchedTokens });
      }
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Limit to top 5 results
      .map(s => s.doc);

  } catch (error) {
    // Propaga o erro em vez de mascará-lo como "sem resultados" — permite que
    // o chamador distinga falha real (ex: API fora do ar) de busca vazia.
    console.error('Error searching knowledge base:', error);
    throw error;
  }
};
