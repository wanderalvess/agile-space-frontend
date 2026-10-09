import { describe, it, expect } from 'vitest';
import { reviveDate } from '../helpers.js';

describe('reviveDate - datas da sprint vindas do snapshot compartilhado', () => {
  it('volta a ser Date quando o snapshot passou por JSON (string ISO)', () => {
    const original = new Date('2026-10-01T08:00:00-03:00');
    const viaJson = JSON.parse(JSON.stringify({ start: original })).start; // string
    const revived = reviveDate(viaJson);
    expect(revived).toBeInstanceOf(Date);
    expect(revived!.getTime()).toBe(original.getTime());
    // O bug: com string, toda comparação de janela dava false.
    expect(new Date('2026-10-02T10:00:00-03:00') >= (viaJson as unknown as Date)).toBe(false);
    expect(new Date('2026-10-02T10:00:00-03:00') >= revived!).toBe(true);
  });

  it('mantém Date e devolve null para vazio ou inválido (nunca uma data inventada)', () => {
    const d = new Date();
    expect(reviveDate(d)).toBe(d);
    expect(reviveDate(null)).toBeNull();
    expect(reviveDate(undefined)).toBeNull();
    expect(reviveDate('')).toBeNull();
    expect(reviveDate('não é data')).toBeNull();
  });
});
