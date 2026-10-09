import { describe, it, expect } from 'vitest';
import type { UserProfile } from '@/lib/types';
import { activeAdminCount, apiErrorMessage, describeLastAccess, filterUsers } from '../user-admin';

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
