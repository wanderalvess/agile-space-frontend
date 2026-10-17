/**
 * Regras da sala do Brainstorming que não dependem de tela: etapas, quem vê o quê, nome do autor, busca e
 * ordem do Mural, colunas da Matriz, cor dos grupos, cronômetro e estado da conexão. Ficam fora dos
 * componentes para serem testadas sem DOM.
 */
import { getQuadrant, votesOf, type Quadrant } from '@/lib/brainstorming-utils';
import type { BrainstormingGroup, BrainstormingIdea, BrainstormingPhase, TimerState } from '@/lib/types';

// ───────────────────────── Etapas ─────────────────────────

/** As cinco etapas reais da sala, na ordem. O id é o que o servidor guarda em `phase`. */
export const BRAIN_STAGES = [
  { id: 'ideation', label: 'Mural' },
  { id: 'diagram', label: 'Teia' },
  { id: 'grouping', label: 'Grupos' },
  { id: 'prioritization', label: 'Matriz' },
  { id: 'actions', label: 'Plano' },
] as const satisfies readonly { id: BrainstormingPhase; label: string }[];

export function stageLabel(phase: BrainstormingPhase | string | undefined): string {
  return BRAIN_STAGES.find((s) => s.id === phase)?.label ?? 'Mural';
}

/** Fase válida ou o Mural (um valor desconhecido do servidor não pode deixar a sala sem etapa). */
export function normalizeStage(phase: string | undefined | null): BrainstormingPhase {
  return BRAIN_STAGES.find((s) => s.id === phase)?.id ?? 'ideation';
}

/** Só o facilitador troca de etapa: para os demais a navegação fica travada (com cadeado). */
export function isStageNavLocked(isFacilitator: boolean): boolean {
  return !isFacilitator;
}

/** Só o Mural e a Teia sabem gerar a imagem (PNG). */
export function canExportImage(phase: BrainstormingPhase | string | undefined): boolean {
  return phase === 'ideation' || phase === 'diagram';
}

// ───────────────────────── Ideias ─────────────────────────

/** A partir de quantos votos a ideia ganha o selo "Em alta". */
export const HOT_VOTES = 3;

export function isHotIdea(idea: Pick<BrainstormingIdea, 'votes' | 'hidden'>): boolean {
  return !idea.hidden && votesOf(idea).length >= HOT_VOTES;
}

export interface MaskContext {
  /** `settings.isRevealed` (ausente = revelado). */
  revealed?: boolean;
  currentUserId?: string;
  isFacilitator: boolean;
}

/**
 * A ideia deve aparecer coberta ("Ideia oculta")? O servidor já manda o texto vazio e `hidden` para quem não
 * pode lê-la; a segunda condição cobre o intervalo entre o facilitador ocultar e a lista chegar de novo.
 * O facilitador e o autor sempre leem o texto.
 */
export function isIdeaMasked(idea: Pick<BrainstormingIdea, 'hidden' | 'authorId'>, ctx: MaskContext): boolean {
  if (idea.hidden) return true;
  if (ctx.revealed !== false) return false;
  if (ctx.isFacilitator) return false;
  return !(ctx.currentUserId && idea.authorId === ctx.currentUserId);
}

/** Primeiro nome de "Ana Souza Lima" -> "Ana". Vazio devolve vazio. */
export function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}

export interface AuthorInfo {
  kind: 'you' | 'anonymous' | 'person' | 'unknown';
  label: string;
}

/**
 * Quem aparece como autor no cartão. As próprias ideias são "Você"; com os autores anônimos todos os outros são
 * "Anônimo" (o servidor nem manda o autor); senão o primeiro nome vindo da lista de participantes e, se a pessoa
 * já saiu da sala, "Participante".
 */
export function authorInfo(
  idea: Pick<BrainstormingIdea, 'authorId'>,
  ctx: { currentUserId?: string; anonymous: boolean; names: ReadonlyMap<string, string> }
): AuthorInfo {
  if (idea.authorId && ctx.currentUserId && idea.authorId === ctx.currentUserId) return { kind: 'you', label: 'Você' };
  if (ctx.anonymous) return { kind: 'anonymous', label: 'Anônimo' };
  const name = idea.authorId ? firstName(ctx.names.get(idea.authorId)) : '';
  return name ? { kind: 'person', label: name } : { kind: 'unknown', label: 'Participante' };
}

/** Mapa id -> apelido dos participantes (nome completo; quem mostra o primeiro nome é `authorInfo`). */
export function participantNames(participants: readonly { id: string; nickname?: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of participants) if (p.nickname) map.set(p.id, p.nickname);
  return map;
}

export type IdeaOrder = 'recent' | 'popular';

export const IDEA_ORDERS: readonly { id: IdeaOrder; label: string }[] = [
  { id: 'recent', label: 'Recentes' },
  { id: 'popular', label: 'Populares' },
];

const time = (iso: string) => Date.parse(iso) || 0;

/** Busca por trecho do texto (sem diferenciar maiúsculas) e ordem: mais recentes, ou mais votadas e depois mais recentes. */
export function filterAndSortIdeas(ideas: readonly BrainstormingIdea[], query: string, order: IdeaOrder): BrainstormingIdea[] {
  const needle = query.toLowerCase();
  return ideas
    .filter((idea) => idea.content.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (order === 'popular') {
        const diff = votesOf(b).length - votesOf(a).length;
        if (diff !== 0) return diff;
      }
      return time(b.createdAt) - time(a.createdAt);
    });
}

/** Ideias por votos (mais votadas primeiro); empate mantém a ordem da lista. */
export function sortByVotes<T extends Pick<BrainstormingIdea, 'votes'>>(ideas: readonly T[]): T[] {
  return [...ideas].sort((a, b) => votesOf(b).length - votesOf(a).length);
}

export interface BoardTotals {
  ideas: number;
  groups: number;
  votes: number;
}

export function boardTotals(ideas: readonly BrainstormingIdea[], groups: readonly BrainstormingGroup[]): BoardTotals {
  return { ideas: ideas.length, groups: groups.length, votes: ideas.reduce((sum, i) => sum + votesOf(i).length, 0) };
}

/** "23 ideias · 5 grupos · 41 votos" (singular quando é 1). */
export function totalsLine(totals: BoardTotals): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [plural(totals.ideas, 'ideia', 'ideias'), plural(totals.groups, 'grupo', 'grupos'), plural(totals.votes, 'voto', 'votos')].join(' · ');
}

// ───────────────────────── Matriz ─────────────────────────

export interface MatrixColumn {
  id: Quadrant;
  title: string;
  /** Legenda curta em palavras: os degraus 80/20 são só o que a Matriz grava, não um retorno medido. */
  hint: string;
  qualifiers: { roi: number; effort: number };
}

/** As cinco colunas da Matriz e os valores de retorno e esforço que cada uma grava (A classificar = 50/50). */
export const MATRIX_COLUMNS: readonly MatrixColumn[] = [
  { id: 'unclassified', title: 'A classificar', hint: 'ainda sem decisão', qualifiers: { roi: 50, effort: 50 } },
  { id: 'quick_wins', title: 'Quick wins', hint: 'retorno alto · esforço baixo', qualifiers: { roi: 80, effort: 20 } },
  { id: 'strategic', title: 'Estratégico', hint: 'retorno alto · esforço alto', qualifiers: { roi: 80, effort: 80 } },
  { id: 'secondary', title: 'Secundários', hint: 'retorno baixo · esforço baixo', qualifiers: { roi: 20, effort: 20 } },
  { id: 'discard', title: 'Descartar', hint: 'retorno baixo · esforço alto', qualifiers: { roi: 20, effort: 80 } },
];

export function matrixColumn(id: string): MatrixColumn | undefined {
  return MATRIX_COLUMNS.find((c) => c.id === id);
}

/** Legenda do quadrante da ideia em palavras ("Retorno alto · esforço baixo" ou "a classificar"). */
export function quadrantLabel(qualifiers?: { roi?: number; effort?: number } | null): string {
  const quadrant = getQuadrant(qualifiers);
  if (quadrant === 'unclassified') return 'a classificar';
  const hint = matrixColumn(quadrant)?.hint ?? '';
  return hint.charAt(0).toUpperCase() + hint.slice(1);
}

/** Ideias da coluna, mais votadas primeiro. */
export function matrixColumnIdeas(ideas: readonly BrainstormingIdea[], columnId: string): BrainstormingIdea[] {
  return sortByVotes(ideas.filter((idea) => getQuadrant(idea.qualifiers) === columnId));
}

// ───────────────────────── Grupos ─────────────────────────

/** Cores dos grupos (as mesmas em qualquer tema; servem de legenda, não de texto). */
export const GROUP_PALETTE = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#dc2626', '#65a30d'] as const;

/** Cor neutra de "Sem grupo". */
export const NO_GROUP_COLOR = '#94a3b8';

const COLOR_PATTERN = /^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?\([0-9.,%\s/-]+\))$/;

function hashOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

/** Cor para um grupo novo: a primeira da paleta que nenhum grupo usa; acabando as cores, volta ao início. */
export function nextGroupColor(groups: readonly Pick<BrainstormingGroup, 'color'>[]): string {
  const used = new Set(groups.map((g) => (g.color ?? '').toLowerCase()));
  return GROUP_PALETTE.find((c) => !used.has(c)) ?? GROUP_PALETTE[groups.length % GROUP_PALETTE.length];
}

/** Cor do ponto de um grupo. Grupos antigos, sem cor gravada, recebem uma da paleta que não muda entre telas. */
export function groupColorOf(group: Pick<BrainstormingGroup, 'id' | 'color'> | null | undefined): string {
  if (!group) return NO_GROUP_COLOR;
  if (group.color && COLOR_PATTERN.test(group.color.trim())) return group.color.trim();
  return GROUP_PALETTE[hashOf(group.id) % GROUP_PALETTE.length];
}

// ───────────────────────── Cronômetro ─────────────────────────

/** Durações do cronômetro: 1 a 5 minutos e 10, 15 e 20 (a sala nasce com 10). */
export const BRAIN_TIMER_PRESETS = [60, 120, 180, 240, 300, 600, 900, 1200] as const;

export const DEFAULT_TIMER_SECONDS = 600;

/** Tolerância para o fim do tempo contar como "agora" (quem abre a sala depois não vê o aviso nem ouve o alarme). */
export const TIMER_LATE_GRACE_MS = 3000;

export function durationLabel(seconds: number): string {
  const min = Math.round(seconds / 60);
  return `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
}

/** Cronômetro parado na duração dada (como o servidor o grava ao criar e ao mudar a duração). */
export function stoppedTimer(duration: number): TimerState {
  return { status: 'stopped', endTime: null, initialDuration: duration, remainingOnPause: duration };
}

/** Cronômetro rodando por `duration` segundos a partir de `now`. */
export function runningTimer(duration: number, now: number): TimerState {
  return { status: 'running', endTime: now + duration * 1000, initialDuration: duration, remainingOnPause: duration };
}

/** Pausa guarda o que sobrou; devolve `null` quando não há o que pausar. */
export function pausedTimer(timer: TimerState | undefined, now: number): TimerState | null {
  if (!timer || !timer.endTime) return null;
  const remaining = Math.max(0, Math.round((timer.endTime - now) / 1000));
  return { ...timer, status: 'paused', remainingOnPause: remaining };
}

/** Retomar soma o que sobrou ao relógio de agora. */
export function resumedTimer(timer: TimerState | undefined, now: number): TimerState | null {
  if (!timer) return null;
  return { ...timer, status: 'running', endTime: now + timer.remainingOnPause * 1000 };
}

/** Reiniciar volta ao parado na duração escolhida. */
export function resetTimer(timer: TimerState | undefined): TimerState | null {
  if (!timer) return null;
  return { ...timer, status: 'stopped', endTime: null, remainingOnPause: timer.initialDuration };
}

/** O aviso "Tempo esgotado" vale enquanto o cronômetro que zerou segue o mesmo (outro início apaga o aviso). */
export function isTimeUp(timer: TimerState | undefined, expiredEndTime: number | null): boolean {
  return !!timer && timer.status === 'running' && expiredEndTime !== null && timer.endTime === expiredEndTime;
}

// ───────────────────────── Conexão ─────────────────────────

export type RoomConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

export interface RoomConnectionState {
  status: RoomConnectionStatus;
  /** Quedas seguidas desde a última conexão aberta. */
  closes: number;
}

export const INITIAL_CONNECTION: RoomConnectionState = { status: 'connecting', closes: 0 };

/** Depois de tantas quedas seguidas a sala avisa que está sem conexão (antes disso só "reconectando"). */
export const OFFLINE_AFTER_CLOSES = 3;

export function nextConnection(state: RoomConnectionState, event: 'open' | 'close'): RoomConnectionState {
  if (event === 'open') return { status: 'live', closes: 0 };
  const closes = state.closes + 1;
  return { status: closes >= OFFLINE_AFTER_CLOSES ? 'offline' : 'reconnecting', closes };
}

export function connectionLabel(status: RoomConnectionStatus): string {
  switch (status) {
    case 'live':
      return 'Ao vivo';
    case 'connecting':
      return 'Conectando…';
    case 'reconnecting':
      return 'Reconectando…';
    default:
      return 'Sem conexão';
  }
}

// ───────────────────────── Convite ─────────────────────────

/** Texto do convite (editável na janela de compartilhar): nome da sessão, squad e o link. */
export function buildInviteText(opts: { title: string; squad?: string; url: string }): string {
  const title = opts.title.trim() || 'Brainstorming';
  const squad = opts.squad?.trim();
  return `Brainstorming "${title}"${squad ? ` da squad ${squad}` : ''}. Vamos lançar ideias, agrupar e priorizar juntos.\nLink: ${opts.url}`;
}
