import { describe, expect, it } from 'vitest';
import { cascadeStory } from '../cascade';
import { dayFromYmd, parseStamp } from '../dates';
import { inferSlip } from '../slip';

const d = (day: number) => dayFromYmd(2026, 10, day);
const today = d(20); // terça

const base = (over: Partial<Parameters<typeof inferSlip>[0]> = {}) => ({
  datesAreInferred: false,
  statusCategory: 'indeterminate' as const,
  start: parseStamp('2026-10-14'),
  end: parseStamp('2026-10-30'),
  resolvedAt: null,
  remainingSec: 0,
  ...over,
});

describe('inferSlip', () => {
  it('não declara atraso com datas inferidas', () => {
    expect(inferSlip(base({ datesAreInferred: true, end: parseStamp('2026-10-01') }), today).days).toBe(0);
  });
  it('fim no passado e ainda aberta: atraso observado em dias úteis', () => {
    const r = inferSlip(base({ end: parseStamp('2026-10-16T18:00:00-03:00') }), today);
    expect(r).toEqual({ days: 2, reason: 'overdue', confidence: 'observed' });
  });
  it('devia ter começado e continua "a fazer"', () => {
    const r = inferSlip(base({ statusCategory: 'new', start: parseStamp('2026-10-19') }), today);
    expect(r).toMatchObject({ days: 1, reason: 'not-started' });
  });
  it('concluída depois do prazo usa a data de resolução', () => {
    const r = inferSlip(base({ statusCategory: 'done', end: parseStamp('2026-10-15'), resolvedAt: parseStamp('2026-10-19T10:00:00-03:00') }), today);
    expect(r).toMatchObject({ days: 2, reason: 'finished-late', confidence: 'observed' });
    expect(inferSlip(base({ statusCategory: 'done', end: parseStamp('2026-10-15') }), today).days).toBe(0);
  });
  it('trabalho restante maior que os dias até o prazo é presumido, e a capacidade pesa', () => {
    const end = parseStamp('2026-10-21');
    const a = inferSlip(base({ end, remainingSec: 20 * 3600 }), today, 8);
    expect(a).toMatchObject({ days: 2, reason: 'remaining-work', confidence: 'presumed' });
    const b = inferSlip(base({ end, remainingSec: 20 * 3600 }), today, 4);
    expect(b.days).toBe(4);
    expect(inferSlip(base({ end, remainingSec: 4 * 3600 }), today, 8).days).toBe(0);
  });
});

const item = (key: string, order: number, s: number, e: number, ownSlip = 0, tie = 0) => ({
  key, order, tie, start: { day: d(s), frac: 0 }, end: { day: d(e), frac: 1 }, ownSlip,
});

describe('cascadeStory', () => {
  it('a fase atrasada estica o próprio fim e empurra o início das seguintes', () => {
    const r = cascadeStory([item('dev', 0, 19, 20, 2), item('qa', 1, 21, 22)]);
    expect(r.get('dev')).toMatchObject({ own: 2, pushed: 0, shift: 2 });
    expect(r.get('dev')!.end.day).toBe(d(22));
    expect(r.get('qa')).toMatchObject({ pushed: 2, shift: 2 });
    expect(r.get('qa')!.start.day).toBe(d(23));
    expect(r.get('qa')!.end.day).toBe(d(26));
  });
  it('fases do mesmo tier não se empurram, e o pior caso do tier propaga (não a soma)', () => {
    const r = cascadeStory([item('a', 0, 19, 20, 3), item('b', 0, 19, 20, 1), item('qa', 1, 21, 22)]);
    expect(r.get('b')).toMatchObject({ pushed: 0, shift: 1 });
    expect(r.get('qa')!.pushed).toBe(3);
  });
  it('sem atraso nada muda', () => {
    const r = cascadeStory([item('dev', 0, 19, 20), item('qa', 1, 21, 22)]);
    expect([...r.values()].every((x) => x.shift === 0)).toBe(true);
    expect(r.get('qa')!.start.day).toBe(d(21));
  });
});

describe('cascata e fases sem data real', () => {
  it('fase não empurrável fica como está, mesmo depois de uma fase atrasada', () => {
    const r = cascadeStory([item('dev', 0, 19, 20, 2), { ...item('qa', 1, 21, 22), pushable: false }]);
    expect(r.get('qa')).toMatchObject({ pushed: 0, shift: 0 });
    expect(r.get('qa')!.start.day).toBe(d(21));
    expect(r.get('qa')!.end.day).toBe(d(22));
  });
});
