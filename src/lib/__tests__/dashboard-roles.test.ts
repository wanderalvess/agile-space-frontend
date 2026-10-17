import { describe, it, expect } from 'vitest';
import { getAllowedDashboardTabs, canUserAccessDashboard, getDashboardRouteForRole, isUserLeadershipOrAdmin } from '../dashboard-roles';

describe('painéis por papel', () => {
  it('cada papel abre o painel do próprio papel', () => {
    expect(getDashboardRouteForRole('Product Owner')).toBe('/squad/dashboards/product-owner');
    expect(getDashboardRouteForRole('Tech Lead')).toBe('/squad/dashboards/tech-lead');
    expect(getDashboardRouteForRole('People Lead')).toBe('/squad/dashboards/people-lead');
    expect(getDashboardRouteForRole('Agile Master')).toBe('/squad/dashboards/agile-master');
    expect(getDashboardRouteForRole('Scrum Master / Agile Coach')).toBe('/squad/dashboards/agile-master');
    expect(getDashboardRouteForRole('Tribe Lead')).toBe('/squad/dashboards/tribe-level');
    expect(getDashboardRouteForRole('Developer')).toBe('/squad/dashboards/member');
    expect(getDashboardRouteForRole(undefined)).toBe('/squad/dashboards/member');
  });

  it('dev vê só o painel JQL e o de execução; não abre painéis de liderança pela URL', () => {
    const tabs = getAllowedDashboardTabs('Developer').map(t => t.id);
    expect(tabs).toEqual(['custom', 'member']);
    expect(canUserAccessDashboard('Developer', '/squad/dashboards/people-lead')).toBe(false);
    expect(canUserAccessDashboard('Developer', '/squad/dashboards/tribe-level')).toBe(false);
    expect(canUserAccessDashboard('Developer', '/squad/dashboards/member')).toBe(true);
  });

  it('Agile Master, Agile Coach, Tribe Lead e admin veem todas as abas', () => {
    for (const role of ['Agile Master', 'Agile Coach', 'Tribe Lead', 'admin']) {
      expect(isUserLeadershipOrAdmin(role)).toBe(true);
      expect(getAllowedDashboardTabs(role)).toHaveLength(7);
    }
  });

  it('PO, Tech Lead e People Lead veem só o próprio painel + JQL (nada de painel alheio)', () => {
    expect(getAllowedDashboardTabs('Product Owner').map(t => t.id)).toEqual(['custom', 'product-owner']);
    expect(getAllowedDashboardTabs('Tech Lead').map(t => t.id)).toEqual(['custom', 'tech-lead']);
    expect(getAllowedDashboardTabs('People Lead').map(t => t.id)).toEqual(['custom', 'people-lead']);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Painel único: matriz papel x painel. Prova de paridade: nenhum painel de papel se perdeu na unificação.
// ---------------------------------------------------------------------------------------------------------------------
import {
  ALL_DASHBOARD_TABS,
  getDashboardTabIdForRole,
  getPanelsUrl,
  parsePapelParam,
  resolveActivePanelTab,
  resolvePanelsAccess,
  type DashboardTabId,
} from '../dashboard-roles';

// Papéis em que o UserContext marca isLeadership (cópia da lista de context/UserContext.tsx).
const LEADERSHIP_FLAG = ['Product Owner', 'Agile Master', 'People Lead', 'Tech Lead', 'Tribe Lead', 'Agile Coach', 'SME', 'admin'];
const isLeadershipFlag = (role: string) => LEADERSHIP_FLAG.includes(role);

const ALL_IDS: DashboardTabId[] = ['custom', 'member', 'product-owner', 'agile-master', 'people-lead', 'tech-lead', 'tribe-level'];

describe('painel único por papel: quem vê qual aba', () => {
  it('as 7 abas antigas continuam existindo, na mesma ordem', () => {
    expect(ALL_DASHBOARD_TABS.map((t) => t.id)).toEqual(ALL_IDS);
  });

  it('cada rota antiga /squad/dashboards/<id> tem uma aba com o mesmo id', () => {
    for (const tab of ALL_DASHBOARD_TABS) {
      expect(tab.href).toBe(`/squad/dashboards/${tab.id}`);
      expect(getPanelsUrl(tab.id)).toBe(`/squad?tab=paineis&papel=${tab.id}`);
    }
  });

  // [papel no cadastro, abas que vê hoje (pelo UserContext.isLeadership), aba inicial]
  const MATRIX: [string, DashboardTabId[], DashboardTabId][] = [
    ['Developer', ['custom', 'member'], 'member'],
    ['QA', ['custom', 'member'], 'member'],
    ['Designer', ['custom', 'member'], 'member'],
    ['UX', ['custom', 'member'], 'member'],
    ['Stakeholder / Observador', ['custom', 'member'], 'member'],
    ['user', ['custom', 'member'], 'member'],
    ['Scrum Master', ['custom', 'agile-master'], 'agile-master'],
    ['Arquiteto(a) / Tech Lead', ['custom', 'tech-lead'], 'tech-lead'],
    // Papéis com isLeadership no UserContext veem as 7 abas (comportamento atual preservado).
    ['Product Owner', ALL_IDS, 'product-owner'],
    ['People Lead', ALL_IDS, 'people-lead'],
    ['Tech Lead', ALL_IDS, 'tech-lead'],
    ['SME', ALL_IDS, 'member'],
    ['Agile Master', ALL_IDS, 'agile-master'],
    ['Agile Coach', ALL_IDS, 'agile-master'],
    ['Scrum Master / Agile Coach', ALL_IDS, 'agile-master'],
    ['Tribe Lead', ALL_IDS, 'tribe-level'],
    ['admin', ALL_IDS, 'tribe-level'],
  ];

  it.each(MATRIX)('%s: abas e aba inicial', (role, tabs, first) => {
    const access = resolvePanelsAccess(role, isLeadershipFlag(role));
    expect(access.tabs.map((t) => t.id).sort()).toEqual([...tabs].sort());
    expect(access.defaultTabId).toBe(first);
    // o painel do próprio papel nunca some
    expect(access.tabs.map((t) => t.id)).toContain(first);
  });

  it('o resultado é o mesmo das funções antigas (getAllowedDashboardTabs)', () => {
    for (const [role] of MATRIX) {
      const lead = isLeadershipFlag(role);
      expect(resolvePanelsAccess(role, lead).tabs).toEqual(getAllowedDashboardTabs(role, lead || isUserLeadershipOrAdmin(role)));
    }
  });

  it('sem o sinal de liderança do contexto, PO, Tech Lead e People Lead veem só o próprio painel + JQL', () => {
    expect(resolvePanelsAccess('Product Owner', false).tabs.map((t) => t.id)).toEqual(['custom', 'product-owner']);
    expect(resolvePanelsAccess('Tech Lead', false).tabs.map((t) => t.id)).toEqual(['custom', 'tech-lead']);
    expect(resolvePanelsAccess('People Lead', false).tabs.map((t) => t.id)).toEqual(['custom', 'people-lead']);
  });

  it('liderança ganha a etiqueta "Visão de liderança"; quem tem um painel só, não', () => {
    expect(resolvePanelsAccess('Agile Master', false).isLeadershipView).toBe(true);
    expect(resolvePanelsAccess('Developer', false).isLeadershipView).toBe(false);
    expect(resolvePanelsAccess('Developer', true).isLeadershipView).toBe(true);
  });

  it('papel desconhecido ou ausente cai na Execução', () => {
    expect(getDashboardTabIdForRole(undefined)).toBe('member');
    expect(getDashboardTabIdForRole('Cargo novo')).toBe('member');
    expect(resolvePanelsAccess(undefined, false).tabs.map((t) => t.id)).toEqual(['custom', 'member']);
  });
});

describe('aba aberta pelo ?papel=', () => {
  const dev = resolvePanelsAccess('Developer', false);
  const lead = resolvePanelsAccess('Agile Master', true);

  it('sem pedido ou com pedido inválido abre o painel do próprio papel', () => {
    expect(resolveActivePanelTab(null, dev)).toEqual({ tabId: 'member', denied: false });
    expect(resolveActivePanelTab('', lead)).toEqual({ tabId: 'agile-master', denied: false });
    expect(resolveActivePanelTab('xyz', dev)).toEqual({ tabId: 'member', denied: false });
  });

  it('aba permitida abre; aba de outro papel mostra acesso negado', () => {
    expect(resolveActivePanelTab('member', dev)).toEqual({ tabId: 'member', denied: false });
    expect(resolveActivePanelTab('tech-lead', dev)).toEqual({ tabId: 'tech-lead', denied: true });
    expect(resolveActivePanelTab('tribe-level', dev)).toEqual({ tabId: 'tribe-level', denied: true });
    expect(resolveActivePanelTab('tribe-level', lead)).toEqual({ tabId: 'tribe-level', denied: false });
  });

  it('as consultas JQL são de todos', () => {
    expect(resolveActivePanelTab('custom', dev)).toEqual({ tabId: 'custom', denied: false });
    expect(resolveActivePanelTab('jql', dev)).toEqual({ tabId: 'custom', denied: false });
  });

  it('parsePapelParam aceita só ids conhecidos', () => {
    expect(parsePapelParam('Tech-Lead')).toBe('tech-lead');
    expect(parsePapelParam('jql')).toBe('custom');
    expect(parsePapelParam('admin')).toBeNull();
    expect(parsePapelParam(undefined)).toBeNull();
  });

  it('getPanelsUrl sem papel abre o painel do próprio papel', () => {
    expect(getPanelsUrl()).toBe('/squad?tab=paineis');
  });
});

describe('descrições das abas', () => {
  it('a aba Tech Lead não promete PRs (não existem no painel)', () => {
    const tl = ALL_DASHBOARD_TABS.find((t) => t.id === 'tech-lead')!;
    expect(tl.description).not.toMatch(/PRs?\b/);
    expect(tl.description).toMatch(/fila de revisão/);
  });
});
