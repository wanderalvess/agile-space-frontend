import { RETRO_TEMPLATES, type RetroBoard, type RetroCard } from './types';
import { isRetroFinished, supportsRetroLifecycle } from './retro-lifecycle';

/** Fase de um quadro, em palavras, para a lista do lobby (o servidor não guarda "encerrada"). */
export function retroLobbyPhaseLabel(board: Pick<RetroBoard, 'isCardsRevealed' | 'votingStatus'>): string {
  if (!board.isCardsRevealed) return 'Escrita';
  if (board.votingStatus === 'active') return 'Votação';
  if (board.votingStatus === 'finished') return 'Votação encerrada';
  return 'Revelada';
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Retro "em andamento" (lobby). Backend novo (`lifecycleStatus`): aberta de verdade, ou seja, não encerrada pelo
 * facilitador, e criada nas últimas 24 h (as retros anteriores à migração estão todas "abertas" e não podem virar
 * "ao vivo" para sempre). Backend antigo: criada nas últimas 24 h e com a votação ainda não encerrada, uma
 * aproximação, por isso a tela fala "em andamento" quando não há o campo.
 */
export function isRetroInProgress(board: Pick<RetroBoard, 'createdAt' | 'votingStatus'> & Partial<Pick<RetroBoard, 'lifecycleStatus'>>, now: number = Date.now()): boolean {
  if (supportsRetroLifecycle(board)) {
    if (isRetroFinished(board)) return false;
  } else if (board.votingStatus === 'finished') {
    return false;
  }
  const created = Date.parse(board.createdAt);
  return Number.isFinite(created) && now - created >= 0 && now - created <= DAY_MS;
}

function actionColumnIds(board: Pick<RetroBoard, 'columns'>): Set<string> {
  const cols = board.columns && board.columns.length > 0 ? board.columns : RETRO_TEMPLATES.classic;
  return new Set(cols.filter((c) => c.theme === 'action').map((c) => c.id));
}

/** Ações do quadro que ainda não foram concluídas (e têm texto). */
export function pendingActionsOf(board: Pick<RetroBoard, 'columns'>, cards: readonly RetroCard[]): RetroCard[] {
  const ids = actionColumnIds(board);
  return cards.filter((c) => ids.has(c.columnKey) && c.isDone !== true && !!c.content?.trim());
}

export interface RetroBoardSummary {
  /** Cartões de feedback (fora das colunas de ação). */
  cards: number;
  actions: number;
  actionsDone: number;
}

export function summarizeRetroBoard(board: Pick<RetroBoard, 'columns'>, cards: readonly RetroCard[]): RetroBoardSummary {
  const ids = actionColumnIds(board);
  let feedback = 0;
  let actions = 0;
  let done = 0;
  for (const c of cards) {
    if (ids.has(c.columnKey)) {
      actions += 1;
      if (c.isDone === true) done += 1;
    } else {
      feedback += 1;
    }
  }
  return { cards: feedback, actions, actionsDone: done };
}

export interface RetroLobbyRow {
  id: string;
  title: string;
  team: string;
  createdAt: string;
  templateKey?: RetroBoard['templateKey'];
  board?: RetroBoard;
}

interface LocalRoomMeta {
  roomId: string;
  title: string;
  team: string;
  createdAt: string;
}

/**
 * Lista do lobby: o que o servidor devolve para a squad, mais as retros abertas neste navegador que o servidor
 * não listou (entrou por código, outra squad). Sem repetição, da mais nova para a mais antiga.
 */
export function mergeLobbyRows(remote: readonly RetroBoard[], local: readonly LocalRoomMeta[]): RetroLobbyRow[] {
  const rows = new Map<string, RetroLobbyRow>();
  for (const b of remote) {
    rows.set(b.id, { id: b.id, title: b.title || 'Retrospectiva sem título', team: b.team || 'Squad Geral', createdAt: b.createdAt, templateKey: b.templateKey, board: b });
  }
  for (const l of local) {
    if (!rows.has(l.roomId)) rows.set(l.roomId, { id: l.roomId, title: l.title || 'Retrospectiva sem título', team: l.team || 'Squad Geral', createdAt: l.createdAt });
  }
  return [...rows.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

export type RetroLobbyFilter = 'all' | 'year' | 'open-actions' | 'finished';

export const RETRO_LOBBY_FILTERS: readonly { id: RetroLobbyFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'year', label: 'Este ano' },
  { id: 'open-actions', label: 'Com ações abertas' },
  { id: 'finished', label: 'Encerradas' },
];

/** "Encerradas" só faz sentido quando o backend informa o encerramento; antes disso o filtro não aparece. */
export function lobbyFiltersFor(rows: readonly RetroLobbyRow[]): readonly { id: RetroLobbyFilter; label: string }[] {
  const known = rows.some((r) => supportsRetroLifecycle(r.board));
  return known ? RETRO_LOBBY_FILTERS : RETRO_LOBBY_FILTERS.filter((f) => f.id !== 'finished');
}

export function filterLobbyRows(
  rows: readonly RetroLobbyRow[],
  filter: RetroLobbyFilter,
  openActionsByBoard: ReadonlyMap<string, number>,
  now: Date = new Date(),
): RetroLobbyRow[] {
  if (filter === 'year') return rows.filter((r) => new Date(r.createdAt).getFullYear() === now.getFullYear());
  if (filter === 'open-actions') return rows.filter((r) => (openActionsByBoard.get(r.id) || 0) > 0);
  if (filter === 'finished') return rows.filter((r) => isRetroFinished(r.board));
  return [...rows];
}
