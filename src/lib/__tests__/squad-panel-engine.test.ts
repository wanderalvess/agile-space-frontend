import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJiraIssues = vi.fn();
const fetchAllJiraIssues = vi.fn();
vi.mock('../../services/jiraService', () => ({
  fetchJiraIssues: (...a: unknown[]) => fetchJiraIssues(...a),
  fetchAllJiraIssues: (...a: unknown[]) => fetchAllJiraIssues(...a),
}));

import {
  ALL_ISSUES_LABEL,
  aggregateRows,
  approximateMatches,
  approximatePanelResult,
  buildPanelResult,
  groupLabelOf,
  runPanelQuery,
} from '../squad-panel-engine';
import type { SquadIssueSnapshot } from '../types';

const creds = { domain: 'jira.exemplo.com', token: 't' };

beforeEach(() => {
  fetchJiraIssues.mockReset();
  fetchAllJiraIssues.mockReset();
});

describe('aggregateRows', () => {
  const issues = [
    { status: 'Done', assignee: 'Ana', type: 'Bug', priority: 'High', estimateSec: 7200, remainingSec: 3600, loggedSec: 1800 },
    { status: 'Done', assignee: 'Ana', type: 'Task', priority: 'Low', estimateSec: 3600 },
    { status: 'Open', assignee: '', type: 'Task', priority: '', parentKey: 'DDW-1', parentTitle: 'Épico' },
  ];

  it('conta por grupo, do maior para o menor', () => {
    expect(aggregateRows(issues, 'status')).toEqual([{ label: 'Done', value: 2 }, { label: 'Open', value: 1 }]);
  });

  it('rótulos de grupo vazio são em português', () => {
    expect(groupLabelOf({}, 'assignee')).toBe('Sem responsável');
    expect(groupLabelOf({}, 'priority')).toBe('Sem prioridade');
    expect(groupLabelOf({}, 'type')).toBe('Sem tipo');
    expect(groupLabelOf({}, 'status')).toBe('Sem status');
    expect(groupLabelOf({}, 'parent')).toBe('Sem issue pai');
    expect(groupLabelOf({ parentKey: 'DDW-1', parentTitle: 'Épico' }, 'parent')).toBe('DDW-1 Épico');
  });

  it('soma horas (segundos viram horas, uma casa) quando a métrica não é contagem', () => {
    expect(aggregateRows(issues, 'assignee', 'estimateHours')).toEqual([{ label: 'Ana', value: 3 }, { label: 'Sem responsável', value: 0 }]);
    expect(aggregateRows(issues, 'status', 'remainingHours')[0]).toEqual({ label: 'Done', value: 1 });
    expect(aggregateRows(issues, 'status', 'loggedHours')[0]).toEqual({ label: 'Done', value: 0.5 });
  });

  it('agrupar por "nenhum" soma tudo numa linha só', () => {
    expect(aggregateRows(issues, 'none')).toEqual([{ label: ALL_ISSUES_LABEL, value: 3 }]);
  });

  it('sem issues devolve "Sem registros" em vez de um gráfico vazio', () => {
    expect(aggregateRows([], 'status')).toEqual([{ label: 'Sem registros', value: 0 }]);
  });
});

describe('buildPanelResult', () => {
  const issues = Array.from({ length: 14 }, (_, i) => ({ key: `DDW-${i}`, title: `T${i}`, status: 'Open', type: 'Task' }));

  it('número: só o total', () => {
    expect(buildPanelResult(issues, { chartType: 'number', groupBy: 'status', aggregateMetric: 'count' })).toEqual({ resultTotal: 14 });
  });

  it('tabela: 10 linhas, mas o total é de todas', () => {
    const r = buildPanelResult(issues, { chartType: 'table', groupBy: 'status', aggregateMetric: 'count' });
    expect(r.resultIssues).toHaveLength(10);
    expect(r.resultTotal).toBe(14);
  });

  it('barras e pizza: linhas agrupadas', () => {
    const r = buildPanelResult(issues, { chartType: 'pie', groupBy: 'status', aggregateMetric: 'count' });
    expect(r.resultRows).toEqual([{ label: 'Open', value: 14 }]);
  });
});

describe('aproximação (Jira não respondeu)', () => {
  it('filtra grosseiramente por palavras da JQL', () => {
    expect(approximateMatches('type = Bug', { type: 'Bug', status: 'Open' })).toBe(true);
    expect(approximateMatches('type = Bug', { type: 'Task', status: 'Open' })).toBe(false);
    expect(approximateMatches('status != Done', { type: 'Task', status: 'Done' })).toBe(false);
    expect(approximateMatches('status != Done', { type: 'Task', status: 'Open' })).toBe(true);
    expect(approximateMatches('project = X', { type: 'Task', status: 'Open' })).toBe(true);
  });

  it('usa as issues sincronizadas e não inventa prioridade', () => {
    const snaps = [
      { key: 'A-1', jiraKey: 'A-1', title: 'Um', status: 'Open', type: 'Bug', assigneeName: 'Ana', estimateSec: 3600, remainingSec: 0, loggedSec: 0, parentKey: '', parentTitle: '' },
      { key: 'A-2', jiraKey: 'A-2', title: 'Dois', status: 'Open', type: 'Task', assigneeName: '', estimateSec: 0, remainingSec: 0, loggedSec: 0, parentKey: '', parentTitle: '' },
    ] as unknown as SquadIssueSnapshot[];
    const spec = { jql: 'type = Bug', chartType: 'pie' as const, groupBy: 'priority' as const, aggregateMetric: 'count' as const };
    expect(approximatePanelResult(spec, snaps)).toEqual({ resultTotal: 1, resultRows: [{ label: 'Sem prioridade', value: 1 }] });
    expect(approximatePanelResult({ ...spec, chartType: 'number' }, snaps)).toEqual({ resultTotal: 1 });
  });
});

describe('runPanelQuery (Jira)', () => {
  it('número: pede só 1 issue e usa o total do Jira', async () => {
    fetchJiraIssues.mockResolvedValue({ issues: [], total: 7 });
    const r = await runPanelQuery(creds, { jql: 'project = X', chartType: 'number', groupBy: 'status', aggregateMetric: 'count' });
    expect(r).toEqual({ resultTotal: 7 });
    expect(fetchJiraIssues).toHaveBeenCalledWith('jira.exemplo.com', 't', 'project = X', { maxResults: 1, fields: ['issuetype'] });
  });

  it('tabela: devolve as linhas com o pai', async () => {
    fetchJiraIssues.mockResolvedValue({ total: 2, issues: [{ key: 'A-1', title: 'Um', status: 'Open', type: 'Task', parentKey: 'A-0', parentTitle: 'Pai' }, { key: 'A-2', title: 'Dois', status: 'Done', type: 'Bug' }] });
    const r = await runPanelQuery(creds, { jql: 'x', chartType: 'table', groupBy: 'status', aggregateMetric: 'count' });
    expect(r.resultTotal).toBe(2);
    expect(r.resultIssues?.[0]).toMatchObject({ key: 'A-1', parentKey: 'A-0' });
    expect(r.resultIssues?.[1]).toMatchObject({ key: 'A-2', parentKey: '' });
  });

  it('barras por issue pai somando horas restantes pede os campos certos', async () => {
    fetchAllJiraIssues.mockResolvedValue({ total: 3, truncated: false, issues: [{ parentKey: 'A-1', parentTitle: 'História', timeRemaining: 7200 }, { parentKey: 'A-1', parentTitle: 'História', timeRemaining: 3600 }, { parentKey: '', timeRemaining: 3600 }] });
    const r = await runPanelQuery(creds, { jql: 'x', chartType: 'bar', groupBy: 'parent', aggregateMetric: 'remainingHours' });
    expect(fetchAllJiraIssues).toHaveBeenCalledWith('jira.exemplo.com', 't', 'x', { fields: ['parent', 'timeestimate'], maxPages: 5 });
    expect(r.resultRows).toEqual([{ label: 'A-1 História', value: 3 }, { label: 'Sem issue pai', value: 1 }]);
    expect(r.resultTotal).toBe(3);
  });

  it('o erro do Jira sobe (quem chama decide se cai na aproximação)', async () => {
    fetchJiraIssues.mockRejectedValue(new Error('JQL inválida'));
    await expect(runPanelQuery(creds, { jql: 'x', chartType: 'number', groupBy: 'status', aggregateMetric: 'count' })).rejects.toThrow('JQL inválida');
  });
});
