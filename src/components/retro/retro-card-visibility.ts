import type { RetroCard } from '@/lib/types';

/**
 * Quando o card mostra o texto real. `card.hidden` vem do servidor (anonimato até revelar): enquanto for
 * verdadeiro não há texto para mostrar, mesmo que isCardsRevealed já tenha virado (o aviso de revelação
 * chega antes da recarga dos cards) — nesse intervalo fica o placeholder, nunca um card vazio.
 */
export function canShowCardContent(
  card: Pick<RetroCard, 'hidden'>,
  opts: { isCardsRevealed: boolean; isAuthor: boolean; isActionPlan: boolean },
): boolean {
  if (card.hidden) return false;
  return opts.isCardsRevealed || opts.isAuthor || opts.isActionPlan;
}
