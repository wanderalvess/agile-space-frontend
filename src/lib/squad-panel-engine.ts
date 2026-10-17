// Motor das consultas JQL dos painéis da squad: roda a JQL no Jira (com o token de quem está logado) ou, quando o Jira
// não responde, faz uma aproximação com as issues já sincronizadas. Funções puras onde dá, para testar sem rede.
import { fetchAllJiraIssues, fetchJiraIssues } from '@/services/jiraService';
import type {
  SquadIssueSnapshot,
  SquadPanelAggregateMetric,
  SquadPanelChartType,
  SquadPanelGroupBy,
  SquadPanelIssueRow,
  SquadPanelResultRow,
} from '@/lib/types';

// Painel é uma ferramenta ad-hoc, não o sync principal da squad: limites bem mais conservadores, para quem tem vários
// painéis não estourar o limite pessoal de consultas do Jira (20 por minuto, ver api/jira/search/route.ts).
export const PANEL_TABLE_LIMIT = 50;
/** Linhas da tabela que o cartão mostra (o resto fica só na contagem). */
export const PANEL_TABLE_SHOWN = 10;
export const PANEL_GROUP_MAX_PAGES = 5; // teto de 500 issues por painel de barras/pizza

export interface PanelQuerySpec {
  jql: string;
  chartType: SquadPanelChartType;
  groupBy: SquadPanelGroupBy;
  aggregateMetric: SquadPanelAggregateMetric;
}

export interface PanelQueryResult {
  resultTotal: number;
  resultRows?: SquadPanelResultRow[];
  resultIssues?: SquadPanelIssueRow[];
}

/** O que a agregação precisa de uma issue, venha ela do Jira ou do que foi sincronizado. */
export interface AggregatableIssue {
  status?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  parentKey?: string;
  parentTitle?: string;
  estimateSec?: number;
  remainingSec?: number;
  loggedSec?: number;
}

const GROUP_BY_FIELDS: Record<Exclude<SquadPanelGroupBy, 'none'>, string[]> = {
  status: ['status'],
  type: ['issuetype'],
  priority: ['priority'],
  assignee: ['assignee'],
  // Campo nativo do Jira em issues filhas (subtarefa): não precisa de plugin, só pedir `parent`.
  parent: ['parent'],
};

// Campos do Jira por métrica de horas. mapIssue já resolve agregado ou individual; pedimos o individual.
const TIME_FIELDS: Record<Exclude<SquadPanelAggregateMetric, 'count'>, string[]> = {
  estimateHours: ['timeoriginalestimate'],
  remainingHours: ['timeestimate'],
  loggedHours: ['timespent'],
};

export const ALL_ISSUES_LABEL = 'Todas as issues';

export function groupLabelOf(issue: AggregatableIssue, groupBy: SquadPanelGroupBy): string {
  switch (groupBy) {
    case 'status': return issue.status || 'Sem status';
    case 'type': return issue.type || 'Sem tipo';
    case 'priority': return issue.priority || 'Sem prioridade';
    case 'assignee': return issue.assignee || 'Sem responsável';
    case 'parent': return issue.parentKey ? `${issue.parentKey} ${issue.parentTitle || ''}`.trim() : 'Sem issue pai';
    default: return ALL_ISSUES_LABEL;
  }
}

function metricAmount(issue: AggregatableIssue, metric: SquadPanelAggregateMetric): number {
  switch (metric) {
    case 'estimateHours': return (issue.estimateSec || 0) / 3600;
    case 'remainingHours': return (issue.remainingSec || 0) / 3600;
    case 'loggedHours': return (issue.loggedSec || 0) / 3600;
    default: return 1;
  }
}

/** Soma por grupo (contagem de issues ou horas), do maior para o menor. Sem issues, uma linha "Sem registros". */
export function aggregateRows(
  issues: AggregatableIssue[],
  groupBy: SquadPanelGroupBy,
  metric: SquadPanelAggregateMetric = 'count',
): SquadPanelResultRow[] {
  const totals = new Map<string, number>();
  for (const issue of issues) {
    const label = groupLabelOf(issue, groupBy);
    totals.set(label, (totals.get(label) || 0) + metricAmount(issue, metric));
  }
  const rows = Array.from(totals.entries())
    .map(([label, value]) => ({ label, value: metric === 'count' ? value : Math.round(value * 10) / 10 }))
    .sort((a, b) => b.value - a.value);
  return rows.length > 0 ? rows : [{ label: 'Sem registros', value: 0 }];
}

/** Monta o resultado de um painel a partir de issues já em mãos (as do Jira ou as sincronizadas). */
export function buildPanelResult(
  issues: (AggregatableIssue & { key: string; title?: string; status?: string; type?: string })[],
  spec: Pick<PanelQuerySpec, 'chartType' | 'groupBy' | 'aggregateMetric'>,
  total: number = issues.length,
): PanelQueryResult {
  if (spec.chartType === 'table') {
    return {
      resultTotal: total,
      resultIssues: issues.slice(0, PANEL_TABLE_SHOWN).map((i) => ({
        key: i.key,
        title: i.title || i.key,
        status: i.status || '',
        type: i.type || '',
        parentKey: i.parentKey || '',
        parentTitle: i.parentTitle || '',
      })),
    };
  }
  if (spec.chartType === 'number') return { resultTotal: total };
  return { resultTotal: total, resultRows: aggregateRows(issues, spec.groupBy, spec.aggregateMetric) };
}

/**
 * Roda a JQL no Jira. Lança erro se o Jira não responder (sem token, JQL inválida, rede): quem chama decide se cai na
 * aproximação ou mostra o erro. Uma consulta que de fato dá 0 resultados volta com total 0, sem erro.
 */
export async function runPanelQuery(
  creds: { domain: string; token: string },
  spec: PanelQuerySpec,
): Promise<PanelQueryResult> {
  const { domain, token } = creds;
  if (spec.chartType === 'number') {
    // `total` já vem exato na primeira página: não precisa paginar tudo só para contar.
    const { total } = await fetchJiraIssues(domain, token, spec.jql, { maxResults: 1, fields: ['issuetype'] });
    return { resultTotal: total };
  }
  if (spec.chartType === 'table') {
    const { issues, total } = await fetchJiraIssues(domain, token, spec.jql, {
      maxResults: PANEL_TABLE_LIMIT,
      fields: ['summary', 'issuetype', 'status', 'parent'],
    });
    return {
      resultTotal: total,
      resultIssues: issues.slice(0, PANEL_TABLE_LIMIT).map((i) => ({
        key: i.key,
        title: i.title,
        status: i.status,
        type: i.type,
        parentKey: i.parentKey || '',
        parentTitle: i.parentTitle || '',
      })),
    };
  }
  // Barras e pizza: agrupar exige todas as issues do escopo (paginado, com teto).
  const metric = spec.aggregateMetric || 'count';
  const groupFields = spec.groupBy === 'none' ? ['status'] : GROUP_BY_FIELDS[spec.groupBy] || ['status'];
  const fields = metric === 'count' ? groupFields : Array.from(new Set([...groupFields, ...TIME_FIELDS[metric]]));
  const { issues, total } = await fetchAllJiraIssues(domain, token, spec.jql, { fields, maxPages: PANEL_GROUP_MAX_PAGES });
  const rows = aggregateRows(
    issues.map((i) => ({
      status: i.status,
      type: i.type,
      priority: i.priority,
      assignee: i.assignee,
      parentKey: i.parentKey,
      parentTitle: i.parentTitle,
      estimateSec: i.timeEstimate,
      remainingSec: i.timeRemaining,
      loggedSec: i.timeSpent,
    })),
    spec.groupBy,
    metric,
  );
  return { resultTotal: total, resultRows: rows };
}

/**
 * Filtro grosseiro por palavras da JQL, só para a aproximação (quando o Jira não respondeu). Não entende JQL de
 * verdade: por isso o cartão avisa que o resultado pode não bater.
 */
export function approximateMatches(jql: string, issue: { type?: string | null; status?: string | null }): boolean {
  const jqlLower = (jql || '').toLowerCase();
  if (jqlLower.includes('bug') && (issue.type || '').toLowerCase() !== 'bug') return false;
  if (jqlLower.includes('done') && !jqlLower.includes('!=') && (issue.status || '').toLowerCase() !== 'done') return false;
  if (jqlLower.includes('status != done') && (issue.status || '').toLowerCase() === 'done') return false;
  return true;
}

/** Aproximação com as issues sincronizadas da squad (o snapshot não guarda prioridade; não inventa uma). */
export function approximatePanelResult(spec: PanelQuerySpec, snapshots: SquadIssueSnapshot[]): PanelQueryResult {
  const matched = snapshots
    .filter((iss) => approximateMatches(spec.jql, iss))
    .map((iss) => ({
      key: iss.jiraKey || iss.key,
      title: iss.title || iss.jiraKey || iss.key,
      status: iss.status,
      type: iss.type || 'Sem tipo',
      priority: 'Sem prioridade',
      assignee: iss.assigneeName || 'Sem responsável',
      parentKey: iss.parentKey,
      parentTitle: iss.parentTitle,
      estimateSec: iss.estimateSec,
      remainingSec: iss.remainingSec,
      loggedSec: iss.loggedSec,
    }));
  return buildPanelResult(matched, spec);
}
