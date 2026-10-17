// Contas dos painéis por papel, sem React: o que cada gráfico mostra a partir das issues, do placar e das pessoas.
// Tudo puro para testar sem rede. Os números vêm do que foi sincronizado do Jira; o que é estimativa por texto
// (débito técnico, fila de revisão e de QA) é marcado como tal nas telas.
import { isAssignedTo, isBugIssue, isDoneIssue, isInProgressIssue, percentOf } from '@/lib/squad-metrics';
import { statusLabelPt } from '@/lib/jira-status';
import type { SquadIssueSnapshot, SquadMember, SquadMetricsRollup } from '@/lib/types';

/** Quantas linhas cada lista curta mostra (tarefas, pendentes, papéis, carga por pessoa). */
export const SHORT_LIST = { tasks: 6, pending: 5, roles: 5, people: 5 } as const;

export interface SprintCore {
  total: number;
  done: number;
  inProgress: number;
  toDo: number;
  bugs: number;
  hasData: boolean;
  /** null = ainda não há escopo (o medidor vira "sem dados" em vez de 0%). */
  doneRate: number | null;
}

/**
 * Placar da sprint. `??` (e não `||`): rollup com 0 itens é um 0 de verdade. Usa a categoria do Jira, não o texto
 * do status.
 */
export function computeSprintCore(rollup: SquadMetricsRollup | null, issues: SquadIssueSnapshot[]): SprintCore {
  const total = rollup?.totalIssues ?? issues.length;
  const done = rollup?.doneIssues ?? issues.filter(isDoneIssue).length;
  const inProgress = rollup?.inProgressIssues ?? issues.filter(isInProgressIssue).length;
  const bugs = rollup?.bugIssues ?? issues.filter(isBugIssue).length;
  return {
    total,
    done,
    inProgress,
    toDo: Math.max(0, total - done - inProgress),
    bugs,
    hasData: !!rollup || issues.length > 0,
    doneRate: percentOf(done, total),
  };
}

export interface LabelValue {
  label: string;
  value: number;
}

function countBy<T>(items: T[], keyOf: (item: T) => string): LabelValue[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Execução (Dev, QA e UX): só as tarefas da própria pessoa, nunca as do time no lugar das dela.
// ---------------------------------------------------------------------------------------------------------------------

export interface ExecutionModel {
  total: number;
  done: number;
  /** null = a pessoa não tem tarefa na sprint. */
  progress: number | null;
  byStatus: LabelValue[];
  /** Bugs seus ainda não concluídos. null quando não há tarefa sua (mostra "—"). */
  openBugs: number | null;
  tasks: SquadIssueSnapshot[];
}

export function buildExecution(myIssues: SquadIssueSnapshot[]): ExecutionModel {
  const total = myIssues.length;
  const done = myIssues.filter(isDoneIssue).length;
  return {
    total,
    done,
    progress: percentOf(done, total),
    byStatus: countBy(myIssues, (i) => statusLabelPt(i.status)),
    openBugs: total > 0 ? myIssues.filter((i) => isBugIssue(i) && !isDoneIssue(i)).length : null,
    tasks: myIssues.slice(0, SHORT_LIST.tasks),
  };
}

export function openBugsHint(total: number, openBugs: number | null): string {
  if (total === 0 || openBugs === null) return 'Sem tarefas suas nesta sprint.';
  if (openBugs === 0) return 'Nenhum bug seu em aberto.';
  return `${openBugs} ${openBugs === 1 ? 'bug seu está' : 'bugs seus estão'} aguardando resolução.`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Product Owner
// ---------------------------------------------------------------------------------------------------------------------

export interface ProductOwnerModel {
  byType: LabelValue[];
  pending: SquadIssueSnapshot[];
}

export function buildProductOwner(issues: SquadIssueSnapshot[]): ProductOwnerModel {
  return {
    byType: countBy(issues, (i) => i.type || 'Sem tipo'),
    pending: issues.filter((i) => !isDoneIssue(i)).slice(0, SHORT_LIST.pending),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Agile Master
// ---------------------------------------------------------------------------------------------------------------------

export type SegmentTone = 'success' | 'brand' | 'muted' | 'danger';

export interface Segment {
  label: string;
  value: number;
  tone: SegmentTone;
  /** Dica em texto (tooltip) para a legenda. */
  hint?: string;
}

/** Status das histórias: concluído, em andamento e o resto (a fazer / backlog). */
export function buildStatusSegments(core: Pick<SprintCore, 'done' | 'inProgress' | 'toDo'>): Segment[] {
  return [
    { label: 'Concluído', value: core.done, tone: 'success' },
    { label: 'Em andamento', value: core.inProgress, tone: 'brand' },
    { label: 'A fazer / backlog', value: core.toDo, tone: 'muted' },
  ];
}

// ---------------------------------------------------------------------------------------------------------------------
// People Lead
// ---------------------------------------------------------------------------------------------------------------------

export interface WorkloadRow {
  name: string;
  /** Horas estimadas no Jira para as tarefas da pessoa. Sem estimativa fica 0. */
  jiraHours: number;
  /** Horas por dia × 5. Sem horas por dia cadastradas fica 0 (sem barra de capacidade). */
  capacity: number;
  role: string;
}

/** Casa a pessoa por id do Jira ou nome completo igual (nunca "contém": "Ana" pegava as tarefas de "Mariana"). */
export function buildWorkload(members: SquadMember[], issues: SquadIssueSnapshot[]): WorkloadRow[] {
  return members.map((m) => {
    const assigned = issues.filter((iss) => isAssignedTo(iss, m));
    return {
      name: m.displayName || m.jiraAccountId,
      jiraHours: Math.round(assigned.reduce((acc, iss) => acc + (iss.estimateSec || 0), 0) / 3600),
      capacity: m.capacityHoursPerDay ? m.capacityHoursPerDay * 5 : 0,
      role: m.role || 'Membro',
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Tech Lead
// ---------------------------------------------------------------------------------------------------------------------

/** Estimativa: conta pelas palavras debt, refactor ou débito no título. O Jira não tem um campo exato para isso aqui. */
export function isTechDebt(issue: { title?: string | null }): boolean {
  return /debt|refactor|débito/i.test(issue.title || '');
}

/** Estimativa: pelo texto do status (contém "review"). Issue concluída não está esperando revisão. */
export function isWaitingReview(issue: { status?: string | null; statusCategory?: string | null }): boolean {
  return !isDoneIssue(issue) && /review/i.test(issue.status || '');
}

/** Estimativa: pelo texto do status (contém "qa" ou "test"). Issue concluída não está esperando teste. */
export function isInQaQueue(issue: { status?: string | null; statusCategory?: string | null }): boolean {
  return !isDoneIssue(issue) && /qa|test/i.test(issue.status || '');
}

export interface TechLeadModel {
  effort: Segment[];
  features: number;
  techDebt: number;
  waitingReview: number;
  inQa: number;
  /** Parte (0 a 100) das tarefas da sprint em cada fila. */
  reviewPct: number;
  qaPct: number;
  people: { name: string; count: number; pct: number }[];
}

export function buildTechLead(issues: SquadIssueSnapshot[], bugs: number, total: number): TechLeadModel {
  const features = issues.filter((i) => !isBugIssue(i) && !isTechDebt(i)).length;
  const techDebt = issues.filter(isTechDebt).length;
  const waitingReview = issues.filter(isWaitingReview).length;
  const inQa = issues.filter(isInQaQueue).length;
  // Maiores cargas primeiro (antes eram as 5 primeiras na ordem em que apareciam, não as 5 maiores).
  const people = countBy(issues, (i) => i.assigneeName || 'Não atribuído')
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, SHORT_LIST.people)
    .map((p) => ({ name: p.label, count: p.value, pct: percentOf(p.value, total) ?? 0 }));
  return {
    effort: [
      { label: 'Funcionalidades', value: features, tone: 'brand' },
      { label: 'Bugs', value: bugs, tone: 'danger' },
      { label: 'Débito técnico', value: techDebt, tone: 'muted' },
    ],
    features,
    techDebt,
    waitingReview,
    inQa,
    reviewPct: percentOf(waitingReview, total) ?? 0,
    qaPct: percentOf(inQa, total) ?? 0,
    people,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Tribo
// ---------------------------------------------------------------------------------------------------------------------

export interface TribeRow {
  id: string;
  name: string;
  rollup: SquadMetricsRollup | null;
  /** true quando o servidor negou a leitura desta squad (fora da tribo de quem consulta). */
  restricted?: boolean;
}

/** Parte dos itens da sprint que já foi concluída. null quando a squad não tem rollup. */
export function predictability(rollup: SquadMetricsRollup | null): number | null {
  if (!rollup) return null;
  return percentOf(rollup.doneIssues ?? 0, rollup.totalIssues);
}

export interface TribeSummary {
  squads: number;
  withData: number;
  avgPredictability: number | null;
  done: number;
  total: number;
  overdue: number;
}

export function summarizeTribe(rows: TribeRow[]): TribeSummary {
  const withData = rows.filter((r) => r.rollup && r.rollup.totalIssues > 0);
  const preds = withData.map((r) => predictability(r.rollup)).filter((n): n is number => n !== null && Number.isFinite(n));
  return {
    squads: rows.length,
    withData: withData.length,
    avgPredictability: preds.length ? Math.round(preds.reduce((a, b) => a + b, 0) / preds.length) : null,
    done: withData.reduce((a, r) => a + (r.rollup?.doneIssues ?? 0), 0),
    total: withData.reduce((a, r) => a + (r.rollup?.totalIssues ?? 0), 0),
    overdue: withData.reduce((a, r) => a + (r.rollup?.overdueIssues ?? 0), 0),
  };
}

/** Squads com dados primeiro; as demais em ordem alfabética. */
export function sortTribeRows(rows: TribeRow[]): TribeRow[] {
  return [...rows].sort(
    (a, b) => Number(!!b.rollup?.totalIssues) - Number(!!a.rollup?.totalIssues) || a.id.localeCompare(b.id),
  );
}

export type PredictabilityTone = 'success' | 'brand' | 'danger';

/** 90% ou mais: verde; de 80% a 89%: cor da marca; abaixo disso: vermelho. */
export function predictabilityTone(pct: number): PredictabilityTone {
  return pct >= 90 ? 'success' : pct >= 80 ? 'brand' : 'danger';
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometria dos gráficos (SVG, sem biblioteca)
// ---------------------------------------------------------------------------------------------------------------------

/** Arco do medidor em meia-lua (viewBox 220 x 128, raio 90, centro em 110,112) até `pct` por cento. */
export function gaugeArcPath(pct: number): string {
  const safe = Math.min(100, Math.max(0, pct));
  const a = (Math.PI * safe) / 100;
  const x = 110 - 90 * Math.cos(a);
  const y = 112 - 90 * Math.sin(a);
  return `M20 112 A90 90 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
}

export const DONUT_RADIUS = 48;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export interface DonutArc {
  label: string;
  value: number;
  tone: SegmentTone | number;
  dasharray: string;
  dashoffset: number;
}

/** Fatias da rosca: cada uma com seu traço e deslocamento (2 px de respiro entre elas). Total 0 -> sem fatias. */
export function donutArcs<T extends { label: string; value: number; tone: SegmentTone | number }>(items: T[]): DonutArc[] {
  const total = items.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return [];
  let acc = 0;
  return items
    .filter((x) => x.value > 0)
    .map((x) => {
      const len = (x.value / total) * DONUT_CIRCUMFERENCE;
      const arc: DonutArc = {
        label: x.label,
        value: x.value,
        tone: x.tone,
        dasharray: `${Math.max(0, len - 2).toFixed(1)} ${(DONUT_CIRCUMFERENCE - len + 2).toFixed(1)}`,
        dashoffset: -acc,
      };
      acc += len;
      return arc;
    });
}

/** Largura (0 a 100) de cada barra em relação à maior. Tudo zero -> 0. */
export function barWidths(items: { value: number }[]): number[] {
  const max = Math.max(0, ...items.map((i) => i.value));
  return items.map((i) => (max > 0 ? Math.round((Math.max(0, i.value) / max) * 100) : 0));
}
