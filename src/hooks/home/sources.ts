/**
 * ÚNICO arquivo da Home que fala com a API. Os hooks só chamam as funções exportadas aqui e recebem os tipos
 * de `types.ts`; a tradução do contrato do backend está em `contract.ts`.
 *
 * Cada função tenta primeiro o endpoint do backend novo (docs/home-api.md do agile-space-backend) e, se o
 * servidor responder 404 (versão sem o endpoint), cai no comportamento anterior. O 404 fica lembrado até
 * recarregar a página, para não repetir a tentativa a cada atualização.
 *
 *   fetchAnnouncements        GET  /api/announcements/active            | legado: GET /api/public/announcements
 *   dismissAnnouncement       POST /api/announcements/{id}/dismiss      | legado: localStorage
 *   fetchNotifications        GET  /api/notifications?category=FOR_YOU|ANNOUNCEMENTS e /unread-count | legado: null
 *   markNotificationsRead     POST /api/notifications/read-all          | legado: localStorage
 *   fetchConversations        GET  /api/conversations                   | legado: null (sem mensagens)
 *   fetchContacts             GET  /api/conversations/contacts
 *   openConversation          POST /api/conversations
 *   fetchMessages             GET  /api/conversations/{id}/messages
 *   sendMessage               POST /api/conversations/{id}/messages
 *   markConversationRead      POST /api/conversations/{id}/read
 *   fetchLiveSessions         GET  /api/live-sessions[?squadId=]        | legado: 5 listas por squad, filtradas
 *   fetchRitualHistory        GET  /api/rituals/{tool}/history          | legado: as mesmas 5 listas por squad
 *   fetchSquadInfos           GET  /api/home                            | legado: /api/squads/{id}/rollup e /squads/{id}
 *
 * Falha de rede, 403 ou outro erro nunca derruba a tela: os hooks recebem o estado vazio.
 */

import { publicApi } from '@/app/admin/api';
import { pokerApi } from '@/app/room/api';
import { retroApi } from '@/app/retro/api';
import { showcaseApi } from '@/app/showcase/api';
import { healthCheckApi } from '@/app/health-check/api';
import { brainstormingApi } from '@/app/brainstorming/api';
import { squadApi } from '@/app/squad/api';
import { authFetch } from '@/lib/auth-client';
import type { SquadConfig, SquadMetricsRollup } from '@/lib/types';
import {
  buildNotificationFeed,
  HISTORY_SEGMENT,
  mapContact,
  mapConversationDto,
  mapLiveSessionDto,
  mapMessageDto,
  mapRitualSessionDto,
  mapSquadSummaryDto,
  normalizeOutgoingMessage,
  serverNotificationId,
  type ConversationDto,
  type HomeDto,
  type LiveSessionDto,
  type MessageDto,
  type NotificationDto,
  type RitualSessionDto,
  type UnreadCountDto,
  type UserRefDto,
} from './contract';
import {
  liveSessionsOf,
  mapBrainstormingBoard,
  mapHealthBoard,
  mapPokerRoom,
  mapRetroBoard,
  mapShowcaseSession,
  sortByRecent,
  sprintProgress,
  toHomeAnnouncement,
  upcomingCeremonies,
  type RawAnnouncement,
} from './derive';
import {
  RITUAL_KEYS,
  type ChatMessage,
  type Contact,
  type Conversation,
  type HomeAnnouncement,
  type NotificationFeed,
  type RitualKey,
  type SquadInfo,
  type SquadRef,
  type ToolSession,
} from './types';

// ---------- HTTP e detecção de endpoint ausente ----------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export class HomeHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HomeHttpError';
  }
}

async function http<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const json = await res.json();
      if (typeof json?.message === 'string' && json.message) message = json.message;
    } catch {
      /* corpo sem JSON */
    }
    throw new HomeHttpError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Endpoints do contrato novo que o servidor respondeu 404 (versão antiga): não tenta de novo. */
const missingEndpoints = new Set<string>();

type Attempt<T> = { ok: true; value: T } | { ok: false };

async function viaContract<T>(key: string, run: () => Promise<T>): Promise<Attempt<T>> {
  if (missingEndpoints.has(key)) return { ok: false };
  try {
    return { ok: true, value: await run() };
  } catch (err) {
    if (err instanceof HomeHttpError && err.status === 404) {
      missingEndpoints.add(key);
      return { ok: false };
    }
    throw err;
  }
}

/** Esquece os endpoints marcados como ausentes (testes). */
export function clearContractCache(): void {
  missingEndpoints.clear();
}

const enc = encodeURIComponent;

// ---------- armazenamento local (legado: dispensa e leitura, por usuário) ----------

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

export function loadReadNotifications(userId: string): Set<string> {
  return readIdSet(readKey(userId));
}

// ---------- avisos ----------

const ANNOUNCEMENTS_TTL_MS = 30_000;
let announcementsCache: { at: number; promise: Promise<HomeAnnouncement[]> } | null = null;

async function loadAnnouncements(): Promise<HomeAnnouncement[]> {
  const toList = (raw: unknown): HomeAnnouncement[] =>
    Array.isArray(raw) ? (raw as RawAnnouncement[]).map(toHomeAnnouncement).filter((a): a is HomeAnnouncement => a !== null) : [];

  const attempt = await viaContract('announcements', () => http<RawAnnouncement[]>('GET', '/announcements/active'));
  if (attempt.ok) return toList(attempt.value);
  // publicApi já devolve [] em qualquer falha.
  return toList(await publicApi.getAnnouncements());
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

/** Dispensa no servidor (contrato v2) ou, nos avisos antigos, só neste navegador. */
export async function dismissAnnouncement(userId: string, announcement: HomeAnnouncement): Promise<void> {
  if (announcement.serverManaged) {
    try {
      await http<void>('POST', `/announcements/${enc(announcement.id)}/dismiss`);
      announcementsCache = null;
      return;
    } catch {
      /* sem rede ou erro: guarda aqui para o aviso sumir ao menos neste navegador */
    }
  }
  const ids = readIdSet(dismissedKey(userId));
  ids.add(announcement.id);
  writeIdSet(dismissedKey(userId), ids);
}

// ---------- notificações ----------

/**
 * Notificações "Para você" e "Avisos" do servidor, com os contadores dele. Null quando o servidor ainda não
 * tem o endpoint: a central mostra só os avisos.
 */
export async function fetchNotifications(): Promise<NotificationFeed | null> {
  const attempt = await viaContract('notifications', async () => {
    const [forYou, announcements, unread] = await Promise.all([
      http<NotificationDto[]>('GET', '/notifications?category=FOR_YOU&limit=30'),
      http<NotificationDto[]>('GET', '/notifications?category=ANNOUNCEMENTS&limit=30'),
      http<UnreadCountDto>('GET', '/notifications/unread-count').catch(() => null),
    ]);
    return buildNotificationFeed(Array.isArray(forYou) ? forYou : [], Array.isArray(announcements) ? announcements : [], unread);
  });
  return attempt.ok ? attempt.value : null;
}

/** Contador de não lidas isolado (polling leve). Null se o servidor não tem o endpoint ou falhou. */
export async function fetchUnreadCounts(): Promise<UnreadCountDto | null> {
  const attempt = await viaContract('notifications', () => http<UnreadCountDto>('GET', '/notifications/unread-count'));
  return attempt.ok ? attempt.value : null;
}

/** Marca como lidas: as do servidor num só POST (`read-all`), as de aviso antigo no navegador. */
export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (ids.some((id) => serverNotificationId(id))) {
    try {
      await http<void>('POST', '/notifications/read-all');
    } catch {
      /* o contador volta a refletir o servidor na próxima atualização */
    }
  }
  const local = ids.filter((id) => !serverNotificationId(id));
  if (local.length > 0) {
    const current = readIdSet(readKey(userId));
    local.forEach((id) => current.add(id));
    writeIdSet(readKey(userId), current);
  }
}

// ---------- mensagens diretas ----------

/** Conversas da pessoa. Null quando o servidor ainda não tem mensagens diretas. */
export async function fetchConversations(): Promise<Conversation[] | null> {
  const attempt = await viaContract('conversations', () => http<ConversationDto[]>('GET', '/conversations'));
  return attempt.ok ? (Array.isArray(attempt.value) ? attempt.value : []).map(mapConversationDto) : null;
}

export async function fetchContacts(): Promise<Contact[]> {
  const list = await http<UserRefDto[]>('GET', '/conversations/contacts');
  return (Array.isArray(list) ? list : []).map(mapContact);
}

export async function openConversation(userId: string): Promise<Conversation> {
  return mapConversationDto(await http<ConversationDto>('POST', '/conversations', { userId }));
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const list = await http<MessageDto[]>('GET', `/conversations/${enc(conversationId)}/messages?limit=50`);
  return (Array.isArray(list) ? list : []).map(mapMessageDto);
}

export async function sendMessage(conversationId: string, text: string): Promise<ChatMessage> {
  const body = normalizeOutgoingMessage(text);
  if (!body) throw new Error('A mensagem está vazia.');
  return mapMessageDto(await http<MessageDto>('POST', `/conversations/${enc(conversationId)}/messages`, { body }));
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await http<void>('POST', `/conversations/${enc(conversationId)}/read`);
}

// ---------- sessões dos rituais ----------

const TOOL_CACHE_TTL_MS = 10_000;
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

/** Legado: lista de um ritual numa squad, com cache curto ("ao vivo" e "histórico" pedem as mesmas listas). */
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

async function fetchAllToolsLegacy(squads: SquadRef[], now: Date): Promise<ToolSession[]> {
  const jobs = squads.flatMap((squad) => RITUAL_KEYS.map((tool) => fetchToolSessions(tool, squad, now)));
  const settled = await Promise.allSettled(jobs);
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

export async function fetchLiveSessions(squads: SquadRef[], now: Date = new Date()): Promise<ToolSession[]> {
  if (squads.length === 0) return [];
  const attempt = await viaContract('live-sessions', async () => {
    // O servidor devolve o id da squad como está cadastrado na sala; comparamos sem diferenciar maiúsculas e
    // devolvemos o id da squad pedida, que é a chave usada pela Home (contagem por squad, tag).
    const bySquad = new Map(squads.map((s) => [s.id.toLowerCase(), s] as const));
    const names = new Map(squads.map((s) => [s.id, s.name] as const));
    // Uma squad só: o filtro vai na consulta. Várias: o servidor devolve todas as acessíveis e filtramos aqui.
    const path = squads.length === 1 ? `/live-sessions?squadId=${enc(squads[0].id)}` : '/live-sessions';
    const dtos = await http<LiveSessionDto[]>('GET', path);
    return (Array.isArray(dtos) ? dtos : [])
      .flatMap((d) => {
        const ref = bySquad.get(String(d.squadId ?? '').toLowerCase());
        return ref ? [{ ...d, squadId: ref.id }] : [];
      })
      .map((d) => mapLiveSessionDto(d, names))
      .filter((s): s is ToolSession => s !== null);
  });
  // O servidor novo só devolve o que não foi encerrado (inclusive a sala aguardando o início): nada a filtrar além disso.
  if (attempt.ok) return liveSessionsOf(attempt.value);
  return liveSessionsOf(await fetchAllToolsLegacy(squads, now), now);
}

const HISTORY_LIMIT = 10;

export async function fetchRitualHistory(
  squads: SquadRef[],
  now: Date = new Date(),
): Promise<Record<RitualKey, ToolSession[]>> {
  const empty = (): Record<RitualKey, ToolSession[]> => ({ poker: [], retro: [], showcase: [], health: [], brainstorming: [] });
  if (squads.length === 0) return empty();

  const attempt = await viaContract('history', async () => {
    const jobs = squads.flatMap((squad) =>
      RITUAL_KEYS.map(async (tool) => {
        const list = await http<RitualSessionDto[]>(
          'GET',
          `/rituals/${HISTORY_SEGMENT[tool]}/history?squadId=${enc(squad.id)}&limit=${HISTORY_LIMIT}`,
        );
        return (Array.isArray(list) ? list : []).map((d) => mapRitualSessionDto(d, squad)).filter((s): s is ToolSession => s !== null);
      }),
    );
    const settled = await Promise.allSettled(jobs);
    const notFound = settled.find((r) => r.status === 'rejected' && r.reason instanceof HomeHttpError && r.reason.status === 404);
    if (notFound && settled.every((r) => r.status === 'rejected')) throw (notFound as PromiseRejectedResult).reason;
    return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  });

  const all = attempt.ok ? attempt.value : await fetchAllToolsLegacy(squads, now);
  const out = empty();
  for (const tool of RITUAL_KEYS) out[tool] = sortByRecent(all.filter((s) => s.tool === tool));
  return out;
}

// ---------- squads ----------

export interface SquadSnapshot {
  rollup: SquadMetricsRollup | null;
  config: SquadConfig | null;
}

const snapshotCache = new Map<string, { at: number; promise: Promise<SquadSnapshot> }>();
const SNAPSHOT_TTL_MS = 60_000;

/** Legado: rollup da sprint e configuração (cerimônias manuais) de uma squad. */
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

function infoFromSnapshot(snap: SquadSnapshot, now: Date): SquadInfo {
  const progress = sprintProgress(snap.rollup, now);
  const manual = snap.config?.ceremonyMode === 'manual' ? snap.config.ceremonies : undefined;
  return {
    sprintName: snap.rollup?.sprintName,
    sprintPercent: progress.percent,
    daysLeft: progress.daysLeft,
    nextCeremony: upcomingCeremonies(manual, now, 1)[0],
  };
}

/**
 * Sprint e próxima cerimônia de cada squad. O agregado `/api/home` traz tudo numa chamada; squads que ele não
 * cobre (ou servidor sem o endpoint) usam rollup e configuração, uma consulta por squad.
 */
export async function fetchSquadInfos(refs: SquadRef[], now: Date = new Date()): Promise<Record<string, SquadInfo>> {
  const out: Record<string, SquadInfo> = {};
  if (refs.length === 0) return out;

  try {
    const attempt = await viaContract('home', () => http<HomeDto>('GET', '/home'));
    if (attempt.ok) {
      const wanted = new Set(refs.map((r) => r.id));
      for (const s of attempt.value?.squads ?? []) if (wanted.has(s.squadId)) out[s.squadId] = mapSquadSummaryDto(s);
    }
  } catch {
    /* agregado indisponível: segue pelo caminho por squad */
  }

  await Promise.all(
    refs
      .filter((r) => !out[r.id])
      .map(async (r) => {
        out[r.id] = infoFromSnapshot(await fetchSquadSnapshot(r.id, now), now);
      }),
  );
  return out;
}
