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
