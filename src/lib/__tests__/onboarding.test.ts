import { describe, expect, it } from 'vitest';
import {
  firstNameOf,
  hasJiraFormErrors,
  isAccessRefused,
  isSearchable,
  jiraFormToastTitle,
  jiraHostOf,
  jiraProfileUrl,
  MSG_JOIN_REFUSED,
  parseInviteToken,
  parseProjectKeys,
  refusalMessage,
  rosterRowAction,
  rosterRowHint,
  searchPhaseOf,
  slugify,
  validateJiraForm,
} from '../onboarding';
import { ApiError, httpStatusOf } from '../api-error';

describe('slugify (chave da squad)', () => {
  it('tira acento, símbolos e espaços; maiúsculas; até 12', () => {
    expect(slugify('Squad Fênix')).toBe('SQUADFENIX');
    expect(slugify('  Missão Crítica #2 ')).toBe('MISSAOCRITIC');
    expect(slugify('Um nome bem comprido demais')).toBe('UMNOMEBEMCOM');
    expect(slugify('Time 42')).toBe('TIME42');
  });
  it('só símbolos vira vazio', () => {
    expect(slugify('---')).toBe('');
  });
});

describe('parseProjectKeys', () => {
  it('separa por vírgula, ponto e vírgula e espaço; maiúsculas; sem repetidas', () => {
    expect(parseProjectKeys('abc, def  ghi;ABC')).toEqual(['ABC', 'DEF', 'GHI']);
  });
  it('vazio e só separadores não geram chave', () => {
    expect(parseProjectKeys('')).toEqual([]);
    expect(parseProjectKeys(' , ; ')).toEqual([]);
  });
  it('mantém a ordem da primeira aparição', () => {
    expect(parseProjectKeys('ddwb ddwa ddwb')).toEqual(['DDWB', 'DDWA']);
  });
});

describe('parseInviteToken', () => {
  it('aceita o link inteiro', () => {
    expect(parseInviteToken('https://app.espacoagil.com.br/invite/9f3a1c7e')).toBe('9f3a1c7e');
  });
  it('ignora query, hash e barra final', () => {
    expect(parseInviteToken('https://x.com/invite/abc123?utm=1')).toBe('abc123');
    expect(parseInviteToken('https://x.com/invite/abc123#topo')).toBe('abc123');
    expect(parseInviteToken('https://x.com/invite/abc123/')).toBe('abc123');
  });
  it('aceita o caminho e só o token', () => {
    expect(parseInviteToken('/invite/tok_en-1')).toBe('tok_en-1');
    expect(parseInviteToken('  tok_en-1  ')).toBe('tok_en-1');
  });
  it('rejeita vazio e o que não é token', () => {
    expect(parseInviteToken('')).toBeNull();
    expect(parseInviteToken('   ')).toBeNull();
    expect(parseInviteToken('https://x.com/invite/')).toBeNull();
    expect(parseInviteToken('colei errado aqui')).toBeNull();
  });
});

describe('busca', () => {
  it('abaixo de 2 letras não consulta', () => {
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable('  a ')).toBe(false);
    expect(isSearchable('ab')).toBe(true);
  });
  it('fases: idle, loading, error, empty e ok', () => {
    const base = { query: 'ddw', loading: false, failed: false, count: 0 };
    expect(searchPhaseOf({ ...base, query: 'd' })).toBe('idle');
    expect(searchPhaseOf({ ...base, loading: true })).toBe('loading');
    expect(searchPhaseOf({ ...base, failed: true })).toBe('error');
    expect(searchPhaseOf(base)).toBe('empty');
    expect(searchPhaseOf({ ...base, count: 3 })).toBe('ok');
  });
  it('erro de rede não vira "nenhuma squad"', () => {
    expect(searchPhaseOf({ query: 'ddw', loading: false, failed: true, count: 0 })).toBe('error');
  });
});

describe('ação de cada linha da lista da squad', () => {
  const row = (o: Partial<Parameters<typeof rosterRowAction>[0]>) => ({ claimable: false, claimed: false, claimedByMe: false, leadership: false, ...o });
  it('linha que o servidor aceita como sua: Sou eu', () => {
    expect(rosterRowAction(row({ claimable: true }))).toBe('claim');
  });
  it('liderança: pedir vínculo (e não mais "entra por convite")', () => {
    expect(rosterRowAction(row({ leadership: true }))).toBe('request');
    expect(rosterRowAction(row({ leadership: true, claimed: true }))).toBe('request');
  });
  it('liderança já ligada à própria conta: já é você', () => {
    expect(rosterRowAction(row({ leadership: true, claimed: true, claimedByMe: true }))).toBe('mine');
  });
  it('vinculada a outra conta', () => {
    expect(rosterRowAction(row({ claimed: true }))).toBe('linked');
  });
  it('linha livre que não é sua', () => {
    expect(rosterRowAction(row({}))).toBe('not-you');
  });
  it('linha de apoio sob o nome', () => {
    expect(rosterRowHint({ claimed: true, claimedByMe: true, emailHint: 'a***@x.com' })).toBe('já é você');
    expect(rosterRowHint({ claimed: true, claimedByMe: false, emailHint: 'a***@x.com' })).toBe('já está no Portal Tech V&D');
    expect(rosterRowHint({ claimed: false, claimedByMe: false, emailHint: 'a***@x.com' })).toBe('a***@x.com');
    expect(rosterRowHint({ claimed: false, claimedByMe: false })).toBe('ainda não entrou');
  });
});

describe('endereço do Jira', () => {
  it('limpa protocolo e barra final', () => {
    expect(jiraHostOf('https://jiraproducao.totvs.com.br/')).toBe('jiraproducao.totvs.com.br');
    expect(jiraHostOf('  jiraproducao.totvs.com.br  ')).toBe('jiraproducao.totvs.com.br');
  });
  it('rejeita o que não parece endereço', () => {
    expect(jiraHostOf('')).toBe('');
    expect(jiraHostOf('jira')).toBe('');
    expect(jiraHostOf('javascript:alert(1)')).toBe('');
    expect(jiraHostOf('a b.com')).toBe('');
  });
  it('link do perfil só com endereço válido', () => {
    expect(jiraProfileUrl('https://jiraproducao.totvs.com.br/')).toBe('https://jiraproducao.totvs.com.br/secure/ViewProfile.jspa');
    expect(jiraProfileUrl('x')).toBe('');
  });
});

describe('formulário do Jira', () => {
  const ok = { domain: 'jiraproducao.totvs.com.br', keys: 'DDWMISSI', token: 'abc' };
  it('completo não tem erro', () => {
    expect(hasJiraFormErrors(validateJiraForm(ok))).toBe(false);
  });
  it('o endereço é obrigatório', () => {
    expect(validateJiraForm({ ...ok, domain: '' }).domain).toBe('Informe o endereço do Jira');
    expect(validateJiraForm({ ...ok, domain: 'jira' }).domain).toBe('Confira o endereço do Jira');
  });
  it('chaves e token são obrigatórios', () => {
    const e = validateJiraForm({ domain: ok.domain, keys: ' , ', token: '  ' });
    expect(e.keys).toBeTruthy();
    expect(e.token).toBeTruthy();
    expect(e.domain).toBeUndefined();
  });
  it('o título do aviso junta o que falta', () => {
    expect(jiraFormToastTitle(validateJiraForm({ ...ok, token: '' }))).toBe('Informe seu token do Jira');
    expect(jiraFormToastTitle(validateJiraForm({ domain: '', keys: '', token: '' }))).toBe('Informe o endereço do Jira, a chave do projeto e seu token do Jira');
    expect(jiraFormToastTitle({})).toBe('');
  });
});

describe('acesso recusado', () => {
  it('só o 403 é recusa de acesso', () => {
    expect(isAccessRefused(403)).toBe(true);
    expect(isAccessRefused(500)).toBe(false);
    expect(isAccessRefused(undefined)).toBe(false);
  });
  it('no 403 vale o texto do caminho; nos outros, o do servidor', () => {
    expect(refusalMessage(403, 'Forbidden', MSG_JOIN_REFUSED)).toBe(MSG_JOIN_REFUSED);
    expect(refusalMessage(409, 'Já existe um projeto com essa chave', 'x')).toBe('Já existe um projeto com essa chave');
    expect(refusalMessage(undefined, '  ', 'padrão')).toBe('padrão');
  });
  it('ApiError guarda o status', () => {
    expect(httpStatusOf(new ApiError('nope', 403))).toBe(403);
    expect(httpStatusOf(new Error('x'))).toBeUndefined();
  });
});

describe('firstNameOf', () => {
  it('pega o primeiro nome e tolera vazio', () => {
    expect(firstNameOf('Wanderson Alves')).toBe('Wanderson');
    expect(firstNameOf('  ')).toBe('');
    expect(firstNameOf(undefined)).toBe('');
  });
});
