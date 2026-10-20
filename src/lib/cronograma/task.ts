/**
 * Issue do Jira já "lida" para o Cronograma: datas viram `Stamp`, números nunca são undefined.
 * A regra de negócio (de onde vêm as datas, o que é real ou aproximado) fica no backend; aqui só se lê.
 */
import type { SquadIssueSnapshot } from '@/lib/types';
import { parseStamp, type Stamp } from './dates';

export type StatusCategory = 'new' | 'indeterminate' | 'done' | 'unknown';

export interface CronoTask {
  key: string;
  title: string;
  type: string;
  status: string;
  statusCategory: StatusCategory;
  assigneeId: string;
  assigneeName: string;
  parentKey: string;
  parentTitle: string;
  /** Posição na lista recebida (ordem de rank do Jira), desempate entre irmãos. */
  orderIndex: number;
  estimateSec: number;
  remainingSec: number;
  isBug: boolean;
  start: Stamp | null;
  end: Stamp | null;
  /** true quando início e fim NÃO vêm de campos de data reais do Jira (fica true se o backend não informou). */
  datesAreInferred: boolean;
  resolvedAt: Stamp | null;
  sprintName: string;
}

export function toCronoTask(s: SquadIssueSnapshot, index: number): CronoTask {
  const key = s.jiraKey || s.key;
  const start = parseStamp(s.targetStart || s.dueDate);
  const end = parseStamp(s.targetEnd || s.dueDate);
  return {
    key,
    title: s.title || '',
    type: s.type || '',
    status: s.status || '',
    statusCategory: s.statusCategory ?? 'unknown',
    assigneeId: s.assigneeId || '',
    assigneeName: s.assigneeName || '',
    parentKey: s.parentKey || '',
    parentTitle: s.parentTitle || '',
    orderIndex: s.orderIndex ?? index,
    estimateSec: s.estimateSec || 0,
    remainingSec: s.remainingSec || 0,
    isBug: !!s.isBug,
    start,
    end,
    datesAreInferred: s.datesAreInferred !== false,
    resolvedAt: parseStamp(s.resolutionDate),
    sprintName: s.sprintName || '',
  };
}

/** Datas reais do Jira: o backend confirmou a origem e há início e fim. */
export function hasRealDates(t: CronoTask): boolean {
  return !t.datesAreInferred && t.start !== null && t.end !== null;
}

export const isDone = (t: CronoTask): boolean => t.statusCategory === 'done';
export const isInProgress = (t: CronoTask): boolean => t.statusCategory === 'indeterminate';

export function personKeyOf(t: CronoTask): string | null {
  return t.assigneeId || t.assigneeName || null;
}

// ---------- Progresso ----------

export function computeTaskProgress(t: Pick<CronoTask, 'status' | 'statusCategory'> & { progressPercent?: number }): number {
  if (t.progressPercent !== undefined && t.progressPercent !== null) return Math.round(t.progressPercent);
  const norm = (t.status || '').toUpperCase();
  if (t.statusCategory === 'done' || norm === 'CONCLUÍDO' || norm === 'DONE' || norm === 'CLOSED') return 100;
  if (norm === 'CODE REVIEW CONCLUÍDO' || norm === 'EM TESTE DE ACEITAÇÃO' || norm === 'EM CODE REVIEW') return 75;
  if (norm === 'EM ANDAMENTO' || norm === 'IN PROGRESS' || norm === 'EM DESENVOLVIMENTO') return 50;
  return 0;
}

export function computeParentProgress(
  parent: Pick<CronoTask, 'status' | 'statusCategory'> & { progressPercent?: number },
  children: Pick<CronoTask, 'status' | 'statusCategory'>[],
): number {
  if (parent.progressPercent !== undefined && parent.progressPercent > 0) return Math.round(parent.progressPercent);
  if (children.length === 0) return computeTaskProgress(parent);
  const total = children.reduce((acc, c) => acc + computeTaskProgress(c), 0);
  return Math.round(total / children.length);
}
