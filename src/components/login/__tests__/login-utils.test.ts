import { describe, expect, it } from 'vitest';
import { LOGIN_MODULES } from '../login-modules';
import { errorMessage, getFieldErrors, hasBlockingError, nextIndex, passwordScore, passwordStrength, type LoginFields } from '../login-utils';

const empty: LoginFields = { name: '', email: '', password: '', confirm: '' };

describe('getFieldErrors', () => {
  it('no login aceita usuário sem formato de e-mail', () => {
    const errors = getFieldErrors('login', { ...empty, email: 'wanderson', password: 'x' });
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
    expect(hasBlockingError('login', errors)).toBe(false);
  });

  it('no login exige e-mail e senha preenchidos', () => {
    const errors = getFieldErrors('login', empty);
    expect(errors.email).toBe('Informe seu e-mail.');
    expect(errors.password).toBe('Informe a senha.');
    expect(hasBlockingError('login', errors)).toBe(true);
  });

  it('no cadastro confere formato do e-mail, 8 caracteres e confirmação', () => {
    const errors = getFieldErrors('register', { name: ' ', email: 'sem-arroba', password: 'curta', confirm: 'outra' });
    expect(errors.name).toBe('Informe seu nome.');
    expect(errors.email).toContain('E-mail inválido');
    expect(errors.password).toBe('Mínimo de 8 caracteres.');
    expect(errors.confirm).toBe('As senhas não conferem.');
    expect(hasBlockingError('register', errors)).toBe(true);
  });

  it('cadastro válido não bloqueia', () => {
    const errors = getFieldErrors('register', { name: 'Ana', email: 'ana@totvs.com.br', password: 'Senha1234', confirm: 'Senha1234' });
    expect(hasBlockingError('register', errors)).toBe(false);
  });

  it('o pedido de reset só olha o e-mail', () => {
    const errors = getFieldErrors('forgot', { ...empty, email: 'ana@totvs.com.br' });
    expect(hasBlockingError('forgot', errors)).toBe(false);
    expect(hasBlockingError('forgot', getFieldErrors('forgot', { ...empty, email: 'ana' }))).toBe(true);
  });

  it('ignora espaços ao redor do e-mail', () => {
    expect(getFieldErrors('register', { ...empty, email: '  ana@totvs.com.br ' }).email).toBeUndefined();
  });
});

describe('passwordStrength', () => {
  it('pontua de 0 a 4', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('abcdefgh')).toBe(1);
    expect(passwordScore('Abcdefgh')).toBe(2);
    expect(passwordScore('Abcdefg1')).toBe(3);
    expect(passwordScore('Abcdef1!')).toBe(4);
  });

  it('rotula e dá o tom da barra', () => {
    expect(passwordStrength('')).toEqual({ score: 0, label: 'Muito fraca', tone: 'weak' });
    expect(passwordStrength('Abcdefgh')).toMatchObject({ label: 'Razoável', tone: 'fair' });
    expect(passwordStrength('Abcdef1!')).toMatchObject({ label: 'Forte', tone: 'good' });
  });
});

describe('vitrine', () => {
  it('gira em ciclo pelos módulos', () => {
    expect(nextIndex(0, 5)).toBe(1);
    expect(nextIndex(4, 5)).toBe(0);
    expect(nextIndex(0, 0)).toBe(0);
  });

  it('mostra os cinco módulos pedidos', () => {
    expect(LOGIN_MODULES.map((m) => m.name)).toEqual(['Scrum Poker', 'Retrospectiva', 'Radar de clima', 'Showcase', 'Brainstorming']);
  });
});

describe('errorMessage', () => {
  it('usa a mensagem do servidor, inclusive a do limite de tentativas', () => {
    expect(errorMessage(new Error('Muitas requisições. Tente novamente em instantes.'), 'padrão')).toBe('Muitas requisições. Tente novamente em instantes.');
  });

  it('cai no texto padrão sem mensagem ou com valor que não é erro', () => {
    expect(errorMessage(new Error(''), 'padrão')).toBe('padrão');
    expect(errorMessage('falhou', 'padrão')).toBe('padrão');
    expect(errorMessage(undefined, 'padrão')).toBe('padrão');
  });
});
