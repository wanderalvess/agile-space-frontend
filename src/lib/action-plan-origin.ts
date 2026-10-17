/**
 * Origem e prazo do Plano de ação, sem React: de onde o plano nasceu (Retro, Radar de clima, Brainstorming, Review
 * ou à mão), a trava contra plano repetido, as contagens da lista e o prazo ("Quando") como data de verdade.
 * Contrato do servidor: `agile-space-backend/docs/action-plan-origin-api.md` (migração V78).
 *
 * O front funciona também contra o backend ANTIGO (sem V78): todos os campos novos são opcionais, e a ausência de
 * `sourceType` no plano é o sinal de "este servidor não conhece origem" (ver `hasOriginContract`).
 */

import { CeremonyApiError } from '@/lib/ceremony-api';
import type { ActionPlanBoard, ActionPlanTask, PlanSourceType } from '@/lib/types';

// ---------------------------------------------------------------------------------------------------------------
// Origem
// ---------------------------------------------------------------------------------------------------------------

export const SOURCE_TYPES: readonly PlanSourceType[] = ['RETRO', 'HEALTH_CHECK', 'BRAINSTORMING', 'SHOWCASE', 'MANUAL'];

/** Nome da origem na tela. `SHOWCASE` é a cerimônia que a tela chama de Review. */
export const SOURCE_LABEL: Record<PlanSourceType, string> = {
  MANUAL: 'Manual',
  RETRO: 'Retro',
  HEALTH_CHECK: 'Radar de clima',
  BRAINSTORMING: 'Brainstorming',
  SHOWCASE: 'Review',
};

const SOURCE_ROUTE: Record<Exclude<PlanSourceType, 'MANUAL'>, string> = {
  RETRO: '/retro',
  HEALTH_CHECK: '/health-check',
  BRAINSTORMING: '/brainstorming',
  SHOWCASE: '/showcase',
};

/** Lê um tipo de origem do servidor (aceita minúsculas); valor ausente dá `undefined`, valor estranho vira `MANUAL`. */
export function normalizeSourceType(value: unknown): PlanSourceType | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const key = String(value).trim().toUpperCase();
  return (SOURCE_TYPES as readonly string[]).includes(key) ? (key as PlanSourceType) : 'MANUAL';
}

/** O servidor conhece origem? (O backend novo devolve `sourceType` em todo plano, "MANUAL" nos antigos.) */
export function hasOriginContract(board: Pick<ActionPlanBoard, 'sourceType'> | null | undefined): boolean {
  return normalizeSourceType(board?.sourceType) !== undefined;
}

/** Rota da sessão que originou o plano; `null` para plano manual. */
export function sourceRoute(type: PlanSourceType | undefined, id: string | null | undefined): string | null {
  if (!type || type === 'MANUAL' || !id) return null;
  return `${SOURCE_ROUTE[type]}/${encodeURIComponent(id)}`;
}

export interface BoardOrigin {
  type: Exclude<PlanSourceType, 'MANUAL'>;
  /** "Retro", "Radar de clima"... */
  label: string;
  /** Título da sessão de origem (pode vir vazio). */
  title: string;
  /** Rota da sessão (null se faltar o id). */
  href: string | null;
}

/** Origem a mostrar no plano; `null` quando é manual, antigo ou o servidor não conhece origem. */
export function boardOrigin(board: Pick<ActionPlanBoard, 'sourceType' | 'sourceId' | 'sourceTitle'> | null | undefined): BoardOrigin | null {
  const type = normalizeSourceType(board?.sourceType);
  if (!board || !type || type === 'MANUAL') return null;
  return { type, label: SOURCE_LABEL[type], title: (board.sourceTitle ?? '').trim(), href: sourceRoute(type, board.sourceId) };
}

/** Rótulo curto da origem para a tabela: "Manual" quando o servidor conhece origem e o plano é manual; `''` quando não sabe. */
export function originChipLabel(board: Pick<ActionPlanBoard, 'sourceType'>): string {
  const type = normalizeSourceType(board.sourceType);
  return type ? SOURCE_LABEL[type] : '';
}

// ---------------------------------------------------------------------------------------------------------------
// Trava contra plano repetido
// ---------------------------------------------------------------------------------------------------------------

/** Erro 409 da criação: já existe plano desta origem na squad. `existingPlanId` falta se o plano for privado. */
export class PlanSourceConflictError extends CeremonyApiError {
  existingPlanId?: string;
  constructor(message: string, existingPlanId?: string) {
    super(message, 409);
    this.name = 'PlanSourceConflictError';
    this.existingPlanId = existingPlanId;
  }
}

/** O erro é o 409 de origem repetida? Devolve o que o servidor contou, ou `null` para qualquer outro erro. */
export function conflictOf(err: unknown): { existingPlanId?: string; message: string } | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { status?: unknown; existingPlanId?: unknown; message?: unknown };
  if (e.status !== 409) return null;
  return {
    existingPlanId: typeof e.existingPlanId === 'string' && e.existingPlanId ? e.existingPlanId : undefined,
    message: typeof e.message === 'string' ? e.message : '',
  };
}

/** O plano da lista que veio desta sessão. Filtra aqui também: um backend antigo ignora o filtro e devolve tudo. */
export function findPlanBySource<T extends Pick<ActionPlanBoard, 'sourceType' | 'sourceId'>>(
  list: readonly T[],
  type: PlanSourceType,
  sourceId: string,
): T | undefined {
  const wanted = sourceId.trim();
  if (!wanted) return undefined;
  return list.find((b) => normalizeSourceType(b.sourceType) === type && (b.sourceId ?? '').trim() === wanted);
}

export interface KnownPlan {
  id: string;
  title: string;
}

/**
 * Resultado da consulta "esta sessão já gerou plano?":
 * - `server`: o servidor confirmou. Trava de verdade: não se oferece criar outro.
 * - `local`: só o aviso guardado neste navegador (servidor antigo ou fora do ar). Avisa e pede confirmação.
 * - `none`: nada impede; `stale` indica que o aviso local apontava para um plano que não existe mais.
 */
export type OriginCheck =
  | { kind: 'server'; plan: KnownPlan }
  | { kind: 'local'; plan: KnownPlan }
  | { kind: 'none'; stale: boolean };

export interface OriginCheckInput {
  type: PlanSourceType;
  sourceId: string;
  /** Consulta `?squadId=&sourceType=&sourceId=`. */
  find: () => Promise<readonly ActionPlanBoard[]>;
  /** Lê um plano pelo id (só usado para conferir um aviso local). */
  getBoard?: (id: string) => Promise<ActionPlanBoard>;
  /** O aviso guardado neste navegador, se houver. */
  lock?: KnownPlan | null;
}

/**
 * Decide se a sessão já tem plano. O servidor manda: achou o plano, é trava real. Sem achar, o aviso local só vale
 * como reserva quando o servidor não garante a trava: backend antigo (o plano do aviso volta sem `sourceType`) ou
 * consulta com falha. Se o plano do aviso foi apagado (404), o aviso está velho e some.
 */
export async function checkOrigin(input: OriginCheckInput): Promise<OriginCheck> {
  const { type, sourceId, lock } = input;
  const local = (): OriginCheck => (lock ? { kind: 'local', plan: lock } : { kind: 'none', stale: false });
  let list: readonly ActionPlanBoard[];
  try {
    list = await input.find();
  } catch {
    return local();
  }
  const found = findPlanBySource(list, type, sourceId);
  if (found) return { kind: 'server', plan: { id: found.id, title: found.title } };
  if (!lock) return { kind: 'none', stale: false };
  if (!input.getBoard) return local();
  try {
    const board = await input.getBoard(lock.id);
    // backend novo e o plano do aviso não é desta origem: o aviso não vale
    return hasOriginContract(board) ? { kind: 'none', stale: true } : local();
  } catch (e) {
    return (e as { status?: unknown })?.status === 404 ? { kind: 'none', stale: true } : local();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Contagens da lista
// ---------------------------------------------------------------------------------------------------------------

export interface PlanCounts {
  total: number;
  done: number;
  open: number;
  /** Concluídas sobre o total, em % arredondado (0 sem ações). */
  pct: number;
}

/** Contagens que o servidor manda na lista; `null` no backend antigo (ou em GET por id, que não traz). */
export function planCounts(board: Pick<ActionPlanBoard, 'tasksTotal' | 'tasksDone'>): PlanCounts | null {
  if (typeof board.tasksTotal !== 'number' || !Number.isFinite(board.tasksTotal)) return null;
  const total = Math.max(0, board.tasksTotal);
  const done = Math.min(total, Math.max(0, typeof board.tasksDone === 'number' ? board.tasksDone : 0));
  return { total, done, open: total - done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export type ProgressFilter = 'all' | 'open' | 'done';

/** "Com ações abertas" = ainda há ação não concluída; "Concluídos" = tem ações e todas estão concluídas. */
export function matchesProgress(counts: PlanCounts | null, filter: ProgressFilter): boolean {
  if (filter === 'all') return true;
  if (!counts) return false;
  return filter === 'open' ? counts.open > 0 : counts.total > 0 && counts.open === 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Prazo (dueDate)
// ---------------------------------------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Data de hoje no fuso do navegador, `yyyy-MM-dd`. */
export function todayIso(now: number | Date = Date.now()): string {
  const d = typeof now === 'number' ? new Date(now) : now;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `yyyy-MM-dd` válido (rejeita 2026-02-30) ou `''`. Aceita sufixo de hora, que é descartado. */
export function normalizeDueDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const m = ISO_DATE.exec(value.trim());
  if (!m) return '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  const valid = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
  return valid ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

export function dueDateOf(task: Pick<ActionPlanTask, 'dueDate'>): string {
  return normalizeDueDate(task.dueDate);
}

/** "25/10/2026" a partir de `2026-10-25`; vazio se não for data. */
export function formatDueDate(value: unknown): string {
  const iso = normalizeDueDate(value);
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}

/** Prazo vencido e ação ainda não concluída. Concluída nunca está atrasada. */
export function isOverdue(task: Pick<ActionPlanTask, 'dueDate' | 'status'>, now: number | Date = Date.now()): boolean {
  const due = dueDateOf(task);
  if (!due) return false;
  if (String(task.status ?? '').trim().toLowerCase() === 'done') return false;
  return due < todayIso(now);
}

export type DueFilter = 'all' | 'overdue' | 'with' | 'without';

export const DUE_FILTER_OPTIONS: readonly { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'Todos os prazos' },
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'with', label: 'Com prazo' },
  { value: 'without', label: 'Sem prazo' },
];

export function matchesDueFilter(task: Pick<ActionPlanTask, 'dueDate' | 'status'>, filter: DueFilter, now: number | Date = Date.now()): boolean {
  switch (filter) {
    case 'overdue':
      return isOverdue(task, now);
    case 'with':
      return dueDateOf(task) !== '';
    case 'without':
      return dueDateOf(task) === '';
    default:
      return true;
  }
}

export type TaskSort = 'plan' | 'due';

/** Ordena pelo prazo mais próximo; sem prazo vai para o fim. Estável: empate mantém a ordem do plano. */
export function sortByDue<T extends Pick<ActionPlanTask, 'dueDate'>>(tasks: readonly T[]): T[] {
  return tasks
    .map((t, i) => ({ t, i, due: dueDateOf(t) }))
    .sort((a, b) => {
      if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : a.i - b.i;
      if (a.due) return -1;
      if (b.due) return 1;
      return a.i - b.i;
    })
    .map((x) => x.t);
}
