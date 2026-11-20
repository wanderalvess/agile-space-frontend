import { describe, expect, it } from 'vitest';
import {
  addBusinessDays, businessDaysBetween, dayFromYmd, formatHours, formatPt, formatStamp, isoOfDay, isWeekendDay,
  minutesOfFrac, nowPt, parseDay, parseStamp, stampEndPt, stampStartPt, todayDay, weekdayOfDay,
} from '../dates';

const d = (y: number, m: number, day: number) => dayFromYmd(y, m, day);

describe('parseStamp', () => {
  it('lê só data', () => {
    expect(parseStamp('2026-10-20')).toEqual({ day: d(2026, 10, 20), minutes: null });
  });
  it('lê data-hora com deslocamento do Brasil sem mudar o relógio', () => {
    expect(parseStamp('2026-10-20T09:00:00-03:00')).toEqual({ day: d(2026, 10, 20), minutes: 540 });
    expect(parseStamp('2026-10-20T17:12:00.000-0300')).toEqual({ day: d(2026, 10, 20), minutes: 17 * 60 + 12 });
  });
  it('converte outros deslocamentos para o fuso do portal, inclusive virando o dia', () => {
    expect(parseStamp('2026-10-20T12:00:00Z')).toEqual({ day: d(2026, 10, 20), minutes: 9 * 60 });
    expect(parseStamp('2026-10-21T01:30:00Z')).toEqual({ day: d(2026, 10, 20), minutes: 22 * 60 + 30 });
  });
  it('sem deslocamento usa o horário como veio', () => {
    expect(parseStamp('2026-10-20T09:30:00')).toEqual({ day: d(2026, 10, 20), minutes: 570 });
    expect(parseStamp('2026-10-20 14:00')).toEqual({ day: d(2026, 10, 20), minutes: 840 });
  });
  it('vazio ou inválido vira null', () => {
    expect(parseStamp('')).toBeNull();
    expect(parseStamp(undefined)).toBeNull();
    expect(parseStamp('amanhã')).toBeNull();
    expect(parseStamp('2026-13-40')).toBeNull();
    expect(parseDay('2026-10-20T09:00:00-03:00')).toBe(d(2026, 10, 20));
  });
});

describe('dias úteis', () => {
  it('reconhece a semana (20/10/2026 é terça)', () => {
    expect(weekdayOfDay(d(2026, 10, 20))).toBe(2);
    expect(isWeekendDay(d(2026, 10, 24))).toBe(true);
    expect(isWeekendDay(d(2026, 10, 25))).toBe(true);
    expect(isWeekendDay(d(2026, 10, 26))).toBe(false);
  });
  it('soma dias úteis pulando o fim de semana', () => {
    expect(isoOfDay(addBusinessDays(d(2026, 10, 23), 1))).toBe('2026-10-26');
    expect(isoOfDay(addBusinessDays(d(2026, 10, 20), 5))).toBe('2026-10-27');
    expect(isoOfDay(addBusinessDays(d(2026, 10, 26), -1))).toBe('2026-10-23');
    expect(addBusinessDays(d(2026, 10, 20), 0)).toBe(d(2026, 10, 20));
  });
  it('conta dias úteis com sinal', () => {
    expect(businessDaysBetween(d(2026, 10, 23), d(2026, 10, 26))).toBe(1);
    expect(businessDaysBetween(d(2026, 10, 20), d(2026, 10, 27))).toBe(5);
    expect(businessDaysBetween(d(2026, 10, 27), d(2026, 10, 20))).toBe(-5);
    expect(businessDaysBetween(d(2026, 10, 24), d(2026, 10, 25))).toBe(0);
    expect(businessDaysBetween(d(2026, 10, 20), d(2026, 10, 20))).toBe(0);
  });
});

describe('posição dentro da jornada 9h-18h', () => {
  it('só data: início em 0 e fim em 1; com hora: proporcional', () => {
    const date = { day: d(2026, 10, 20), minutes: null };
    expect(stampStartPt(date).frac).toBe(0);
    expect(stampEndPt(date).frac).toBe(1);
    const noon = { day: d(2026, 10, 20), minutes: 13 * 60 + 30 };
    expect(stampStartPt(noon).frac).toBeCloseTo(0.5);
    expect(stampEndPt({ day: 1, minutes: 20 * 60 }).frac).toBe(1);
    expect(stampStartPt({ day: 1, minutes: 7 * 60 }).frac).toBe(0);
  });
  it('formata', () => {
    expect(minutesOfFrac(0.5)).toBe(13 * 60 + 30);
    expect(formatPt({ day: d(2026, 10, 20), frac: 1 })).toBe('20/10 18:00');
    expect(formatStamp(parseStamp('2026-10-20T09:00:00-03:00'))).toBe('20/10 09:00');
    expect(formatStamp(parseStamp('2026-10-20'))).toBe('20/10');
    expect(formatHours(8.2)).toBe('8h12');
    expect(formatHours(8)).toBe('8h');
  });
});

describe('agora', () => {
  const ms = (iso: string) => Date.parse(iso);
  it('no expediente dá a fração; antes das 9h é 0; depois das 18h vai para o dia útil seguinte', () => {
    expect(nowPt(ms('2026-10-20T16:30:00Z'))).toEqual({ day: d(2026, 10, 20), frac: 0.5 });
    expect(nowPt(ms('2026-10-20T10:00:00Z'))).toEqual({ day: d(2026, 10, 20), frac: 0 });
    expect(nowPt(ms('2026-10-20T22:00:00Z'))).toEqual({ day: d(2026, 10, 21), frac: 0 });
  });
  it('fim de semana vira segunda', () => {
    expect(nowPt(ms('2026-10-24T15:00:00Z'))).toEqual({ day: d(2026, 10, 26), frac: 0 });
    expect(todayDay(ms('2026-10-21T01:00:00Z'))).toBe(d(2026, 10, 20));
  });
});
