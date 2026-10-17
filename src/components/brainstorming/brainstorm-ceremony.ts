/**
 * Regras da cerimônia do Brainstorming que dependem do backend novo (V80): facilitador atual, encerrar e reabrir,
 * assumir e passar a facilitação, limite de votos, autoria e "editada". Tudo puro (sem DOM) e tolerante ao backend
 * antigo: sem os campos novos a sala se comporta como sempre (aberta, facilitador = criador, sem limite de votos).
 * Contrato: `docs/redesign/brainstorming-cerimonia.md`.
 */
import type { BrainstormingBoard, BrainstormingIdea, Participant } from '@/lib/types';

// ───────────────────────── Facilitador e status ─────────────────────────

/** O facilitador atual: `facilitatorId`, ou o criador em mural/servidor antigo. */
export function effectiveFacilitatorId(board: Pick<BrainstormingBoard, 'creatorId' | 'facilitatorId'> | null | undefined): string | undefined {
  if (!board) return undefined;
  return board.facilitatorId || board.creatorId || undefined;
}

export function isFacilitatorOf(board: Pick<BrainstormingBoard, 'creatorId' | 'facilitatorId'> | null | undefined, userId: string | null | undefined): boolean {
  const id = effectiveFacilitatorId(board);
  return !!id && !!userId && id === userId;
}

export function isBoardCreator(board: Pick<BrainstormingBoard, 'creatorId'> | null | undefined, userId: string | null | undefined): boolean {
  return !!board?.creatorId && !!userId && board.creatorId === userId;
}

/** Mural encerrado (`status = FINISHED`). Sem o campo (backend antigo) está aberto. */
export function isBoardFinished(board: Pick<BrainstormingBoard, 'status'> | null | undefined): boolean {
  return board?.status === 'FINISHED';
}

/**
 * O servidor conhece as funções novas? Os campos `status` e `facilitatorId` vêm sempre no backend novo
 * (mesmo em mural antigo); no backend antigo não existem. É o que decide mostrar ou esconder encerrar, assumir e passar.
 */
export function supportsCeremonyApi(board: Pick<BrainstormingBoard, 'status' | 'facilitatorId'> | null | undefined): boolean {
  return !!board && (board.status !== undefined || board.facilitatorId !== undefined);
}

/** Encerrar e reabrir: facilitador atual, criador do mural ou ADMIN. */
export function canFinishOrReopen(args: { board: BrainstormingBoard | null | undefined; userId: string | null | undefined; isAdmin?: boolean }): boolean {
  const { board, userId, isAdmin } = args;
  return !!board && !!userId && (!!isAdmin || isFacilitatorOf(board, userId) || isBoardCreator(board, userId));
}

/** Passar a facilitação: facilitador atual ou ADMIN. */
export function canTransferFacilitation(args: { board: BrainstormingBoard | null | undefined; userId: string | null | undefined; isAdmin?: boolean }): boolean {
  const { board, userId, isAdmin } = args;
  return !!board && !!userId && (!!isAdmin || isFacilitatorOf(board, userId));
}

/** Nome do participante para exibir: `displayName` (backend novo), o apelido ou "Participante". */
export function participantName(p: Pick<Participant, 'nickname' | 'displayName'> | null | undefined): string {
  return p?.displayName?.trim() || p?.nickname?.trim() || 'Participante';
}

/** Nome do facilitador: o da lista de participantes, depois `facilitatorName`; vazio se nenhum for conhecido. */
export function facilitatorDisplayName(board: BrainstormingBoard | null | undefined, participants: readonly Participant[]): string {
  const id = effectiveFacilitatorId(board);
  const person = id ? participants.find((p) => p.id === id) : undefined;
  if (person) return participantName(person);
  return board?.facilitatorName?.trim() || '';
}

/** Quem pode receber a facilitação: os participantes da sala, menos o facilitador atual. */
export function transferCandidates(board: BrainstormingBoard | null | undefined, participants: readonly Participant[]): Participant[] {
  const current = effectiveFacilitatorId(board);
  return participants.filter((p) => p.id !== current);
}

// ───────────────────────── Assumir a facilitação ─────────────────────────

/** Tempo padrão do servidor (`app.brainstorming.facilitator-offline-seconds`) com o facilitador fora antes de outro assumir. */
export const FACILITATOR_OFFLINE_SECONDS = 60;

export interface ClaimState {
  /** O botão "Assumir a facilitação" aparece. */
  visible: boolean;
  /** Pode clicar já (o servidor ainda confere). */
  enabled: boolean;
  /** Segundos que faltam para habilitar (só para participante comum, com o facilitador fora). */
  waitSeconds: number;
}

/**
 * Regras de "Assumir a facilitação" que o backend aceitaria:
 * - quem já facilita não vê o botão;
 * - criador e ADMIN assumem sempre (o servidor não checa presença);
 * - os demais participantes só quando a presença diz que o facilitador está OFFLINE, e habilitado passado o tempo
 *   (`thresholdMs`); com a presença desconhecida (backend antigo) o botão não aparece.
 */
export function claimState(args: {
  board: BrainstormingBoard | null | undefined;
  userId: string | null | undefined;
  isAdmin?: boolean;
  isParticipant: boolean;
  /** `undefined` = presença desconhecida. */
  facilitatorOnline: boolean | undefined;
  /** Há quanto tempo o facilitador está fora, medido por esta tela. */
  offlineForMs: number;
  thresholdMs?: number;
}): ClaimState {
  const { board, userId, isAdmin, isParticipant, facilitatorOnline, offlineForMs, thresholdMs = FACILITATOR_OFFLINE_SECONDS * 1000 } = args;
  const hidden: ClaimState = { visible: false, enabled: false, waitSeconds: 0 };
  if (!board || !userId || !supportsCeremonyApi(board) || isFacilitatorOf(board, userId)) return hidden;
  if (isAdmin || isBoardCreator(board, userId)) return { visible: true, enabled: true, waitSeconds: 0 };
  if (!isParticipant || facilitatorOnline !== false) return hidden;
  const remaining = Math.max(0, thresholdMs - offlineForMs);
  return { visible: true, enabled: remaining === 0, waitSeconds: Math.ceil(remaining / 1000) };
}

// ───────────────────────── Limite de votos ─────────────────────────

export const MIN_VOTE_LIMIT = 1;
export const MAX_VOTE_LIMIT = 100;
/** Valor sugerido ao ligar o limite. */
export const DEFAULT_VOTE_LIMIT = 3;

export type VoteLimitReading = { ok: true; value: number } | { ok: false };

/** Lê o campo "Votos por pessoa": inteiro de 1 a 100; o resto é inválido. */
export function readVoteLimit(text: string | number | null | undefined): VoteLimitReading {
  const raw = typeof text === 'number' ? String(text) : (text ?? '').trim();
  if (!/^\d{1,3}$/.test(raw)) return { ok: false };
  const value = Number(raw);
  return value >= MIN_VOTE_LIMIT && value <= MAX_VOTE_LIMIT ? { ok: true, value } : { ok: false };
}

/** Limite do mural: número de 1 a 100, ou `null` (sem limite, campo ausente incluso). */
export function boardVoteLimit(board: Pick<BrainstormingBoard, 'votesPerParticipant'> | null | undefined): number | null {
  const n = board?.votesPerParticipant;
  return typeof n === 'number' && Number.isInteger(n) && n >= MIN_VOTE_LIMIT ? n : null;
}

export interface VoteQuota {
  /** `null` = sem limite. */
  limit: number | null;
  used: number;
  /** `null` = sem limite. */
  remaining: number | null;
  /** Atingiu (ou passou) o limite: votar em outra ideia fica desabilitado. */
  reached: boolean;
}

/** Votos que a pessoa já deu: ideias em que o id dela consta em `votes` (ideias ocultas vêm sem votos; o servidor conta e recusa). */
export function votesUsedBy(ideas: readonly Pick<BrainstormingIdea, 'votes'>[], userId: string | null | undefined): number {
  if (!userId) return 0;
  return ideas.reduce((sum, idea) => sum + (Array.isArray(idea.votes) && idea.votes.includes(userId) ? 1 : 0), 0);
}

export function voteQuota(limit: number | null | undefined, ideas: readonly Pick<BrainstormingIdea, 'votes'>[], userId: string | null | undefined): VoteQuota {
  const used = votesUsedBy(ideas, userId);
  if (typeof limit !== 'number' || limit < MIN_VOTE_LIMIT) return { limit: null, used, remaining: null, reached: false };
  return { limit, used, remaining: Math.max(0, limit - used), reached: used >= limit };
}

/** "Você usou 2 de 3 votos" (singular quando o limite é 1). Sem limite não há texto. */
export function quotaLabel(quota: VoteQuota): string {
  if (quota.limit === null) return '';
  return `Você usou ${quota.used} de ${quota.limit} ${quota.limit === 1 ? 'voto' : 'votos'}`;
}

/** Pode votar nesta ideia? Remover o próprio voto sempre vale (devolve a cota), exceto no mural encerrado. */
export function canVoteOn(args: { quota: VoteQuota; hasVoted: boolean; readOnly?: boolean }): boolean {
  if (args.readOnly) return false;
  return args.hasVoted || !args.quota.reached;
}

// ───────────────────────── Autoria e edição ─────────────────────────

/**
 * Quem pode mudar o TEXTO de uma ideia. Sem `restrictEdits` qualquer participante (como sempre); com ele, o autor,
 * o facilitador atual e o ADMIN. Mural encerrado: ninguém. Mover, agrupar, votar e fundir não passam por aqui.
 */
export function canEditIdeaText(args: {
  idea: Pick<BrainstormingIdea, 'authorId'>;
  userId: string | null | undefined;
  isFacilitator: boolean;
  isAdmin?: boolean;
  restrictEdits?: boolean;
  readOnly?: boolean;
}): boolean {
  const { idea, userId, isFacilitator, isAdmin, restrictEdits, readOnly } = args;
  if (readOnly) return false;
  if (!restrictEdits) return true;
  if (isFacilitator || isAdmin) return true;
  return !!userId && !!idea.authorId && idea.authorId === userId;
}

export interface EditedBadge {
  /** Texto do selo: "editada" ou "editada por Caio". */
  label: string;
  /** Detalhe para o `title`: data e hora quando houver. */
  title: string;
}

function firstNameOf(full: string): string {
  return full.trim().split(/\s+/)[0] ?? '';
}

function formatEditedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Selo "editada" da ideia; `null` quando o texto nunca foi alterado (ou o servidor não informa). */
export function editedBadge(idea: Pick<BrainstormingIdea, 'editedAt' | 'editedByName'>): EditedBadge | null {
  if (!idea.editedAt) return null;
  const who = idea.editedByName ? firstNameOf(idea.editedByName) : '';
  const when = formatEditedAt(idea.editedAt);
  return {
    label: who ? `editada por ${who}` : 'editada',
    title: `Texto editado${when ? ` em ${when}` : ''}${idea.editedByName ? ` por ${idea.editedByName}` : ''}`,
  };
}

// ───────────────────────── Erros das rotas novas ─────────────────────────

export type CeremonyAction = 'finish' | 'reopen' | 'claim' | 'transfer';

/**
 * 404 e 405 nas rotas novas = backend antigo (rota inexistente): a função some, sem erro na tela. A exceção é o
 * `transfer`, cujo 404 também significa "essa pessoa não está nesta sala" (mensagem do servidor em português).
 */
export function isEndpointUnavailable(action: CeremonyAction, error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status === 405) return true;
  if (status !== 404) return false;
  if (action !== 'transfer') return true;
  return !/n[ãa]o est[áa] nesta sala/i.test(String((error as { message?: string }).message ?? ''));
}
