/**
 * Hub do Brainstorming: entrar por ID ou link, junção da lista da squad com o histórico e filtros. Regras
 * puras, sem tela.
 */
import { deriveSessionStatus, type SessionStatus } from './session-status';
import type { BrainstormingBoard, BrainstormingPhase } from './types';

// ───────────────────────── ID ou link ─────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;
const ROOM_PATH = /\/brainstorming\/([^/?#\s]+)/i;

export type RoomCodeReading =
  | { state: 'empty' }
  | { state: 'invalid' }
  | { state: 'id'; id: string }
  | { state: 'link'; id: string };

/** Um ID no formato UUID é sempre minúsculo no servidor: colar em maiúsculas não pode dar "não encontrado". */
function normalizeId(candidate: string): string | null {
  const id = candidate.trim();
  if (UUID.test(id)) return id.toLowerCase();
  return SAFE_ID.test(id) ? id : null;
}

/**
 * Lê o que a pessoa colou no campo de entrada: o ID puro ou o link inteiro da sala (com ou sem domínio, com
 * parâmetros ou âncora). O UUID volta em minúsculas; qualquer outro ID mantém as letras como foram digitadas.
 */
export function readRoomCode(input: string): RoomCodeReading {
  const text = (input ?? '').trim();
  if (!text) return { state: 'empty' };
  const fromPath = ROOM_PATH.exec(text);
  if (fromPath) {
    let segment = fromPath[1];
    try {
      segment = decodeURIComponent(segment);
    } catch {
      /* fica o segmento cru */
    }
    const id = normalizeId(segment);
    return id ? { state: 'link', id } : { state: 'invalid' };
  }
  if (/[/\s]/.test(text)) return { state: 'invalid' };
  const id = normalizeId(text);
  return id ? { state: 'id', id } : { state: 'invalid' };
}

/** ID para abrir a sala, ou `null` se o texto não serve. */
export function parseRoomCode(input: string): string | null {
  const reading = readRoomCode(input);
  return reading.state === 'id' || reading.state === 'link' ? reading.id : null;
}

// ───────────────────────── Lista ─────────────────────────

export interface BrainstormLobbyRow {
  id: string;
  title: string;
  team: string;
  createdAt: string;
  phase?: BrainstormingPhase;
  creatorId?: string;
  /** Ideias e pessoas vêm do histórico da squad; ausentes quando o histórico não respondeu. */
  ideas?: number;
  people?: number;
  status?: SessionStatus;
  /** Veio só do histórico deste navegador (o servidor não a listou na squad). */
  localOnly?: boolean;
}

export interface HistoryRowLike {
  id: string;
  participantsCount?: number;
  summary?: string | null;
  status?: SessionStatus;
}

export interface LocalRoomLike {
  roomId: string;
  title: string;
  team: string;
  createdAt: string;
}

/** "23 ideias" -> 23. */
export function ideasFromSummary(summary: string | null | undefined): number | undefined {
  const match = /^(\d+)\s+ideia/i.exec((summary ?? '').trim());
  return match ? Number(match[1]) : undefined;
}

/**
 * Lista do hub: os murais da squad (servidor), com ideias e pessoas do histórico quando ele respondeu, mais os
 * abertos neste navegador que o servidor não listou (entrou por ID ou link, outra squad). Mais novos primeiro.
 */
export function mergeBrainstormRows(
  boards: readonly BrainstormingBoard[],
  history: readonly HistoryRowLike[],
  local: readonly LocalRoomLike[],
  now: number = Date.now()
): BrainstormLobbyRow[] {
  const byId = new Map(history.map((h) => [h.id, h]));
  const rows = new Map<string, BrainstormLobbyRow>();
  for (const b of boards) {
    const h = byId.get(b.id);
    // O histórico resume "N ideias"; sem ideias o resumo vem vazio, e isso é zero (não "sem dado").
    const ideas = h ? (ideasFromSummary(h.summary) ?? (h.summary ? undefined : 0)) : undefined;
    rows.set(b.id, {
      id: b.id,
      title: b.title || 'Brainstorming sem título',
      team: b.team || '',
      createdAt: b.createdAt,
      phase: b.phase,
      creatorId: b.creatorId,
      ideas,
      people: h?.participantsCount,
      status: h?.status ?? deriveSessionStatus('BRAINSTORMING', { phase: b.phase, createdAt: b.createdAt }, now),
    });
  }
  for (const l of local) {
    if (rows.has(l.roomId)) continue;
    rows.set(l.roomId, { id: l.roomId, title: l.title || 'Brainstorming sem título', team: l.team || '', createdAt: l.createdAt, localOnly: true });
  }
  return [...rows.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export type BrainstormLobbyFilter = 'all' | 'live' | 'plan';

export const BRAINSTORM_LOBBY_FILTERS: readonly { id: BrainstormLobbyFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'live', label: 'Em andamento' },
  { id: 'plan', label: 'No plano' },
];

/** Etapa em palavras para a tabela e a última sessão. */
export function lobbyStageLabel(phase: BrainstormingPhase | undefined): string {
  switch (phase) {
    case 'ideation':
      return 'Mural';
    case 'diagram':
      return 'Teia';
    case 'grouping':
      return 'Grupos';
    case 'prioritization':
      return 'Matriz';
    case 'actions':
      return 'Plano';
    default:
      return '';
  }
}

export function filterBrainstormRows(
  rows: readonly BrainstormLobbyRow[],
  filter: BrainstormLobbyFilter,
  query: string
): BrainstormLobbyRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (needle && !r.title.toLowerCase().includes(needle)) return false;
    if (filter === 'live') return r.status === 'LIVE';
    if (filter === 'plan') return r.phase === 'actions';
    return true;
  });
}

/** "Em andamento" na última sessão: a mais recente que o servidor considera ao vivo. */
export function isLobbyRowLive(row: Pick<BrainstormLobbyRow, 'status'>): boolean {
  return row.status === 'LIVE';
}

// ───────────────────────── Atalho local ─────────────────────────

/** Mesma chave que os outros hubs usam para "salas abertas neste navegador" (ver `useToolHistory`). */
export const ROOMS_META_KEY = 'agileSpace_rooms_meta';

/**
 * Guarda a sala criada na lista local. Continua útil como atalho quando o servidor está fora ou a sala é de outra
 * squad. Falha do storage nunca atrapalha a criação.
 */
export function rememberRoom(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  meta: { roomId: string; title: string; team: string; createdBy?: string },
  now: Date = new Date()
): void {
  try {
    if (!storage) return;
    const saved = storage.getItem(ROOMS_META_KEY);
    const rooms = saved ? JSON.parse(saved) : [];
    const list = Array.isArray(rooms) ? rooms : [];
    storage.setItem(ROOMS_META_KEY, JSON.stringify([...list, { ...meta, type: 'brainstorming', createdAt: now.toISOString() }]));
  } catch {
    /* sem storage: só não aparece no atalho */
  }
}

// ───────────────────────── Datas ─────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "hoje", "ontem", "há 3 dias" (até uma semana) ou "30/09" ("30/09/2025" em outro ano). Data inválida dá vazio. */
export function shortCreated(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date(now);
  const days = Math.round((startOfDay(today) - startOfDay(date)) / DAY_MS);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  return date.getFullYear() === today.getFullYear() ? base : `${base}/${date.getFullYear()}`;
}

/** Para frases ("criada hoje", "criada em 30/09"). */
export function createdPhrase(iso: string, now: number = Date.now()): string {
  const short = shortCreated(iso, now);
  return /^\d/.test(short) ? `em ${short}` : short;
}
