/**
 * Contrato do backend da Home (agile-space-backend, docs/home-api.md) e a tradução dele para os tipos de
 * `types.ts`. Só tipos e funções puras; quem chama a rede é `sources.ts`.
 */

import { safeHref } from '@/lib/safe-url';
import { sessionHref } from './derive';
import type {
  ChatMessage,
  Contact,
  Conversation,
  HomeNotification,
  NotificationFeed,
  NotificationKind,
  RitualKey,
  SessionStatus,
  SquadInfo,
  SquadRef,
  ToolSession,
  UnreadCounts,
} from './types';

// ---------- DTOs do servidor ----------

export type ServerTool = 'POKER' | 'RETRO' | 'SHOWCASE' | 'HEALTH_CHECK' | 'BRAINSTORMING';
export type ServerStatus = 'LIVE' | 'ASYNC_OPEN' | 'PLANNING' | 'FINISHED';

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  title: string | null;
  text: string;
  link: string | null;
  actorId: string | null;
  actorName: string | null;
  actorAvatarUrl?: string | null;
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

export interface UserRefDto {
  id: string;
  name: string;
  avatarUrl?: string | null;
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
  tool: ServerTool;
  id: string;
  title: string;
  squadId: string;
  squadName: string | null;
  participantsCount: number;
  status: ServerStatus;
  link: string;
  startedAt: string | null;
  updatedAt: string | null;
}

export interface RitualSessionDto {
  tool: ServerTool;
  id: string;
  title: string;
  squadId: string;
  date: string;
  participantsCount: number;
  status: ServerStatus;
  summary: string | null;
  durationMinutes: number | null;
  link: string;
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
  multiSquad: boolean;
  squads: SquadSummaryDto[];
}

// ---------- ferramentas e status ----------

const TOOL_FROM_SERVER: Record<ServerTool, RitualKey> = {
  POKER: 'poker',
  RETRO: 'retro',
  SHOWCASE: 'showcase',
  HEALTH_CHECK: 'health',
  BRAINSTORMING: 'brainstorming',
};

/** Segmento da rota `/api/rituals/{tool}/history`. */
export const HISTORY_SEGMENT: Record<RitualKey, string> = {
  poker: 'poker',
  retro: 'retro',
  showcase: 'showcase',
  health: 'health-check',
  brainstorming: 'brainstorming',
};

const STATUS_FROM_SERVER: Record<ServerStatus, SessionStatus> = {
  LIVE: 'live',
  ASYNC_OPEN: 'async',
  PLANNING: 'planning',
  FINISHED: 'done',
};

export function toolFromServer(tool: string | null | undefined): RitualKey | null {
  return TOOL_FROM_SERVER[(tool ?? '').toUpperCase() as ServerTool] ?? null;
}

export function statusFromServer(status: string | null | undefined): SessionStatus {
  return STATUS_FROM_SERVER[(status ?? '').toUpperCase() as ServerStatus] ?? 'done';
}

// ---------- sessões ----------

function fromServerSession(
  dto: { tool: ServerTool; id: string; title: string; squadId: string; link: string; status: ServerStatus; participantsCount: number },
  squadName: string,
  createdAt: string | null | undefined,
  result?: string | null,
): ToolSession | null {
  const tool = toolFromServer(dto.tool);
  if (!tool || !dto.id) return null;
  return {
    id: dto.id,
    tool,
    squadId: dto.squadId,
    squadName,
    title: dto.title?.trim() || 'Sessão',
    createdAt: createdAt ?? undefined,
    participants: dto.participantsCount > 0 ? dto.participantsCount : undefined,
    result: result?.trim() || undefined,
    status: statusFromServer(dto.status),
    href: safeHref(dto.link) ?? sessionHref(tool, dto.id),
  };
}

export function mapLiveSessionDto(dto: LiveSessionDto, squadNames: ReadonlyMap<string, string>): ToolSession | null {
  return fromServerSession(dto, dto.squadName || squadNames.get(dto.squadId) || dto.squadId, dto.startedAt ?? dto.updatedAt);
}

export function mapRitualSessionDto(dto: RitualSessionDto, squad: SquadRef): ToolSession | null {
  return fromServerSession(dto, squad.name, dto.date, dto.summary);
}

// ---------- squads ----------

export function mapSquadSummaryDto(dto: SquadSummaryDto): SquadInfo {
  const start = dto.nextCeremony ? new Date(dto.nextCeremony.startsAt) : null;
  return {
    sprintName: dto.sprintName ?? undefined,
    sprintPercent: typeof dto.sprintProgressPct === 'number' ? Math.min(100, Math.max(0, Math.round(dto.sprintProgressPct))) : null,
    daysLeft: typeof dto.sprintDaysLeft === 'number' ? Math.max(0, dto.sprintDaysLeft) : null,
    nextCeremony: dto.nextCeremony && start && !Number.isNaN(start.getTime()) ? { title: dto.nextCeremony.name, start } : undefined,
  };
}

// ---------- notificações ----------

const CTA_LABEL: Record<NotificationKind, string> = {
  INVITE: 'Abrir convite',
  REMINDER: 'Votar agora',
  ACTION_ASSIGNED: 'Ver ações',
  MESSAGE: 'Abrir',
  ANNOUNCEMENT: 'Saiba mais',
};

const ICON_BY_KIND: Record<NotificationKind, NonNullable<HomeNotification['icon']>> = {
  INVITE: 'calendar',
  REMINDER: 'calendar',
  ACTION_ASSIGNED: 'list',
  MESSAGE: 'calendar',
  ANNOUNCEMENT: 'megaphone',
};

export function mapNotificationDto(dto: NotificationDto, tab: HomeNotification['tab']): HomeNotification {
  const person = dto.actorName?.trim() || undefined;
  const link = safeHref(dto.link);
  return {
    id: `notification:${dto.id}`,
    tab,
    kind: dto.kind,
    who: person ?? (dto.title?.trim() || 'Aviso'),
    personName: person,
    text: dto.text ?? '',
    icon: ICON_BY_KIND[dto.kind] ?? 'megaphone',
    createdAt: dto.createdAt,
    unread: !dto.readAt,
    cta: link ? { label: CTA_LABEL[dto.kind] ?? 'Abrir', href: link } : undefined,
  };
}

export function mapUnreadDto(dto: Partial<UnreadCountDto> | null | undefined): UnreadCounts {
  const forYou = dto?.forYou ?? 0;
  const messages = dto?.messages ?? 0;
  const announcements = dto?.announcements ?? 0;
  return { foryou: forYou, messages, announcements, total: dto?.total ?? forYou + messages + announcements };
}

export function buildNotificationFeed(
  forYou: NotificationDto[],
  announcements: NotificationDto[],
  unread: Partial<UnreadCountDto> | null,
): NotificationFeed {
  const items = [
    ...forYou.map((n) => mapNotificationDto(n, 'foryou')),
    ...announcements.map((n) => mapNotificationDto(n, 'announcements')),
  ];
  const counts = unread
    ? mapUnreadDto(unread)
    : {
        foryou: items.filter((n) => n.tab === 'foryou' && n.unread).length,
        messages: 0,
        announcements: items.filter((n) => n.tab === 'announcements' && n.unread).length,
        total: 0,
      };
  if (!unread) counts.total = counts.foryou + counts.announcements;
  return { items, unread: counts };
}

/** Id do servidor de um item da central (sem o prefixo local). */
export function serverNotificationId(itemId: string): string | null {
  return itemId.startsWith('notification:') ? itemId.slice('notification:'.length) : null;
}

// ---------- mensagens ----------

export function mapContact(dto: UserRefDto): Contact {
  return { id: dto.id, name: dto.name?.trim() || 'Pessoa' };
}

export function mapMessageDto(dto: MessageDto): ChatMessage {
  return { id: dto.id, conversationId: dto.conversationId, senderId: dto.senderId, body: dto.body, createdAt: dto.createdAt };
}

export function mapConversationDto(dto: ConversationDto): Conversation {
  return {
    id: dto.id,
    other: mapContact(dto.otherUser),
    lastMessage: dto.lastMessage ? mapMessageDto(dto.lastMessage) : null,
    unreadCount: dto.unreadCount ?? 0,
    updatedAt: dto.updatedAt,
  };
}

/** Tamanho máximo de uma mensagem no servidor. */
export const MESSAGE_MAX_LENGTH = 2000;

/** Texto pronto para enviar, ou null se vazio (o servidor recusa corpo vazio). */
export function normalizeOutgoingMessage(raw: string): string | null {
  const body = raw.trim();
  if (!body) return null;
  return body.slice(0, MESSAGE_MAX_LENGTH);
}
