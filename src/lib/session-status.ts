/**
 * Status uniforme das sessões dos rituais (contrato da home, seção 5 de agile-space-backend/docs/home-api.md).
 * A fonte da verdade é o `SessionStatusResolver` do backend; `deriveSessionStatus` só existe para as telas que
 * ainda recebem a listagem crua de cada ferramenta e espelha as mesmas regras, sempre do lado conservador:
 * sem evidência de que a sessão está acontecendo, ela NÃO aparece como "Ao vivo".
 */

export type SessionStatus = 'LIVE' | 'ASYNC_OPEN' | 'PLANNING' | 'FINISHED';
export type SessionTool = 'POKER' | 'RETRO' | 'SHOWCASE' | 'HEALTH_CHECK' | 'BRAINSTORMING';

export type SessionChipTone = 'live' | 'neutral' | 'done';

export interface SessionStatusChip {
  label: string;
  tone: SessionChipTone;
}

const CHIPS: Record<SessionStatus, SessionStatusChip> = {
  LIVE: { label: 'Ao vivo', tone: 'live' },
  ASYNC_OPEN: { label: 'Assíncrona', tone: 'neutral' },
  PLANNING: { label: 'Planejando', tone: 'neutral' },
  FINISHED: { label: 'Concluída', tone: 'done' },
};

export function sessionStatusChip(status: SessionStatus | null | undefined): SessionStatusChip {
  return (status && CHIPS[status]) || CHIPS.FINISHED;
}

export function sessionStatusLabel(status: SessionStatus | null | undefined): string {
  return sessionStatusChip(status).label;
}

/** Classes Tailwind de cada tom do chip (mesma linguagem dos badges do portal). */
export const SESSION_CHIP_CLASSES: Record<SessionChipTone, string> = {
  live: 'bg-primary/10 text-primary border-primary/30',
  neutral: 'bg-muted/50 text-muted-foreground border-border',
  done: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
};

/** Sessão "ao vivo" sem atividade há mais que isso é tratada como encerrada (abandonada). */
export const ABANDONED_AFTER_MS = 12 * 60 * 60 * 1000;

const TOOL_ALIASES: Record<string, SessionTool> = {
  poker: 'POKER',
  room: 'POKER',
  retro: 'RETRO',
  showcase: 'SHOWCASE',
  health: 'HEALTH_CHECK',
  'health-check': 'HEALTH_CHECK',
  health_check: 'HEALTH_CHECK',
  brainstorming: 'BRAINSTORMING',
};

export function normalizeTool(tool: string | null | undefined): SessionTool | null {
  if (!tool) return null;
  const upper = tool.toUpperCase();
  if (['POKER', 'RETRO', 'SHOWCASE', 'HEALTH_CHECK', 'BRAINSTORMING'].includes(upper)) return upper as SessionTool;
  return TOOL_ALIASES[tool.toLowerCase()] ?? null;
}

/** Campos das listagens cruas que importam para o status (todos opcionais: cada ferramenta manda os seus). */
export interface RawSessionLike {
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  // poker
  mode?: string | null;
  sessionStartedAt?: string | null;
  sessionEndedAt?: string | null;
  // retro
  votingStatus?: string | null;
  // brainstorming
  phase?: string | null;
}

function time(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function isStale(ref: number | null, now: number): boolean {
  return ref === null || now - ref > ABANDONED_AFTER_MS;
}

/**
 * Deriva o status de uma sessão a partir da listagem crua da ferramenta. Regras (espelho do backend):
 * - POKER: sessionEndedAt → FINISHED; modo assíncrono → ASYNC_OPEN; sessionStartedAt → LIVE; senão PLANNING.
 * - SHOWCASE: planning → PLANNING; active → LIVE; finished → FINISHED.
 * - HEALTH_CHECK: collecting → ASYNC_OPEN; finished → FINISHED.
 * - RETRO / BRAINSTORMING: fase final → FINISHED; senão LIVE só com atividade recente; na dúvida FINISHED.
 * - LIVE sem atividade há mais de 12 h → FINISHED.
 */
export function deriveSessionStatus(toolRaw: string, session: RawSessionLike, now: number = Date.now()): SessionStatus {
  const tool = normalizeTool(toolRaw);
  const status = (session.status || '').toLowerCase();
  const lastActivity = time(session.updatedAt) ?? time(session.sessionStartedAt) ?? time(session.createdAt);

  switch (tool) {
    case 'POKER': {
      if (session.sessionEndedAt) return 'FINISHED';
      if ((session.mode || '').toLowerCase() === 'async') return 'ASYNC_OPEN';
      if (session.sessionStartedAt) return isStale(lastActivity, now) ? 'FINISHED' : 'LIVE';
      return 'PLANNING';
    }
    case 'SHOWCASE': {
      if (status === 'planning') return 'PLANNING';
      if (status === 'active') return isStale(lastActivity, now) ? 'FINISHED' : 'LIVE';
      return 'FINISHED';
    }
    case 'HEALTH_CHECK':
      return status === 'collecting' ? 'ASYNC_OPEN' : 'FINISHED';
    case 'RETRO': {
      if ((session.votingStatus || '').toLowerCase() === 'finished') return 'FINISHED';
      return isStale(lastActivity, now) ? 'FINISHED' : 'LIVE';
    }
    case 'BRAINSTORMING': {
      if ((session.phase || '').toLowerCase() === 'actions') return 'FINISHED';
      return isStale(lastActivity, now) ? 'FINISHED' : 'LIVE';
    }
    default:
      return 'FINISHED';
  }
}

/** Rótulo do ritual para listas mistas. */
export const TOOL_LABELS: Record<SessionTool, string> = {
  POKER: 'Scrum Poker',
  RETRO: 'Retrospectiva',
  SHOWCASE: 'Showcase',
  HEALTH_CHECK: 'Radar de clima',
  BRAINSTORMING: 'Brainstorming',
};

/** Rota da listagem de cada ritual (onde a pessoa cria uma sessão nova). */
export const TOOL_LIST_ROUTES: Record<SessionTool, string> = {
  POKER: '/room',
  RETRO: '/retro',
  SHOWCASE: '/showcase',
  HEALTH_CHECK: '/health-check',
  BRAINSTORMING: '/brainstorming',
};

/** Segmento da rota de histórico (`/api/rituals/{tool}/history`). */
export const TOOL_PATH_SEGMENTS: Record<SessionTool, string> = {
  POKER: 'poker',
  RETRO: 'retro',
  SHOWCASE: 'showcase',
  HEALTH_CHECK: 'health-check',
  BRAINSTORMING: 'brainstorming',
};
