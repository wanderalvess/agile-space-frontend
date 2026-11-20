import { describe, expect, it } from 'vitest';
import type { Membership, MyMemberships } from '../memberships-api';
import { buildMyLinks, filterMyLinks, originSummary } from '../my-links';

const session = {
  activeProjectId: 'DDWMISSI',
  activeProjectName: 'Missão Crítica',
  activeProjectRole: 'Developer',
  accessibleProjects: [
    { projectId: 'DDWPRIME', projectName: 'Prime', roleName: 'Agile Master', leadership: true, directAssignment: true, tribeName: 'Varejo' },
    { projectId: 'DDWMISSI', projectName: 'Missão Crítica', roleName: 'Developer', leadership: false, directAssignment: true },
    { projectId: 'DDWOMNI', projectName: 'Omni', roleName: 'QA', directAssignment: false, tribeName: 'Canais' },
  ],
};

const membership = (projectId: string, over: Partial<Membership> = {}): Membership => ({
  projectId,
  projectName: projectId,
  roleName: 'Developer',
  roleKey: 'DEVELOPER',
  leadership: false,
  direct: true,
  scope: 'SQUAD',
  source: 'JIRA',
  roles: [{ roleName: 'Developer', roleKey: 'DEVELOPER', leadership: false, source: 'JIRA', primary: true }],
  ...over,
});

const memberships = (list: Membership[], over: Partial<MyMemberships> = {}): MyMemberships => ({
  contractVersion: '1',
  activeProjectId: list[0]?.projectId ?? null,
  legacyOnly: false,
  transversalLeader: false,
  memberships: list,
  ...over,
});

describe('buildMyLinks com /me/memberships', () => {
  const po = membership('DDWMISSI', {
    projectName: 'Missão Digital',
    roleName: 'Product Owner',
    roleKey: 'PRODUCT_OWNER',
    leadership: true,
    source: 'MANUAL',
    roles: [
      { roleName: 'Product Owner', roleKey: 'PRODUCT_OWNER', leadership: true, source: 'MANUAL', primary: true },
      { roleName: 'Developer', roleKey: 'DEVELOPER', leadership: false, source: 'JIRA', primary: false },
    ],
  });
  const tribe = membership('DDWPRIME', {
    projectName: 'Prime',
    tribeName: 'Varejo',
    roleName: 'Liderança Transversal da Tribo',
    roleKey: 'TRIBE_LEADER_ACCESS',
    leadership: true,
    direct: false,
    scope: 'TRIBE',
    source: null,
    roles: [{ roleName: 'Liderança Transversal da Tribo', roleKey: 'TRIBE_LEADER_ACCESS', leadership: true, source: null, primary: true }],
  });

  it('várias linhas na mesma squad viram um vínculo com todos os papéis, o primário primeiro', () => {
    const [link] = buildMyLinks(session, [], undefined, memberships([po]));
    expect(link.role).toBe('Product Owner');
    expect(link.roles.map((r) => r.name)).toEqual(['Product Owner', 'Developer']);
    expect(link.roles.map((r) => r.primary)).toEqual([true, false]);
    expect(link.roles.map((r) => r.origin)).toEqual(['Manual', 'Importado do Jira']);
    expect(link.leadership).toBe(true);
    expect(link.origin).toBe('Manual');
  });

  it('vínculo de tribo é marcado como "Liderança da tribo", sem origem e como acesso indireto', () => {
    const links = buildMyLinks(session, [], undefined, memberships([po, tribe]));
    const prime = links.find((l) => l.id === 'DDWPRIME')!;
    expect(prime).toMatchObject({ scope: 'TRIBE', scopeLabel: 'Liderança da tribo', direct: false, via: 'Varejo', origin: null });
    expect(links.find((l) => l.id === 'DDWMISSI')).toMatchObject({ scope: 'SQUAD', scopeLabel: null, direct: true });
  });

  it('segmento: "Liderança do segmento"', () => {
    const seg = membership('S1', { scope: 'SEGMENT', direct: false, segmentName: 'Distribuição', leadership: true });
    const [link] = buildMyLinks(session, [], undefined, memberships([seg]));
    expect(link).toMatchObject({ scopeLabel: 'Liderança do segmento', via: 'Distribuição' });
  });

  it('o endpoint manda: lista vazia (conta legada) não cai nos projetos da sessão', () => {
    expect(buildMyLinks(session, [], undefined, memberships([], { legacyOnly: true }))).toEqual([]);
  });

  it('squad ativa = a da sessão validada; fora dos vínculos vale a do servidor', () => {
    const m = memberships([membership('A1'), membership('B2')], { activeProjectId: 'B2' });
    expect(buildMyLinks({ activeProjectId: 'a1' }, [], undefined, m).find((l) => l.active)?.id).toBe('A1');
    expect(buildMyLinks({ activeProjectId: 'SOLTA' }, [], undefined, m).find((l) => l.active)?.id).toBe('B2');
  });

  it('endpoint ausente (null) cai na sessão, e a sessão também ganha papel e alcance', () => {
    const links = buildMyLinks(session, [], undefined, null);
    expect(links.map((l) => l.id)).toEqual(['DDWMISSI', 'DDWPRIME', 'DDWOMNI']);
    const omni = links.find((l) => l.id === 'DDWOMNI')!;
    expect(omni).toMatchObject({ scope: 'TRIBE', scopeLabel: 'Liderança da tribo', origin: null });
    expect(links.find((l) => l.id === 'DDWPRIME')!.roles).toEqual([{ name: 'Agile Master', leadership: true, origin: null, primary: true }]);
  });

  it('a busca também olha os papéis secundários', () => {
    const links = buildMyLinks(session, [], undefined, memberships([po]));
    expect(filterMyLinks(links, 'developer').map((l) => l.id)).toEqual(['DDWMISSI']);
  });
});

describe('originSummary', () => {
  const role = (name: string, origin: string | null) => ({ name, leadership: false, origin, primary: false });

  it('uma origem só aparece uma vez', () => {
    expect(originSummary({ origin: null, roles: [role('A', 'Manual'), role('B', 'Manual')] })).toBe('Manual');
  });

  it('origens diferentes aparecem por papel', () => {
    expect(originSummary({ origin: null, roles: [role('PO', 'Manual'), role('Dev', 'Importado do Jira')] })).toBe('Manual (PO) · Importado do Jira (Dev)');
  });

  it('sem origem conhecida, nada', () => {
    expect(originSummary({ origin: null, roles: [role('A', null)] })).toBeNull();
  });
});
