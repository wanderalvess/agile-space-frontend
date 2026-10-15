import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearUserScopedStorage,
  rememberSessionUser,
  setAuthToken,
  getAuthToken,
  tokenUserId,
} from '../auth-client';

function fakeJwt(sub: string): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ sub })}.assinatura`;
}

describe('auth-client - troca de usuário no mesmo navegador', () => {
  beforeEach(() => localStorage.clear());

  it('tokenUserId lê o sub do JWT e tolera lixo', () => {
    expect(tokenUserId(fakeJwt('u1'))).toBe('u1');
    expect(tokenUserId('abc')).toBeNull();
    expect(tokenUserId(null)).toBeNull();
    expect(tokenUserId('a.%%%.c')).toBeNull();
  });

  it('clearUserScopedStorage apaga o que é da pessoa e preserva preferências do aparelho', () => {
    localStorage.setItem('agileSpace_activeSquadId', 'DDW');
    localStorage.setItem('agileSpace_guest_profile', '{"uid":"u1"}');
    localStorage.setItem('favorites_u1', '[]');
    localStorage.setItem('agileSpace_newSquad_DDW', '1');
    localStorage.setItem('poker-chat-read:room1:u1', '123');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('poker-sound-enabled', '1');

    clearUserScopedStorage();

    expect(localStorage.getItem('agileSpace_activeSquadId')).toBeNull();
    expect(localStorage.getItem('agileSpace_guest_profile')).toBeNull();
    expect(localStorage.getItem('favorites_u1')).toBeNull();
    expect(localStorage.getItem('agileSpace_newSquad_DDW')).toBeNull();
    expect(localStorage.getItem('poker-chat-read:room1:u1')).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('poker-sound-enabled')).toBe('1');
  });

  it('rememberSessionUser limpa o resíduo só quando quem entrou é outra pessoa', () => {
    rememberSessionUser('u1');
    localStorage.setItem('agileSpace_activeSquadId', 'DDW');

    rememberSessionUser('u1');
    expect(localStorage.getItem('agileSpace_activeSquadId')).toBe('DDW');

    rememberSessionUser('u2');
    expect(localStorage.getItem('agileSpace_activeSquadId')).toBeNull();
  });

  it('não mexe no token ao limpar o escopo do usuário', () => {
    setAuthToken('tok');
    clearUserScopedStorage();
    expect(getAuthToken()).toBe('tok');
  });

  it('apaga o token pessoal do Jira (PAT) no logout e na troca de conta, e preserva o token de sessão', () => {
    localStorage.setItem('agile_jira_config_u1', JSON.stringify({ domain: 'jira.totvs.com.br', token: 'PAT-SECRETO' }));
    localStorage.setItem('agileSpace_jira_config', JSON.stringify({ domain: 'x', token: 'PAT-LEGADO' }));
    localStorage.setItem('agile_tdn_config_u1', '{}');
    setAuthToken('sessao');

    clearUserScopedStorage();

    expect(localStorage.getItem('agile_jira_config_u1')).toBeNull();
    expect(localStorage.getItem('agileSpace_jira_config')).toBeNull();
    expect(localStorage.getItem('agile_tdn_config_u1')).toBeNull();
    expect(getAuthToken()).toBe('sessao');
  });

  it('troca de conta no mesmo navegador não herda o PAT da conta anterior', () => {
    rememberSessionUser('u1');
    localStorage.setItem('agile_jira_config_u1', JSON.stringify({ domain: 'd', token: 'PAT-U1' }));
    rememberSessionUser('u2');
    expect(localStorage.getItem('agile_jira_config_u1')).toBeNull();
  });
});
