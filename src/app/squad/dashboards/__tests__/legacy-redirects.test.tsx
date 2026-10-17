import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => redirect(...a) }));

import Index from '../page';
import AgileMaster from '../agile-master/page';
import Custom from '../custom/page';
import Member from '../member/page';
import PeopleLead from '../people-lead/page';
import ProductOwner from '../product-owner/page';
import TechLead from '../tech-lead/page';
import TribeLevel from '../tribe-level/page';
import { getPanelsUrl } from '../../../../lib/dashboard-roles';

beforeEach(() => redirect.mockReset());

// As rotas antigas viram atalhos para a aba do papel no painel único (Squad Hub > Painéis).
describe('rotas antigas /squad/dashboards/*', () => {
  it('o índice abre o painel do próprio papel', () => {
    Index();
    expect(redirect).toHaveBeenCalledWith('/squad?tab=paineis');
    expect(getPanelsUrl()).toBe('/squad?tab=paineis');
  });

  it.each([
    ['agile-master', AgileMaster],
    ['custom', Custom],
    ['member', Member],
    ['people-lead', PeopleLead],
    ['product-owner', ProductOwner],
    ['tech-lead', TechLead],
    ['tribe-level', TribeLevel],
  ] as const)('/squad/dashboards/%s -> /squad?tab=paineis&papel=%s', (slug, Page) => {
    Page();
    expect(redirect).toHaveBeenCalledWith(`/squad?tab=paineis&papel=${slug}`);
    expect(getPanelsUrl(slug)).toBe(`/squad?tab=paineis&papel=${slug}`);
  });
});
