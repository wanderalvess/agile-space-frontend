import { describe, expect, it } from 'vitest';
import type { BacklogParent, BacklogView, PlanItem, PlanView, Thermometer } from '../api';
import { planItem, scopeTotalsOf, scopeViewOf } from './fixtures/scope';
import {
  applyScope,
  buildScope,
  canAdvanceFromScope,
  carryOverTimes,
  divergenceMessages,
  estimateThermometer,
  filterBacklog,
  hasNoEstimate,
  itemDivergenceMessages,
  noticesFromItem,
  parentHours,
  scopeSummary,
  scopeTotals,
  syncedAgo,
  unclassifiedSummary,
} from '../scope';

const sub = (over: Partial<BacklogParent['subtasks'][number]> = {}) => ({
  key: 'X-1', title: 'sub', typeId: '1', typeName: 'Codificação', subtaskClass: 'DEV' as const, estimateH: 16, remainingH: 16, countedH: 16,
  defaultHoursApplied: false, status: null, statusCategory: null, assigneeId: null, assigneeName: null, ...over,
});

const parent = (over: Partial<BacklogParent> = {}): BacklogParent => ({
  key: 'SQ-1', title: 'Checkout (DEV 18h / QA 6h)', status: 'Refinamento Concluído', carryOver: false,
  titleHours: { dev: 18, qa: 6 }, subtasks: [sub(), sub({ key: 'X-2', typeName: 'Teste', subtaskClass: 'QA', estimateH: 6, remainingH: 6, countedH: 6 })],
  sumByClass: { DEV: 16, QA: 6 }, divergenceDev: true, divergenceQa: false, divergent: true, ...over,
});

const item = (over: Partial<PlanItem> = {}): PlanItem => planItem(over);

const thermo = (over: Partial<Thermometer> = {}): Thermometer => ({
  allocatedHours: 60, capacityHours: 90, pct: 66.7, zone: 'VERDE', state: 'DENTRO_DA_CAPACIDADE', reservePct: 12, reserveLimitHours: 100.8, ...over,
});

describe('horas da tarefa', () => {
  it('vale o título; sem título, a soma das subtarefas; sobra, o restante', () => {
    expect(parentHours(parent(), 'DEV')).toBe(18);
    expect(parentHours(parent({ titleHours: null }), 'DEV')).toBe(16);
    expect(parentHours(parent({ carryOver: true, sumByClass: { DEV: 5, QA: 2 } }), 'DEV')).toBe(5);
  });

  it('sem estimativa: nem título nem subtarefas DEV/QA', () => {
    expect(hasNoEstimate(parent())).toBe(false);
    expect(hasNoEstimate(parent({ titleHours: null, sumByClass: {}, subtasks: [] }))).toBe(true);
  });
});

describe('divergência título x subtarefas', () => {
  it('escreve a frase com o nome da subtarefa e diz que vale o título', () => {
    expect(divergenceMessages(parent())).toEqual(['Título diz DEV 18h, subtarefa Codificação tem 16h. Vale o título']);
  });

  it('várias subtarefas somam; classe sem subtarefa é dita', () => {
    const p = parent({ subtasks: [sub(), sub({ key: 'X-3', typeName: 'Code Review', estimateH: 4 })], sumByClass: { DEV: 20 }, divergenceQa: true });
    const m = divergenceMessages(p);
    expect(m[0]).toBe('Título diz DEV 18h, subtarefas Codificação e Code Review somam 20h. Vale o título');
    expect(m[1]).toBe('Título diz QA 6h, não há subtarefa QA (0h). Vale o título');
  });

  it('sem divergência, sem frase', () => {
    expect(divergenceMessages(parent({ divergenceDev: false, divergent: false }))).toEqual([]);
  });
});

describe('avisos do item do plano (flags do servidor)', () => {
  it('divergência usa as somas do servidor e diz que vale o título (caso 5823: título 5h, Codificação 5h + Code Review 1h)', () => {
    const i = item({
      titleDevHours: 5, devHours: 5, subtaskDevH: 6, divergenceDev: true, divergent: true,
      subtasks: [
        { key: 'S-1', title: 'Codificação', typeId: '10', typeName: 'Codificação', cls: 'DEV', estimateH: 5, remainingH: 5, countedH: 5, defaultHoursApplied: false, assigneeId: null, assigneeName: null },
        { key: 'S-2', title: 'Code Review', typeId: '12', typeName: 'Code Review', cls: 'DEV', estimateH: 1, remainingH: 1, countedH: 1, defaultHoursApplied: true, assigneeId: null, assigneeName: null },
      ],
    });
    expect(itemDivergenceMessages(i)).toEqual(['Título diz DEV 5h, subtarefas Codificação e Code Review somam 6h. Vale o título']);
    expect(noticesFromItem(i)).toMatchObject({ divergences: expect.any(Array), noEstimate: false, noTitleHours: false });
  });

  it('sobra mostra estimado e restante; sem título e sem horas pede estimativa; pai fora do backlog é sinalizada', () => {
    const carry = noticesFromItem(item({ carryOver: true, subtaskDevEstimateH: 20, subtaskDevRemainingH: 6, subtaskQaEstimateH: 4, subtaskQaRemainingH: 1 }));
    expect([carry.carryOver, carry.estimated, carry.remaining]).toEqual([true, 24, 7]);
    expect(noticesFromItem(item({ titleDevHours: null, titleQaHours: null, devHours: 0, qaHours: 0, noEstimate: true })).noEstimate).toBe(true);
    expect(noticesFromItem(item({ titleDevHours: null, titleQaHours: null })).noTitleHours).toBe(true);
    expect(noticesFromItem(item({ inBacklog: false })).outOfBacklog).toBe(true);
  });
});

describe('carry-over', () => {
  it('mostra Tempo Estimado e Tempo Restante das subtarefas DEV/QA', () => {
    const p = parent({ carryOver: true, subtasks: [sub({ estimateH: 20, remainingH: 8 }), sub({ key: 'X-9', subtaskClass: 'FORA_DA_CONTA', estimateH: 50, remainingH: 50 })] });
    expect(carryOverTimes(p)).toEqual({ estimated: 20, remaining: 8 });
  });
});

describe('escopo e recálculo', () => {
  const backlog = [parent(), parent({ key: 'SQ-2', title: 'Troca', titleHours: { dev: 10, qa: 4 }, sumByClass: { DEV: 10, QA: 4 }, divergent: false })];

  it('soma o que está no plano e o que está sendo adicionado, e tira o que está sendo removido', () => {
    const base = buildScope([item()], backlog, new Set(), new Set());
    expect(scopeTotals(base)).toEqual({ DEV: 18, QA: 6 });
    const adding = buildScope([item()], backlog, new Set(['SQ-2']), new Set());
    expect(adding.map((e) => [e.key, e.pending])).toEqual([['SQ-1', false], ['SQ-2', true]]);
    expect(scopeTotals(adding)).toEqual({ DEV: 28, QA: 10 });
    expect(scopeTotals(buildScope([item()], backlog, new Set(), new Set(['i1'])))).toEqual({ DEV: 0, QA: 0 });
  });

  it('não duplica quando o servidor já devolveu o item', () => {
    expect(buildScope([item()], backlog, new Set(['SQ-1']), new Set())).toHaveLength(1);
  });

  it('as horas do item são as do servidor (devHours/qaHours), mesmo que o backlog diga outra coisa', () => {
    const e = buildScope([item({ devHours: 12, qaHours: 3 })], backlog, new Set(), new Set());
    expect([e[0].dev, e[0].qa]).toEqual([12, 3]);
    expect(e[0].item?.id).toBe('i1');
  });

  it('resumo: totais do servidor quando nada está pendente; soma local só durante a mudança', () => {
    const plan = { scope: { ...scopeTotalsOf([item()]), itemCount: 7, allocated: { DEV: 70, QA: 30 } }, thermometer: {} };
    const entries = buildScope([item()], backlog, new Set(), new Set());
    expect(scopeSummary(plan, entries, false)).toEqual({ count: 7, DEV: 70, QA: 30 });
    expect(scopeSummary(plan, entries, true)).toEqual({ count: 1, DEV: 18, QA: 6 });
  });

  it('applyScope troca itens, totais e termômetro e mantém a versão do plano', () => {
    const sv = scopeViewOf([item()], { DEV: thermo({ allocatedHours: 18 }) });
    const plan = { version: 9, items: [], scope: scopeTotalsOf([]), thermometer: {} } as unknown as PlanView;
    const next = applyScope(plan, sv);
    expect([next.version, next.items.length, next.scope.itemCount, next.thermometer.DEV.allocatedHours]).toEqual([9, 1, 1, 18]);
  });

  it('estimativa provisória usa as faixas e a reserva do servidor', () => {
    const t = estimateThermometer(thermo(), 96);
    expect(t.pct).toBeCloseTo(106.7, 1);
    expect(t.state).toBe('COBERTO_PELA_RESERVA');
    expect(t.zone).toBe('VERMELHO');
    expect(estimateThermometer(thermo(), 60).zone).toBe('VERDE');
    expect(estimateThermometer(thermo(), 80).zone).toBe('AMARELO');
    expect(estimateThermometer(thermo(), 80).state).toBe('DENTRO_DA_CAPACIDADE');
    expect(estimateThermometer(thermo(), 120).state).toBe('ACIMA_DA_RESERVA');
    expect(estimateThermometer(thermo({ capacityHours: 0 }), 10).state).toBe('SEM_CAPACIDADE');
  });
});

describe('filtros das refinadas', () => {
  const view: BacklogView = {
    syncedAt: null, sprintKey: 'plan:p1', unclassifiedTypes: [],
    items: [
      parent(),
      parent({ key: 'SQ-2', title: 'Troca', divergent: false, divergenceDev: false }),
      parent({ key: 'SQ-3', title: 'Sem nada', titleHours: null, sumByClass: {}, subtasks: [], divergent: false, divergenceDev: false }),
      parent({ key: 'SQ-4', title: 'Sobra', carryOver: true, divergent: false, divergenceDev: false }),
    ],
  };
  const f = (o: Partial<Parameters<typeof filterBacklog>[2]>, inScope = new Set<string>()) =>
    filterBacklog(view, inScope, { query: '', onlyWithHours: false, filter: 'todas', ...o }).map((p) => p.key);

  it('busca, só com horas, filtros e quem já está no escopo some', () => {
    expect(f({})).toEqual(['SQ-1', 'SQ-2', 'SQ-3', 'SQ-4']);
    expect(f({ query: 'troca' })).toEqual(['SQ-2']);
    expect(f({ onlyWithHours: true })).toEqual(['SQ-1', 'SQ-2', 'SQ-4']);
    expect(f({ filter: 'sobra' })).toEqual(['SQ-4']);
    expect(f({ filter: 'divergentes' })).toEqual(['SQ-1']);
    expect(f({ filter: 'sem-estimativa' })).toEqual(['SQ-3']);
    expect(f({}, new Set(['SQ-1']))).toEqual(['SQ-2', 'SQ-3', 'SQ-4']);
  });
});

describe('tipos sem classificação, sincronização e avanço', () => {
  it('resume contagem, horas e nomes', () => {
    expect(unclassifiedSummary([])).toBeNull();
    expect(unclassifiedSummary([
      { typeId: '1', typeName: 'Especificação', count: 1, hours: 3 },
      { typeId: '2', typeName: 'Plano de Testes', count: 2, hours: 9 },
    ])).toEqual({ count: 3, hours: 12, names: 'Especificação (1), Plano de Testes (2)' });
  });

  it('"sincronizado há X min"', () => {
    const now = Date.parse('2026-10-20T12:00:00Z');
    expect(syncedAgo(null, now)).toBeNull();
    expect(syncedAgo('2026-10-20T11:59:50Z', now)).toBe('agora há pouco');
    expect(syncedAgo('2026-10-20T11:57:00Z', now)).toBe('há 3 min');
    expect(syncedAgo('2026-10-20T09:00:00Z', now)).toBe('há 3 h');
  });

  it('avançar exige pelo menos uma tarefa', () => {
    expect(canAdvanceFromScope({ items: [] })).toBe(false);
    expect(canAdvanceFromScope({ items: [item()] })).toBe(true);
  });
});
