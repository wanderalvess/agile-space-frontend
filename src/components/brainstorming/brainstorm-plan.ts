/**
 * Do Plano ao plano de ação (5W2H): quais ideias entram, como cada ação nasce e a trava de duplicidade
 * guardada neste navegador. A trava real (um plano por sessão) depende do servidor; aqui ela só avisa.
 */
import { getQuadrant, votesOf } from '@/lib/brainstorming-utils';
import type { ActionPlanTask, BrainstormingGroup, BrainstormingIdea } from '@/lib/types';
import { sortByVotes } from './brainstorm-room-logic';

/** Quantas ideias entram marcadas por padrão (as mais votadas, sem as descartadas). */
export const PLAN_DEFAULT_COUNT = 5;

export function planTitle(boardTitle: string | undefined): string {
  return `Plano de Ação: ${(boardTitle ?? '').trim() || 'Brainstorming'}`;
}

/** Ideias que podem virar ação: as que o servidor revelou e que a Matriz não descartou, mais votadas primeiro. */
export function planCandidates(ideas: readonly BrainstormingIdea[]): BrainstormingIdea[] {
  return sortByVotes(ideas.filter((idea) => !idea.hidden && getQuadrant(idea.qualifiers) !== 'discard'));
}

/** Ids marcados no início: as `count` primeiras candidatas. */
export function defaultPlanSelection(candidates: readonly Pick<BrainstormingIdea, 'id'>[], count: number = PLAN_DEFAULT_COUNT): string[] {
  return candidates.slice(0, count).map((c) => c.id);
}

export function planWhy(idea: Pick<BrainstormingIdea, 'votes'>): string {
  const votes = votesOf(idea).length;
  return `Ideia priorizada no Brainstorming, ${votes} ${votes === 1 ? 'voto' : 'votos'}`;
}

/** "Esforço baixo" ou "Esforço alto" quando a Matriz já decidiu; vazio enquanto a ideia está a classificar. */
export function planEffort(idea: Pick<BrainstormingIdea, 'qualifiers'>): string {
  const effort = idea.qualifiers?.effort;
  if (effort === undefined || effort === null || effort === 50) return '';
  return effort > 50 ? 'Esforço alto' : 'Esforço baixo';
}

/** A ação 5W2H de uma ideia: quem, quando e como ficam em branco para a squad preencher. */
export function buildPlanTask(idea: BrainstormingIdea, group: Pick<BrainstormingGroup, 'title'> | undefined, order: number): Partial<ActionPlanTask> {
  return {
    what: idea.content,
    why: planWhy(idea),
    where: group?.title || 'Squad',
    when: '',
    who: '',
    how: '',
    howMuch: planEffort(idea),
    status: 'todo',
    order,
  };
}

// ───────────────────────── Trava local de duplicidade ─────────────────────────

export interface PlanLock {
  planId: string;
  title: string;
  createdAt: string;
}

export const planLockKey = (boardId: string) => `agile_brainstorming_plan_${boardId}`;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/** Plano já criado a partir desta sessão neste navegador, ou `null` (storage indisponível também dá `null`). */
export function readPlanLock(storage: ReadableStorage | undefined, boardId: string): PlanLock | null {
  try {
    const raw = storage?.getItem(planLockKey(boardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlanLock>;
    if (typeof parsed.planId !== 'string' || !parsed.planId) return null;
    return { planId: parsed.planId, title: typeof parsed.title === 'string' ? parsed.title : '', createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : '' };
  } catch {
    return null;
  }
}

export function writePlanLock(storage: WritableStorage | undefined, boardId: string, lock: PlanLock): void {
  try {
    storage?.setItem(planLockKey(boardId), JSON.stringify(lock));
  } catch {
    /* sem storage: a trava só vale nesta visita */
  }
}
