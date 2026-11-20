import { describe, it, expect } from 'vitest';
import { describeExpiry, keysNeedingAttention } from '../api-key-expiry';

const now = new Date('2026-10-13T12:00:00Z');
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

describe('validade das chaves de API', () => {
  it('sem data = sem expiração', () => {
    expect(describeExpiry(null, now)).toMatchObject({ level: 'none', label: 'Sem expiração' });
    expect(describeExpiry(undefined, now).daysLeft).toBeNull();
  });

  it('descreve quanto falta e marca "soon" abaixo de 14 dias', () => {
    expect(describeExpiry(inDays(60), now)).toMatchObject({ level: 'ok', label: 'Expira em 60 dias' });
    expect(describeExpiry(inDays(13), now)).toMatchObject({ level: 'soon', label: 'Expira em 13 dias' });
    expect(describeExpiry(inDays(14), now).level).toBe('ok');
    expect(describeExpiry(inDays(0.5), now)).toMatchObject({ level: 'soon', label: 'Expira hoje ou amanhã' });
  });

  it('chave vencida', () => {
    expect(describeExpiry(inDays(-1), now)).toMatchObject({ level: 'expired', label: 'Expirou ontem' });
    expect(describeExpiry(inDays(-5), now)).toMatchObject({ level: 'expired', label: 'Expirou há 5 dias' });
  });

  it('aviso só considera chaves ativas vencendo ou vencidas', () => {
    const keys = [
      { id: 'ok', expiresAt: inDays(80) },
      { id: 'soon', expiresAt: inDays(5) },
      { id: 'expired', expiresAt: inDays(-2) },
      { id: 'revoked', expiresAt: inDays(2), revokedAt: inDays(-1) },
      { id: 'never', expiresAt: null },
    ];
    expect(keysNeedingAttention(keys, now).map((k) => k.id)).toEqual(['soon', 'expired']);
  });
});
