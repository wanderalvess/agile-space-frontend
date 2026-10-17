/**
 * Regras puras da sala da Retro: fases, colunas, votos, limites, arrastar, timer e reducers dos eventos do
 * WebSocket. Ficam fora dos componentes para serem testadas sem DOM e para a tela só orquestrar.
 */
import type { PhaseStep } from '@/components/room-kit/PhaseStepper';
import {
  RETRO_TEMPLATES,
  type GlobalRole,
  type RetroBoard,
  type RetroCard,
  type RetroColumnDef,
  type RetroColumnKey,
  type RetroColumnTheme,
  type RetroParticipant,
  type TeamRole,
  type TimerState,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Fases
// ---------------------------------------------------------------------------

export type RetroPhase = 'write' | 'reveal' | 'vote' | 'act';

/** Fases da cerimônia, na ordem em que a sala acontece. */
export const RETRO_PHASES: readonly (PhaseStep & { id: RetroPhase })[] = [
  { id: 'write', label: 'Escrever' },
  { id: 'reveal', label: 'Revelar' },
  { id: 'vote', label: 'Votar' },
  { id: 'act', label: 'Agir' },
];

/**
 * Fase atual a partir do estado do quadro: cards ocultos -> Escrever; revelados sem votação -> Revelar;
 * votação aberta -> Votar; votação encerrada -> Agir. Não há campo de fase no servidor: ela é derivada.
 */
export function retroPhase(board: Pick<RetroBoard, 'isCardsRevealed' | 'votingStatus'>): RetroPhase {
  if (!board.isCardsRevealed) return 'write';
  if (board.votingStatus === 'active') return 'vote';
  if (board.votingStatus === 'finished') return 'act';
  return 'reveal';
}

// ---------------------------------------------------------------------------
// Colunas e cards
// ---------------------------------------------------------------------------

/** Colunas ordenadas do quadro; quadros antigos (sem colunas gravadas) caem no modelo clássico. */
export function resolveColumns(board: Pick<RetroBoard, 'columns'>): RetroColumnDef[] {
  if (board.columns && board.columns.length > 0) {
    return [...board.columns].sort((a, b) => a.order - b.order);
  }
  return RETRO_TEMPLATES.classic;
}

export const isActionTheme = (theme?: RetroColumnTheme) => theme === 'action';

/** Card de coluna de ação (plano de ação). `actionItems` cobre quadros antigos sem tema gravado. */
export function isActionCard(card: Pick<RetroCard, 'columnKey'>, columns: readonly RetroColumnDef[]): boolean {
  const column = columns.find((c) => c.id === card.columnKey);
  return column ? isActionTheme(column.theme) : card.columnKey === 'actionItems';
}

/** Agrupa os cards por coluna, sem criar chave para colunas vazias. */
export function groupCardsByColumn(cards: readonly RetroCard[]): Record<string, RetroCard[]> {
  const grouped: Record<string, RetroCard[]> = {};
  for (const card of cards) (grouped[card.columnKey] ||= []).push(card);
  return grouped;
}

/**
 * A coluna ordena por votos? Vale a escolha explícita do facilitador; sem ela, ordena sozinha durante a
 * votação e depois dela. Coluna de ação nunca ordena por votos.
 */
export function isColumnSortedByVotes(
  board: Pick<RetroBoard, 'columnSorts' | 'votingStatus'>,
  columnKey: RetroColumnKey,
  theme?: RetroColumnTheme,
): boolean {
  if (isActionTheme(theme)) return false;
  const explicit = board.columnSorts?.[columnKey];
  if (explicit !== undefined) return explicit;
  return board.votingStatus === 'active' || board.votingStatus === 'finished';
}

/** Cards sem duplicata, ordenados por posição ou, quando pedido, pelos mais votados (empate: ordem original). */
export function sortColumnCards(cards: readonly RetroCard[], byVotes: boolean): RetroCard[] {
  const unique = Array.from(new Map(cards.map((c) => [c.id, c])).values());
  if (byVotes) {
    return unique.sort((a, b) => {
      const diff = (b.votes?.length || 0) - (a.votes?.length || 0);
      return diff !== 0 ? diff : a.order - b.order;
    });
  }
  return unique.sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// Votos
// ---------------------------------------------------------------------------

/** Quantos votos a pessoa já usou numa coluna (cada painel é uma votação separada). */
export function votesUsedInColumn(cards: readonly RetroCard[], columnKey: RetroColumnKey, userId: string): number {
  return cards.filter((c) => c.columnKey === columnKey && c.votes.includes(userId)).length;
}

export type VoteCheck =
  | { ok: true; removing: boolean }
  | { ok: false; reason: 'closed' | 'unknown-card' | 'limit'; max?: number };

/** Pode votar (ou retirar o voto) neste card agora? Retirar o voto é sempre permitido com a votação aberta. */
export function checkVote(args: {
  board: Pick<RetroBoard, 'votingStatus' | 'maxVotesPerParticipant'>;
  cards: readonly RetroCard[];
  cardId: string;
  userId: string;
}): VoteCheck {
  const { board, cards, cardId, userId } = args;
  if (board.votingStatus !== 'active') return { ok: false, reason: 'closed' };
  const card = cards.find((c) => c.id === cardId);
  if (!card) return { ok: false, reason: 'unknown-card' };
  const removing = card.votes.includes(userId);
  const max = board.maxVotesPerParticipant || 0;
  if (!removing && max > 0 && votesUsedInColumn(cards, card.columnKey, userId) >= max) {
    return { ok: false, reason: 'limit', max };
  }
  return { ok: true, removing };
}

export function voteLimitMessage(max: number): string {
  const usado = max === 1 ? 'seu único voto' : `seus ${max} votos`;
  return `Você já usou ${usado} neste painel. Remova um voto dele antes de votar em outro card do mesmo painel.`;
}

/** Opções do limite de votos por painel; mantém o valor atual (ex.: 5 do padrão) mesmo fora da lista. */
export const VOTE_LIMIT_PRESETS = [0, 3, 5, 10] as const;

export function voteLimitOptions(current: number): { value: string; label: string }[] {
  const values = new Set<number>([...VOTE_LIMIT_PRESETS, Math.max(0, current || 0)]);
  return [...values]
    .sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
    .map((n) => ({ value: String(n), label: n === 0 ? 'Sem limite' : String(n) }));
}

// ---------------------------------------------------------------------------
// Arrastar cards
// ---------------------------------------------------------------------------

export type MovePlan =
  | { kind: 'ignore' }
  | { kind: 'blocked'; reason: 'anonymous' | 'vote-limit' }
  | { kind: 'move'; moves: RetroCard[] };

/**
 * Converte um arrastar-e-soltar nas novas posições dos cards. Regras:
 * - na fase anônima só o autor (ou o facilitador) move o card;
 * - coluna ordenada por votos não aceita reposicionar dentro dela;
 * - mudar de painel leva os votos junto e não pode estourar o limite do destino;
 * - sem espaço entre os vizinhos, a coluna inteira é renumerada.
 */
export function planCardMove(args: {
  allCards: readonly RetroCard[];
  activeId: string;
  overId: string;
  overIsColumn: boolean;
  board: Pick<RetroBoard, 'isCardsRevealed' | 'columnSorts' | 'maxVotesPerParticipant'> | null;
  userId: string;
  isCreator: boolean;
  now?: number;
}): MovePlan {
  const { allCards, activeId, overId, overIsColumn, board, userId, isCreator, now = Date.now() } = args;
  const activeCard = allCards.find((c) => c.id === activeId);
  if (!activeCard) return { kind: 'ignore' };

  if (!board?.isCardsRevealed && activeCard.authorId !== userId && !isCreator) {
    return { kind: 'blocked', reason: 'anonymous' };
  }

  const sortedCards = [...allCards].sort((a, b) => a.order - b.order);

  let targetColumn: RetroColumnKey;
  if (overIsColumn) {
    targetColumn = overId;
  } else {
    const overCard = allCards.find((c) => c.id === overId);
    if (!overCard || overCard.id === activeCard.id) return { kind: 'ignore' };
    targetColumn = overCard.columnKey;
  }

  if (targetColumn === activeCard.columnKey && board?.columnSorts?.[targetColumn]) return { kind: 'ignore' };
  if (overIsColumn && targetColumn === activeCard.columnKey) return { kind: 'ignore' };

  const max = board?.maxVotesPerParticipant || 0;
  if (targetColumn !== activeCard.columnKey && max > 0 && activeCard.votes.includes(userId)) {
    const usedThere = allCards.filter((c) => c.columnKey === targetColumn && c.id !== activeCard.id && c.votes.includes(userId)).length;
    if (usedThere >= max) return { kind: 'blocked', reason: 'vote-limit' };
  }

  const moves: RetroCard[] = [];
  const cardsInTargetColumn = sortedCards.filter((c) => c.columnKey === targetColumn && c.id !== activeCard.id);

  if (overIsColumn) {
    const lastCard = cardsInTargetColumn[cardsInTargetColumn.length - 1];
    moves.push({ ...activeCard, columnKey: targetColumn, order: lastCard ? lastCard.order + 1000 : now });
    return { kind: 'move', moves };
  }

  const overCard = allCards.find((c) => c.id === overId)!;
  const columnWithActive = sortedCards.filter((c) => c.columnKey === targetColumn);
  const activeIndex = columnWithActive.findIndex((c) => c.id === activeCard.id);
  const overIndex = columnWithActive.findIndex((c) => c.id === overCard.id);
  const isDroppingBefore = activeIndex === -1 || activeIndex > overIndex;

  const newOverIndex = cardsInTargetColumn.findIndex((c) => c.id === overCard.id);
  const cardBefore = isDroppingBefore ? cardsInTargetColumn[newOverIndex - 1] : overCard;
  const cardAfter = isDroppingBefore ? overCard : cardsInTargetColumn[newOverIndex + 1];
  const orderBefore = cardBefore?.order;
  const orderAfter = cardAfter?.order;

  if (orderBefore !== undefined && orderAfter !== undefined && orderAfter - orderBefore < 1) {
    const finalColumnCards = [...cardsInTargetColumn];
    const insertAt = isDroppingBefore ? newOverIndex : newOverIndex + 1;
    finalColumnCards.splice(insertAt, 0, activeCard);
    finalColumnCards.forEach((c, idx) => moves.push({ ...c, columnKey: targetColumn, order: (idx + 1) * 1000 }));
    return { kind: 'move', moves };
  }

  let newOrder: number;
  if (orderBefore !== undefined && orderAfter !== undefined) newOrder = (orderBefore + orderAfter) / 2;
  else if (orderBefore !== undefined) newOrder = orderBefore + 1000;
  else if (orderAfter !== undefined) newOrder = orderAfter / 2;
  else newOrder = now;
  moves.push({ ...activeCard, columnKey: targetColumn, order: newOrder });
  return { kind: 'move', moves };
}

// ---------------------------------------------------------------------------
// Navegação entre colunas
// ---------------------------------------------------------------------------

/** Coluna vizinha (com volta no fim). Sem colunas, devolve a atual. */
export function neighborStage(columns: readonly RetroColumnDef[], current: RetroColumnKey, direction: 1 | -1): RetroColumnKey {
  if (columns.length === 0) return current;
  const index = columns.findIndex((c) => c.id === current);
  const next = (index + direction + columns.length) % columns.length;
  return columns[next].id;
}

/** Só o facilitador troca de coluna quando a sincronização está ligada. */
export function isStageNavLocked(board: Pick<RetroBoard, 'syncStageEnabled'>, isFacilitator: boolean): boolean {
  return !!board.syncStageEnabled && !isFacilitator;
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

/** Tolerância para considerar que o fim do timer foi "agora" (alarme e auto-revelar só valem dentro dela). */
export const TIMER_LATE_GRACE_MS = 3000;

export const stoppedTimer = (duration: number): TimerState => ({
  status: 'stopped',
  initialDuration: duration,
  remainingOnPause: duration,
  endTime: null,
});

export const startedTimer = (duration: number, now: number): TimerState => ({
  status: 'running',
  endTime: now + duration * 1000,
  initialDuration: duration,
  remainingOnPause: duration,
});

export function pausedTimer(timer: TimerState | undefined, now: number): TimerState | null {
  if (!timer?.endTime) return null;
  const remaining = Math.max(0, Math.round((Number(timer.endTime) - now) / 1000));
  return { ...timer, status: 'paused', remainingOnPause: remaining };
}

export function resumedTimer(timer: TimerState | undefined, now: number): TimerState | null {
  if (!timer) return null;
  return { ...timer, status: 'running', endTime: now + (timer.remainingOnPause ?? timer.initialDuration) * 1000 };
}

/** Zerar e encerrar (timer que chegou a zero) voltam o relógio à duração escolhida. */
export function resetTimer(timer: TimerState | undefined): TimerState | null {
  if (!timer) return null;
  return { ...timer, status: 'stopped', endTime: null, remainingOnPause: timer.initialDuration };
}

/** Timer da tela (com padrões) a partir do que veio no quadro. */
export function timerFromBoard(timer: Partial<TimerState> | undefined): TimerState {
  return {
    status: (timer?.status || 'stopped') as TimerState['status'],
    initialDuration: timer?.initialDuration || 300,
    remainingOnPause: timer?.remainingOnPause ?? 300,
    endTime: timer?.endTime ? Number(timer.endTime) : null,
  };
}

// ---------------------------------------------------------------------------
// Reducers dos eventos do WebSocket (e das respostas do servidor)
// ---------------------------------------------------------------------------

/** Troca o item de mesmo id ou acrescenta no fim. */
export function upsertById<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index < 0) return [...list, item];
  const copy = [...list];
  copy[index] = item;
  return copy;
}

export function removeById<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

/** CARDS_IMPORTED: os importados substituem os de mesmo id e vão para o fim. */
export function importCards(prev: readonly RetroCard[], imported: readonly RetroCard[]): RetroCard[] {
  const ids = new Set(imported.map((c) => c.id));
  return [...prev.filter((c) => !ids.has(c.id)), ...imported];
}

/** Junta duplicatas por id mantendo a última ocorrência. */
export function uniqueById<T extends { id: string }>(list: readonly T[]): T[] {
  return Array.from(new Map(list.map((c) => [c.id, c])).values());
}

/**
 * Cards na tela: o que o servidor mandou, com as mudanças otimistas ainda em voo por cima
 * (um eco de outro evento do WebSocket não desfaz o que a pessoa acabou de fazer).
 */
export function overlayPending(cards: readonly RetroCard[], pending: ReadonlyMap<string, RetroCard>): RetroCard[] {
  if (pending.size === 0) return [...cards];
  const byId = new Map(cards.map((c) => [c.id, c]));
  pending.forEach((card, id) => byId.set(id, card));
  return Array.from(byId.values());
}

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------

/** Cargo do perfil global -> papel dentro da retro. */
export function mapGlobalToTeamRole(role: GlobalRole): TeamRole {
  switch (role) {
    case 'Agile Master':
    case 'Scrum Master':
    case 'Scrum Master / Agile Coach':
    case 'Agile Coach':
      return 'AM';
    case 'Product Owner':
    case 'Product Owner (PO)':
      return 'PO';
    case 'Tech Lead':
    case 'Arquiteto(a) / Tech Lead':
    case 'People Lead':
    case 'Tribe Lead':
      return 'PL';
    case 'QA':
    case 'Analista de QA':
      return 'QA';
    case 'Designer':
    case 'UX':
    case 'Designer / UI-UX':
      return 'UX';
    case 'Developer':
    case 'Desenvolvedor(a)':
      return 'DEV';
    case 'SME':
      return 'SME';
    case 'Stakeholder / Observador':
    default:
      return 'OUTRO';
  }
}

/** Papel da retro -> categoria usada para agrupar a lista de presença. */
export function presenceCategoryOf(role?: TeamRole): string | null {
  switch (role) {
    case 'DEV':
      return 'Developer';
    case 'QA':
      return 'QA';
    case 'UX':
      return 'UX';
    case 'AM':
    case 'PO':
    case 'PL':
      return 'Management';
    default:
      return null;
  }
}

export interface ContributionSummary {
  /** Cards de feedback no quadro (ocultos inclusive: o servidor só esconde o texto, não a existência). */
  total: number;
  /** Quantos são seus. */
  mine: number;
  /** Quem escreveu, só quando a autoria chegou (própria, ou autores abertos). */
  byAuthor: { id: string; name: string; count: number }[];
  /** Cards cuja autoria o servidor não mostrou. */
  anonymous: number;
}

/** Resumo de contribuições para a faixa "ao vivo". Não inclui as colunas de ação. */
export function contributionSummary(
  cards: readonly RetroCard[],
  columns: readonly RetroColumnDef[],
  participants: readonly RetroParticipant[],
  currentUserId: string,
): ContributionSummary {
  const actionIds = new Set(columns.filter((c) => isActionTheme(c.theme)).map((c) => c.id));
  const names = new Map(participants.map((p) => [p.id, p.nickname]));
  const counts = new Map<string, number>();
  let total = 0;
  let anonymous = 0;
  for (const card of cards) {
    if (actionIds.has(card.columnKey)) continue;
    total += 1;
    if (!card.authorId) {
      anonymous += 1;
      continue;
    }
    counts.set(card.authorId, (counts.get(card.authorId) || 0) + 1);
  }
  const byAuthor = [...counts.entries()]
    .map(([id, count]) => ({ id, name: names.get(id) || 'Participante', count }))
    .sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : b.count - a.count));
  return { total, mine: counts.get(currentUserId) || 0, byAuthor, anonymous };
}

// ---------------------------------------------------------------------------
// Prazo das ações
// ---------------------------------------------------------------------------

export type DueStatus = 'none' | 'ok' | 'soon' | 'overdue';

const DUE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function dueDay(due?: string): Date | null {
  const m = DUE_RE.exec(due || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Prazo vencido (antes de hoje), perto (hoje até 3 dias) ou tranquilo. Ação concluída nunca vence. */
export function dueStatus(due: string | undefined, done: boolean | undefined, now: Date = new Date()): DueStatus {
  const day = dueDay(due);
  if (!day) return 'none';
  if (done) return 'ok';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  return diffDays <= 3 ? 'soon' : 'ok';
}

/** "2025-10-22" -> "22/10/2025"; texto fora do padrão volta como está. */
export function formatDueDate(due?: string): string {
  const m = DUE_RE.exec(due || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : due || '';
}

/** "2025-10-22" -> "22/10" (curto, para o chip do card). */
export function formatDueShort(due?: string): string {
  const m = DUE_RE.exec(due || '');
  return m ? `${m[3]}/${m[2]}` : due || '';
}
