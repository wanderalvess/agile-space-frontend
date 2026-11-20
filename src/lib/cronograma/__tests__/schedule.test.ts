import { describe, expect, it } from 'vitest';
import { dayFromYmd, formatPt, parseStamp } from '../dates';
import { buildModel, computeKpis, inferredSubtasks, type BuildContext } from '../schedule';
import { buildCapacityResolver } from '../suggest';
import { toCronoTask, type CronoTask } from '../task';
import { EMPTY_FILTERS, axisDays, barGeometry, buildRows, countEmptyClosed, filterStories, presetRange, quickCounts, sprintRange } from '../view';

const NOW = Date.parse('2026-10-20T12:00:00Z'); // terça 09:00 em Brasília
const d = (day: number) => dayFromYmd(2026, 10, day);

let n = 0;
function task(over: Partial<CronoTask> & { key: string }): CronoTask {
  n += 1;
  return {
    title: over.key, type: 'Sub-task', zeroWindow: false, status: 'To Do', statusCategory: 'new', assigneeId: '', assigneeName: '', parentKey: '', parentTitle: '',
    orderIndex: n, estimateSec: 0, remainingSec: 0, isBug: false, start: null, end: null, datesAreInferred: true, resolvedAt: null, sprintName: 'S1', ...over,
  };
}
const real = (s: string, e: string) => {
  const st = parseStamp(s);
  const en = parseStamp(e);
  const zeroWindow = !!st && !!en && st.minutes !== null && en.minutes !== null && (en.day - st.day) * 1440 + en.minutes - st.minutes < 60;
  return { start: st, end: en, datesAreInferred: false, zeroWindow };
};

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

describe('toCronoTask: janela sem duração', () => {
  it('início e fim no mesmo minuto (ou invertidos) são janela sem duração; com duração normal não', () => {
    const mk = (s: string, e: string) => toCronoTask({ key: 'A-1', type: 'x', targetStart: s, targetEnd: e, datesAreInferred: false } as never, 0);
    expect(mk('2026-10-20T17:35:00-03:00', '2026-10-20T17:35:00-03:00').zeroWindow).toBe(true);
    expect(mk('2026-10-20T17:35:00-03:00', '2026-10-20T17:00:00-03:00').zeroWindow).toBe(true);
    expect(mk('2026-10-21T17:38:00-03:00', '2026-10-22T17:38:00-03:00').zeroWindow).toBe(false);
    expect(mk('2026-10-20', '2026-10-20').zeroWindow).toBe(false);
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

describe('ajustes do cronograma real (DDWMISSI)', () => {
  const doing = { status: 'In Progress', statusCategory: 'indeterminate' as const };

  it('janela sem duração: barra mínima de 1 hora, aviso e nenhum atraso presumido nem cascata', () => {
    const tasks = [
      story(),
      sub('DEV', 'Codificação', { ...real('2026-10-20T17:35:00-03:00', '2026-10-20T17:35:00-03:00'), ...doing, estimateSec: hours6(), remainingSec: hours6(), assigneeName: 'W', assigneeId: 'w' }),
      sub('QA', 'Teste QA', real('2026-10-22', '2026-10-23')),
    ];
    const [h] = buildModel(tasks, ctx());
    const dev = h.tasks.find((t) => t.task.key === 'DEV')!;
    expect(dev.zeroWindow).toBe(true);
    expect(dev.slip).toMatchObject({ own: 0, presumedDays: 0, shift: 0 });
    const w = dev.planned!;
    expect((w.end.day + w.end.frac) - (w.start.day + w.start.frac)).toBeCloseTo(60 / 540, 5);
    expect(h.tasks.find((t) => t.task.key === 'QA')!.slip.pushed).toBe(0);
  });

  it('atraso presumido aparece só na própria fase: não empurra e não entra no KPI de atraso', () => {
    const tasks = [
      story(),
      sub('DEV', 'Codificação', { ...real('2026-10-19T09:00:00-03:00', '2026-10-20T18:00:00-03:00'), ...doing, remainingSec: 40 * 3600 }),
      sub('QA', 'Teste QA', real('2026-10-22', '2026-10-23')),
    ];
    const [h] = buildModel(tasks, ctx());
    const dev = h.tasks.find((t) => t.task.key === 'DEV')!;
    expect(dev.slip.presumedDays).toBeGreaterThan(0);
    expect(dev.slip.own).toBe(0);
    expect(h.tasks.find((t) => t.task.key === 'QA')!.slip.shift).toBe(0);
    expect(computeKpis([h])).toMatchObject({ delayed: 0, mayDelay: 1 });
  });

  it('atraso observado empurra; fase com data aproximada nunca é empurrada', () => {
    const tasks = [
      story(),
      sub('DEV', 'Codificação', { ...real('2026-10-14T09:00:00-03:00', '2026-10-16T18:00:00-03:00'), ...doing }),
      sub('QA', 'Teste QA', { start: parseStamp('2026-10-22'), end: parseStamp('2026-10-23'), datesAreInferred: true }),
    ];
    const [h] = buildModel(tasks, ctx());
    const qa = h.tasks.find((t) => t.task.key === 'QA')!;
    expect(h.tasks.find((t) => t.task.key === 'DEV')!.slip.own).toBe(2);
    expect(qa.slip.pushed).toBe(0);
    expect(computeKpis([h]).delayed).toBe(1);
  });

  it('a sugestão nunca substitui data real do Jira, mesmo com a fonte "horas"', () => {
    const tasks = [
      story(),
      sub('A', 'Codificação', { ...real('2026-10-21T17:38:00-03:00', '2026-10-22T17:38:00-03:00'), assigneeId: 'w', assigneeName: 'W', estimateSec: 8 * 3600 }),
      sub('B', 'Codificação', { assigneeId: 'w', assigneeName: 'W', estimateSec: 8 * 3600, start: parseStamp('2026-10-01'), end: parseStamp('2026-10-02') }),
    ];
    const [h] = buildModel(tasks, ctx({ source: 'horas' }));
    const a = h.tasks.find((t) => t.task.key === 'A')!;
    expect(a.origin).toBe('jira');
    expect(a.suggestion).toBeNull();
    expect(formatPt(a.planned!.start)).toBe('21/10 17:38');
    expect(h.tasks.find((t) => t.task.key === 'B')!.origin).toBe('sugestao');
  });

  it('kpi: fim previsto depois do fim da sprint vira aviso em dias úteis', () => {
    const tasks = [story(), sub('A', 'Codificação', { assigneeId: 'x', estimateSec: 30 * 3600 })];
    const k = computeKpis(buildModel(tasks, ctx({ source: 'horas' })), d(21));
    expect(k.overrunDays).toBeGreaterThan(0);
    expect(k.forecastIsSuggestion).toBe(true);
    expect(computeKpis(buildModel(tasks, ctx({ source: 'horas' })), d(30)).overrunDays).toBe(0);
  });
});

function hours6() { return 6 * 3600; }

describe('filtros rápidos e fases ocultas', () => {
  const doingT = { status: 'In Progress', statusCategory: 'indeterminate' as const };
  const tasks = [
    story(),
    sub('LATE', 'Codificação', { ...real('2026-10-14T09:00:00-03:00', '2026-10-16T18:00:00-03:00'), ...doingT, assigneeId: 'me' }),
    sub('OPEN', 'Teste QA', { assigneeId: 'other', estimateSec: 3600 }),
    sub('CLOSED1', 'Teste QA', { status: 'Fechado', statusCategory: 'done' }),
    sub('CLOSED2', 'Execução TI', { status: 'Cancelado', statusCategory: 'done' }),
    sub('CLOSED_WITH_DATES', 'Code Review', { status: 'Fechado', statusCategory: 'done', ...real('2026-10-15', '2026-10-15') }),
    sub('NO_ESTIMATE', 'Execução TI', { assigneeId: 'other' }),
  ];
  const model = () => buildModel(tasks, ctx());

  it('Atrasadas, Em andamento e Minhas', () => {
    const keys = (quick: 'LATE' | 'DOING' | 'MINE' | 'MAY_LATE') => filterStories(model(), { ...EMPTY_FILTERS, quick }, { myAccountId: 'me' }).flatMap((v) => v.tasks.map((t) => t.task.key));
    expect(keys('LATE')).toContain('LATE');
    expect(keys('LATE')).not.toContain('OPEN');
    expect(keys('DOING')).toEqual(['LATE']);
    expect(keys('MINE')).toEqual(['LATE']);
    expect(filterStories(model(), { ...EMPTY_FILTERS, quick: 'MINE' }, {})).toEqual([]);
    expect(quickCounts(model(), { myAccountId: 'me' })).toMatchObject({ late: expect.any(Number), doing: 1, mine: 1 });
  });

  it('esconde fechadas sem datas e sem horas; fases visíveis + ocultas = total', () => {
    const m = model();
    const total = m.reduce((a, s) => a + s.tasks.length, 0);
    const hidden = countEmptyClosed(m);
    expect(hidden).toBe(2);
    const shown = filterStories(m, EMPTY_FILTERS, { hideEmptyClosed: true }).reduce((a, v) => a + v.tasks.length, 0);
    expect(shown + hidden).toBe(total);
    const all = filterStories(m, EMPTY_FILTERS, { hideEmptyClosed: false }).reduce((a, v) => a + v.tasks.length, 0);
    expect(all).toBe(total);
    const keys = filterStories(m, EMPTY_FILTERS, { hideEmptyClosed: true })[0].tasks.map((t) => t.task.key);
    expect(keys).toContain('CLOSED_WITH_DATES');
    expect(keys).toContain('NO_ESTIMATE');
  });
});
