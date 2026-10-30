import { describe, expect, it, vi } from 'vitest';

// O hook importa a API da squad e o contexto; aqui só interessa a função pura da lista de sprints.
vi.mock('../../context/UserContext', () => ({ useUser: () => ({ userProfile: null }) }));
vi.mock('../../app/squad/api', () => ({ squadApi: {} }));
vi.mock('../../services/projectService', () => ({ projectService: {} }));
vi.mock('../useSquadConfig', () => ({ useSquadConfig: () => ({ config: null, loading: false }) }));

import { buildSprintOptions } from '../useSquadDashboardData';

const hist = (sprintId: string, sprintName: string, closedAt?: string) => ({
  sprintId, sprintName, sprintStart: '', sprintEnd: '', sprintWorkdays: 10, state: closedAt ? ('closed' as const) : ('active' as const), lastSyncedAt: '', closedAt,
});

describe('lista de sprints do painel (a mesma do Squad Hub)', () => {
  it('atual primeiro, depois o histórico com a data de encerramento', () => {
    const opts = buildSprintOptions({
      currentSprintId: '42',
      currentSprintName: 'Sprint 42',
      history: [hist('42', 'Sprint 42'), hist('41', 'Sprint 41', '2026-09-30T12:00:00Z'), hist('40', 'Sprint 40')],
      issues: [],
    });
    expect(opts.map((o) => o.value)).toEqual(['42', '41', '40']);
    expect(opts[0].label).toBe('Sprint 42 (Atual)');
    expect(opts[1].label).toMatch(/^Sprint 41 \(\d{2}\/\d{2}\)$/);
    expect(opts[2].label).toBe('Sprint 40');
  });

  it('sprints que só existem nas issues entram depois, sem repetir', () => {
    const opts = buildSprintOptions({
      currentSprintId: '42',
      currentSprintName: 'Sprint 42',
      history: [hist('41', 'Sprint 41')],
      issues: [{ sprintId: '41', sprintName: 'Sprint 41' }, { sprintId: '39', sprintName: 'Sprint 39' }, { sprintId: 'UNMAPPED', sprintName: 'x' }, { sprintId: '', sprintName: 'y' }],
    });
    expect(opts.map((o) => o.value)).toEqual(['42', '41', '39']);
  });

  it('sem placar da sprint atual o primeiro item é "Sprint atual" (valor current)', () => {
    expect(buildSprintOptions({ currentSprintId: '', history: [], issues: [] })).toEqual([{ label: 'Sprint atual', value: 'current' }]);
  });

  it('histórico sem id ou "UNMAPPED" é ignorado', () => {
    const opts = buildSprintOptions({ currentSprintId: '', history: [hist('', 'sem id'), hist('UNMAPPED', 'não mapeada')], issues: [] });
    expect(opts).toHaveLength(1);
  });

  it('histórico null (squad sem histórico no backend) não quebra a lista', () => {
    expect(buildSprintOptions({ currentSprintId: '', history: null, issues: [] })).toEqual([{ label: 'Sprint atual', value: 'current' }]);
  });
});
