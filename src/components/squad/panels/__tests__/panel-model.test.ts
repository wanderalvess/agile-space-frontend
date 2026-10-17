import { describe, expect, it } from 'vitest';
import type { SquadIssueSnapshot, SquadMember, SquadMetricsRollup } from '../../../../lib/types';
import {
  barWidths,
  buildExecution,
  buildProductOwner,
  buildStatusSegments,
  buildTechLead,
  buildWorkload,
  computeSprintCore,
  donutArcs,
  gaugeArcPath,
  isInQaQueue,
  isTechDebt,
  isWaitingReview,
  openBugsHint,
  predictability,
  predictabilityTone,
  sortTribeRows,
  summarizeTribe,
  type TribeRow,
} from '../panel-model';
import { niceStep } from '../WorkloadChart';

let n = 0;
function issue(over: Partial<SquadIssueSnapshot> = {}): SquadIssueSnapshot {
  n += 1;
  return {
    key: `DDW-${n}`,
    jiraKey: `DDW-${n}`,
    title: `Tarefa ${n}`,
    type: 'Task',
    isBug: false,
    status: 'To Do',
    statusCategory: 'new',
    estimateSec: 0,
    remainingSec: 0,
    loggedSec: 0,
    updatedAtJira: '',
    staleSinceDays: 0,
    dueDate: '',
    assigneeId: '',
    assigneeName: '',
    parentKey: '',
    parentTitle: '',
    sprintId: '1',
    sprintName: 'Sprint 1',
    syncedAt: '',
    ...over,
  };
}
const done = (o: Partial<SquadIssueSnapshot> = {}) => issue({ status: 'Done', statusCategory: 'done', ...o });
const doing = (o: Partial<SquadIssueSnapshot> = {}) => issue({ status: 'In Progress', statusCategory: 'indeterminate', ...o });

const rollup = (o: Partial<SquadMetricsRollup> = {}) => ({ squadId: 'S', totalIssues: 0, doneIssues: 0, inProgressIssues: 0, bugIssues: 0, ...o }) as SquadMetricsRollup;

describe('computeSprintCore', () => {
  it('usa o placar do servidor quando existe, inclusive com zeros de verdade', () => {
    const c = computeSprintCore(rollup({ totalIssues: 0 }), [done()]);
    expect(c.total).toBe(0);
    expect(c.doneRate).toBeNull();
    expect(c.hasData).toBe(true);
  });

  it('sem placar calcula pelas issues (categoria do Jira, não pelo texto do status)', () => {
    const c = computeSprintCore(null, [done(), done(), doing(), issue(), issue({ type: 'Bug', isBug: true })]);
    expect(c).toMatchObject({ total: 5, done: 2, inProgress: 1, toDo: 2, bugs: 1, doneRate: 40, hasData: true });
  });

  it('sem placar e sem issues não há dado', () => {
    const c = computeSprintCore(null, []);
    expect(c.hasData).toBe(false);
    expect(c.doneRate).toBeNull();
  });

  it('"a fazer" nunca fica negativo', () => {
    expect(computeSprintCore(rollup({ totalIssues: 3, doneIssues: 3, inProgressIssues: 2 }), []).toDo).toBe(0);
  });
});

describe('Execução', () => {
  it('só conta as tarefas da pessoa; sem tarefa, progresso e bugs ficam sem valor', () => {
    const empty = buildExecution([]);
    expect(empty.progress).toBeNull();
    expect(empty.openBugs).toBeNull();
    expect(openBugsHint(0, null)).toBe('Sem tarefas suas nesta sprint.');
  });

  it('progresso, status em português e bugs em aberto (concluído não conta)', () => {
    const mine = [done(), done({ type: 'Bug', isBug: true }), doing({ type: 'Bug', isBug: true }), issue()];
    const m = buildExecution(mine);
    expect(m.progress).toBe(50);
    expect(m.openBugs).toBe(1);
    expect(m.byStatus.map((s) => s.label).sort()).toEqual(['A fazer', 'Concluído', 'Em andamento']);
    expect(openBugsHint(4, 1)).toBe('1 bug seu está aguardando resolução.');
    expect(openBugsHint(4, 3)).toBe('3 bugs seus estão aguardando resolução.');
    expect(openBugsHint(4, 0)).toBe('Nenhum bug seu em aberto.');
  });

  it('a lista mostra no máximo 6 tarefas', () => {
    expect(buildExecution(Array.from({ length: 9 }, () => issue())).tasks).toHaveLength(6);
  });
});

describe('Product Owner', () => {
  it('conta por tipo (sem tipo vira "Sem tipo") e lista até 5 pendentes (concluídos fora)', () => {
    const issues = [done(), ...Array.from({ length: 7 }, () => issue({ type: 'Story' })), issue({ type: '' })];
    const m = buildProductOwner(issues);
    expect(m.byType.find((t) => t.label === 'Story')?.value).toBe(7);
    expect(m.byType.find((t) => t.label === 'Sem tipo')?.value).toBe(1);
    expect(m.pending).toHaveLength(5);
    expect(m.pending.every((p) => p.statusCategory !== 'done')).toBe(true);
  });
});

describe('Agile Master', () => {
  it('rosca de status: concluído, em andamento e o resto', () => {
    const segs = buildStatusSegments({ done: 21, inProgress: 11, toDo: 6 });
    expect(segs.map((s) => [s.label, s.value])).toEqual([['Concluído', 21], ['Em andamento', 11], ['A fazer / backlog', 6]]);
  });
});

describe('People Lead', () => {
  const member = (o: Partial<SquadMember>): SquadMember => ({ dbId: 'x', squadId: 'S', jiraAccountId: 'acc', displayName: 'Ana Ribeiro', ...o });

  it('soma horas estimadas por id do Jira ou nome completo e usa a capacidade da semana (horas por dia x 5)', () => {
    const issues = [issue({ assigneeId: 'acc-ana', estimateSec: 3600 * 6 }), issue({ assigneeName: 'ana ribeiro', estimateSec: 3600 * 4 }), issue({ assigneeName: 'Mariana Souza', estimateSec: 3600 * 20 })];
    const rows = buildWorkload([member({ jiraAccountId: 'acc-ana', capacityHoursPerDay: 6 })], issues);
    expect(rows).toEqual([{ name: 'Ana Ribeiro', jiraHours: 10, capacity: 30, role: 'Membro' }]);
  });

  it('sem horas por dia cadastradas não inventa capacidade; sem estimativa não inventa horas', () => {
    const rows = buildWorkload([member({ displayName: 'Bruno' })], [issue({ assigneeName: 'Bruno' })]);
    expect(rows[0]).toMatchObject({ jiraHours: 0, capacity: 0 });
  });

  it('niceStep dá degraus redondos que cobrem o maior valor em 4 faixas', () => {
    expect(niceStep(0)).toBe(1);
    for (const max of [3, 12, 38, 42, 100, 480]) {
      expect(niceStep(max) * 4).toBeGreaterThanOrEqual(max);
    }
    expect(niceStep(48)).toBe(20);
  });
});

describe('Tech Lead', () => {
  it('débito técnico é estimativa pelo título (debt, refactor, débito)', () => {
    expect(isTechDebt({ title: 'Refactor do módulo fiscal' })).toBe(true);
    expect(isTechDebt({ title: 'Pagar débito técnico da NFC-e' })).toBe(true);
    expect(isTechDebt({ title: 'Criar relatório' })).toBe(false);
    expect(isTechDebt({ title: undefined })).toBe(false);
  });

  it('fila de revisão e de QA é pelo texto do status, só para o que ainda não foi concluído', () => {
    expect(isWaitingReview({ status: 'Em Code Review', statusCategory: 'indeterminate' })).toBe(true);
    expect(isWaitingReview({ status: 'Review concluído', statusCategory: 'done' })).toBe(false);
    expect(isInQaQueue({ status: 'QA Testing', statusCategory: 'indeterminate' })).toBe(true);
    expect(isInQaQueue({ status: 'Homologação', statusCategory: 'indeterminate' })).toBe(false);
    expect(isInQaQueue({ status: 'Tested', statusCategory: 'done' })).toBe(false);
  });

  it('esforço, filas e as 5 maiores cargas por pessoa (não as 5 primeiras)', () => {
    const issues = [
      ...Array.from({ length: 5 }, () => issue({ assigneeName: 'Bruno' })),
      ...Array.from({ length: 3 }, () => issue({ assigneeName: 'Ana' })),
      issue({ assigneeName: 'Carla' }),
      issue({ assigneeName: 'Diego' }),
      issue({ assigneeName: 'Elisa' }),
      issue({ assigneeName: 'Fabio' }),
      issue({ assigneeName: 'Gabriela', title: 'Débito técnico do ERP' }),
      issue({ assigneeName: 'Gabriela', status: 'Code Review', statusCategory: 'indeterminate' }),
      issue({ assigneeName: 'Gabriela', status: 'QA', statusCategory: 'indeterminate' }),
      issue({ assigneeName: '' }),
    ];
    const m = buildTechLead(issues, 2, issues.length);
    expect(m.people).toHaveLength(5);
    expect(m.people[0]).toMatchObject({ name: 'Bruno', count: 5 });
    expect(m.people[1]).toMatchObject({ name: 'Ana', count: 3 });
    expect(m.techDebt).toBe(1);
    expect(m.waitingReview).toBe(1);
    expect(m.inQa).toBe(1);
    expect(m.effort.map((s) => s.label)).toEqual(['Funcionalidades', 'Bugs', 'Débito técnico']);
    expect(m.reviewPct).toBe(Math.round((1 / issues.length) * 100));
  });
});

describe('Tribo', () => {
  const row = (id: string, done: number, total: number, over?: number, restricted = false): TribeRow => ({
    id,
    name: id,
    rollup: total ? rollup({ squadId: id, totalIssues: total, doneIssues: done, overdueIssues: over }) : null,
    restricted,
  });

  it('previsibilidade é a parte concluída; squad sem rollup não tem', () => {
    expect(predictability(rollup({ totalIssues: 38, doneIssues: 21 }))).toBe(55);
    expect(predictability(null)).toBeNull();
    expect(predictability(rollup({ totalIssues: 0 }))).toBeNull();
  });

  it('resumo conta só squads com itens', () => {
    const s = summarizeTribe([row('A', 21, 38, 3), row('B', 30, 33, 0), row('C', 0, 0), row('D', 0, 0, 0, true)]);
    expect(s).toMatchObject({ squads: 4, withData: 2, done: 51, total: 71, overdue: 3 });
    expect(s.avgPredictability).toBe(73); // (55% + 91%) / 2
  });

  it('sem nenhuma squad com dado não há média', () => {
    expect(summarizeTribe([row('C', 0, 0)]).avgPredictability).toBeNull();
    expect(summarizeTribe([])).toMatchObject({ squads: 0, withData: 0, total: 0 });
  });

  it('ordena squads com dados primeiro e as demais por nome', () => {
    expect(sortTribeRows([row('Z', 0, 0), row('B', 1, 2), row('A', 0, 0)]).map((r) => r.id)).toEqual(['B', 'A', 'Z']);
  });

  it('cor da previsibilidade: 90+ verde, 80 a 89 marca, abaixo vermelho', () => {
    expect([95, 90, 89, 80, 79, 0].map(predictabilityTone)).toEqual(['success', 'success', 'brand', 'brand', 'danger', 'danger']);
  });
});

describe('geometria dos gráficos', () => {
  it('medidor: 0% termina no início, 50% no topo, 100% no fim', () => {
    expect(gaugeArcPath(0)).toBe('M20 112 A90 90 0 0 1 20.0 112.0');
    expect(gaugeArcPath(50)).toBe('M20 112 A90 90 0 0 1 110.0 22.0');
    expect(gaugeArcPath(100)).toBe('M20 112 A90 90 0 0 1 200.0 112.0');
    expect(gaugeArcPath(150)).toBe(gaugeArcPath(100));
    expect(gaugeArcPath(-5)).toBe(gaugeArcPath(0));
  });

  it('rosca: fatias somam a circunferência e fatia zerada some', () => {
    const arcs = donutArcs([{ label: 'A', value: 3, tone: 'brand' }, { label: 'B', value: 0, tone: 'muted' }, { label: 'C', value: 1, tone: 'danger' }]);
    expect(arcs.map((a) => a.label)).toEqual(['A', 'C']);
    expect(arcs[0].dashoffset).toBeCloseTo(0);
    expect(arcs[1].dashoffset).toBeLessThan(0);
    expect(donutArcs([{ label: 'A', value: 0, tone: 'brand' }])).toEqual([]);
  });

  it('barras: a maior vale 100 e tudo zero vale 0', () => {
    expect(barWidths([{ value: 18 }, { value: 9 }, { value: 0 }])).toEqual([100, 50, 0]);
    expect(barWidths([{ value: 0 }, { value: 0 }])).toEqual([0, 0]);
  });
});
