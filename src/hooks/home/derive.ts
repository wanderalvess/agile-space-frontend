/**
 * Regras puras da Home: nada aqui faz rede nem lê o navegador, então tudo é testável sem mock.
 * Os hooks chamam estas funções com o que `sources.ts` devolveu.
 */

import type { HealthCheckBoard, BrainstormingBoard, RetroBoard, Room, SquadCeremony, SquadMetricsRollup } from '@/lib/types';
import type { ShowcaseSession } from '@/components/showcase/types';
import { computeNextOccurrence } from '@/lib/ceremony-schedule';
import { safeHref } from '@/lib/safe-url';
import type {
  AnnouncementKind,
  HomeAnnouncement,
  HomeNotification,
  NotificationTab,
  RitualKey,
  SessionStatus,
  SquadRef,
  ToolSession,
} from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Sem `validUntil` (o backend ainda não manda), um aviso vale por 7 dias no banner... */
export const ANNOUNCEMENT_BANNER_TTL_MS = 7 * DAY;
/** ...e por 30 dias na lista do sino. */
export const ANNOUNCEMENT_LIST_TTL_MS = 30 * DAY;

/** Uma sala de poker síncrona iniciada e nunca encerrada deixa de contar como "ao vivo" depois disso. */
export const POKER_SYNC_MAX_AGE_MS = 12 * HOUR;
/** Sessão assíncrona fica aberta por dias. */
export const POKER_ASYNC_MAX_AGE_MS = 7 * DAY;
/** A retro não tem "encerrada em": sem resumo e criada há menos que isso, está acontecendo. */
export const RETRO_LIVE_MAX_AGE_MS = 8 * HOUR;
export const SHOWCASE_LIVE_MAX_AGE_MS = 12 * HOUR;
export const HEALTH_OPEN_MAX_AGE_MS = 7 * DAY;
export const BRAINSTORMING_OPEN_MAX_AGE_MS = 7 * DAY;

/** Máximo de squads consultadas de uma vez (ao vivo, histórico): quem lidera muitas não dispara centenas de chamadas. */
export const MAX_QUERIED_SQUADS = 8;

// ---------- texto e datas ----------

export function firstName(name?: string | null): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || '';
}

export function greetingFor(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function parseDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "hoje", "ontem" ou dd/MM (com o ano quando não é o atual). Vazio se a data não existe. */
export function formatShortDate(iso: string | null | undefined, now: Date): string {
  const d = parseDate(iso);
  if (!d) return '';
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return d.getFullYear() === now.getFullYear() ? `${dd}/${mm}` : `${dd}/${mm}/${d.getFullYear()}`;
}

/** "hoje, 09:12", "ontem" ou dd/MM. */
export function formatPublished(iso: string | null | undefined, now: Date): string {
  const d = parseDate(iso);
  if (!d) return '';
  const day = formatShortDate(iso, now);
  if (day === 'hoje') return `hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return day;
}

/** "há 5 min", "há 2 h", "ontem" ou dd/MM. */
export function formatRelative(iso: string | null | undefined, now: Date): string {
  const d = parseDate(iso);
  if (!d) return '';
  const diff = now.getTime() - d.getTime();
  if (diff < MINUTE) return 'agora';
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY && startOfDay(d) === startOfDay(now)) return `há ${Math.floor(diff / HOUR)} h`;
  return formatShortDate(iso, now);
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ---------- avisos ----------

export interface RawAnnouncement {
  id?: string;
  title?: string;
  content?: string;
  message?: string;
  text?: string;
  createdBy?: string;
  publishedBy?: string;
  createdAt?: string;
  publishedAt?: string;
  /** Campos que o backend novo vai mandar; hoje chegam ausentes. */
  type?: string;
  kind?: string;
  validUntil?: string | null;
  audience?: string;
  audienceLabel?: string;
  learnMoreUrl?: string;
  /** Contrato v2 (GET /api/announcements/active). */
  createdByName?: string | null;
  validFrom?: string;
  link?: string | null;
  audienceType?: string;
}

export function announcementKind(raw?: string | null): AnnouncementKind {
  const v = (raw ?? '').trim().toLowerCase();
  if (['important', 'importante', 'warning', 'alert', 'urgent', 'urgente'].includes(v)) return 'important';
  if (['maintenance', 'manutencao', 'manutenção'].includes(v)) return 'maintenance';
  return 'info';
}

export function toHomeAnnouncement(raw: RawAnnouncement | null | undefined): HomeAnnouncement | null {
  if (!raw || typeof raw !== 'object') return null;
  const text = String(raw.content ?? raw.message ?? raw.text ?? '').trim();
  const title = String(raw.title ?? '').trim();
  if (!title && !text) return null;
  const v2 = typeof raw.audienceType === 'string';
  const publishedAt = raw.publishedAt ?? raw.validFrom ?? raw.createdAt;
  return {
    id: raw.id || `${publishedAt ?? ''}|${title}`,
    kind: announcementKind(raw.type ?? raw.kind),
    title: title || text,
    text: title ? text : '',
    // No v2 `createdBy` é o e-mail: só o nome resolvido pelo servidor pode aparecer.
    publishedBy: raw.publishedBy ?? raw.createdByName ?? (v2 ? undefined : raw.createdBy) ?? undefined,
    publishedAt,
    validUntil: raw.validUntil ?? undefined,
    audienceLabel: raw.audienceLabel ?? audienceLabelOf(raw.audienceType ?? raw.audience),
    learnMoreUrl: safeHref(raw.link ?? raw.learnMoreUrl),
    serverManaged: v2 || undefined,
  };
}

function audienceLabelOf(audience?: string): string | undefined {
  switch ((audience ?? '').toUpperCase()) {
    case 'ALL':
      return 'para todas as squads';
    case 'SQUADS':
      return 'para squads selecionadas';
    case 'ROLES':
      return 'para papéis selecionados';
    default:
      return undefined;
  }
}

export function isAnnouncementActive(a: HomeAnnouncement, now: Date, defaultTtlMs: number): boolean {
  const until = parseDate(a.validUntil);
  if (until) return now.getTime() <= until.getTime();
  // Vigência resolvida pelo servidor: sem data final, o aviso vale até ser removido.
  if (a.serverManaged) return true;
  const published = parseDate(a.publishedAt);
  if (!published) return true;
  return now.getTime() - published.getTime() <= defaultTtlMs;
}

const KIND_PRIORITY: Record<AnnouncementKind, number> = { important: 0, maintenance: 1, info: 2 };

/** O aviso do banner: importante antes de manutenção antes de informativo; empate pelo mais recente. */
export function pickBannerAnnouncement(
  list: HomeAnnouncement[],
  dismissed: ReadonlySet<string>,
  now: Date,
): HomeAnnouncement | null {
  const candidates = list.filter((a) => !dismissed.has(a.id) && isAnnouncementActive(a, now, ANNOUNCEMENT_BANNER_TTL_MS));
  candidates.sort((a, b) => {
    const byKind = KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind];
    if (byKind !== 0) return byKind;
    return (parseDate(b.publishedAt)?.getTime() ?? 0) - (parseDate(a.publishedAt)?.getTime() ?? 0);
  });
  return candidates[0] ?? null;
}

export function announcementMeta(a: HomeAnnouncement, now: Date): string {
  const until = parseDate(a.validUntil);
  const parts = [
    a.publishedBy ? `Publicado por ${a.publishedBy}` : 'Publicado',
    formatPublished(a.publishedAt, now),
    until ? `válido até ${formatPublished(a.validUntil, now) || until.toLocaleDateString('pt-BR')}` : '',
    a.audienceLabel ?? '',
  ].filter(Boolean);
  return parts.join(' · ');
}

// ---------- notificações ----------

/** Avisos recentes (mesmo os já dispensados do banner) viram itens da aba "Avisos" do sino. */
export function announcementsToNotifications(
  list: HomeAnnouncement[],
  readIds: ReadonlySet<string>,
  now: Date,
): HomeNotification[] {
  return list
    .filter((a) => isAnnouncementActive(a, now, ANNOUNCEMENT_LIST_TTL_MS))
    .sort((a, b) => (parseDate(b.publishedAt)?.getTime() ?? 0) - (parseDate(a.publishedAt)?.getTime() ?? 0))
    .map((a) => ({
      id: `announcement:${a.id}`,
      tab: 'announcements' as const,
      who: a.title,
      text: a.text,
      icon: a.kind === 'maintenance' ? ('wrench' as const) : a.kind === 'important' ? ('alert' as const) : ('megaphone' as const),
      createdAt: a.publishedAt,
      unread: !readIds.has(`announcement:${a.id}`),
      cta: a.learnMoreUrl ? { label: 'Saiba mais', href: a.learnMoreUrl } : undefined,
    }));
}

export function unreadByTab(items: HomeNotification[]): Record<NotificationTab, number> {
  const out: Record<NotificationTab, number> = { foryou: 0, messages: 0, announcements: 0 };
  for (const n of items) if (n.unread) out[n.tab] += 1;
  return out;
}

export function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

// ---------- sessões dos rituais ----------

export const TOOL_LABEL: Record<RitualKey, string> = {
  poker: 'Planning Poker',
  retro: 'Retrospectiva',
  showcase: 'Review',
  health: 'Radar de clima',
  brainstorming: 'Brainstorming',
};

const TOOL_ROUTE: Record<RitualKey, string> = {
  poker: '/room',
  retro: '/retro',
  showcase: '/showcase',
  health: '/health-check',
  brainstorming: '/brainstorming',
};

export function sessionHref(tool: RitualKey, id: string): string {
  return `${TOOL_ROUTE[tool]}/${encodeURIComponent(id)}`;
}

/** Rota que abre direto o diálogo de criar (retro e poker aceitam ?nova=1); nos demais é a lista. */
export function toolCreateHref(tool: RitualKey): string {
  return tool === 'poker' || tool === 'retro' ? `${TOOL_ROUTE[tool]}?nova=1` : TOOL_ROUTE[tool];
}

export function toolListHref(tool: RitualKey): string {
  return TOOL_ROUTE[tool];
}

function ageMs(iso: string | null | undefined, now: Date): number {
  const d = parseDate(iso);
  return d ? now.getTime() - d.getTime() : Number.POSITIVE_INFINITY;
}

export function mapPokerRoom(room: Room, squad: SquadRef, now: Date): ToolSession {
  const isAsync = room.mode === 'async';
  let status: SessionStatus;
  if (room.sessionEndedAt) status = 'done';
  else if (room.sessionStartedAt) {
    const limit = isAsync ? POKER_ASYNC_MAX_AGE_MS : POKER_SYNC_MAX_AGE_MS;
    status = ageMs(room.sessionStartedAt, now) <= limit ? (isAsync ? 'async' : 'live') : 'done';
  } else status = 'planning';
  const tasks = Array.isArray(room.issuesQueue) ? room.issuesQueue.length : 0;
  return {
    id: room.id,
    tool: 'poker',
    squadId: squad.id,
    squadName: squad.name,
    title: room.title?.trim() || 'Sessão de poker',
    createdAt: room.sessionStartedAt || room.createdAt,
    participants: room.participantsCount ?? room.participantIds?.length,
    result: tasks > 0 ? pluralize(tasks, 'tarefa', 'tarefas') : undefined,
    status,
    href: sessionHref('poker', room.id),
  };
}

export function mapRetroBoard(board: RetroBoard, squad: SquadRef, now: Date): ToolSession {
  const live = !board.summary && ageMs(board.createdAt, now) <= RETRO_LIVE_MAX_AGE_MS;
  return {
    id: board.id,
    tool: 'retro',
    squadId: squad.id,
    squadName: squad.name,
    title: board.title?.trim() || 'Retrospectiva',
    createdAt: board.createdAt,
    participants: board.participantIds?.length,
    status: live ? 'live' : 'done',
    href: sessionHref('retro', board.id),
  };
}

export function mapShowcaseSession(session: ShowcaseSession, squad: SquadRef, now: Date): ToolSession {
  const raw = (session.status ?? '').toLowerCase();
  let status: SessionStatus;
  if (raw === 'presenting' || raw === 'active') {
    status = ageMs(session.createdAt, now) <= SHOWCASE_LIVE_MAX_AGE_MS ? 'live' : 'done';
  } else if (raw === 'planning') status = 'planning';
  else status = 'done';
  const tasks = Array.isArray(session.tasks) ? session.tasks.length : 0;
  return {
    id: session.id,
    tool: 'showcase',
    squadId: squad.id,
    squadName: squad.name,
    title: session.name?.trim() || session.sprintName?.trim() || 'Review',
    createdAt: session.createdAt ?? undefined,
    participants: session.members?.length || undefined,
    result: tasks > 0 ? pluralize(tasks, 'tarefa', 'tarefas') : undefined,
    status,
    href: sessionHref('showcase', session.id),
  };
}

export function mapHealthBoard(board: HealthCheckBoard, squad: SquadRef, now: Date): ToolSession {
  const open = board.status === 'collecting' && ageMs(board.createdAt, now) <= HEALTH_OPEN_MAX_AGE_MS;
  return {
    id: board.id,
    tool: 'health',
    squadId: squad.id,
    squadName: squad.name,
    title: board.sprintName?.trim() ? `Radar ${board.sprintName.trim()}` : 'Radar de clima',
    createdAt: board.createdAt,
    participants: board.participantIds?.length,
    status: open ? 'live' : 'done',
    href: sessionHref('health', board.id),
  };
}

const PHASE_LABEL: Record<string, string> = {
  ideation: 'ideação',
  diagram: 'diagrama',
  grouping: 'agrupamento',
  prioritization: 'priorização',
  actions: 'plano de ação',
};

export function mapBrainstormingBoard(board: BrainstormingBoard, squad: SquadRef, now: Date): ToolSession {
  const open = ageMs(board.createdAt, now) <= BRAINSTORMING_OPEN_MAX_AGE_MS;
  return {
    id: board.id,
    tool: 'brainstorming',
    squadId: squad.id,
    squadName: squad.name,
    title: board.title?.trim() || 'Brainstorming',
    createdAt: board.createdAt,
    participants: board.participantIds?.length,
    result: PHASE_LABEL[board.phase] ? `fase: ${PHASE_LABEL[board.phase]}` : undefined,
    status: open ? 'in_progress' : 'done',
    href: sessionHref('brainstorming', board.id),
  };
}

export function isLive(s: ToolSession): boolean {
  return s.status === 'live' || s.status === 'async';
}

export function sortByRecent(list: ToolSession[]): ToolSession[] {
  return [...list].sort((a, b) => (parseDate(b.createdAt)?.getTime() ?? 0) - (parseDate(a.createdAt)?.getTime() ?? 0));
}

export function liveSessionsOf(list: ToolSession[]): ToolSession[] {
  return sortByRecent(list.filter(isLive));
}

export function liveCountBySquad(list: ToolSession[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of list) if (isLive(s)) out[s.squadId] = (out[s.squadId] ?? 0) + 1;
  return out;
}

export function statusLabel(status: SessionStatus, tool: RitualKey): string {
  const masculine = tool === 'health' || tool === 'brainstorming';
  switch (status) {
    case 'live':
      return 'Ao vivo';
    case 'async':
      return 'Assíncrona';
    case 'planning':
      return 'Planejando';
    case 'in_progress':
      return 'Em andamento';
    default:
      return masculine ? 'Concluído' : 'Concluída';
  }
}

/** Linha de apoio do card "Ao vivo agora". */
export function liveMeta(s: ToolSession): string {
  return [
    TOOL_LABEL[s.tool],
    s.status === 'async' ? 'assíncrona' : '',
    s.participants ? pluralize(s.participants, 'pessoa', 'pessoas') : '',
    s.result ?? '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Linha de apoio de um item do histórico. */
export function historyMeta(s: ToolSession, now: Date): string {
  return [
    formatShortDate(s.createdAt, now),
    s.participants ? pluralize(s.participants, 'pessoa', 'pessoas') : '',
    s.result ?? '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Chips do card do ritual: o que há de mais útil saber sem abrir o painel. */
export function ritualFacts(sessions: ToolSession[], now: Date): string[] {
  if (sessions.length === 0) return ['Nenhuma sessão'];
  const ordered = sortByRecent(sessions);
  const facts: string[] = [];
  const live = ordered.filter(isLive).length;
  if (live > 0) facts.push(live === 1 ? 'Ao vivo agora' : `${live} ao vivo`);
  const last = ordered.find((s) => !isLive(s));
  if (last) {
    const when = formatShortDate(last.createdAt, now);
    facts.push(when ? `Última: ${when}${last.result ? ` · ${last.result}` : ''}` : 'Última sessão registrada');
  }
  return facts.slice(0, 2);
}

// ---------- squads, sprint e cerimônias ----------

export interface SprintProgress {
  percent: number | null;
  daysLeft: number | null;
}

export function sprintProgress(rollup: SquadMetricsRollup | null | undefined, now: Date): SprintProgress {
  if (!rollup) return { percent: null, daysLeft: null };
  const start = parseDate(rollup.extraMetrics?.activeSprintStart);
  const end = parseDate(rollup.extraMetrics?.activeSprintEnd);
  if (start && end && end.getTime() > start.getTime()) {
    const pct = ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
    return {
      percent: Math.min(100, Math.max(0, Math.round(pct))),
      daysLeft: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY)),
    };
  }
  const total = rollup.workdaysTotal;
  const remaining = rollup.workdaysRemaining;
  if (typeof total === 'number' && total > 0 && typeof remaining === 'number') {
    return {
      percent: Math.min(100, Math.max(0, Math.round(((total - remaining) / total) * 100))),
      daysLeft: Math.max(0, remaining),
    };
  }
  return { percent: null, daysLeft: null };
}

/** "Sprint 42 · faltam 6 dias". Sem nome de sprint devolve vazio. */
export function sprintLabel(name: string | undefined, daysLeft: number | null): string {
  if (!name) return '';
  if (daysLeft === null) return name;
  if (daysLeft === 0) return `${name} · termina hoje`;
  return `${name} · ${daysLeft === 1 ? 'falta 1 dia' : `faltam ${daysLeft} dias`}`;
}

export interface UpcomingCeremony {
  title: string;
  start: Date;
}

/** Próxima ocorrência de cada cerimônia manual da squad, da mais próxima para a mais distante. */
export function upcomingCeremonies(ceremonies: SquadCeremony[] | undefined, now: Date, limit = 2): UpcomingCeremony[] {
  const out: UpcomingCeremony[] = [];
  for (const c of ceremonies ?? []) {
    const next = computeNextOccurrence([c], now);
    if (next) out.push({ title: next.ceremony.title || 'Cerimônia', start: next.start });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, limit);
}

/** Quais squads consultar: a escolhida (ou todas), com a ativa primeiro e um teto de {@link MAX_QUERIED_SQUADS}. */
export function pickSquadsToQuery<T extends SquadRef>(
  refs: T[],
  activeId: string | undefined,
  scope: string | null,
  cap = MAX_QUERIED_SQUADS,
): T[] {
  if (scope) {
    const one = refs.find((r) => r.id === scope);
    return one ? [one] : [];
  }
  const ordered = [...refs].sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId));
  return ordered.slice(0, cap);
}

export interface SessionLike {
  accessibleProjects?: Array<{ projectId: string; projectName?: string; roleName?: string }>;
  activeProjectId?: string;
  activeProjectName?: string;
}

/** Squads da pessoa. Sem lista de projetos acessíveis (conta de uma squad só), cai na squad ativa. */
export function squadRefsFromSession(session: SessionLike | null | undefined): Array<SquadRef & { roleName?: string }> {
  if (!session) return [];
  const list = (session.accessibleProjects ?? []).map((p) => ({
    id: p.projectId,
    name: p.projectName || p.projectId,
    roleName: p.roleName,
  }));
  if (list.length > 0) return list;
  if (session.activeProjectId && session.activeProjectId !== 'Sem Time') {
    return [{ id: session.activeProjectId, name: session.activeProjectName || session.activeProjectId }];
  }
  return [];
}

// ---------- módulos ----------

function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Busca sem acento e sem diferença de caixa. Consulta vazia casa com tudo. */
export function matchesQuery(query: string, ...fields: string[]): boolean {
  const q = normalizeText(query.trim());
  if (!q) return true;
  return normalizeText(fields.join(' ')).includes(q);
}

// ---------- saudação ----------

export interface HeroChip {
  text: string;
  /** Chip em destaque (cor da marca). */
  brand?: boolean;
}

/** Chips sob a saudação: contexto da squad (uma só) ou visão geral (várias). */
export function heroChips(input: {
  squadName?: string;
  squadCount: number;
  liveCount: number;
  sprintText?: string;
  nextCeremonyText?: string;
}): HeroChip[] {
  const chips: HeroChip[] = [];
  if (input.squadCount > 1) {
    chips.push({ text: `Você acompanha ${input.squadCount} squads`, brand: true });
    if (input.liveCount > 0) chips.push({ text: pluralize(input.liveCount, 'sessão ao vivo', 'sessões ao vivo') });
  } else {
    if (input.squadName) chips.push({ text: `Squad ${input.squadName}`, brand: true });
    if (input.sprintText) chips.push({ text: input.sprintText });
  }
  if (input.nextCeremonyText) chips.push({ text: input.nextCeremonyText });
  return chips;
}
