import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { getMyMemberships, parseMyMemberships } from '../memberships-api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const contract = {
  contractVersion: '1',
  activeProjectId: 'DDWMISSI',
  legacyOnly: false,
  transversalLeader: true,
  memberships: [
    {
      projectId: 'DDWMISSI',
      projectName: 'Missão Digital',
      segmentName: 'Distribuição',
      tribeName: 'Varejo',
      roleName: 'Product Owner',
      roleKey: 'PRODUCT_OWNER',
      leadership: true,
      direct: true,
      scope: 'SQUAD',
      source: 'MANUAL',
      roles: [
        { roleName: 'Product Owner', roleKey: 'PRODUCT_OWNER', leadership: true, source: 'MANUAL', primary: true },
        { roleName: 'Developer', roleKey: 'DEVELOPER', leadership: false, source: 'JIRA', primary: false },
      ],
    },
    {
      projectId: 'DDWPRIME',
      projectName: 'Prime',
      tribeName: 'Varejo',
      roleName: 'Liderança Transversal da Tribo',
      roleKey: 'TRIBE_LEADER_ACCESS',
      leadership: true,
      direct: false,
      scope: 'TRIBE',
      source: null,
      roles: [{ roleName: 'Liderança Transversal da Tribo', roleKey: 'TRIBE_LEADER_ACCESS', leadership: true, source: null, primary: true }],
    },
  ],
};

describe('GET /me/memberships (cliente)', () => {
  beforeEach(() => {
    authFetch.mockReset();
  });

  it('lê o contrato versão 1 com todos os papéis por squad', async () => {
    authFetch.mockResolvedValue(json(200, contract));
    const m = await getMyMemberships();
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/me\/memberships$/);
    expect(m?.contractVersion).toBe('1');
    expect(m?.activeProjectId).toBe('DDWMISSI');
    expect(m?.transversalLeader).toBe(true);
    expect(m?.memberships).toHaveLength(2);
    expect(m?.memberships[0].roles.map((r) => r.roleName)).toEqual(['Product Owner', 'Developer']);
    expect(m?.memberships[0].roles.map((r) => r.primary)).toEqual([true, false]);
    expect(m?.memberships[1]).toMatchObject({ scope: 'TRIBE', direct: false, source: null });
  });

  it('404 (backend antigo) devolve null, sem lançar', async () => {
    authFetch.mockResolvedValue(new Response('', { status: 404 }));
    await expect(getMyMemberships()).resolves.toBeNull();
  });

  it.each([401, 403, 500, 502])('status %i devolve null', async (status) => {
    authFetch.mockResolvedValue(new Response('', { status }));
    await expect(getMyMemberships()).resolves.toBeNull();
  });

  it('falha de rede devolve null', async () => {
    authFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getMyMemberships()).resolves.toBeNull();
  });

  it('corpo fora do contrato (HTML, lista no lugar do objeto) devolve null', async () => {
    authFetch.mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(getMyMemberships()).resolves.toBeNull();
    authFetch.mockResolvedValue(json(200, []));
    await expect(getMyMemberships()).resolves.toBeNull();
    authFetch.mockResolvedValue(json(200, { contractVersion: '1' }));
    await expect(getMyMemberships()).resolves.toBeNull();
  });
});

describe('parseMyMemberships', () => {
  it('conta sem vínculo: lista vazia, activeProjectId nulo e legacyOnly', () => {
    const m = parseMyMemberships({ contractVersion: '1', activeProjectId: null, legacyOnly: true, transversalLeader: false, memberships: [] });
    expect(m).toEqual({ contractVersion: '1', activeProjectId: null, legacyOnly: true, transversalLeader: false, memberships: [] });
  });

  it('campos que o contrato pode acrescentar são ignorados; vínculo sem projectId é descartado', () => {
    const m = parseMyMemberships({ ...contract, novoCampo: 1, memberships: [{ roleName: 'Dev' }, ...contract.memberships] });
    expect(m?.memberships.map((x) => x.projectId)).toEqual(['DDWMISSI', 'DDWPRIME']);
  });

  it('sem a lista roles, o papel primário vira a única linha; scope desconhecido vira SQUAD', () => {
    const m = parseMyMemberships({
      memberships: [{ projectId: 'X1', roleName: 'QA', roleKey: 'QA', leadership: false, source: 'INVITE', scope: 'OUTRO' }],
    });
    expect(m?.memberships[0].roles).toEqual([{ roleName: 'QA', roleKey: 'QA', leadership: false, source: 'INVITE', primary: true }]);
    expect(m?.memberships[0]).toMatchObject({ scope: 'SQUAD', direct: true, projectName: 'X1' });
  });
});
