import type { HealthCheckBoard, HealthCheckParticipant } from './types';

/**
 * Lógica pura do Radar de clima que depende dos campos novos do backend (encerramento real, quem já respondeu,
 * apresentação sincronizada). Todos os campos novos são opcionais: sem eles tudo cai no comportamento antigo.
 * Contrato: docs/redesign/ceremony-radar-retro.md.
 */

// ───────────────────────── Ciclo de vida ─────────────────────────

/** Radar encerrado? Lê `lifecycleStatus` (novo) e cai em `status` (antigo, `collecting|finished`) quando ele não vem. */
export function isBoardFinished(board: Pick<HealthCheckBoard, 'status' | 'lifecycleStatus'>): boolean {
  if (board.lifecycleStatus === 'FINISHED') return true;
  if (board.lifecycleStatus === 'OPEN') return false;
  return board.status === 'finished';
}

/** Instante do encerramento, ou `null` quando é desconhecido (backend antigo ou radar encerrado antes da migração). */
export function finishedAtOf(board: Pick<HealthCheckBoard, 'finishedAt'>): Date | null {
  if (!board.finishedAt) return null;
  const date = new Date(board.finishedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ───────────────────────── Quem já respondeu ─────────────────────────

export interface ResponseCounts {
  /** Pessoas com pelo menos um voto. */
  responded: number;
  /** Pessoas que votaram em todas as dimensões. */
  completed: number | null;
  /** Pessoas na sala. */
  participants: number;
}

/**
 * Contagens para "N de M já responderam". `null` quando o servidor não informa (backend antigo): a tela esconde
 * o recurso em vez de inventar zero. O total vem da lista de participantes já sincronizada (quando carregada) ou,
 * na lista do lobby, do próprio quadro. Nunca devolve mais respondentes do que pessoas.
 */
export function responseCounts(
  board: Pick<HealthCheckBoard, 'respondedCount' | 'completedCount' | 'participantsCount'>,
  participants?: readonly unknown[]
): ResponseCounts | null {
  if (typeof board.respondedCount !== 'number' || !Number.isFinite(board.respondedCount)) return null;
  const total = participants ? Math.max(participants.length, 0) : board.participantsCount;
  if (typeof total !== 'number' || !Number.isFinite(total)) return null;
  const participantsCount = Math.max(total, 0);
  const responded = Math.min(Math.max(Math.floor(board.respondedCount), 0), participantsCount);
  const completed = typeof board.completedCount === 'number' && Number.isFinite(board.completedCount)
    ? Math.min(Math.max(Math.floor(board.completedCount), 0), responded)
    : null;
  return { responded, completed, participants: participantsCount };
}

/** "5 de 8 já responderam" / "1 de 1 já respondeu". */
export function respondedLabel(counts: ResponseCounts): string {
  const verb = counts.responded === 1 && counts.participants === 1 ? 'já respondeu' : 'já responderam';
  return `${counts.responded} de ${counts.participants} ${verb}`;
}

/** Percentual (0 a 100) de quem já respondeu; 0 sem ninguém na sala. */
export function respondedPercent(counts: ResponseCounts): number {
  return counts.participants > 0 ? Math.round((counts.responded / counts.participants) * 100) : 0;
}

/** Resposta de `GET /{id}/progress`. `pendingParticipantIds` só existe para o criador/ADMIN. */
export interface HealthProgress {
  boardId?: string;
  dimensionsCount?: number;
  participantsCount?: number;
  respondedCount?: number;
  completedCount?: number;
  pendingParticipantIds?: string[];
}

export interface PendingPerson {
  id: string;
  name: string;
}

/**
 * "Ainda não votaram": ids do servidor -> nomes pelos participantes do quadro. Quem não está na lista (saiu da sala
 * entre a consulta e a lista) é descartado, e a ordem é alfabética. `null` = o servidor não mandou a lista
 * (quem consulta não é o facilitador, ou backend antigo): a tela não mostra o bloco.
 */
export function pendingPeople(
  progress: Pick<HealthProgress, 'pendingParticipantIds'> | null | undefined,
  participants: readonly Pick<HealthCheckParticipant, 'id' | 'nickname'>[]
): PendingPerson[] | null {
  const ids = progress?.pendingParticipantIds;
  if (!Array.isArray(ids)) return null;
  const byId = new Map(participants.map((p) => [p.id, p.nickname]));
  const seen = new Set<string>();
  const people: PendingPerson[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    const name = byId.get(id);
    if (name) people.push({ id, name });
  }
  return people.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/**
 * A lista de pendentes precisa ser refeita? Quando o número de respondentes muda (ou a lista nunca foi buscada) e o
 * radar ainda coleta. O facilitador é o único que lê a lista; para os demais a contagem do quadro basta.
 */
export function shouldRefetchProgress(args: { enabled: boolean; finished: boolean; respondedCount: number | undefined; lastFetchedFor: number | null | undefined }): boolean {
  if (!args.enabled || args.finished) return false;
  if (typeof args.respondedCount !== 'number') return false;
  return args.lastFetchedFor === null || args.lastFetchedFor === undefined || args.lastFetchedFor !== args.respondedCount;
}

// ───────────────────────── Apresentação sincronizada ─────────────────────────

/** Etapas que o frontend publica. O servidor aceita qualquer texto de 1 a 40 caracteres `A-Za-z0-9_-.`. */
export const SYNC_STAGE_IDS = ['score', 'radar', 'freq', 'comments', 'plan'] as const;
export type SyncStageId = (typeof SYNC_STAGE_IDS)[number];

/** Etapa publicada que esta tela sabe mostrar; qualquer outra coisa é ignorada (versão nova do facilitador). */
export function knownStage(stage: unknown): SyncStageId | null {
  return typeof stage === 'string' && (SYNC_STAGE_IDS as readonly string[]).includes(stage) ? (stage as SyncStageId) : null;
}

/** Lê `presentationStage` de um quadro. `undefined` = o servidor não conhece o recurso (backend antigo). */
export function publishedStageOf(board: Pick<HealthCheckBoard, 'presentationStage'> | null | undefined): string | null | undefined {
  if (!board) return undefined;
  if (board.presentationStage === undefined) return undefined;
  return board.presentationStage ?? null;
}

export interface FollowInput {
  /** "Acompanhar o facilitador" ligado. */
  follow: boolean;
  /** Etapa publicada agora (`null` = sem apresentação; `undefined` = backend sem o recurso). */
  published: string | null | undefined;
  /** Quem publica (criador/ADMIN) nunca segue. */
  isFacilitator: boolean;
}

/**
 * Esta pessoa está seguindo o facilitador agora? Segue quando não é o facilitador, a opção está ligada e há uma
 * etapa conhecida publicada. Devolve a etapa a mostrar (`null` quando não segue). É derivado, sem estado: quando o
 * facilitador encerra a apresentação (`published` volta a `null`) a pessoa sai sozinha; quem abriu a própria
 * apresentação mantém a dela.
 */
export function followState({ follow, published, isFacilitator }: FollowInput): { following: boolean; stage: SyncStageId | null } {
  const stage = knownStage(published);
  if (isFacilitator || !follow || !stage) return { following: false, stage: null };
  return { following: true, stage };
}
