import type { KanbanCardData, KanbanPriority, KanbanStatus } from './types';

export const KANBAN_STATUS_LABELS: Record<KanbanStatus, string> = {
  todo: 'A Fazer',
  doing: 'Em Andamento',
  done: 'Concluído',
};

export const KANBAN_PRIORITY_LABELS: Record<KanbanPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const KANBAN_FILTERS = ['todas', 'urgentes', 'com-prazo', 'de-sessoes'] as const;
export type KanbanFilter = (typeof KANBAN_FILTERS)[number];

export const KANBAN_FILTER_LABELS: Record<KanbanFilter, string> = {
  todas: 'Todas',
  urgentes: 'Urgentes',
  'com-prazo': 'Com prazo',
  'de-sessoes': 'De sessões',
};

/** Urgente = urgência Alta ou Crítica. */
export function isUrgent(card: Pick<KanbanCardData, 'priority'>): boolean {
  return card.priority === 'alta' || card.priority === 'critica';
}

/** "De sessões" = a tarefa veio de uma cerimônia (tem link de origem). */
export function isFromSession(card: Pick<KanbanCardData, 'originLink'>): boolean {
  return !!card.originLink;
}

export function matchesKanbanFilter(card: KanbanCardData, filter: KanbanFilter): boolean {
  switch (filter) {
    case 'urgentes':
      return isUrgent(card);
    case 'com-prazo':
      return !!parseDueDate(card.dueDate);
    case 'de-sessoes':
      return isFromSession(card);
    default:
      return true;
  }
}

export function filterKanbanCards(cards: KanbanCardData[], filter: KanbanFilter): KanbanCardData[] {
  return filter === 'todas' ? cards : cards.filter((c) => matchesKanbanFilter(c, filter));
}

/**
 * O prazo é uma data digitada por pessoa (sem fuso): o servidor devolve "2026-10-17T00:00:00".
 * Só o dia importa; devolve "2026-10-17" ou null se vazio/ilegível.
 */
export function parseDueDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return null;
  return `${y}-${mo}-${d}`;
}

/** Formato aceito pelo servidor para o prazo (data local à meia-noite, sem fuso). */
export function dueDateToServer(dateOnly: string): string {
  return `${dateOnly}T00:00:00`;
}

function dayNumber(dateOnly: string): number {
  const [y, m, d] = dateOnly.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function todayOnly(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type DueTone = 'overdue' | 'soon' | 'normal';

export interface DueDescription {
  label: string;
  tone: DueTone;
}

/** "atrasada", "hoje", "amanhã" ou "18/10"; null sem prazo. Tarefa concluída nunca fica "atrasada". */
export function describeDue(value: string | null | undefined, opts: { now?: Date; done?: boolean } = {}): DueDescription | null {
  const day = parseDueDate(value);
  if (!day) return null;
  const now = opts.now ?? new Date();
  const diff = dayNumber(day) - dayNumber(todayOnly(now));
  const [, mo, d] = day.split('-');
  const short = `${d}/${mo}`;
  if (opts.done) return { label: short, tone: 'normal' };
  if (diff < 0) return { label: 'atrasada', tone: 'overdue' };
  if (diff === 0) return { label: 'hoje', tone: 'soon' };
  if (diff === 1) return { label: 'amanhã', tone: 'soon' };
  return { label: short, tone: 'normal' };
}

/** Prazo por extenso para o campo de leitura: "17/10/2026". */
export function formatDueFull(value: string | null | undefined): string {
  const day = parseDueDate(value);
  if (!day) return '';
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

/** Percentual de tarefas concluídas (0 sem tarefas). */
export function completionRate(cards: Pick<KanbanCardData, 'status'>[]): number {
  if (cards.length === 0) return 0;
  return Math.round((cards.filter((c) => c.status === 'done').length / cards.length) * 100);
}

export function countByStatus(cards: Pick<KanbanCardData, 'status'>[]): Record<KanbanStatus, number> {
  const out: Record<KanbanStatus, number> = { todo: 0, doing: 0, done: 0 };
  for (const c of cards) if (c.status in out) out[c.status] += 1;
  return out;
}
