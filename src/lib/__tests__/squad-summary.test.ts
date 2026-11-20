import { describe, expect, it } from 'vitest';
import type { SquadIssueSnapshot, SquadMetricsRollup } from '../types';
import { barPercent, boardColumns, buildAttention, isCapacityMissing, orderKpis, sprintStats } from '../squad-summary';

const issue = (key: string, statusCategory: string, updatedAtJira?: string) =>
  ({ key, statusCategory, updatedAtJira }) as unknown as SquadIssueSnapshot;

describe('sprintStats', () => {
  it('usa o placar do servidor quando existe', () => {
    const r = { totalIssues: 10, doneIssues: 4, inProgressIssues: 3 } as SquadMetricsRollup;
    expect(sprintStats(r, [])).toEqual({ total: 10, done: 4, inProgress: 3, todo: 3, pct: 40 });
  });
  it('sem placar conta as issues pela categoria do Jira', () => {
    const issues = [issue('A-1', 'done'), issue('A-2', 'indeterminate'), issue('A-3', 'new'), issue('A-4', 'new')];
    expect(sprintStats(null, issues)).toEqual({ total: 4, done: 1, inProgress: 1, todo: 2, pct: 25 });
  });
  it('sprint vazia não divide por zero', () => {
    expect(sprintStats(null, []).pct).toBe(0);
  });
});

describe('boardColumns', () => {
  it('separa por categoria e põe as mais recentes primeiro', () => {
    const cols = boardColumns([
      issue('A-1', 'new', '2026-10-01'),
      issue('A-2', 'new', '2026-10-05'),
      issue('A-3', 'indeterminate', '2026-10-02'),
      issue('A-4', 'done', '2026-10-03'),
      issue('A-5', 'unknown'),
    ]);
    expect(cols.map((c) => c.id)).toEqual(['todo', 'doing', 'done']);
    expect(cols[0].items.map((i) => i.key)).toEqual(['A-2', 'A-1', 'A-5']);
    expect(cols[1].items.map((i) => i.key)).toEqual(['A-3']);
    expect(cols[2].items.map((i) => i.key)).toEqual(['A-4']);
  });
});

describe('isCapacityMissing', () => {
  it('só avisa quando há pessoas e nenhuma tem hora por dia', () => {
    expect(isCapacityMissing([])).toBe(false);
    expect(isCapacityMissing([{ capacityHoursPerDay: 0 }, {}])).toBe(true);
    expect(isCapacityMissing([{ capacityHoursPerDay: 6 }, {}])).toBe(false);
    expect(isCapacityMissing([{ systemCalculatedCapacityHoursPerDay: 5 }])).toBe(false);
  });
});

describe('buildAttention', () => {
  const base = { overdue: 0, stale: 0, hasRollup: true, peopleCount: 5, canSync: true, canOpenPeople: true };
  it('sem nada pendente, lista vazia', () => {
    expect(buildAttention(base)).toEqual([]);
  });
  it('atrasados levam ao Cronograma e parados às Métricas, com singular e plural', () => {
    const items = buildAttention({ ...base, overdue: 1, stale: 3 });
    expect(items[0]).toMatchObject({ id: 'overdue', href: '/squad?tab=cronograma' });
    expect(items[0].text).toContain('1 item está');
    expect(items[1]).toMatchObject({ id: 'stale', href: '/squad?tab=metricas' });
    expect(items[1].text).toContain('3 itens estão');
  });
  it('sprint não sincronizada oferece sincronizar só a quem pode', () => {
    expect(buildAttention({ ...base, hasRollup: false })[0]).toMatchObject({ id: 'not-synced', action: 'sync' });
    expect(buildAttention({ ...base, hasRollup: false, canSync: false })[0].action).toBeUndefined();
  });
  it('sem pessoas: "Abrir Pessoas" só para quem gerencia; os outros veem só o texto', () => {
    expect(buildAttention({ ...base, peopleCount: 0 })[0]).toMatchObject({ id: 'no-people', actionLabel: 'Abrir Pessoas', href: '/squad/roster' });
    const plain = buildAttention({ ...base, peopleCount: 0, canOpenPeople: false })[0];
    expect(plain.href).toBeUndefined();
    expect(plain.actionLabel).toBeUndefined();
  });
});

describe('barPercent', () => {
  it('escala pelo maior valor da lista, não por um teto fixo', () => {
    expect(barPercent(30, 30)).toBe(100);
    expect(barPercent(15, 30)).toBe(50);
    expect(barPercent(1, 30)).toBe(3);
  });
  it('sem valor ou sem máximo, barra vazia', () => {
    expect(barPercent(0, 10)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(-1, 10)).toBe(0);
  });
});

describe('orderKpis', () => {
  const kpis = [{ key: 'done' }, { key: 'hours' }, { key: 'bugs' }, { key: 'stale' }];
  it('põe o KPI do papel primeiro e mantém o resto na ordem', () => {
    expect(orderKpis(kpis, 'QA').map((k) => k.key)).toEqual(['bugs', 'done', 'hours', 'stale']);
    expect(orderKpis(kpis, 'Scrum Master').map((k) => k.key)).toEqual(['stale', 'done', 'hours', 'bugs']);
  });
  it('papel desconhecido ou já primeiro não muda nada', () => {
    expect(orderKpis(kpis, 'Designer')).toBe(kpis);
    expect(orderKpis(kpis, undefined)).toBe(kpis);
    expect(orderKpis(kpis, 'Developer')).toBe(kpis);
  });
});
