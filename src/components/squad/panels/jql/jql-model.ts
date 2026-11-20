// Modelo das consultas JQL: o que um painel guarda, onde fica salvo ("Neste navegador" ou "Na squad") e como a lista
// do navegador é lida e convertida. Sem React, para testar sem rede.
import type {
  SquadPanel,
  SquadPanelAggregateMetric,
  SquadPanelChartType,
  SquadPanelGroupBy,
  SquadPanelIssueRow,
  SquadPanelResultRow,
} from '@/lib/types';
import type { PanelsUnavailable } from '@/store/useSquadPanelsStore';

export type PanelStorage = 'local' | 'squad';
export type PanelVisibility = 'private' | 'squad';

/** Painel guardado no navegador (localStorage por squad). */
export interface LocalJqlPanel {
  id: string;
  title: string;
  jql: string;
  chartType: SquadPanelChartType;
  groupBy: SquadPanelGroupBy;
  aggregateMetric: SquadPanelAggregateMetric;
  /** No navegador é só um rótulo: ninguém mais vê. */
  visibility: PanelVisibility;
  resultTotal?: number;
  resultRows?: SquadPanelResultRow[];
  resultIssues?: SquadPanelIssueRow[];
  /** Hora da última atualização ("14:32"). */
  lastUpdated?: string;
  /** true quando o resultado veio das issues já sincronizadas (o Jira não respondeu): só uma aproximação. */
  approximate?: boolean;
}

/** O que o cartão desenha, venha o painel do navegador ou do servidor. */
export interface PanelCardModel {
  /** Chave única na lista: separa um id local de um id do servidor. */
  key: string;
  id: string;
  storage: PanelStorage;
  title: string;
  jql: string;
  chartType: SquadPanelChartType;
  groupBy: SquadPanelGroupBy;
  aggregateMetric: SquadPanelAggregateMetric;
  visibility: PanelVisibility;
  resultTotal?: number;
  resultRows?: SquadPanelResultRow[];
  resultIssues?: SquadPanelIssueRow[];
  /** "14:32" ou vazio quando ainda não rodou. */
  updatedLabel: string;
  approximate: boolean;
  lastRunError?: string;
  /** Só painel da squad: quem criou. */
  ownerName?: string;
  /** Só quem criou (ou, no navegador, quem está no navegador) edita, atualiza e exclui. */
  canEdit: boolean;
  /** true quando o painel da squad é de outra pessoa. */
  fromOthers: boolean;
}

export const CHART_OPTIONS: { value: SquadPanelChartType; label: string }[] = [
  { value: 'bar', label: 'Gráfico de barras' },
  { value: 'pie', label: 'Gráfico de pizza' },
  { value: 'number', label: 'Contador numérico' },
  { value: 'table', label: 'Tabela de itens' },
];

export const GROUP_BY_OPTIONS: { value: SquadPanelGroupBy; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'assignee', label: 'Responsável' },
  { value: 'type', label: 'Tipo de item' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'parent', label: 'Issue pai' },
  { value: 'none', label: 'Nenhum' },
];

export const METRIC_OPTIONS: { value: SquadPanelAggregateMetric; label: string }[] = [
  { value: 'count', label: 'Contagem de issues' },
  { value: 'estimateHours', label: 'Horas estimadas' },
  { value: 'remainingHours', label: 'Horas restantes' },
  { value: 'loggedHours', label: 'Horas lançadas' },
];

export const VISIBILITY_OPTIONS: { value: PanelVisibility; label: string }[] = [
  { value: 'squad', label: 'Toda a squad' },
  { value: 'private', label: 'Só eu' },
];

export const STORAGE_LABEL: Record<PanelStorage, string> = {
  local: 'Neste navegador',
  squad: 'Na squad',
};

export function localStorageKey(squadId: string): string {
  return `agileSpace_custom_panels_${squadId}`;
}

/** Os quatro modelos que aparecem quando a squad ainda não tem nenhum painel salvo. */
export function defaultTemplates(squadKey: string): LocalJqlPanel[] {
  const base = { aggregateMetric: 'count' as const, visibility: 'squad' as const };
  return [
    { ...base, id: 'template-bugs', title: 'Bugs bloqueantes (Highest / High)', jql: `project = ${squadKey} AND type = Bug AND priority in (Highest, High)`, chartType: 'number', groupBy: 'status' },
    { ...base, id: 'template-status', title: 'Distribuição da sprint por status', jql: `project = ${squadKey} AND sprint in openSprints()`, chartType: 'pie', groupBy: 'status' },
    { ...base, id: 'template-assignee', title: 'Itens por responsável no momento', jql: `project = ${squadKey} AND status != Done`, chartType: 'bar', groupBy: 'assignee' },
    { ...base, id: 'template-qa', title: 'Fila de homologação e testes (QA)', jql: `project = ${squadKey} AND status in ('QA Testing', 'Homologação', 'In Review')`, chartType: 'table', groupBy: 'status' },
  ];
}

const CHART_TYPES: SquadPanelChartType[] = ['number', 'table', 'bar', 'pie'];
const GROUP_BYS: SquadPanelGroupBy[] = ['status', 'type', 'priority', 'assignee', 'parent', 'none'];
const METRICS: SquadPanelAggregateMetric[] = ['count', 'estimateHours', 'remainingHours', 'loggedHours'];

/** Lê a lista salva no navegador, aceitando o formato antigo (sem métrica). null = nada salvo ou ilegível. */
export function parseStoredPanels(raw: string | null | undefined): LocalJqlPanel[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const out: LocalJqlPanel[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.title !== 'string' || typeof p.jql !== 'string') continue;
    out.push({
      id: p.id,
      title: p.title,
      jql: p.jql,
      chartType: CHART_TYPES.includes(p.chartType as SquadPanelChartType) ? (p.chartType as SquadPanelChartType) : 'number',
      groupBy: GROUP_BYS.includes(p.groupBy as SquadPanelGroupBy) ? (p.groupBy as SquadPanelGroupBy) : 'status',
      aggregateMetric: METRICS.includes(p.aggregateMetric as SquadPanelAggregateMetric) ? (p.aggregateMetric as SquadPanelAggregateMetric) : 'count',
      visibility: p.visibility === 'private' ? 'private' : 'squad',
      resultTotal: typeof p.resultTotal === 'number' ? p.resultTotal : undefined,
      resultRows: Array.isArray(p.resultRows) ? (p.resultRows as SquadPanelResultRow[]) : undefined,
      resultIssues: Array.isArray(p.resultIssues) ? (p.resultIssues as LocalJqlPanel['resultIssues']) : undefined,
      lastUpdated: typeof p.lastUpdated === 'string' ? p.lastUpdated : undefined,
      approximate: p.approximate === true,
    });
  }
  return out.length > 0 ? out : null;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** "2026-10-16T17:32:00Z" -> "14:32" (hora local). Vazio se a data não for válida. */
export function formatClockFromIso(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : formatClock(d);
}

export function localToCard(p: LocalJqlPanel): PanelCardModel {
  return {
    key: `local:${p.id}`,
    id: p.id,
    storage: 'local',
    title: p.title,
    jql: p.jql,
    chartType: p.chartType,
    groupBy: p.groupBy,
    aggregateMetric: p.aggregateMetric,
    visibility: p.visibility,
    resultTotal: p.resultTotal,
    resultRows: p.resultRows,
    resultIssues: p.resultIssues,
    updatedLabel: p.lastUpdated || '',
    approximate: !!p.approximate,
    canEdit: true,
    fromOthers: false,
  };
}

export function serverToCard(p: SquadPanel, userId: string): PanelCardModel {
  const mine = !!userId && p.ownerId === userId;
  return {
    key: `squad:${p.id}`,
    id: p.id,
    storage: 'squad',
    title: p.title,
    jql: p.jql,
    chartType: p.chartType,
    groupBy: p.groupBy,
    aggregateMetric: p.aggregateMetric,
    visibility: p.visibility,
    resultTotal: p.resultTotal,
    resultRows: p.resultRows,
    resultIssues: p.resultIssues,
    updatedLabel: formatClockFromIso(p.lastRunAt),
    approximate: false,
    lastRunError: p.lastRunError || undefined,
    ownerName: p.ownerName || undefined,
    canEdit: mine,
    fromOthers: !mine,
  };
}

/** Valor de uma barra ou fatia: contagem inteira, ou horas com "h". */
export function formatPanelValue(metric: SquadPanelAggregateMetric, value: number): string {
  if (metric === 'count') return String(Math.round(value));
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
}

/** Junta as linhas depois da `keep`-ésima em "Outros (N grupos)". Lista curta volta como veio. */
export function capRows(rows: SquadPanelResultRow[], keep: number): { rows: SquadPanelResultRow[]; hidden: number } {
  if (rows.length <= keep) return { rows, hidden: 0 };
  return { rows: rows.slice(0, keep), hidden: rows.length - keep };
}

export function serverUnavailableText(reason: PanelsUnavailable): string {
  switch (reason) {
    case 'forbidden':
      return 'Indisponível: o servidor não liberou painéis da squad para você.';
    case 'not_found':
      return 'Indisponível: este servidor ainda não guarda painéis da squad.';
    default:
      return 'Indisponível agora: não foi possível falar com o servidor.';
  }
}

export interface PanelForm {
  title: string;
  jql: string;
  chartType: SquadPanelChartType;
  groupBy: SquadPanelGroupBy;
  aggregateMetric: SquadPanelAggregateMetric;
  visibility: PanelVisibility;
  storage: PanelStorage;
}

export function emptyForm(squadId: string): PanelForm {
  return {
    title: '',
    jql: `project = ${squadId}`,
    chartType: 'bar',
    groupBy: 'status',
    aggregateMetric: 'count',
    visibility: 'squad',
    storage: 'local',
  };
}

export function formFromCard(card: PanelCardModel): PanelForm {
  return {
    title: card.title,
    jql: card.jql,
    chartType: card.chartType,
    groupBy: card.groupBy === 'none' && card.chartType !== 'bar' && card.chartType !== 'pie' ? 'status' : card.groupBy,
    aggregateMetric: card.aggregateMetric,
    visibility: card.visibility,
    storage: card.storage,
  };
}
