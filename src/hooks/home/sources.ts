/**
 * ÚNICO arquivo da Home que fala com a API. Os hooks (`useHomeAnnouncements`, `useNotifications`,
 * `useLiveSessions`, `useRitualHistory`, `useMySquads`) só chamam as funções exportadas aqui e recebem
 * os tipos de `types.ts`. Quando o backend publicar o contrato novo (avisos com tipo/público/validade/
 * dispensa, central de notificações, endpoint único de sessões ao vivo, agregado da home), trocar a fonte
 * é editar APENAS este arquivo:
 *
 *   fetchAnnouncements      hoje: GET /api/public/announcements        -> trocar pelo endpoint novo de avisos
 *   dismissAnnouncement     hoje: localStorage por usuário             -> POST de dispensa no servidor
 *   fetchNotifications      hoje: sem endpoint (devolve null)          -> GET da central de notificações
 *   markNotificationsRead   hoje: localStorage por usuário             -> POST "marcar como lidas"
 *   fetchLiveSessions       hoje: 5 listas por squad, filtradas        -> GET do endpoint único de ao vivo
 *   fetchRitualHistory      hoje: as mesmas 5 listas por squad         -> endpoint de histórico (ou do agregado)
 *   fetchSquadSnapshot      hoje: GET /api/squads/{id} e /rollup       -> agregado da home
 *
 * Falha de rede, 403 ou 404 nunca derruba a tela: cada função devolve o estado vazio.
 */

import { publicApi } from '@/app/admin/api';
import { pokerApi } from '@/app/room/api';
import { retroApi } from '@/app/retro/api';
import { showcaseApi } from '@/app/showcase/api';
import { healthCheckApi } from '@/app/health-check/api';
import { brainstormingApi } from '@/app/brainstorming/api';
import { squadApi } from '@/app/squad/api';
import type { SquadConfig, SquadMetricsRollup } from '@/lib/types';
import {
  liveSessionsOf,
  mapBrainstormingBoard,
  mapHealthBoard,
  mapPokerRoom,
  mapRetroBoard,
  mapShowcaseSession,
  sortByRecent,
  toHomeAnnouncement,
  type RawAnnouncement,
} from './derive';
import {
  RITUAL_KEYS,
  type HomeAnnouncement,
  type HomeNotification,
  type RitualKey,
  type SquadRef,
  type ToolSession,
} from './types';

// ---------- armazenamento local (dispensa e leitura, por usuário) ----------

const dismissedKey = (userId: string) => `agileSpace_home_dismissed_${userId}`;
const readKey = (userId: string) => `agileSpace_home_read_${userId}`;

/** Quantos ids lembrar: o suficiente para os avisos recentes, sem crescer para sempre. */
const MAX_REMEMBERED_IDS = 200;

export function readIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function writeIdSet(key: string, ids: Iterable<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].slice(-MAX_REMEMBERED_IDS)));
  } catch {
    /* storage bloqueado: some só nesta sessão */
  }
}

export function loadDismissedAnnouncements(userId: string): Set<string> {
  return readIdSet(dismissedKey(userId));
}

export async function dismissAnnouncement(userId: string, id: string): Promise<void> {
  const ids = readIdSet(dismissedKey(userId));
  ids.add(id);
  writeIdSet(dismissedKey(userId), ids);
}

export function loadReadNotifications(userId: string): Set<string> {
  return readIdSet(readKey(userId));
}

export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  const current = readIdSet(readKey(userId));
  ids.forEach((id) => current.add(id));
  writeIdSet(readKey(userId), current);
}

// ---------- avisos e notificações ----------

const ANNOUNCEMENTS_TTL_MS = 30_000;
let announcementsCache: { at: number; promise: Promise<HomeAnnouncement[]> } | null = null;

async function loadAnnouncements(): Promise<HomeAnnouncement[]> {
  // publicApi já devolve [] em qualquer falha.
  const raw = (await publicApi.getAnnouncements()) as unknown as RawAnnouncement[];
  if (!Array.isArray(raw)) return [];
  return raw.map(toHomeAnnouncement).filter((a): a is HomeAnnouncement => a !== null);
}

/** O banner e o sino leem os mesmos avisos: um cache curto evita pedir duas vezes. */
export function fetchAnnouncements(now: Date = new Date()): Promise<HomeAnnouncement[]> {
  if (announcementsCache && now.getTime() - announcementsCache.at < ANNOUNCEMENTS_TTL_MS) return announcementsCache.promise;
  const promise = loadAnnouncements().catch(() => {
    announcementsCache = null;
    return [] as HomeAnnouncement[];
  });
  announcementsCache = { at: now.getTime(), promise };
  return promise;
}

export function clearAnnouncementsCache(): void {
  announcementsCache = null;
}

/**
 * Notificações "Para você" e "Mensagens". Ainda não existe endpoint: devolve null e a central mostra só os
 * avisos. Com o contrato novo, devolver aqui a lista já no formato de HomeNotification (sem os avisos, que
 * continuam vindo de fetchAnnouncements ou passam a vir junto, a critério do backend).
 */
export async function fetchNotifications(): Promise<HomeNotification[] | null> {
  return null;
}

// ---------- sessões dos rituais ----------

const TOOL_CACHE_TTL_MS = 15_000;
const toolCache = new Map<string, { at: number; promise: Promise<ToolSession[]> }>();

async function loadToolSessions(tool: RitualKey, squad: SquadRef, now: Date): Promise<ToolSession[]> {
  switch (tool) {
    case 'poker':
      return (await pokerApi.listRooms(squad.id)).map((r) => mapPokerRoom(r, squad, now));
    case 'retro':
      return (await retroApi.listBoards({ squadId: squad.id })).map((b) => mapRetroBoard(b, squad, now));
    case 'showcase':
      return (await showcaseApi.getSessions(squad.id, 15)).map((s) => mapShowcaseSession(s, squad, now));
    case 'health':
      return (await healthCheckApi.listBoards(squad.id)).map((b) => mapHealthBoard(b, squad, now));
    case 'brainstorming':
      return (await brainstormingApi.listBoards(squad.id)).map((b) => mapBrainstormingBoard(b, squad, now));
  }
}

/** Lista de um ritual numa squad, com cache curto: "ao vivo" e "histórico" pedem as mesmas listas. */
export function fetchToolSessions(tool: RitualKey, squad: SquadRef, now: Date = new Date()): Promise<ToolSession[]> {
  const key = `${tool}:${squad.id}`;
  const hit = toolCache.get(key);
  if (hit && now.getTime() - hit.at < TOOL_CACHE_TTL_MS) return hit.promise;
  const promise = loadToolSessions(tool, squad, now).catch((err) => {
    toolCache.delete(key);
    throw err;
  });
  toolCache.set(key, { at: now.getTime(), promise });
  return promise;
}

/** Limpa o cache (testes, ou depois de criar/encerrar uma sessão). */
export function clearToolSessionCache(): void {
  toolCache.clear();
}

async function fetchAllTools(squads: SquadRef[], now: Date): Promise<ToolSession[]> {
  const jobs = squads.flatMap((squad) => RITUAL_KEYS.map((tool) => fetchToolSessions(tool, squad, now)));
  const settled = await Promise.allSettled(jobs);
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

export async function fetchLiveSessions(squads: SquadRef[], now: Date = new Date()): Promise<ToolSession[]> {
  if (squads.length === 0) return [];
  return liveSessionsOf(await fetchAllTools(squads, now));
}

export async function fetchRitualHistory(
  squads: SquadRef[],
  now: Date = new Date(),
): Promise<Record<RitualKey, ToolSession[]>> {
  const empty: Record<RitualKey, ToolSession[]> = { poker: [], retro: [], showcase: [], health: [], brainstorming: [] };
  if (squads.length === 0) return empty;
  const all = await fetchAllTools(squads, now);
  for (const tool of RITUAL_KEYS) empty[tool] = sortByRecent(all.filter((s) => s.tool === tool));
  return empty;
}

// ---------- squads ----------

export interface SquadSnapshot {
  rollup: SquadMetricsRollup | null;
  config: SquadConfig | null;
}

const snapshotCache = new Map<string, { at: number; promise: Promise<SquadSnapshot> }>();
const SNAPSHOT_TTL_MS = 60_000;

export function fetchSquadSnapshot(squadId: string, now: Date = new Date()): Promise<SquadSnapshot> {
  const hit = snapshotCache.get(squadId);
  if (hit && now.getTime() - hit.at < SNAPSHOT_TTL_MS) return hit.promise;
  const promise = Promise.allSettled([squadApi.getRollup(squadId), squadApi.getSquad(squadId)]).then(([rollup, config]) => ({
    rollup: rollup.status === 'fulfilled' ? rollup.value : null,
    config: config.status === 'fulfilled' ? config.value : null,
  }));
  snapshotCache.set(squadId, { at: now.getTime(), promise });
  return promise;
}

export function clearSquadSnapshotCache(): void {
  snapshotCache.clear();
}
