import {
  SITUATION_LABEL,
  SITUATION_ORDER,
  formatHours,
  formatNumber,
  formatPercent,
  type ReportTask,
  type SessionReportData,
  type TaskSituation,
} from './poker-report';

/**
 * "Página de resultados": a folha-resumo (1 página A4) que o facilitador leva para
 * a gestão. É calculada a partir do mesmo `SessionReportData` da tela, da impressão
 * e do PDF, então os números sempre batem. Só usa o que a sala já tem; o que faltar
 * não é inventado: some da folha e vira uma linha em `omitted`.
 */

export interface ResultsKpi {
  id: string;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  /** Destaque visual (total de esforço). */
  main?: boolean;
  /** Alerta (divergência). */
  tone?: 'danger' | 'warn';
}

export interface ResultsBar {
  key: string;
  label: string;
  /** Horas do papel. */
  value: number;
  valueLabel: string;
  /** Participação no maior valor (0 a 1), para o comprimento da barra. */
  ratio: number;
  /** Participação no total dos papéis (0 a 1). */
  share: number;
  /** "3 tarefas". */
  sub: string;
}

export interface ResultsSegment {
  situation: TaskSituation;
  label: string;
  count: number;
  /** Fração do total de tarefas da pauta (0 a 1). */
  share: number;
}

export interface ResultsPageData {
  title: string;
  team: string | null;
  dateLabel: string;
  dateLong: string;
  timeRange: string | null;
  durationLabel: string | null;
  deckLabel: string;
  facilitators: string[];
  participantsCount: number;
  participantsByRole: Array<{ label: string; count: number }>;
  agenda: number;
  kpis: ResultsKpi[];
  /** Horas por papel (vazio fora do baralho de horas ou sem horas por papel). */
  roleBars: ResultsBar[];
  /** Tarefas por situação, só as que existem. */
  situation: ResultsSegment[];
  /** As maiores estimativas (até 3). */
  largest: Array<{ task: ReportTask; detail: string }>;
  /** Pendências sem estimativa (puladas, adiadas, não abordadas), na ordem da pauta. */
  pending: Array<{ task: ReportTask; detail: string }>;
  cancelled: number;
  /** O que a sala não tinha e por isso ficou fora da folha. */
  omitted: string[];
}

/** Cores das barras da situação das tarefas (a legenda sempre traz o nome e a contagem). */
export const SEGMENT_COLOR: Record<TaskSituation, string> = {
  consenso: '#16a34a',
  revotada: '#0ea5e9',
  divergencia: '#dc2626',
  estimada: '#64748b',
  adiada: '#f59e0b',
  pulada: '#d97706',
  cancelada: '#94a3b8',
  nao_abordada: '#cbd5e1',
};

const ROLE_BAR: Record<string, string> = { Developer: '#0e7490', QA: '#002233', UX: '#A44DFF', Designer: '#FF8900' };
/** Cor da barra de um papel (papéis desconhecidos ficam em cinza). */
export const roleBarColor = (role: string): string => ROLE_BAR[role] ?? '#64748b';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function buildResultsPage(report: SessionReportData): ResultsPageData {
  const { header: h, kpis: k, highlights: hl } = report;
  const isHours = h.deck === 'hours';
  const omitted: string[] = [];

  const kpis: ResultsKpi[] = [
    {
      id: 'estimated',
      label: 'Tarefas estimadas',
      value: String(k.estimated),
      unit: `de ${k.agenda}`,
      sub: plural(k.discussed, 'debatida', 'debatidas'),
    },
  ];
  if (k.total !== null) {
    kpis.push({
      id: 'total',
      label: isHours ? 'Total de horas' : h.deck === 'fibonacci' ? 'Total de pontos' : 'Total estimado',
      value: formatNumber(k.total),
      unit: isHours || h.deck === 'tshirt' ? 'h' : 'SP',
      sub: 'Esforço estimado',
      main: true,
    });
  } else if (k.distribution.length > 0) {
    kpis.push({ id: 'total', label: 'Tamanhos estimados', value: k.distribution.map((d) => `${d.count}×${d.label}`).join(' '), sub: 'Quantidade por tamanho', main: true });
  } else {
    omitted.push('Total estimado: nenhuma tarefa teve estimativa numérica.');
  }

  if (k.firstRoundPct !== null) {
    kpis.push({ id: 'first', label: 'Consenso na 1ª rodada', value: formatPercent(k.firstRoundPct), sub: `${k.firstRoundClosed} de ${k.withRounds} estimadas` });
  }
  if (k.avgRounds !== null) {
    kpis.push({ id: 'avg', label: 'Média de rodadas', value: formatNumber(k.avgRounds), unit: 'por tarefa', sub: k.revoted > 0 ? plural(k.revoted, 'revotada', 'revotadas') : 'Nenhuma revotação' });
  }
  if (k.firstRoundPct === null && k.avgRounds === null) {
    omitted.push('Consenso na 1ª rodada e média de rodadas: a sessão não registrou rodadas de votação.');
  }
  kpis.push({
    id: 'divergent',
    label: 'Divergências críticas',
    value: String(k.divergent),
    sub: k.divergent > 0 ? 'Estimadas com votos distantes' : 'Nenhuma tarefa',
    tone: k.divergent > 0 ? 'danger' : undefined,
  });
  if (k.largest) {
    kpis.push({ id: 'largest', label: 'Maior estimativa', value: k.largest.label, sub: `${k.largest.task.key ? `${k.largest.task.key} · ` : ''}${k.largest.task.title}` });
  }

  // Horas por papel (barras)
  const roleTotal = k.roleTotals.reduce((s, r) => s + r.hours, 0);
  const roleMax = Math.max(0, ...k.roleTotals.map((r) => r.hours));
  const roleBars: ResultsBar[] =
    isHours && roleMax > 0
      ? k.roleTotals.map((r) => ({
          key: r.role,
          label: r.label,
          value: r.hours,
          valueLabel: formatHours(r.hours),
          ratio: r.hours / roleMax,
          share: roleTotal > 0 ? r.hours / roleTotal : 0,
          sub: plural(r.tasks, 'tarefa', 'tarefas'),
        }))
      : [];
  if (roleBars.length === 0) {
    omitted.push(isHours ? 'Horas por papel: nenhuma estimativa com horas por papel foi registrada.' : 'Horas por papel: disponível apenas no baralho de horas.');
  }

  // Situação das tarefas (barra empilhada)
  const total = report.tasks.length;
  const counts = new Map<TaskSituation, number>();
  report.tasks.forEach((t) => counts.set(t.situation, (counts.get(t.situation) ?? 0) + 1));
  const situation: ResultsSegment[] = SITUATION_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
    situation: s,
    label: SITUATION_LABEL[s],
    count: counts.get(s) ?? 0,
    share: total > 0 ? (counts.get(s) ?? 0) / total : 0,
  }));

  const pendingDetail = (t: ReportTask) =>
    [t.reason ?? t.parkedNote, t.assignee ? `Responsável no Jira: ${t.assignee}` : null].filter(Boolean).join(' · ');

  if (h.durationMins === null) omitted.push('Duração: a sessão não registrou horário de início e fim.');
  if (h.facilitators.length === 0) omitted.push('Facilitador: não identificado entre os participantes.');

  return {
    title: h.title,
    team: h.team,
    dateLabel: h.dateLabel,
    dateLong: h.dateLong.charAt(0).toUpperCase() + h.dateLong.slice(1),
    timeRange: h.timeRange,
    durationLabel: h.durationMins !== null ? h.durationLabel : null,
    deckLabel: h.deckLabel,
    facilitators: h.facilitators,
    participantsCount: h.participantsCount,
    participantsByRole: h.participantsByRole,
    agenda: k.agenda,
    kpis,
    roleBars,
    situation,
    largest: hl.largest.map((t) => ({ task: t, detail: t.copyText })),
    pending: hl.pending.map((t) => ({ task: t, detail: pendingDetail(t) })),
    cancelled: k.cancelled,
    omitted,
  };
}

/** Texto alternativo da barra empilhada: "3 consenso · 1 revotada ...". */
export function situationSummary(segments: ResultsSegment[]): string {
  return segments.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(' · ');
}

// ---------------------------------------------------------------------------
// Indicadores do documento executivo (impressão e PDF)
// ---------------------------------------------------------------------------

export interface ReportKpiItem {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  main?: boolean;
}

/**
 * Cartões de indicadores do relatório completo (esforço, qualidade do refinamento
 * e o que ficou fora). Impressão e PDF leem esta mesma lista, na mesma ordem.
 */
export function buildReportKpiItems(report: SessionReportData): ReportKpiItem[] {
  const { header: h, kpis: k } = report;
  const isHours = h.deck === 'hours';
  const items: ReportKpiItem[] = [
    { label: 'Tarefas estimadas', value: String(k.estimated), unit: `de ${k.agenda}`, sub: plural(k.discussed, 'debatida', 'debatidas') },
  ];
  if (k.total !== null) {
    items.push({
      label: isHours ? 'Total de horas' : h.deck === 'fibonacci' ? 'Total de pontos' : 'Total estimado',
      value: formatNumber(k.total),
      unit: isHours || h.deck === 'tshirt' ? 'h' : 'SP',
      sub: 'Esforço estimado',
      main: true,
    });
  } else if (k.distribution.length > 0) {
    items.push({ label: 'Tamanhos estimados', value: k.distribution.map((d) => `${d.count}×${d.label}`).join(' '), sub: 'Quantidade por tamanho', main: true });
  }
  k.roleTotals.forEach((t) => items.push({ label: `Esforço ${t.label}`, value: formatNumber(t.hours), unit: 'h', sub: plural(t.tasks, 'tarefa', 'tarefas') }));
  items.push({
    label: 'Fechadas na 1ª rodada',
    value: k.firstRoundPct !== null ? formatPercent(k.firstRoundPct) : '—',
    sub: k.withRounds > 0 ? `${k.firstRoundClosed} de ${k.withRounds} estimadas` : undefined,
  });
  items.push({
    label: 'Média de rodadas',
    value: k.avgRounds !== null ? formatNumber(k.avgRounds) : '—',
    unit: k.avgRounds !== null ? 'por tarefa' : undefined,
    sub: k.revoted > 0 ? plural(k.revoted, 'revotada', 'revotadas') : 'Nenhuma revotação',
  });
  items.push({ label: 'Divergência crítica', value: String(k.divergent), sub: k.divergent > 0 ? 'Estimadas com votos distantes' : 'Nenhuma tarefa' });
  items.push({
    label: 'Fora da estimativa',
    value: String(k.outside),
    sub:
      [
        k.skipped && plural(k.skipped, 'pulada', 'puladas'),
        k.parkedPending && plural(k.parkedPending, 'adiada', 'adiadas'),
        k.cancelled && plural(k.cancelled, 'cancelada', 'canceladas'),
        k.untouched && plural(k.untouched, 'não abordada', 'não abordadas'),
      ]
        .filter(Boolean)
        .join(' · ') || 'Todas estimadas',
  });
  if (k.largest) {
    items.push({ label: 'Maior estimativa', value: k.largest.label, sub: `${k.largest.task.key ? `${k.largest.task.key} · ` : ''}${k.largest.task.title}` });
  }
  items.push({ label: 'Tempo gasto', value: h.durationLabel, sub: k.avgMinsPerTopic !== null ? `${formatNumber(k.avgMinsPerTopic)} min por tarefa debatida` : undefined });
  return items;
}
