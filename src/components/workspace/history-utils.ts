import { deriveSessionStatus, sessionStatusChip, TOOL_LABELS, type SessionStatusChip } from '@/lib/session-status';
import type { HistoryItem } from './types';

export type HistoryType = HistoryItem['type'];

export const HISTORY_FILTERS = ['todos', 'poker', 'retro', 'health'] as const;
export type HistoryFilter = (typeof HISTORY_FILTERS)[number];

export const HISTORY_FILTER_LABELS: Record<HistoryFilter, string> = {
  todos: 'Tudo',
  poker: 'Poker',
  retro: 'Retro',
  health: 'Radar',
};

/** Nome do ritual como aparece no portal (mesmos rótulos de `TOOL_LABELS`). */
export const HISTORY_TYPE_LABELS: Record<HistoryType, string> = {
  poker: TOOL_LABELS.POKER,
  retro: TOOL_LABELS.RETRO,
  health: TOOL_LABELS.HEALTH_CHECK,
};

/** Rota da sala de cada ritual. */
export function historyRoomUrl(type: HistoryType, roomId: string): string {
  const base = type === 'poker' ? '/room/' : type === 'retro' ? '/retro/' : '/health-check/';
  return base + roomId;
}

export interface RawSession {
  id: string;
  createdAt?: unknown;
  participantIds?: string[];
  creatorId?: string;
  [key: string]: unknown;
}

/** Fica só com as sessões em que a pessoa participou ou que ela criou. */
export function onlyMine<T extends RawSession>(list: T[] | null | undefined, userId: string): T[] {
  return (list || []).filter((r) => !!userId && (r.participantIds?.includes(userId) || r.creatorId === userId));
}

function createdTime(value: unknown): number {
  if (typeof value === 'string') {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  const maybe = (value as { toDate?: () => Date } | null)?.toDate?.();
  return maybe ? maybe.getTime() : 0;
}

/** Junta as três listas, da mais nova para a mais antiga. */
export function mergeHistory(poker: RawSession[], retro: RawSession[], health: RawSession[]): HistoryItem[] {
  const all = [
    ...poker.map((r) => ({ ...r, type: 'poker' as const, roomId: r.id })),
    ...retro.map((r) => ({ ...r, type: 'retro' as const, roomId: r.id })),
    ...health.map((r) => ({ ...r, type: 'health' as const, roomId: r.id })),
  ] as unknown as HistoryItem[];
  return all.sort((a, b) => createdTime(b.createdAt) - createdTime(a.createdAt));
}

export function filterHistory(items: HistoryItem[], filter: HistoryFilter): HistoryItem[] {
  return filter === 'todos' ? items : items.filter((i) => i.type === filter);
}

/** Estado da sessão: Ao vivo, Assíncrona, Planejando ou Concluída. */
export function historyStatusChip(item: HistoryItem): SessionStatusChip {
  return sessionStatusChip(deriveSessionStatus(item.type, item as never));
}

/** Data de criação legível (pt-BR) ou string vazia. */
export function historyDate(value: unknown, withTime = false): string {
  const t = createdTime(value);
  if (!t) return '';
  const d = new Date(t);
  return withTime
    ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR');
}

/** Squads diferentes na lista (a etiqueta de squad só vale a pena quando elas se misturam). */
export function distinctTeams(items: HistoryItem[]): string[] {
  return Array.from(new Set(items.map((i) => (i.team || '').trim()).filter(Boolean)));
}
