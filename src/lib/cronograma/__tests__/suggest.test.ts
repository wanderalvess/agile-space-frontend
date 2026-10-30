import { describe, expect, it } from 'vitest';
import { dayFromYmd, formatPt, isoOfDay, type Pt } from '../dates';
import { advance, buildCapacityResolver, hoursForSuggestion, suggestSchedule, type SuggestTask } from '../suggest';

const d = (day: number) => dayFromYmd(2026, 10, day);
const MON_9H: Pt = { day: d(19), frac: 0 };
const CAP = 8.2;

const mk = (over: Partial<SuggestTask> & { key: string }): SuggestTask => ({
  storyKey: 'H1', order: 0, tie: 0, person: 'ana', hours: 8.2, inProgress: false, done: false, ...over,
});
const run = (tasks: SuggestTask[], now: Pt = MON_9H, cap: (p: string | null) => number = () => CAP, sprintStartDay?: number) =>
  suggestSchedule(tasks, { now, capacityOf: cap, sprintStartDay });

describe('advance', () => {
  it('um dia útil de capacidade ocupa a jornada inteira, 9h às 18h', () => {
    const end = advance(MON_9H, 1);
    expect(formatPt(end)).toBe('19/10 18:00');
  });
  it('passa para o próximo dia útil e pula o fim de semana', () => {
    const end = advance({ day: d(23), frac: 0 }, 1.5); // sexta
    expect(isoOfDay(end.day)).toBe('2026-10-26');
    expect(end.frac).toBeCloseTo(0.5);
  });
});

describe('hoursForSuggestion', () => {
  it('em andamento usa o restante; senão a estimativa', () => {
    expect(hoursForSuggestion({ inProgress: true, estimateSec: 10 * 3600, remainingSec: 4 * 3600 })).toBe(4);
    expect(hoursForSuggestion({ inProgress: false, estimateSec: 10 * 3600, remainingSec: 4 * 3600 })).toBe(10);
    expect(hoursForSuggestion({ inProgress: true, estimateSec: 10 * 3600, remainingSec: 0 })).toBe(10);
    expect(hoursForSuggestion({ inProgress: false, estimateSec: 0, remainingSec: 0 })).toBe(0);
  });
});

describe('suggestSchedule', () => {
  it('capacidade 8,2 h: 8,2 h cabem em um dia, 16,4 h em dois', () => {
    const r = run([mk({ key: 'a', hours: 8.2 }), mk({ key: 'b', storyKey: 'H2', person: 'bia', hours: 16.4 })]);
    expect(formatPt(r.get('a')!.start)).toBe('19/10 09:00');
    expect(formatPt(r.get('a')!.end)).toBe('19/10 18:00');
    expect(formatPt(r.get('b')!.end)).toBe('20/10 18:00');
  });

  it('a capacidade da pessoa muda a duração', () => {
    const cap = (p: string | null) => (p === 'diego' ? 8.3 : p === 'ana' ? 4 : CAP);
    const r = run([mk({ key: 'a', hours: 8, person: 'ana' }), mk({ key: 'd', storyKey: 'H2', hours: 8.3, person: 'diego' })], MON_9H, cap);
    expect(formatPt(r.get('a')!.end)).toBe('20/10 18:00'); // 8h / 4h por dia = 2 dias
    expect(formatPt(r.get('d')!.end)).toBe('19/10 18:00');
    expect(r.get('a')!.capacityHours).toBe(4);
  });

  it('a fase só começa depois que a anterior termina (QA espera DEV, de outra pessoa)', () => {
    const r = run([
      mk({ key: 'dev', order: 0, person: 'ana', hours: 16.4 }),
      mk({ key: 'qa', order: 3, person: 'diego', hours: 8.2 }),
    ]);
    expect(formatPt(r.get('dev')!.end)).toBe('20/10 18:00');
    expect(formatPt(r.get('qa')!.start)).toBe('21/10 09:00');
    expect(formatPt(r.get('qa')!.end)).toBe('21/10 18:00');
  });

  it('a espera vale mesmo quando o fim da anterior cai no meio do dia', () => {
    const r = run([
      mk({ key: 'dev', order: 0, person: 'ana', hours: 4.1 }),
      mk({ key: 'qa', order: 1, person: 'diego', hours: 4.1 }),
    ]);
    expect(formatPt(r.get('dev')!.end)).toBe('19/10 13:30');
    expect(formatPt(r.get('qa')!.start)).toBe('19/10 13:30');
    expect(formatPt(r.get('qa')!.end)).toBe('19/10 18:00');
  });

  it('cada pessoa executa em fila: duas subtarefas da mesma pessoa nunca se sobrepõem', () => {
    const r = run([
      mk({ key: 'a', storyKey: 'H1', person: 'ana', hours: 8.2 }),
      mk({ key: 'b', storyKey: 'H2', person: 'ana', hours: 8.2 }),
    ]);
    expect(formatPt(r.get('a')!.end)).toBe('19/10 18:00');
    expect(formatPt(r.get('b')!.start)).toBe('20/10 09:00');
  });

  it('pessoas diferentes trabalham ao mesmo tempo', () => {
    const r = run([
      mk({ key: 'a', storyKey: 'H1', person: 'ana' }),
      mk({ key: 'b', storyKey: 'H2', person: 'bia' }),
    ]);
    expect(formatPt(r.get('b')!.start)).toBe('19/10 09:00');
  });

  it('fases da mesma ordem na mesma história rodam em paralelo (pessoas diferentes)', () => {
    const r = run([
      mk({ key: 'a', order: 0, person: 'ana' }),
      mk({ key: 'b', order: 0, person: 'bia' }),
    ]);
    expect(formatPt(r.get('b')!.start)).toBe('19/10 09:00');
  });

  it('não sugere no passado: começa em "agora" (meio da tarde) e não às 9h', () => {
    const r = run([mk({ key: 'a', hours: 2 })], { day: d(21), frac: 0.5 });
    expect(formatPt(r.get('a')!.start)).toBe('21/10 13:30');
  });

  it('agora fora do expediente ou no fim de semana já chega normalizado; sexta à noite começa na segunda', () => {
    const r = run([mk({ key: 'a', hours: 2 })], { day: d(23), frac: 1 });
    expect(isoOfDay(r.get('a')!.start.day)).toBe('2026-10-26');
    expect(r.get('a')!.start.frac).toBe(0);
  });

  it('respeita o início da sprint quando ela ainda não começou', () => {
    const r = run([mk({ key: 'a', hours: 2 })], MON_9H, () => CAP, d(22));
    expect(isoOfDay(r.get('a')!.start.day)).toBe('2026-10-22');
  });

  it('tarefa em andamento ocupa a fila da pessoa primeiro; as demais vêm depois', () => {
    const r = run([
      mk({ key: 'todo', storyKey: 'H1', person: 'ana', hours: 8.2 }),
      mk({ key: 'doing', storyKey: 'H2', person: 'ana', hours: 4.1, inProgress: true }),
    ]);
    expect(formatPt(r.get('doing')!.start)).toBe('19/10 09:00');
    expect(formatPt(r.get('doing')!.end)).toBe('19/10 13:30');
    expect(formatPt(r.get('todo')!.start)).toBe('19/10 13:30');
  });

  it('concluídas não ganham sugestão, mas a fase seguinte espera o fim real delas', () => {
    const r = run([
      mk({ key: 'dev', order: 0, done: true, doneEnd: { day: d(21), frac: 1 } }),
      mk({ key: 'qa', order: 1, person: 'diego' }),
    ]);
    expect(r.has('dev')).toBe(false);
    expect(formatPt(r.get('qa')!.start)).toBe('22/10 09:00');
  });

  it('sem horas não há sugestão; sem responsável não há fila', () => {
    const r = run([
      mk({ key: 'x', hours: 0 }),
      mk({ key: 'u1', storyKey: 'H2', person: null }),
      mk({ key: 'u2', storyKey: 'H3', person: null }),
    ]);
    expect(r.has('x')).toBe(false);
    expect(formatPt(r.get('u2')!.start)).toBe('19/10 09:00');
  });
});

describe('buildCapacityResolver', () => {
  const members = [
    { jiraAccountId: 'acc-ana', displayName: 'Ana Ribeiro', capacityHoursPerDay: 8.3 },
    { jiraAccountId: 'acc-bia', displayName: 'Bia Souza', systemCalculatedCapacityHoursPerDay: 7 },
    { jiraAccountId: 'acc-cid', displayName: 'Cid Lima' },
  ];
  it('pessoa > padrão da squad > 8h12', () => {
    const withSquad = buildCapacityResolver(members, 6);
    expect(withSquad('acc-ana', '')).toEqual({ hours: 8.3, source: 'pessoa' });
    expect(withSquad('acc-bia', '')).toEqual({ hours: 7, source: 'pessoa' });
    expect(withSquad('acc-cid', 'Cid Lima')).toEqual({ hours: 6, source: 'squad' });
    const noSquad = buildCapacityResolver(members, undefined);
    expect(noSquad('', 'Fulano')).toEqual({ hours: 8.2, source: 'padrao' });
    expect(buildCapacityResolver(members, 0)('x', 'y').source).toBe('padrao');
  });
  it('acha a pessoa pelo nome quando o id não casa', () => {
    expect(buildCapacityResolver(members, 6)('outro-id', ' ana ribeiro ')).toEqual({ hours: 8.3, source: 'pessoa' });
  });
});

describe('fase com data real entra na fila como bloco ocupado', () => {
  const fixed = (s: number, sf: number, e: number, ef: number) => ({ start: { day: d(s), frac: sf }, end: { day: d(e), frac: ef } });

  it('não é recalculada e não ganha sugestão', () => {
    const r = run([mk({ key: 'real', hours: 8.2, fixed: fixed(21, 0.5, 22, 0.5) })]);
    expect(r.has('real')).toBe(false);
  });

  it('duas fases do mesmo responsável, uma com data real no meio da fila: a outra contorna o bloco', () => {
    const r = run([
      mk({ key: 'a', storyKey: 'H1', person: 'ana', hours: 8.2 }),
      mk({ key: 'meio', storyKey: 'H2', person: 'ana', hours: 8.2, fixed: fixed(20, 0, 20, 1) }),
      mk({ key: 'c', storyKey: 'H3', person: 'ana', hours: 8.2 }),
    ]);
    expect(formatPt(r.get('a')!.start)).toBe('19/10 09:00');
    expect(formatPt(r.get('a')!.end)).toBe('19/10 18:00');
    expect(formatPt(r.get('c')!.start)).toBe('21/10 09:00');
    expect(formatPt(r.get('c')!.end)).toBe('21/10 18:00');
  });

  it('uma tarefa que não cabe antes do bloco vai para depois dele', () => {
    const r = run([
      mk({ key: 'bloco', storyKey: 'H1', person: 'ana', hours: 1, fixed: fixed(19, 0.5, 19, 1) }),
      mk({ key: 'longa', storyKey: 'H2', person: 'ana', hours: 8.2 }),
    ]);
    expect(formatPt(r.get('longa')!.start)).toBe('20/10 09:00');
  });

  it('a fase seguinte espera o fim da fase com data real', () => {
    const r = run([
      mk({ key: 'dev', order: 0, person: 'ana', fixed: fixed(21, 0, 22, 1) }),
      mk({ key: 'qa', order: 3, person: 'diego', hours: 8.2 }),
    ]);
    expect(formatPt(r.get('qa')!.start)).toBe('23/10 09:00');
  });
});
