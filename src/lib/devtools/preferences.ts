import { getDevTool } from './registry';

/**
 * Favoritas e recentes do DevTools: guardadas por usuário neste navegador (localStorage).
 * Toda leitura e escrita é protegida: em janela privada ou com dados bloqueados o DevTools
 * continua funcionando, só sem lembrar.
 */

export const MAX_RECENTS = 8;
/** Quantos recentes aparecem na seção do topo da aba "Todas". */
export const RECENTS_ON_TOP = 4;

export interface RecentEntry {
  id: string;
  /** Instante da abertura (ms desde 1970). */
  at: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export const favoritesKey = (userId: string) => `agile-devtools:fav:${userId || 'anon'}`;
export const recentsKey = (userId: string) => `agile-devtools:recent:${userId || 'anon'}`;

function readJson(key: string, storage?: StorageLike | null): unknown {
  try {
    const s = storage === undefined ? defaultStorage() : storage;
    const raw = s?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown, storage?: StorageLike | null): boolean {
  try {
    const s = storage === undefined ? defaultStorage() : storage;
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const known = (id: unknown): id is string => typeof id === 'string' && !!getDevTool(id);

export function readFavorites(userId: string, storage?: StorageLike | null): string[] {
  const data = readJson(favoritesKey(userId), storage);
  if (!Array.isArray(data)) return [];
  return [...new Set(data.filter(known))];
}

export function writeFavorites(userId: string, ids: string[], storage?: StorageLike | null): boolean {
  return writeJson(favoritesKey(userId), ids, storage);
}

/** Devolve a nova lista (adiciona no fim, ou tira se já estava). */
export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function readRecents(userId: string, storage?: StorageLike | null): RecentEntry[] {
  const data = readJson(recentsKey(userId), storage);
  if (!Array.isArray(data)) return [];
  const out: RecentEntry[] = [];
  for (const item of data) {
    if (item && typeof item === 'object' && known((item as RecentEntry).id) && Number.isFinite((item as RecentEntry).at)) {
      if (!out.some((r) => r.id === (item as RecentEntry).id)) out.push({ id: (item as RecentEntry).id, at: (item as RecentEntry).at });
    }
  }
  return out.slice(0, MAX_RECENTS);
}

/** Põe a ferramenta no topo dos recentes (sem repetir) e corta no limite. */
export function withRecent(list: RecentEntry[], id: string, at: number): RecentEntry[] {
  return [{ id, at }, ...list.filter((r) => r.id !== id)].slice(0, MAX_RECENTS);
}

export function writeRecents(userId: string, list: RecentEntry[], storage?: StorageLike | null): boolean {
  return writeJson(recentsKey(userId), list, storage);
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const two = (n: number) => String(n).padStart(2, '0');

/** "hoje, 09:12", "ontem", "há 3 dias" — para o rodapé dos cartões de recentes. */
export function relativeWhen(at: number, now: number): string {
  const a = new Date(at);
  const n = new Date(now);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(n) - startOf(a)) / DAY);
  if (days <= 0) return `hoje, ${two(a.getHours())}:${two(a.getMinutes())}`;
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}
