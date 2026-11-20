/**
 * Conteúdo do Manual como dado: cada tópico é uma lista de blocos. O mesmo dado alimenta a página do tópico,
 * o sumário "Neste tópico", o tempo de leitura e a busca no texto (índice montado por `data/search.ts`).
 *
 * Texto dos blocos aceita marcação simples: **negrito**, `código` e [rótulo](/rota).
 */
export type ManualBlock =
  /** "Ideia central": o resumo do tópico em duas ou três frases. Um por tópico, sempre o primeiro. */
  | { kind: 'idea'; text: string }
  /** Título de seção. Entra no sumário lateral e reinicia a numeração dos passos. */
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  /** Passo numerado (a numeração recomeça a cada seção). */
  | { kind: 'step'; title: string; text: string }
  | { kind: 'li'; text: string }
  /** Aviso (âmbar): limite, cuidado ou algo que costuma surpreender. */
  | { kind: 'warn'; text: string }
  /** Pergunta comum, aberta e fechada pela pessoa. */
  | { kind: 'faq'; q: string; a: string }
  /** Trecho de código com botão de copiar. */
  | { kind: 'code'; lang: string; code: string }
  /** Linha de referência de API: método (ou "Escopo", "Ferramenta"), caminho/nome e uma frase. */
  | { kind: 'api'; label: string; path: string; text: string }
  /** Seção pronta de API REST e ferramentas MCP de um módulo (vem do catálogo de integrações). */
  | { kind: 'module-api'; moduleId: string };

export type ManualBlockKind = ManualBlock['kind'];
