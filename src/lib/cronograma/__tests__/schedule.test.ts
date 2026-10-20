import { describe, expect, it } from 'vitest';
import { dayFromYmd, formatPt, parseStamp } from '../dates';
import { buildModel, computeKpis, inferredSubtasks, type BuildContext } from '../schedule';
import { buildCapacityResolver } from '../suggest';
import { toCronoTask, type CronoTask } from '../task';
import { EMPTY_FILTERS, axisDays, barGeometry, buildRows, filterStories, presetRange, sprintRange } from '../view';

const NOW = Date.parse('2026-10-20T12:00:00Z'); // terça 09:00 em Brasília
const d = (day: number) => dayFromYmd(2026, 10, day);

let n = 0;
function task(over: Partial<CronoTask> & { key: string }): CronoTask {
  n += 1;
  return {
    title: over.key, type: 'Sub-task', status: 'To Do', statusCategory: 'new', assigneeId: '', assigneeName: '', parentKey: '', parentTitle: '',
    orderIndex: n, estimateSec: 0, remainingSec: 0, isBug: false, start: null, end: null, datesAreInferred: true, resolvedAt: null, sprintName: 'S1', ...over,
  };
}
const real = (s: string, e: string) => ({ start: parseStamp(s), end: parseStamp(e), datesAreInferred: false });

const ctx = (over: Partial<BuildContext> = {}): BuildContext => ({
  nowMs: NOW, source: 'jira', capacityOf: buildCapacityResolver([], undefined), ...over,
});

const story = (key = 'H1') => task({ key, type: 'Story', parentKey: '' });
const sub = (key: string, type: string, over: Partial<CronoTask> = {}) => task({ key, type, parentKey: 'H1', parentTitle: 'História', ...over });

describe('toCronoTask', () => {
  it('aceita data e data-hora e trata datesAreInferred ausente como inferido', () => {
    const t = toCronoTask({ key: 'A-1', type: 'Sub-task', targetStart: '2026-10-20T09:00:00-03:00', targetEnd: '2026-10-22', datesAreInferred: false } as never, 0);
    expect(t.start).toEqual({ day: d(20), minutes: 540 });
    expect(t.end).toEqual({ day: d(22), minutes: null });
    expect(t.datesAreInferred).toBe(false);
    expect(toCronoTask({ key: 'A-2', type: 'x' } as never, 1).datesAreInferred).toBe(true);
  });
});

describe('buildModel com datas reais do Jira', () => {
  it('usa data e hora, e a fase atrasada empurra as seguintes', () => {
    const tasks = [
      story(),
      sub('DEV', 'Codificação', { ...real('2026-10-14T09:00:00-03:00', '2026-10-16T18:00:00-03:00'), status: 'In Progress', statusCategory: 'indeterminate' }),
      sub('QA', 'Teste QA', real('2026-10-21T09:00:00-03:00', '2026-10-23T12:00:00-03:00')),
    ];
    const [h] = buildModel(tasks, ctx());
    const dev = h.tasks.find((t) => t.task.key === 'DEV')!;
    const qa = h.tasks.find((t) => t.task.key === 'QA')!;
    expect(dev.origin).toBe('jira');
    expect(dev.slip).toMatchObject({ own: 2, reason: 'overdue' });
    expect(formatPt(dev.planned!.start)).toBe('14/10 09:00');
    expect(formatPt(dev.effective!.end)).toBe('20/10 18:00');
    expect(qa.slip.pushed).toBe(2);
    expect(formatPt(qa.effective!.start)).toBe('23/10 09:00');
    expect(h.delayDays).toBe(2);
    expect(computeKpis([h])).toMatchObject({ phases: 2, delayed: 2, inProgress: 1 });
  });

  it('a simulação de atraso empurra as fases seguintes só desta história', () => {
    const tasks = [
      story(),
      sub('DEV', 'Codificação', real('2026-10-20', '2026-10-21')),
      sub('QA', 'Teste QA', real('2026-10-22', '2026-10-23')),
      task({ key: 'H2', type: 'Story' }),
      task({ key: 'OUTRA', type: 'Codificação', parentKey: 'H2', ...real('2026-10-20', '2026-10-21') }),
    ];
    const model = buildModel(tasks, ctx(), { key: 'DEV', days: 2 });
    const qa = model[0].tasks.find((t) => t.task.key === 'QA')!;
    expect(qa.slip.pushed).toBe(2);
    expect(model[0].tasks.find((t) => t.task.key === 'DEV')!.slip.manual).toBe(true);
    expect(model[1].tasks[0].slip.shift).toBe(0);
  });
});

describe('buildModel com datas aproximadas', () => {
  const tasks = (): CronoTask[] => [
    story(),
    sub('DEV', 'Codificação', {
      start: parseStamp('2026-10-01'), end: parseStamp('2026-10-02'), estimateSec: 16.4 * 3600, assigneeId: 'a', assigneeName: 'Ana',
    }),
    sub('QA', 'Teste QA', {
      start: parseStamp('2026-10-01'), end: parseStamp('2026-10-02'), estimateSec: 8.2 * 3600, assigneeId: 'd', assigneeName: 'Diego',
    }),
  ];

  it('nunca declara atraso sobre datas inventadas, mesmo com o fim no passado', () => {
    const [h] = buildModel(tasks(), ctx());
    expect(h.tasks.every((t) => t.origin === 'aproximada' && t.slip.shift === 0)).toBe(true);
    expect(h.delayDays).toBe(0);
  });

  it('com a fonte "horas" usa a sugestão: DEV 2 dias, QA espera o DEV', () => {
    const [h] = buildModel(tasks(), ctx({ source: 'horas' }));
    const dev = h.tasks.find((t) => t.task.key === 'DEV')!;
    const qa = h.tasks.find((t) => t.task.key === 'QA')!;
    expect(dev.origin).toBe('sugestao');
    expect(formatPt(dev.planned!.start)).toBe('20/10 09:00');
    expect(formatPt(dev.planned!.end)).toBe('21/10 18:00');
    expect(formatPt(qa.planned!.start)).toBe('22/10 09:00');
    expect(qa.slip.shift).toBe(0);
    expect(dev.suggestion?.capacityHours).toBe(8.2);
  });

  it('a sugestão aparece nos detalhes mesmo com a fonte "jira"', () => {
    const [h] = buildModel(tasks(), ctx());
    expect(h.tasks[0].suggestion).not.toBeNull();
  });

  it('data aproximada inteira fora da sprint não vira barra: cai na sugestão', () => {
    const win = { sprintStartDay: d(13), sprintEndDay: d(30) };
    const [h] = buildModel(tasks(), ctx(win));
    expect(h.tasks.every((t) => t.origin === 'sugestao')).toBe(true);
    const inside = tasks().map((t) => (t.parentKey ? { ...t, start: parseStamp('2026-10-15'), end: parseStamp('2026-10-16') } : t));
    expect(buildModel(inside, ctx(win))[0].tasks.every((t) => t.origin === 'aproximada')).toBe(true);
  });

  it('sem nenhuma data e com horas, cai na sugestão automaticamente', () => {
    const [h] = buildModel([story(), sub('DEV', 'Codificação', { estimateSec: 8.2 * 3600 })], ctx());
    expect(h.tasks[0].origin).toBe('sugestao');
  });

  it('sem datas e sem horas fica sem barra', () => {
    const [h] = buildModel([story(), sub('DEV', 'Codificação')], ctx());
    expect(h.tasks[0].origin).toBe('nenhuma');
    expect(h.tasks[0].effective).toBeNull();
  });

  it('inferredSubtasks conta só subtarefas', () => {
    expect(inferredSubtasks(tasks())).toEqual({ inferred: 2, total: 2 });
    expect(inferredSubtasks([story(), sub('X', 'Codificação', real('2026-10-20', '2026-10-21'))])).toEqual({ inferred: 0, total: 1 });
  });
});

describe('filtros, linhas e geometria', () => {
  const tasks = [
    story('H1'), sub('A-1', 'Codificação', { assigneeName: 'Ana', ...real('2026-10-20', '2026-10-21') }),
    sub('A-2', 'Teste QA', { assigneeName: 'Diego', status: 'In Progress', statusCategory: 'indeterminate', ...real('2026-10-22', '2026-10-23') }),
    task({ key: 'H2', type: 'Story' }), task({ key: 'B-1', type: 'Codificação', parentKey: 'H2', assigneeName: 'Ana', ...real('2026-10-20', '2026-10-22') }),
  ];
  const model = () => buildModel(tasks, ctx());

  it('sem filtro mostra tudo; busca por chave de subtarefa mostra só a fase', () => {
    expect(filterStories(model(), EMPTY_FILTERS).map((v) => v.tasks.length)).toEqual([2, 1]);
    const r = filterStories(model(), { ...EMPTY_FILTERS, search: 'a-2' });
    expect(r).toHaveLength(1);
    expect(r[0].tasks.map((t) => t.task.key)).toEqual(['A-2']);
  });

  it('buscar a chave da história mostra as fases dela', () => {
    const r = filterStories(model(), { ...EMPTY_FILTERS, search: 'H1' });
    expect(r[0].tasks).toHaveLength(2);
  });

  it('filtra por status, tipo e responsável', () => {
    expect(filterStories(model(), { ...EMPTY_FILTERS, status: 'In Progress' })[0].tasks.map((t) => t.task.key)).toEqual(['A-2']);
    expect(filterStories(model(), { ...EMPTY_FILTERS, type: 'Teste QA' })[0].tasks).toHaveLength(1);
    expect(filterStories(model(), { ...EMPTY_FILTERS, assignee: 'Ana' }).map((v) => v.story.key)).toEqual(['H1', 'H2']);
  });

  it('os três níveis de hierarquia e o recolher', () => {
    const v = filterStories(model(), EMPTY_FILTERS);
    const kinds = (level: 'story-to-subtask' | 'subtask-only' | 'story-only', collapsed = {}) =>
      buildRows(v, { grouping: 'story', level, collapsed }).map((r) => r.kind);
    expect(kinds('story-to-subtask')).toEqual(['story', 'task', 'task', 'story', 'task']);
    expect(kinds('subtask-only')).toEqual(['task', 'task', 'task']);
    expect(kinds('story-only')).toEqual(['story', 'story']);
    expect(kinds('story-to-subtask', { H1: true })).toEqual(['story', 'story', 'task']);
  });

  it('por pessoa agrupa e separa em faixas o que se sobrepõe', () => {
    const overlapping = buildModel([
      story(), sub('X', 'Codificação', { assigneeName: 'Ana', ...real('2026-10-20', '2026-10-22') }),
      sub('Y', 'Codificação', { assigneeName: 'Ana', ...real('2026-10-21', '2026-10-23') }),
    ], ctx());
    const rows = buildRows(filterStories(overlapping, EMPTY_FILTERS), { grouping: 'person', level: 'story-to-subtask', collapsed: {} });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'person', name: 'Ana', lanes: 2, overlap: true });
  });

  it('períodos e eixo', () => {
    const sprint = sprintRange('2026-10-13T00:00:00Z', '2026-10-24', NOW);
    expect(sprint).toEqual({ start: d(13), end: d(24) });
    expect(sprintRange(undefined, undefined, NOW)).toEqual({ start: d(20), end: d(33) });
    expect(presetRange('NEXT_14_DAYS', sprint, NOW)).toEqual({ start: d(20), end: d(34) });
    expect(presetRange('CURRENT_MONTH', sprint, NOW)).toEqual({ start: d(1), end: d(31) });
    expect(axisDays(sprint)).toHaveLength(12);
    expect(axisDays({ start: d(5), end: d(1) })).toEqual([]);
  });

  it('a barra é proporcional à hora do dia e é cortada nas pontas do eixo', () => {
    const g = barGeometry({ start: { day: d(20), frac: 0.5 }, end: { day: d(21), frac: 1 } }, d(19), d(23), 100)!;
    expect(g.left).toBe(150);
    expect(g.width).toBe(150);
    expect(barGeometry({ start: { day: d(1), frac: 0 }, end: { day: d(2), frac: 1 } }, d(19), d(23), 100)).toBeNull();
    const clipped = barGeometry({ start: { day: d(10), frac: 0 }, end: { day: d(21), frac: 1 } }, d(19), d(23), 100)!;
    expect(clipped).toMatchObject({ left: 0, clippedStart: true, clippedEnd: false });
  });
});

describe('desempenho', () => {
  it('uma sprint com 600 subtarefas monta o modelo sem travar', () => {
    const tasks: CronoTask[] = [];
    for (let s = 0; s < 120; s += 1) {
      tasks.push(task({ key: `S-${s}`, type: 'Story' }));
      ['Codificação', 'Testes Automatizados', 'Code Review', 'Teste QA', 'Execução TI'].forEach((type, i) => {
        tasks.push(task({
          key: `S-${s}-${i}`, type, parentKey: `S-${s}`, assigneeId: `p${(s + i) % 12}`, assigneeName: `Pessoa ${(s + i) % 12}`,
          estimateSec: (4 + i) * 3600, ...real('2026-10-14T09:00:00-03:00', '2026-10-28T18:00:00-03:00'),
        }));
      });
    }
    const t0 = performance.now();
    const model = buildModel(tasks, ctx({ source: 'horas' }));
    const ms = performance.now() - t0;
    expect(model).toHaveLength(120);
    expect(model[0].tasks).toHaveLength(5);
    expect(ms).toBeLessThan(1500);
  });
});
