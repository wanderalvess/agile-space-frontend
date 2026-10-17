import { describe, expect, it } from 'vitest';
import {
  CURRENT_SPRINT,
  HUB_TABS,
  buildSprintChoices,
  defaultSyncJql,
  hubHref,
  resolveHubLocation,
  resolveSyncJql,
  selectedSprintValue,
  sprintSelectorVisible,
} from '../squad-hub';

describe('abas do hub por URL', () => {
  it('tem as cinco abas, com Resumo primeiro', () => {
    expect(HUB_TABS.map((t) => t.id)).toEqual(['resumo', 'quadro', 'cronograma', 'metricas', 'paineis']);
    expect(HUB_TABS[0].label).toBe('Resumo');
  });

  it('sem ?tab= ou com valor desconhecido abre o Resumo', () => {
    expect(resolveHubLocation(undefined).tab).toBe('resumo');
    expect(resolveHubLocation(null).tab).toBe('resumo');
    expect(resolveHubLocation('').tab).toBe('resumo');
    expect(resolveHubLocation('qualquer-coisa').tab).toBe('resumo');
  });

  it('aceita cada aba pelo próprio nome, sem diferença de caixa', () => {
    expect(resolveHubLocation('quadro').tab).toBe('quadro');
    expect(resolveHubLocation('Cronograma').tab).toBe('cronograma');
    expect(resolveHubLocation('metricas').tab).toBe('metricas');
    expect(resolveHubLocation('paineis').tab).toBe('paineis');
  });

  it('atalhos antigos continuam valendo', () => {
    expect(resolveHubLocation('overview').tab).toBe('resumo');
    expect(resolveHubLocation('painel').tab).toBe('resumo');
    expect(resolveHubLocation('board').tab).toBe('quadro');
    expect(resolveHubLocation('plans').tab).toBe('cronograma');
    expect(resolveHubLocation('metrics').tab).toBe('metricas');
    expect(resolveHubLocation('dashboards').tab).toBe('paineis');
  });

  it('?tab=pulse e ?tab=performance caem em Métricas, cada um na sua visão', () => {
    expect(resolveHubLocation('pulse')).toEqual({ tab: 'metricas', metricsView: 'sprint' });
    expect(resolveHubLocation('performance')).toEqual({ tab: 'metricas', metricsView: 'desempenho' });
  });

  it('?view=desempenho escolhe a visão das Métricas', () => {
    expect(resolveHubLocation('metricas', 'desempenho').metricsView).toBe('desempenho');
    expect(resolveHubLocation('metricas', 'outra').metricsView).toBe('sprint');
  });

  it('monta o endereço de cada aba', () => {
    expect(hubHref('resumo')).toBe('/squad?tab=resumo');
    expect(hubHref('quadro')).toBe('/squad?tab=quadro');
    expect(hubHref('metricas')).toBe('/squad?tab=metricas');
    expect(hubHref('metricas', { metricsView: 'desempenho' })).toBe('/squad?tab=metricas&view=desempenho');
    expect(hubHref('quadro', { metricsView: 'desempenho' })).toBe('/squad?tab=quadro');
  });

  it('o endereço montado volta para a mesma aba', () => {
    for (const t of HUB_TABS) {
      const query = new URL(hubHref(t.id), 'http://x').searchParams;
      expect(resolveHubLocation(query.get('tab'), query.get('view')).tab).toBe(t.id);
    }
  });
});

describe('seletor de sprint do cabeçalho', () => {
  it('aparece no Resumo, no Cronograma e nas Métricas da sprint, mas não no Quadro, nem no Desempenho nem nos Painéis', () => {
    expect(sprintSelectorVisible({ tab: 'resumo', metricsView: 'sprint' })).toBe(true);
    expect(sprintSelectorVisible({ tab: 'cronograma', metricsView: 'sprint' })).toBe(true);
    expect(sprintSelectorVisible({ tab: 'metricas', metricsView: 'sprint' })).toBe(true);
    expect(sprintSelectorVisible({ tab: 'metricas', metricsView: 'desempenho' })).toBe(false);
    expect(sprintSelectorVisible({ tab: 'quadro', metricsView: 'sprint' })).toBe(false);
    expect(sprintSelectorVisible({ tab: 'paineis', metricsView: 'sprint' })).toBe(false);
  });

  const fmt = (iso: string) => iso.slice(0, 10);

  it('usa o histórico da configuração, com a data de encerramento', () => {
    const choices = buildSprintChoices({
      currentLabel: 'Sprint atual',
      history: [{ sprintId: '10', sprintName: 'Sprint 10', closedAt: '2026-09-01T00:00:00Z' }, { sprintId: '9' }],
      formatDate: fmt,
      issueSprints: [{ value: 'x', label: 'ignorada' }],
    });
    expect(choices).toEqual([
      { value: CURRENT_SPRINT, label: 'Sprint atual' },
      { value: '10', label: 'Sprint 10 (2026-09-01)' },
      { value: '9', label: 'Sprint 9' },
    ]);
  });

  it('sem histórico usa as sprints vistas nas issues', () => {
    const choices = buildSprintChoices({
      currentLabel: 'Sprint 11 (atual)',
      history: [],
      formatDate: fmt,
      issueSprints: [{ value: 'current', label: 'atual' }, { value: '10', label: 'Sprint 10' }],
    });
    expect(choices).toEqual([{ value: CURRENT_SPRINT, label: 'Sprint 11 (atual)' }, { value: '10', label: 'Sprint 10' }]);
  });

  it('sem nada além da atual não há o que escolher', () => {
    expect(buildSprintChoices({ currentLabel: 'a', history: [], formatDate: fmt, issueSprints: [] })).toEqual([]);
    expect(buildSprintChoices({ currentLabel: 'a', history: [], formatDate: fmt, issueSprints: [{ value: 'current', label: 'a' }] })).toEqual([]);
  });

  it('o valor marcado vem da store, do hook ou cai na atual', () => {
    const choices = [{ value: CURRENT_SPRINT, label: 'a' }, { value: '10', label: 'b' }];
    expect(selectedSprintValue(choices, '10', 'current')).toBe('10');
    expect(selectedSprintValue(choices, null, '10')).toBe('10');
    expect(selectedSprintValue(choices, null, 'current')).toBe(CURRENT_SPRINT);
    expect(selectedSprintValue(choices, '99', 'current')).toBe(CURRENT_SPRINT);
  });
});

describe('JQL da configuração da squad', () => {
  it('gera o padrão do projeto', () => {
    expect(defaultSyncJql('ABC')).toBe('project = "ABC" AND sprint in openSprints()');
  });
  it('sem JQL gravada usa o padrão', () => {
    expect(resolveSyncJql(undefined, 'ABC')).toBe(defaultSyncJql('ABC'));
    expect(resolveSyncJql('   ', 'ABC')).toBe(defaultSyncJql('ABC'));
  });
  it('mantém a JQL gravada do mesmo projeto, com ou sem aspas', () => {
    expect(resolveSyncJql('project = ABC AND labels = x', 'abc')).toBe('project = ABC AND labels = x');
    expect(resolveSyncJql('project = "ABC" AND sprint in openSprints()', 'ABC')).toBe('project = "ABC" AND sprint in openSprints()');
  });
  it('JQL gravada para outro projeto volta ao padrão do projeto atual (sem nome de squad fixo no código)', () => {
    expect(resolveSyncJql('project = MISSI AND sprint in openSprints()', 'XYZ')).toBe(defaultSyncJql('XYZ'));
    expect(resolveSyncJql('project = "MISSI" AND sprint in openSprints()', 'MISSI')).toBe('project = "MISSI" AND sprint in openSprints()');
  });
  it('JQL sem "project =" é mantida', () => {
    expect(resolveSyncJql('assignee = currentUser()', 'XYZ')).toBe('assignee = currentUser()');
  });
});
