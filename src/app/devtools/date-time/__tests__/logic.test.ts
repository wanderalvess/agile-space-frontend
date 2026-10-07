import { describePeriod, parseMoment } from '../logic';

describe('date-time', () => {
  it('segundos vs milissegundos', () => {
    expect(parseMoment('1700000000')?.getTime()).toBe(1_700_000_000_000);
    expect(parseMoment('1700000000000')?.getTime()).toBe(1_700_000_000_000);
    expect(parseMoment('2026-01-01T00:00:00Z')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(parseMoment('lixo')).toBeNull();
  });
  it('período', () => {
    const r = describePeriod(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-03T05:30:00Z'));
    expect(r?.text).toBe('2 dias, 5 horas e 30 minutos');
  });
});
