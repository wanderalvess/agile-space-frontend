import { describe, it, expect } from 'vitest';
import { ADMIN_TABS, ADMIN_TAB_GROUPS, adminTabHref, isCanonicalTabParam, resolveAdminTab } from '../admin-tabs';

describe('abas da Administração', () => {
  it('tem 14 abas em 6 grupos, cada uma com id único', () => {
    expect(ADMIN_TABS).toHaveLength(14);
    expect(ADMIN_TAB_GROUPS.map((g) => g.label)).toEqual([
      'Pessoas e acesso',
      'Atendimento',
      'Uso e métricas',
      'Comunicação',
      'Integrações e IA',
      'Sistema',
    ]);
    expect(new Set(ADMIN_TABS.map((t) => t.id)).size).toBe(14);
  });

  it('resolve cada id oficial para a própria aba', () => {
    for (const tab of ADMIN_TABS) expect(resolveAdminTab(tab.id).id).toBe(tab.id);
  });

  it('governance continua valendo como apelido de jira (e /projects manda para lá)', () => {
    expect(resolveAdminTab('governance').id).toBe('jira');
    expect(resolveAdminTab('jira').label).toBe('Sincronização Jira');
  });

  it('aceita os ids antigos e ignora caixa e espaços', () => {
    expect(resolveAdminTab('users').id).toBe('usuarios');
    expect(resolveAdminTab('api-keys').id).toBe('apikeys');
    expect(resolveAdminTab('system').id).toBe('sistema');
    expect(resolveAdminTab(' Chamados ').id).toBe('chamados');
  });

  it('aba desconhecida, vazia ou ausente abre Usuários', () => {
    expect(resolveAdminTab('qualquer').id).toBe('usuarios');
    expect(resolveAdminTab('').id).toBe('usuarios');
    expect(resolveAdminTab(null).id).toBe('usuarios');
    expect(resolveAdminTab(undefined).id).toBe('usuarios');
  });

  it('só o nome oficial é canônico', () => {
    expect(isCanonicalTabParam('jira')).toBe(true);
    expect(isCanonicalTabParam('governance')).toBe(false);
    expect(isCanonicalTabParam('qualquer')).toBe(false);
    expect(isCanonicalTabParam(null)).toBe(false);
  });

  it('monta o endereço por aba', () => {
    expect(adminTabHref('chamados')).toBe('/admin?tab=chamados');
  });
});
