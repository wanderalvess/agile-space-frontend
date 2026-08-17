import type { PromptItem } from './types';

/**
 * Detecção de itens parecidos na hora de publicar.
 *
 * O objetivo é evitar que a biblioteca vire depósito de cinco versões do mesmo
 * prompt. É um alerta, nunca um bloqueio: duplicata proposital existe (uma
 * variação para outra squad, por exemplo) e quem publica decide.
 */

export interface SimilarPrompt {
  item: PromptItem;
  /** 0 a 1. */
  score: number;
  /** O que disparou o alerta, para a mensagem ser específica. */
  reason: 'titulo-identico' | 'conteudo-identico' | 'titulo-parecido';
}

/** Palavras curtas e conectivos não ajudam a distinguir um item do outro. */
const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'por', 'com', 'sem', 'em', 'no', 'na',
  'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'que', 'como', 'the', 'and', 'for'
]);

const SIMILAR_THRESHOLD = 0.5;
const MAX_RESULTS = 3;

/** Minúsculas, sem acento e sem pontuação — "Revisão de PR" e "revisao de pr" são o mesmo. */
export const normalize = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Mínimo de 2 letras: neste acervo, siglas como PR, PO, QA, UX e IA são
// exatamente o que separa um item do outro.
const tokenize = (value: string): Set<string> =>
  new Set(
    normalize(value)
      .split(' ')
      .filter(word => word.length >= 2 && !STOPWORDS.has(word))
  );

/** Coeficiente de Dice: 2×interseção / soma dos tamanhos. */
export const similarity = (a: string, b: string): number => {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  tokensA.forEach(token => {
    if (tokensB.has(token)) shared += 1;
  });

  return (2 * shared) / (tokensA.size + tokensB.size);
};

export function findSimilarPrompts(
  title: string | undefined,
  content: string | undefined,
  items: PromptItem[],
  excludeId?: string
): SimilarPrompt[] {
  const normalizedTitle = normalize(title);
  const normalizedContent = normalize(content);

  if (!normalizedTitle && !normalizedContent) return [];

  const matches: SimilarPrompt[] = [];

  for (const item of items) {
    if (excludeId && item.id === excludeId) continue;

    const itemTitle = normalize(item.title);
    const itemContent = normalize(item.content);

    if (normalizedTitle && itemTitle && itemTitle === normalizedTitle) {
      matches.push({ item, score: 1, reason: 'titulo-identico' });
      continue;
    }

    // Conteúdo igual com título diferente é o caso mais traiçoeiro: passa
    // despercebido na busca por título e duplica de fato.
    if (normalizedContent && itemContent && itemContent === normalizedContent) {
      matches.push({ item, score: 1, reason: 'conteudo-identico' });
      continue;
    }

    if (normalizedTitle && itemTitle) {
      const score = similarity(normalizedTitle, itemTitle);
      if (score >= SIMILAR_THRESHOLD) {
        matches.push({ item, score, reason: 'titulo-parecido' });
      }
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
}
