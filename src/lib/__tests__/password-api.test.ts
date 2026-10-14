import { describe, expect, it } from 'vitest';
import { buildResetLink, passwordErrorMessage, validateNewPassword } from '../password-api';

describe('validateNewPassword', () => {
  it('aceita senha de 8 a 128 caracteres igual à confirmação', () => {
    expect(validateNewPassword('Senha-Boa-1', 'Senha-Boa-1')).toBeNull();
    expect(validateNewPassword('a'.repeat(8), 'a'.repeat(8))).toBeNull();
    expect(validateNewPassword('a'.repeat(128), 'a'.repeat(128))).toBeNull();
  });

  it('recusa senha curta, longa demais e confirmação diferente', () => {
    expect(validateNewPassword('curta', 'curta')).toMatch(/pelo menos 8/);
    expect(validateNewPassword('a'.repeat(129), 'a'.repeat(129))).toMatch(/no máximo 128/);
    expect(validateNewPassword('Senha-Boa-1', 'Senha-Boa-2')).toMatch(/confirmação/);
  });
});

describe('buildResetLink', () => {
  it('monta o link com o token na query, sem barra dupla', () => {
    expect(buildResetLink('abc_DEF-123', 'https://app.exemplo.com.br/')).toBe('https://app.exemplo.com.br/reset-password?token=abc_DEF-123');
  });

  it('codifica caracteres que quebrariam a query', () => {
    expect(buildResetLink('a b&c', 'http://localhost:9002')).toBe('http://localhost:9002/reset-password?token=a%20b%26c');
  });
});

describe('passwordErrorMessage', () => {
  const res = (body: unknown) => ({ json: async () => body }) as unknown as Response;

  it('usa message, depois error, depois o texto padrão', async () => {
    expect(await passwordErrorMessage(res({ message: 'Senha atual incorreta' }), 'x')).toBe('Senha atual incorreta');
    expect(await passwordErrorMessage(res({ error: '403 FORBIDDEN' }), 'x')).toBe('403 FORBIDDEN');
    expect(await passwordErrorMessage(res({}), 'padrão')).toBe('padrão');
  });

  it('corpo que não é JSON cai no texto padrão', async () => {
    const broken = { json: async () => { throw new Error('não é json'); } } as unknown as Response;
    expect(await passwordErrorMessage(broken, 'padrão')).toBe('padrão');
  });
});
