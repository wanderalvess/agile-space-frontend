/**
 * tech-extractor.ts
 * Extrator determinístico de artefatos técnicos (Endpoints HTTP, tabelas de banco,
 * nomes de serviços) e gerador de snippets de destaque sem necessidade de IA.
 */

export interface TechnicalExtraction {
  endpoints: string[];
  tables: string[];
  services: string[];
  bestSnippet: string;
}

// Stop words comuns em português para higienizar buscas
const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'por', 'pelo', 'pela', 'pelos', 'pelas', 'para', 'pra', 'com', 'sem',
  'qual', 'quais', 'quem', 'como', 'onde', 'quando', 'porque', 'porquê',
  'que', 'qual', 'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
  'aquele', 'aquela', 'tem', 'temos', 'existe', 'existem', 'me', 'meu', 'minha',
  'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa', 'nossos', 'nossas', 'e', 'ou'
]);

/**
 * Remove stop words e caracteres especiais desnecessários de uma frase de busca.
 */
export function extractKeywords(query: string): string[] {
  if (!query) return [];
  const words = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos para tokenização
    .replace(/[^\w\s\-/]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * Extrai rotas HTTP e endpoints do texto (ex: POST /api/v1/pedidos, GET /winthor/pedidos)
 */
export function extractEndpoints(text: string): string[] {
  if (!text) return [];
  const endpointRegex = /(?:GET|POST|PUT|DELETE|PATCH)\s+[\/\w\-\.\{\}]+/gi;
  const matches = text.match(endpointRegex) || [];

  // Também procura por caminhos que começam com /api/ ou /winthor/ ou /v1/ sem verbo
  const pathRegex = /(?:^|\s)(\/(?:api|winthor|v\d+)[\/\w\-\.\{\}]+)/gi;
  let match: RegExpExecArray | null;
  const paths: string[] = [];
  while ((match = pathRegex.exec(text)) !== null) {
    if (match[1] && !matches.some(m => m.includes(match![1]))) {
      paths.push(match[1]);
    }
  }

  return Array.from(new Set([...matches, ...paths]));
}

/**
 * Extrai nomes prováveis de tabelas do banco de dados (ex: PCPEDC, PCPRODUT, PCCLIENT, tb_pedido)
 */
export function extractTables(text: string): string[] {
  if (!text) return [];
  // Padrões como PCPEDC, PCPRODUT ou tb_... ou t_...
  const tableRegex = /\b(?:PC[A-Z0-9]{3,8}|tb_[\w]+|t_[\w]+)\b/gi;
  const matches = text.match(tableRegex) || [];
  return Array.from(new Set(matches.map(m => m.toUpperCase())));
}

/**
 * Identifica nomes de microsserviços ou módulos (ex: winthor-pedido, servico-faturamento)
 */
export function extractServices(text: string): string[] {
  if (!text) return [];
  const serviceRegex = /\b[\w\-]+(?:-servico|-service|-api|-backend|-app|winthor-[\w\-]+)\b/gi;
  const matches = text.match(serviceRegex) || [];
  return Array.from(new Set(matches.map(m => m.toLowerCase())));
}

/**
 * Encontra o parágrafo ou trecho mais relevante de um documento contendo as palavras-chave.
 */
export function extractBestSnippet(content: string, query: string, maxLength: number = 320): string {
  if (!content) return '';

  const cleanContent = content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  const keywords = extractKeywords(query);

  if (keywords.length === 0) {
    return cleanContent.length > maxLength ? cleanContent.substring(0, maxLength) + '...' : cleanContent;
  }

  // Divide o texto em frases ou parágrafos
  const sentences = cleanContent.split(/(?<=[.!?\n])\s+/);

  let bestSentence = sentences[0] || cleanContent;
  let maxScore = -1;

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lowerSentence.includes(kw)) score += 1;
    }
    if (score > maxScore) {
      maxScore = score;
      bestSentence = sentence;
    }
  }

  if (bestSentence.length > maxLength) {
    return bestSentence.substring(0, maxLength) + '...';
  }
  return bestSentence;
}

/**
 * Executa a análise completa de um documento para exibição no chat
 */
export function analyzeDocument(content: string, title: string, query: string): TechnicalExtraction {
  const fullText = `${title}\n${content}`;
  return {
    endpoints: extractEndpoints(fullText),
    tables: extractTables(fullText),
    services: extractServices(fullText),
    bestSnippet: extractBestSnippet(content, query),
  };
}
