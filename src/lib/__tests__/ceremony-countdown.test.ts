import { describe, expect, it } from 'vitest';
import { formatCountdown } from '../ceremony-countdown';

const at = (iso: string) => new Date(iso);

describe('formatCountdown', () => {
  const now = at('2026-10-09T09:00:00');

  it('agora, minutos e horas', () => {
    expect(formatCountdown(at('2026-10-09T08:59:00'), now).isNow).toBe(true);
    expect(formatCountdown(at('2026-10-09T09:10:00'), now)).toMatchObject({ label: 'em 10 min', isSoon: true });
    expect(formatCountdown(at('2026-10-09T14:00:00'), now).label).toBe('em 5h');
  });

  it('amanhã só quando o dia de calendário é o seguinte', () => {
    const r = formatCountdown(at('2026-10-10T10:00:00'), now);
    expect(r.label.startsWith('amanhã')).toBe(true);
  });

  it('daqui a 5 dias não vira "amanhã"', () => {
    const r = formatCountdown(at('2026-10-14T10:00:00'), now);
    expect(r.label.startsWith('amanhã')).toBe(false);
    expect(r.label).toContain('14/10');
  });
});
