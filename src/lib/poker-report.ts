import type { DeckType, Issue, Participant, Vote, VotingRound } from './types';
import {
  TECHNICAL_CATEGORIES,
  computeSessionBreakdown,
  computeTopicTiming,
  formatEstimateCopy,
  formatRoleForCopy,
  getParticipantCategory,
  type SessionBreakdown,
  type TopicTimingRow,
} from './poker-utils';

/**
 * Modelo do relatório final do refinamento (o documento que o facilitador mostra,
 * imprime e leva para a gestão). Tudo aqui é puro e testável: a tela, o PDF
 * (impressão), o Markdown, o CSV, o texto do TDN e o "Copiar resumo" leem este
 * mesmo objeto, então os números nunca divergem entre os formatos.
 *
 * Só usa o que a sala já tem (tarefas, rodadas, votos, notas, horários da
 * sessão). Nada é inventado: o que o backend não fornece fica `null`/vazio e a
 * interface simplesmente não mostra.
 */

// ---------------------------------------------------------------------------
// Formatação (pt-BR)
// ---------------------------------------------------------------------------

/** "7,5" / "12" — vírgula decimal, no máximo 1 casa, sem zeros à direita. */
export function formatNumber(n: number, maxFractionDigits = 1): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function formatHours(n: number): string {
  return `${formatNumber(n)}h`;
}

export function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

/** 58 -> "58 min"; 72 -> "1h12"; 120 -> "2h". */
export function formatDurationMins(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`;
}

/** Número vindo de string do backend ("8", "7.5", "7,5"); null quando não é número. */
export function parseNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const t = value.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return isFinite(n) ? n : null;
}

const SIZES = ['PP', 'P', 'M', 'G', 'GG', '?'];

/** Rótulo da estimativa final conforme o baralho: "14h", "5 SP", "M". Vazio vira "—". */
export function formatEstimateLabel(raw: string | null | undefined, deck: DeckType): string {
  if (!raw || raw.trim() === '' || raw === 'N/A') return '—';
  const clean = raw.trim().toUpperCase();
  if (SIZES.includes(clean)) return clean;
  const n = parseNum(raw);
  const shown = n === null ? raw.trim() : formatNumber(n);
  if (deck === 'hours') return `${shown}h`;
  if (deck === 'tshirt') return n === null ? shown : `${shown}h`;
  return `${shown} SP`;
}

export function deckLabel(deck: DeckType): string {
  return deck === 'hours' ? 'Horas' : deck === 'tshirt' ? 'Camisetas (P/M/G)' : 'Fibonacci (SP)';
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TaskSituation =
  | 'consenso'      // estimada em uma rodada, sem divergência crítica
  | 'revotada'      // estimada depois de mais de uma rodada
  | 'divergencia'   // estimada, mas a rodada final ainda tinha divergência crítica
  | 'estimada'      // estimada sem rodada registrada (histórico incompleto)
  | 'adiada'        // adiada e ainda sem estimativa
  | 'pulada'
  | 'cancelada'
  | 'nao_abordada';

export const SITUATION_LABEL: Record<TaskSituation, string> = {
  consenso: 'Consenso',
  revotada: 'Revotada',
  divergencia: 'Divergência',
  estimada: 'Estimada',
  adiada: 'Adiada',
  pulada: 'Pulada',
  cancelada: 'Cancelada',
  nao_abordada: 'Não abordada',
};

export const SITUATION_ORDER: TaskSituation[] = ['consenso', 'revotada', 'divergencia', 'estimada', 'adiada', 'pulada', 'cancelada', 'nao_abordada'];

export interface TaskDivergence {
  /** Papel (categoria técnica) que mais divergiu. */
  role: string;
  /** Menor e maior voto do papel, já formatados ("6h", "M"). */
  low: string;
  high: string;
  /** "Divergência crítica no DEV · 6h a 16h". */
  text: string;
}

export interface ReportTask {
  id: string;
  /** Posição na pauta (1 = primeira). */
  order: number;
  key: string | null;
  title: string;
  jiraLink: string | null;
  /** Responsável no Jira, quando a tarefa veio de lá. */
  assignee: string | null;
  situation: TaskSituation;
  estimated: boolean;
  /** Estimativa final como gravada na tarefa ("14", "M"). */
  estimateRaw: string | null;
  /** Valor numérico da estimativa (horas, SP ou horas de camiseta); null se não houver. */
  total: number | null;
  /** "14h", "5 SP", "M" ou "—". */
  totalLabel: string;
  /** Horas por papel (só baralho de horas; sem zeros). */
  roles: Record<string, number>;
  /** Rodadas de votação realizadas (sem as puladas). */
  rounds: number;
  parkCount: number;
  /** Como a tarefa adiada terminou. */
  parkOutcome: 'retomada e estimada' | 'terminou pulada' | 'ficou pendente' | null;
  parkedNote: string | null;
  divergence: TaskDivergence | null;
  decisionNote: string | null;
  /** Motivo de pular/cancelar. */
  reason: string | null;
  devNotes: string | null;
  qaNotes: string | null;
  /** "(DEV 10h / QA 4h)" — o mesmo texto do "Copiar estimativa" da mesa. Vazio fora do baralho de horas. */
  copyText: string;
}

export interface RoleTotal {
  role: string;
  label: string;
  hours: number;
  /** Tarefas estimadas em que o papel tem horas. */
  tasks: number;
}

export interface ReportHeader {
  title: string;
  team: string | null;
  deck: DeckType;
  deckLabel: string;
  /** "Horas", "Story points", "Tamanhos". */
  unitLabel: string;
  startedAt: string | null;
  endedAt: string | null;
  /** "14/10/2026" — dia da sessão (ou do relatório, se a sessão não registrou início). */
  dateLabel: string;
  /** "terça-feira, 14 de outubro de 2026". */
  dateLong: string;
  /** "10:30 às 11:42" quando há início e fim. */
  timeRange: string | null;
  /** Duração ativa (descontadas as pausas), em minutos. */
  durationMins: number | null;
  durationLabel: string;
  idleMins: number;
  facilitators: string[];
  participantsCount: number;
  participantsByRole: Array<{ label: string; count: number }>;
}

export interface ReportKpis {
  agenda: number;
  estimated: number;
  discussed: number;
  skipped: number;
  cancelled: number;
  /** Adiadas e ainda sem estimativa. */
  parkedPending: number;
  /** Nunca chegaram à mesa (e não foram adiadas). */
  untouched: number;
  /** pulada + cancelada + adiada pendente + não abordada. */
  outside: number;
  /** Soma das estimativas finais (null quando nenhuma é numérica). */
  total: number | null;
  totalLabel: string;
  roleTotals: RoleTotal[];
  /** Tarefas estimadas com ao menos uma rodada registrada. */
  withRounds: number;
  /** Fechadas na 1ª rodada, sem divergência crítica. */
  firstRoundClosed: number;
  firstRoundPct: number | null;
  avgRounds: number | null;
  revoted: number;
  divergent: number;
  largest: { task: ReportTask; label: string } | null;
  /** Minutos por tarefa debatida. */
  avgMinsPerTopic: number | null;
  /** Distribuição das estimativas finais em decks sem soma (camisetas). */
  distribution: Array<{ label: string; count: number }>;
}

export interface ReportTotals {
  roles: Record<string, number>;
  total: number | null;
  /** Soma dos papéis difere da soma das estimativas finais (ajuste manual de alguma tarefa). */
  rolesDiffer: boolean;
  /** Algumas estimativas não são numéricas e ficaram fora da soma. */
  partial: boolean;
}

export interface ReportHighlights {
  largest: ReportTask[];
  mostDiscussed: ReportTask[];
  divergent: ReportTask[];
  pending: ReportTask[];
  cancelled: ReportTask[];
  withNotes: ReportTask[];
}

export interface SessionReportData {
  header: ReportHeader;
  /** Colunas de papel da tabela (ordem canônica: DEV, QA, UX, Designer, outros). */
  roles: Array<{ role: string; label: string }>;
  tasks: ReportTask[];
  kpis: ReportKpis;
  totals: ReportTotals;
  highlights: ReportHighlights;
  breakdown: SessionBreakdown;
  topicTiming: TopicTimingRow[];
  activeMins: number;
}

export interface ReportInput {
  roomTitle?: string;
  roomTeam?: string;
  deck: DeckType;
  issues: Issue[];
  participants: Participant[];
  rounds?: VotingRound[];
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  /** Limites de divergência (horas). Padrão da sala: { warn: 2, high: 5 }. */
  divergenceThresholds?: { warn: number; high: number };
  /** Inclui o tempo por tópico (mesma flag da visão ao vivo). */
  perTopicTime?: boolean;
  /** Para testes e fuso: relógio e fuso usados nas datas. */
  now?: Date;
  timeZone?: string;
}

// ---------------------------------------------------------------------------
// Papéis e participantes
// ---------------------------------------------------------------------------

export function roleLabel(role: string): string {
  return formatRoleForCopy(role);
}

function roleRank(role: string): number {
  const i = (TECHNICAL_CATEGORIES as readonly string[]).indexOf(role);
  return i === -1 ? TECHNICAL_CATEGORIES.length : i;
}

function categoryLabel(category: ReturnType<typeof getParticipantCategory>): string {
  if (category === 'Developer') return 'DEV';
  if (category === 'QA') return 'QA';
  if (category === 'UX') return 'UX';
  if (category === 'Designer') return 'Designer';
  if (category === 'Management') return 'Gestão';
  return 'Observadores';
}

const CATEGORY_ORDER = ['DEV', 'QA', 'UX', 'Designer', 'Gestão', 'Observadores'];

export function summarizeParticipants(participants: Participant[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  participants.forEach((p) => {
    const label = categoryLabel(getParticipantCategory(p));
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return CATEGORY_ORDER.filter((l) => counts.has(l)).map((label) => ({ label, count: counts.get(label)! }));
}

// ---------------------------------------------------------------------------
// Divergência por rodada
// ---------------------------------------------------------------------------

/** Votos por papel técnico de uma rodada (gestão e espectadores ficam de fora, como na mesa). */
export function roleVotesOfRound(round: Pick<VotingRound, 'votes'>, participants: Participant[]): Record<string, string[]> {
  const map = new Map(participants.map((p) => [p.id, p]));
  const out: Record<string, string[]> = {};
  (round.votes || []).forEach((v: Vote) => {
    const p = map.get(v.participantId);
    const category = p
      ? getParticipantCategory(p)
      : v.participantRole
        ? getParticipantCategory({ role: v.participantRole, globalRole: v.participantGlobalRole })
        : null;
    if (!category || category === 'Management') return;
    (out[category] ||= []).push(v.value);
  });
  return out;
}

/**
 * Pior divergência crítica da rodada, no mesmo critério da mesa: baralho de
 * horas compara a diferença (máx - mín) com o limite "high"; os outros baralhos
 * consideram crítico qualquer papel (com 2+ votos) que não votou igual.
 */
export function criticalDivergence(
  round: Pick<VotingRound, 'votes'>,
  participants: Participant[],
  deck: DeckType,
  thresholds: { warn: number; high: number } = { warn: 2, high: 5 }
): TaskDivergence | null {
  const byRole = roleVotesOfRound(round, participants);
  let worst: { role: string; spread: number; low: string; high: string } | null = null;
  for (const [role, values] of Object.entries(byRole)) {
    if (values.length < 2) continue;
    if (deck === 'hours') {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      if (nums.length < 2) continue;
      const lo = Math.min(...nums);
      const hi = Math.max(...nums);
      if (hi - lo > thresholds.high && (!worst || hi - lo > worst.spread)) {
        worst = { role, spread: hi - lo, low: formatHours(lo), high: formatHours(hi) };
      }
    } else if (new Set(values).size > 1) {
      const sorted = [...new Set(values)];
      const spread = sorted.length;
      if (!worst || spread > worst.spread) worst = { role, spread, low: sorted[0], high: sorted[sorted.length - 1] };
    }
  }
  if (!worst) return null;
  const name = roleLabel(worst.role);
  return { role: worst.role, low: worst.low, high: worst.high, text: `Divergência crítica no ${name} · ${worst.low} a ${worst.high}` };
}

// ---------------------------------------------------------------------------
// Montagem do relatório
// ---------------------------------------------------------------------------

function clean(text: string | null | undefined): string | null {
  const t = (text ?? '').trim();
  return t === '' ? null : t;
}

function rolePointsOf(issue: Issue): Record<string, number> {
  const raw: Record<string, string | null | undefined> = issue.rolePoints ?? { Developer: issue.devPoints, QA: issue.qaPoints };
  const out: Record<string, number> = {};
  for (const [role, value] of Object.entries(raw)) {
    const n = parseNum(value);
    if (n !== null && n !== 0) out[role] = n;
  }
  return out;
}

function parkOutcomeOf(i: Issue): ReportTask['parkOutcome'] {
  if (!((i.parkCount || 0) > 0 || i.parked)) return null;
  if (i.skipped) return 'terminou pulada';
  return i.status === 'completed' ? 'retomada e estimada' : 'ficou pendente';
}

function dateParts(iso: string | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

export function buildSessionReport(input: ReportInput): SessionReportData {
  const { deck, issues, participants, sessionStartedAt, sessionEndedAt, timeZone } = input;
  const rounds = input.rounds ?? [];
  const isHours = deck === 'hours';

  // ---- rodadas por tarefa (sem as puladas/canceladas), em ordem cronológica
  const byIssue = new Map<string, VotingRound[]>();
  const titleCount = new Map<string, number>();
  issues.forEach((i) => titleCount.set(i.title, (titleCount.get(i.title) ?? 0) + 1));
  const idByTitle = new Map(issues.filter((i) => titleCount.get(i.title) === 1).map((i) => [i.title, i.id]));
  rounds
    .filter((r) => !r.skipped && !r.cancelled)
    .forEach((r) => {
      const id = r.issueId || idByTitle.get(r.topic);
      if (!id) return;
      (byIssue.get(id) ?? byIssue.set(id, []).get(id)!).push(r);
    });
  byIssue.forEach((list) => list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));

  // ---- tarefas
  const tasks: ReportTask[] = issues.map((i, idx) => {
    const estimated = !i.skipped && !i.cancelled && i.status === 'completed';
    const parked = (i.parkCount || 0) > 0 || !!i.parked;
    const list = byIssue.get(i.id) ?? [];
    const finalRound = [...list].reverse().find((r) => (r.votes || []).length > 0) ?? list[list.length - 1];
    const divergence = estimated && finalRound ? criticalDivergence(finalRound, participants, deck, input.divergenceThresholds) : null;

    let situation: TaskSituation;
    if (i.cancelled) situation = 'cancelada';
    else if (i.skipped) situation = 'pulada';
    else if (estimated) situation = divergence ? 'divergencia' : list.length > 1 ? 'revotada' : list.length === 1 ? 'consenso' : 'estimada';
    else situation = parked ? 'adiada' : 'nao_abordada';

    const roles = estimated && isHours ? rolePointsOf(i) : {};
    const total = estimated ? parseNum(i.estimatedPoints) : null;
    const copyText = estimated && isHours
      ? formatEstimateCopy(Object.entries(roles).map(([role, v]) => ({ role, value: String(v) })), 'h', { skipZero: true })
      : '';

    return {
      id: i.id,
      order: idx + 1,
      key: clean(i.key),
      title: i.title,
      jiraLink: clean(i.jiraLink),
      assignee: clean(i.jiraAssignee),
      situation,
      estimated,
      estimateRaw: estimated ? i.estimatedPoints ?? null : null,
      total,
      totalLabel: estimated ? formatEstimateLabel(i.estimatedPoints, deck) : '—',
      roles,
      rounds: list.length,
      parkCount: i.parkCount || (i.parked ? 1 : 0),
      parkOutcome: parkOutcomeOf(i),
      parkedNote: clean(i.parkedNote),
      divergence,
      decisionNote: estimated ? clean(i.decisionNote) : null,
      reason: i.skipped || i.cancelled ? clean(i.note) : null,
      devNotes: clean(i.devNotes),
      qaNotes: clean(i.qaNotes),
      copyText,
    };
  });

  const est = tasks.filter((t) => t.estimated);

  // ---- colunas de papel e totais
  const roleSet = new Set<string>();
  est.forEach((t) => Object.keys(t.roles).forEach((r) => roleSet.add(r)));
  const roleKeys = [...roleSet].sort((a, b) => roleRank(a) - roleRank(b));
  const roles = roleKeys.map((role) => ({ role, label: roleLabel(role) }));

  const roleTotals: RoleTotal[] = roleKeys.map((role) => {
    const withRole = est.filter((t) => t.roles[role]);
    return { role, label: roleLabel(role), hours: withRole.reduce((s, t) => s + t.roles[role], 0), tasks: withRole.length };
  });

  const numeric = est.filter((t) => t.total !== null);
  const total = numeric.length > 0 ? numeric.reduce((s, t) => s + (t.total as number), 0) : null;
  const rolesSum = roleTotals.reduce((s, r) => s + r.hours, 0);
  const totals: ReportTotals = {
    roles: Object.fromEntries(roleTotals.map((r) => [r.role, r.hours])),
    total,
    rolesDiffer: isHours && total !== null && roleTotals.length > 0 && Math.abs(rolesSum - total) > 0.001,
    partial: numeric.length < est.length,
  };

  // ---- tempo
  const timing = computeTopicTiming(rounds, issues, sessionStartedAt);
  const activeMins = timing.reduce((s, r) => s + r.mins, 0);
  const idleMins = timing.reduce((s, r) => s + r.idleMins, 0);
  const breakdown = computeSessionBreakdown(issues, rounds);
  const start = dateParts(sessionStartedAt);
  const end = dateParts(sessionEndedAt);
  const rawMins = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)) : 0;
  const durationMins = activeMins > 0 ? activeMins : rawMins > 0 ? rawMins : null;

  const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { ...opts, timeZone }).format(d);
  const day = start ?? end ?? input.now ?? new Date();
  const timeRange = start && end ? `${fmtDate(start, { hour: '2-digit', minute: '2-digit' })} às ${fmtDate(end, { hour: '2-digit', minute: '2-digit' })}` : null;

  const facilitators = participants.filter((p) => p.isFacilitator).map((p) => p.nickname).filter(Boolean);

  const header: ReportHeader = {
    title: clean(input.roomTitle) ?? 'Scrum Poker',
    team: clean(input.roomTeam),
    deck,
    deckLabel: deckLabel(deck),
    unitLabel: isHours ? 'Horas' : deck === 'fibonacci' ? 'Story points' : 'Tamanhos',
    startedAt: sessionStartedAt ?? null,
    endedAt: sessionEndedAt ?? null,
    dateLabel: fmtDate(day, { day: '2-digit', month: '2-digit', year: 'numeric' }),
    dateLong: fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    timeRange,
    durationMins,
    durationLabel: durationMins !== null ? formatDurationMins(durationMins) : 'N/A',
    idleMins,
    facilitators,
    participantsCount: participants.length,
    participantsByRole: summarizeParticipants(participants),
  };

  // ---- indicadores
  const withRounds = est.filter((t) => t.rounds >= 1);
  const firstRoundClosed = est.filter((t) => t.situation === 'consenso').length;
  const roundsSum = withRounds.reduce((s, t) => s + t.rounds, 0);
  const pending = tasks.filter((t) => t.situation === 'pulada' || t.situation === 'adiada' || t.situation === 'nao_abordada');
  const cancelledTasks = tasks.filter((t) => t.situation === 'cancelada');
  const largestTask = numeric.reduce<ReportTask | null>((best, t) => (!best || (t.total as number) > (best.total as number) ? t : best), null);

  const distribution = !isHours && total === null
    ? Object.entries(est.reduce<Record<string, number>>((acc, t) => { acc[t.totalLabel] = (acc[t.totalLabel] ?? 0) + 1; return acc; }, {}))
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => SIZES.indexOf(a.label) - SIZES.indexOf(b.label))
    : [];

  const kpis: ReportKpis = {
    agenda: tasks.length,
    estimated: est.length,
    discussed: breakdown.discussed,
    skipped: tasks.filter((t) => t.situation === 'pulada').length,
    cancelled: cancelledTasks.length,
    parkedPending: tasks.filter((t) => t.situation === 'adiada').length,
    untouched: tasks.filter((t) => t.situation === 'nao_abordada').length,
    outside: pending.length + cancelledTasks.length,
    total,
    totalLabel: total === null ? '—' : isHours ? formatHours(total) : deck === 'fibonacci' ? `${formatNumber(total)} SP` : formatHours(total),
    roleTotals,
    withRounds: withRounds.length,
    firstRoundClosed,
    firstRoundPct: withRounds.length > 0 ? (firstRoundClosed / withRounds.length) * 100 : null,
    avgRounds: withRounds.length > 0 ? roundsSum / withRounds.length : null,
    revoted: est.filter((t) => t.rounds > 1).length,
    divergent: est.filter((t) => t.situation === 'divergencia').length,
    largest: largestTask && (largestTask.total as number) > 0 ? { task: largestTask, label: largestTask.totalLabel } : null,
    avgMinsPerTopic: durationMins !== null && breakdown.discussed > 0 ? durationMins / breakdown.discussed : durationMins !== null ? 0 : null,
    distribution,
  };

  const highlights: ReportHighlights = {
    largest: [...numeric].filter((t) => (t.total as number) > 0).sort((a, b) => (b.total as number) - (a.total as number) || a.order - b.order).slice(0, 3),
    mostDiscussed: est.filter((t) => t.rounds >= 2).sort((a, b) => b.rounds - a.rounds || (b.total ?? 0) - (a.total ?? 0) || a.order - b.order).slice(0, 3),
    divergent: est.filter((t) => t.situation === 'divergencia'),
    pending,
    cancelled: cancelledTasks,
    withNotes: tasks.filter((t) => t.devNotes || t.qaNotes),
  };

  const topicTiming = input.perTopicTime ? timing : [];

  return { header, roles, tasks, kpis, totals, highlights, breakdown, topicTiming, activeMins };
}

// ---------------------------------------------------------------------------
// Tabela: filtro e ordenação (compartilhado entre a tela e os testes)
// ---------------------------------------------------------------------------

export type TaskSort = 'pauta' | 'maior' | 'rodadas';

export function sortTasks(tasks: ReportTask[], sort: TaskSort): ReportTask[] {
  const list = [...tasks];
  if (sort === 'maior') return list.sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.order - b.order);
  if (sort === 'rodadas') return list.sort((a, b) => b.rounds - a.rounds || a.order - b.order);
  return list.sort((a, b) => a.order - b.order);
}

export function countBySituation(tasks: ReportTask[]): Record<TaskSituation, number> {
  const out = Object.fromEntries(SITUATION_ORDER.map((s) => [s, 0])) as Record<TaskSituation, number>;
  tasks.forEach((t) => { out[t.situation] += 1; });
  return out;
}

/** "PTV-12 Título" — identificação curta de uma tarefa. */
export function taskName(t: Pick<ReportTask, 'key' | 'title'>): string {
  return t.key ? `${t.key} ${t.title}` : t.title;
}
