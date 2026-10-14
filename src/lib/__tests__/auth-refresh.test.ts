import { describe, expect, it } from 'vitest';
import { shouldRefreshToken, tokenLifetime } from '../auth-client';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

describe('renovação da sessão', () => {
  const iat = 1_000_000;
  const exp = iat + 86_400;
  const token = jwt({ sub: 'u1', iat, exp });

  it('lê iat e exp do token', () => {
    expect(tokenLifetime(token)).toEqual({ iat, exp });
  });

  it('não renova antes da metade da validade', () => {
    expect(shouldRefreshToken(token, (iat + 3_600) * 1000)).toBe(false);
  });

  it('renova passada a metade da validade', () => {
    expect(shouldRefreshToken(token, (iat + 43_200) * 1000)).toBe(true);
    expect(shouldRefreshToken(token, (iat + 80_000) * 1000)).toBe(true);
  });

  it('token ausente, malformado ou sem exp não dispara renovação', () => {
    expect(shouldRefreshToken(null)).toBe(false);
    expect(shouldRefreshToken('lixo')).toBe(false);
    expect(shouldRefreshToken(jwt({ sub: 'u1', iat }))).toBe(false);
  });
});
