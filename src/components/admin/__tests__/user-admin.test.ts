import { describe, it, expect } from 'vitest';
import type { UserProfile } from '@/lib/types';
import {
  ACCESS_LEVEL_INFO,
  CARGO_FILTER_OPTIONS,
  accessLevelOf,
  activeAdminCount,
  apiErrorMessage,
  describeLastAccess,
  filterUsers,
  hasActiveFilters,
  lockReasons,
  needsAdminConfirm,
  squadLabelOf,
  squadsSummary,
  usersCountLabel,
} from '../user-admin';

const u = (over: Partial<UserProfile>): UserProfile =>
  ({ id: 'x', name: 'Ana', role: 'MEMBER', squadId: '', isGuest: false, ...over }) as UserProfile;

const users = [
  u({ id: '1', name: 'José Álvares', email: 'jose@totvs.com.br', role: 'ADMIN' as any, active: true }),
  u({ id: '2', name: 'Maria', email: 'maria@ext.totvs.com.br', active: false, jobTitle: 'Developer' as any }),
  u({ id: '3', name: 'Carlos', email: 'carlos@totvs.com.br', jiraAccountId: 'carlos.s' }),
];

describe('gestão de usuários (painel admin)', () => {
  it('busca por nome sem acento, e-mail e id do Jira', () => {
    const f = (search: string) => filterUsers(users, { search, status: 'all', role: 'all' }).map((x) => x.id);
    expect(f('jose')).toEqual(['1']);
    expect(f('EXT.TOTVS')).toEqual(['2']);
    expect(f('carlos.s')).toEqual(['3']);
    expect(f('')).toEqual(['1', '2', '3']);
  });

  it('filtra por status e por admin; conta sem o campo active conta como ativa', () => {
    expect(filterUsers(users, { search: '', status: 'inactive', role: 'all' }).map((x) => x.id)).toEqual(['2']);
    expect(filterUsers(users, { search: '', status: 'active', role: 'all' }).map((x) => x.id)).toEqual(['1', '3']);
    expect(filterUsers(users, { search: '', status: 'all', role: 'admin' }).map((x) => x.id)).toEqual(['1']);
  });

  it('conta administradores ativos', () => {
    expect(activeAdminCount(users)).toBe(1);
    expect(activeAdminCount([...users, u({ id: '4', role: 'admin' as any, active: false })])).toBe(1);
  });

  it('traduz erro do servidor para mensagem útil', () => {
    expect(apiErrorMessage(new Error('User API error 409: {"message":"Não é possível rebaixar o último administrador ativo."}')))
      .toContain('último administrador');
    expect(apiErrorMessage(new Error('User API error 409: {"error":"Conflict"}'))).toContain('último administrador');
    expect(apiErrorMessage(new Error('User API error 403: x'))).toContain('permissão');
    expect(apiErrorMessage(new Error('boom'))).toBe('Não foi possível concluir a ação.');
  });

  it('descreve o último acesso', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    expect(describeLastAccess(null, now)).toBe('Sem registro');
    expect(describeLastAccess('2026-10-09T08:00:00Z', now)).toBe('Hoje');
    expect(describeLastAccess('2026-10-08T08:00:00Z', now)).toBe('Ontem');
    expect(describeLastAccess('2026-10-04T12:00:00Z', now)).toBe('Há 5 dias');
  });
});

describe('travas, filtros e detalhes (painel admin)', () => {
  const admin = (id: string, over: Partial<UserProfile> = {}) => u({ id, role: 'ADMIN' as any, active: true, ...over });

  it('a própria conta não desativa nem muda o próprio nível', () => {
    const me = admin('me');
    expect(lockReasons(me, { currentUserId: 'me', adminCount: 3 })).toEqual({
      status: 'você não pode desativar a própria conta',
      nivel: 'você não pode mudar o próprio nível',
    });
  });

  it('o último administrador ativo fica travado nos dois controles', () => {
    expect(lockReasons(admin('x'), { currentUserId: 'me', adminCount: 1 })).toEqual({
      status: 'é o último administrador ativo',
      nivel: 'é o último administrador ativo',
    });
  });

  it('admin que não é o último e membro comum ficam livres; membro que é "você" só trava o Status', () => {
    expect(lockReasons(admin('x'), { currentUserId: 'me', adminCount: 2 })).toEqual({ status: null, nivel: null });
    expect(lockReasons(u({ id: 'm' }), { currentUserId: 'me', adminCount: 1 })).toEqual({ status: null, nivel: null });
    expect(lockReasons(u({ id: 'me' }), { currentUserId: 'me', adminCount: 1 })).toEqual({
      status: 'você não pode desativar a própria conta',
      nivel: null,
    });
  });

  it('só dar ADMIN a quem não é admin pede confirmação', () => {
    expect(needsAdminConfirm(u({}), 'ADMIN')).toBe(true);
    expect(needsAdminConfirm(admin('a'), 'ADMIN')).toBe(false);
    expect(needsAdminConfirm(u({}), 'LEAD')).toBe(false);
  });

  it('nível de acesso: papel desconhecido vale MEMBER', () => {
    expect(accessLevelOf(u({ role: 'admin' as any }))).toBe('ADMIN');
    expect(accessLevelOf(u({ role: 'lead' as any }))).toBe('LEAD');
    expect(accessLevelOf(u({ role: 'Developer' }))).toBe('MEMBER');
    expect(ACCESS_LEVEL_INFO.LEAD).toContain('Todas as squads');
  });

  it('o filtro de cargo traz todos os 15 cargos além de "todos" e "administradores"', () => {
    expect(CARGO_FILTER_OPTIONS).toHaveLength(17);
    expect(CARGO_FILTER_OPTIONS.map((o) => o.value)).toContain('Scrum Master');
    const sm = filterUsers(
      [u({ id: 'a', jobTitle: 'Scrum Master' }), u({ id: 'b', jobTitle: 'Agile Master' })],
      { search: '', status: 'all', role: 'Scrum Master' },
    );
    expect(sm.map((x) => x.id)).toEqual(['a']);
  });

  it('detecta filtro aplicado e monta o contador', () => {
    expect(hasActiveFilters({ search: ' ', status: 'all', role: 'all' })).toBe(false);
    expect(hasActiveFilters({ search: 'a', status: 'all', role: 'all' })).toBe(true);
    expect(hasActiveFilters({ search: '', status: 'inactive', role: 'all' })).toBe(true);
    expect(usersCountLabel(30, 112, 112)).toBe('Exibindo 30 de 112 usuários');
    expect(usersCountLabel(1, 1, 112)).toBe('Exibindo 1 de 112 usuários · 1 corresponde aos filtros');
    expect(usersCountLabel(0, 0, 112)).toBe('Exibindo 0 de 112 usuários · 0 correspondem aos filtros');
  });

  it('squads dos detalhes: erro não vira "sem vínculo"', () => {
    expect(squadsSummary(undefined, 'X')).toEqual({ kind: 'loading' });
    expect(squadsSummary(null, 'X')).toEqual({ kind: 'error' });
    expect(squadsSummary([{ squadId: 'A', role: 'Agile Master' }], 'X')).toEqual({ kind: 'links', links: [{ squadId: 'A', role: 'Agile Master' }] });
    expect(squadsSummary([], 'DDWMISSI')).toEqual({ kind: 'active', squadId: 'DDWMISSI' });
    expect(squadsSummary([], '')).toEqual({ kind: 'none' });
    expect(squadsSummary([], undefined)).toEqual({ kind: 'none' });
  });

  it('squad da lista: squad ativa, depois o time antigo, depois "Sem squad"', () => {
    expect(squadLabelOf({ squadId: 'A', team: 'B' })).toBe('A');
    expect(squadLabelOf({ squadId: '', team: 'B' })).toBe('B');
    expect(squadLabelOf({ squadId: '' })).toBe('Sem squad');
  });
});
