import type { BrainstormingGroup, BrainstormingIdea } from './types';

export type Quadrant = 'unclassified' | 'quick_wins' | 'strategic' | 'secondary' | 'discard';

/**
 * Quadrante da ideia na matriz ROI x esforço. Única fonte para a fase "Matriz" e para o "Plano" (as duas
 * telas divergiam: uma ideia devolvida a "A Classificar" 50/50 aparecia como Quick Win no Plano).
 * Sem qualificadores (ou 50/50) = ainda não classificada.
 */
export function getQuadrant(qualifiers?: { roi?: number; effort?: number } | null): Quadrant {
  const roi = qualifiers?.roi ?? 50;
  const effort = qualifiers?.effort ?? 50;
  if (roi === 50 && effort === 50) return 'unclassified';
  if (roi > 50 && effort <= 50) return 'quick_wins';
  if (roi > 50 && effort > 50) return 'strategic';
  if (roi <= 50 && effort <= 50) return 'secondary';
  return 'discard';
}

/** Insere ou substitui pelo id, mantendo a ordem. */
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx < 0) return [...list, item];
  const copy = [...list];
  copy[idx] = item;
  return copy;
}

/** Ideia apagada: some da lista e as ligadas a ela perdem só a ligação (como no servidor). */
export function applyIdeaDeleted(ideas: BrainstormingIdea[], ideaId: string): BrainstormingIdea[] {
  return ideas
    .filter(i => i.id !== ideaId)
    .map(i => (i.parentId === ideaId ? { ...i, parentId: null } : i));
}

/** Grupo apagado: some da lista e as ideias dele voltam para "Sem grupo". */
export function applyGroupDeleted(
  groups: BrainstormingGroup[],
  ideas: BrainstormingIdea[],
  groupId: string,
): { groups: BrainstormingGroup[]; ideas: BrainstormingIdea[] } {
  return {
    groups: groups.filter(g => g.id !== groupId),
    ideas: ideas.map(i => (i.groupId === groupId ? { ...i, groupId: null } : i)),
  };
}

/** Votos da ideia como lista de ids (o servidor devolve array JSON; tolera ausência). */
export function votesOf(idea: Pick<BrainstormingIdea, 'votes'>): string[] {
  return Array.isArray(idea.votes) ? idea.votes : [];
}

/** Chave que muda quando algo visível da ideia muda (posição, texto, ligação, votos): dispara a re-sincronização da teia. */
export function ideaSignature(ideas: BrainstormingIdea[]): string {
  return ideas
    .map(i => [i.id, i.parentId ?? '', i.groupId ?? '', i.position?.x ?? '', i.position?.y ?? '', i.content, votesOf(i).join(',')].join('|'))
    .join('\n');
}
