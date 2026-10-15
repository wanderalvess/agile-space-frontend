/**
 * Clientes da home: avisos, notificações, mensagens diretas, sessões ao vivo, histórico por ritual e o agregado
 * `/api/home`. Contrato: agile-space-backend/docs/home-api.md. O JWT vai pelo `authFetch`; userId/role saem do
 * token no servidor, nunca do corpo.
 */
import { authFetch } from '@/lib/auth-client';
import { ensureOk } from '@/lib/ceremony-api';
import { TOOL_PATH_SEGMENTS, type SessionStatus, type SessionTool } from '@/lib/session-status';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

// ---------- tipos (seções 1–7 do contrato) ----------

export type AnnouncementType = 'INFO' | 'IMPORTANT' | 'MAINTENANCE';
export type AudienceType = 'ALL' | 'SQUADS' | 'ROLES';

export interface AnnouncementDto {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  audienceType: AudienceType;
  audienceSquadIds: string[];
  audienceRoles: string[];
  validFrom: string;
  validUntil: string | null;
  link: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  dismissed: boolean;
}

export interface AnnouncementInput {
  title: string;
  content: string;
  type: AnnouncementType;
  audienceType: AudienceType;
  audienceSquadIds: string[];
  audienceRoles: string[];
  validFrom?: string | null;
  validUntil?: string | null;
  link?: string | null;
}

export type NotificationKind = 'INVITE' | 'REMINDER' | 'ACTION_ASSIGNED' | 'MESSAGE' | 'ANNOUNCEMENT';
export type NotificationCategory = 'FOR_YOU' | 'ANNOUNCEMENTS';

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  title: string | null;
  text: string;
  link: string | null;
  actorId: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  squadId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface UnreadCountDto {
  forYou: number;
  messages: number;
  announcements: number;
  total: number;
}

export const EMPTY_UNREAD: UnreadCountDto = { forYou: 0, messages: 0, announcements: 0, total: 0 };

export interface UserRefDto {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationDto {
  id: string;
  otherUser: UserRefDto;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
}

export interface LiveSessionDto {
  tool: SessionTool;
  id: string;
  title: string;
  squadId: string;
  squadName: string | null;
  participantsCount: number;
  status: SessionStatus;
  link: string;
  startedAt: string | null;
  updatedAt: string | null;
}

export interface RitualSessionDto {
  tool: SessionTool;
  id: string;
  title: string;
  squadId: string;
  date: string;
  participantsCount: number;
  status: SessionStatus;
  summary: string | null;
  durationMinutes: number | null;
  link: string;
}

export interface RitualFactsDto {
  tool: SessionTool;
  facts: string[];
  openCount: number;
  last: RitualSessionDto | null;
}

export interface SquadSummaryDto {
  squadId: string;
  name: string;
  sprintName: string | null;
  sprintDaysLeft: number | null;
  sprintProgressPct: number | null;
  liveCount: number;
  nextCeremony: { name: string; startsAt: string } | null;
}

export interface HomeDto {
  announcements: AnnouncementDto[];
  unread: UnreadCountDto;
  multiSquad: boolean;
  squads: SquadSummaryDto[];
  liveSessions: LiveSessionDto[];
  rituals: RitualFactsDto[];
}

export const EMPTY_HOME: HomeDto = {
  announcements: [],
  unread: EMPTY_UNREAD,
  multiSquad: false,
  squads: [],
  liveSessions: [],
  rituals: [],
};

// ---------- helpers ----------

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`);
  await ensureOk(res, fallback);
  return res.json();
}

async function send<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, fallback: string, body?: unknown): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  await ensureOk(res, fallback);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const id = (value: string) => encodeURIComponent(value);

// ---------- 1. avisos ----------

export const announcementsApi = {
  active: () => getJson<AnnouncementDto[]>('/announcements/active', 'Falha ao carregar os avisos'),
  history: (limit = 20) => getJson<AnnouncementDto[]>(`/announcements/history${query({ limit })}`, 'Falha ao carregar os avisos'),
  dismiss: (announcementId: string) => send<void>('POST', `/announcements/${id(announcementId)}/dismiss`, 'Falha ao dispensar o aviso'),
};

export const adminAnnouncementsApi = {
  list: () => getJson<AnnouncementDto[]>('/admin/announcements', 'Falha ao carregar os avisos'),
  create: (input: AnnouncementInput) => send<AnnouncementDto>('POST', '/admin/announcements', 'Falha ao publicar o aviso', input),
  update: (announcementId: string, input: AnnouncementInput) =>
    send<AnnouncementDto>('PUT', `/admin/announcements/${id(announcementId)}`, 'Falha ao salvar o aviso', input),
  remove: (announcementId: string) => send<void>('DELETE', `/admin/announcements/${id(announcementId)}`, 'Falha ao remover o aviso'),
};

// ---------- 2. notificações ----------

export const notificationsApi = {
  list: (category: NotificationCategory = 'FOR_YOU', limit = 30) =>
    getJson<NotificationDto[]>(`/notifications${query({ category, limit })}`, 'Falha ao carregar as notificações'),
  unreadCount: () => getJson<UnreadCountDto>('/notifications/unread-count', 'Falha ao carregar as notificações'),
  markRead: (notificationId: string) => send<void>('POST', `/notifications/${id(notificationId)}/read`, 'Falha ao marcar como lida'),
  markAllRead: (category?: NotificationCategory) =>
    send<void>('POST', `/notifications/read-all${query({ category })}`, 'Falha ao marcar como lidas'),
};

// ---------- 3. mensagens diretas ----------

export const conversationsApi = {
  list: () => getJson<ConversationDto[]>('/conversations', 'Falha ao carregar as mensagens'),
  contacts: () => getJson<UserRefDto[]>('/conversations/contacts', 'Falha ao carregar os contatos'),
  open: (userId: string) => send<ConversationDto>('POST', '/conversations', 'Falha ao abrir a conversa', { userId }),
  messages: (conversationId: string, opts: { limit?: number; before?: string } = {}) =>
    getJson<MessageDto[]>(
      `/conversations/${id(conversationId)}/messages${query({ limit: opts.limit ?? 50, before: opts.before })}`,
      'Falha ao carregar a conversa',
    ),
  sendMessage: (conversationId: string, body: string) =>
    send<MessageDto>('POST', `/conversations/${id(conversationId)}/messages`, 'Falha ao enviar a mensagem', { body }),
  markRead: (conversationId: string) => send<void>('POST', `/conversations/${id(conversationId)}/read`, 'Falha ao marcar como lida'),
};

// ---------- 5/6/7. ao vivo, histórico e agregado ----------

export const liveSessionsApi = {
  list: (squadId?: string | null) => getJson<LiveSessionDto[]>(`/live-sessions${query({ squadId })}`, 'Falha ao carregar as sessões ao vivo'),
};

export const ritualsApi = {
  history: (tool: SessionTool, opts: { squadId?: string | null; limit?: number } = {}) =>
    getJson<RitualSessionDto[]>(
      `/rituals/${TOOL_PATH_SEGMENTS[tool]}/history${query({ squadId: opts.squadId, limit: opts.limit ?? 10 })}`,
      'Falha ao carregar o histórico',
    ),
};

export const homeApi = {
  get: (squadId?: string | null) => getJson<HomeDto>(`/home${query({ squadId })}`, 'Falha ao carregar a home'),
};

/** Versão tolerante do agregado: qualquer falha vira seções vazias (a home nunca quebra por causa dele). */
export async function loadHomeSafe(squadId?: string | null): Promise<{ data: HomeDto; failed: boolean }> {
  try {
    const data = await homeApi.get(squadId);
    return {
      data: {
        announcements: data?.announcements ?? [],
        unread: data?.unread ?? EMPTY_UNREAD,
        multiSquad: !!data?.multiSquad,
        squads: data?.squads ?? [],
        liveSessions: data?.liveSessions ?? [],
        rituals: data?.rituals ?? [],
      },
      failed: false,
    };
  } catch {
    return { data: EMPTY_HOME, failed: true };
  }
}

/** URL do canal do usuário (`/ws/user?token=`), derivada da base da API como nas salas. */
export function buildUserChannelUrl(token: string | null, apiBase: string = API_BASE_URL): string {
  const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '/ws/user');
  return `${wsBase}?token=${encodeURIComponent(token || '')}`;
}
