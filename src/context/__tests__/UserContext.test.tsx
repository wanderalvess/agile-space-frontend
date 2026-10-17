// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership, MyMemberships } from '../../lib/memberships-api';

const mocks = vi.hoisted(() => ({
  session: null as Record<string, unknown> | null,
  memberships: null as unknown,
  authFetch: vi.fn(),
  saveUser: vi.fn(),
}));

vi.mock('../AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, isLoading: false, logout: vi.fn() }),
}));
vi.mock('../../hooks/useMyMemberships', () => ({
  useMyMemberships: () => ({ memberships: mocks.memberships, settled: true, stale: mocks.memberships, refresh: vi.fn() }),
}));
vi.mock('../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => mocks.authFetch(...args) }));
vi.mock('../../app/users/api', () => ({ userApi: { saveUser: (...args: unknown[]) => mocks.saveUser(...args) } }));

import { UserProvider, useUserContext } from '../UserContext';

type Ctx = ReturnType<typeof useUserContext>;
let latest: Ctx;

function Probe() {
  const ctx = useUserContext();
  useEffect(() => {
    latest = ctx;
  });
  return null;
}

const mount = () =>
  render(
    <UserProvider>
      <Probe />
    </UserProvider>,
  );

const ms = (projectId: string, over: Partial<Membership> = {}): Membership => ({
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

const data = (list: Membership[], over: Partial<MyMemberships> = {}): MyMemberships => ({
  contractVersion: '1',
  activeProjectId: list[0]?.projectId ?? null,
  legacyOnly: false,
  transversalLeader: false,
  memberships: list,
  ...over,
});

const sessionOf = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  name: 'Ana Souza',
  email: 'ana@totvs.com.br',
  role: 'MEMBER',
  activeProjectId: 'DDWMISSI',
  activeProjectRole: 'Developer',
  accessibleProjects: [{ projectId: 'DDWMISSI' }, { projectId: 'DDWPRIME' }],
  ...over,
});

const byUser = (rows: Array<{ squadId: string; role: string }>) =>
  mocks.authFetch.mockImplementation(async (url: string) =>
    String(url).includes('/squads/by-user') ? ({ ok: true, json: async () => rows } as unknown as Response) : ({ ok: false, json: async () => ({}) } as unknown as Response),
  );

beforeEach(() => {
  localStorage.clear();
  mocks.session = sessionOf();
  mocks.memberships = null;
  mocks.authFetch.mockReset();
  mocks.saveUser.mockReset().mockResolvedValue(undefined);
  byUser([]);
});

describe('UserProvider - squad ativa sem troca silenciosa', () => {
  it('/squads/by-user com outras squads NÃO troca a squad nem grava users.squad_id', async () => {
    byUser([
      { squadId: 'OUTRA', role: 'Product Owner' },
      { squadId: 'MAIS_UMA', role: 'QA' },
    ]);
    mount();
    await waitFor(() => expect(latest.userSquads).toHaveLength(2));
    expect(latest.userProfile?.squadId).toBe('DDWMISSI');
    expect(latest.userProfile?.role).toBe('Developer');
    expect(mocks.saveUser).not.toHaveBeenCalled();
  });

  it('a squad ativa é a da sessão validada: fora dos vínculos usa a que o servidor validou, também sem gravar nada', async () => {
    mocks.memberships = data([ms('DDWPRIME', { roleName: 'Agile Master', leadership: true }), ms('B2')], { activeProjectId: 'DDWPRIME' });
    byUser([{ squadId: 'B2', role: 'QA' }]);
    mount();
    await waitFor(() => expect(latest.userSquads).toHaveLength(1));
    expect(latest.activeSquadId).toBe('DDWPRIME');
    expect(latest.userProfile?.squadId).toBe('DDWPRIME');
    expect(latest.userProfile?.role).toBe('Agile Master');
    expect(mocks.saveUser).not.toHaveBeenCalled();
  });

  it('trocar a squad na sessão (switchProject) muda a ativa do perfil, e só isso', async () => {
    mocks.memberships = data([ms('DDWMISSI'), ms('DDWPRIME', { roleName: 'Tech Lead', leadership: true })]);
    const { rerender } = mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));

    mocks.session = sessionOf({ activeProjectId: 'DDWPRIME', activeProjectRole: 'Tech Lead' });
    rerender(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWPRIME'));
    expect(latest.userProfile?.role).toBe('Tech Lead');
    expect(mocks.saveUser).not.toHaveBeenCalled();
  });

  it('administrador continua "admin", mesmo com papel de vínculo', async () => {
    mocks.session = sessionOf({ role: 'ADMIN' });
    mocks.memberships = data([ms('DDWMISSI', { roleName: 'QA' })]);
    mount();
    await waitFor(() => expect(latest.userProfile?.role).toBe('admin'));
    expect(latest.isLeadership).toBe(true);
  });
});

describe('UserProvider - mustOnboard', () => {
  it('sem o endpoint (null): o critério de antes, sem squad ativa', async () => {
    mocks.session = sessionOf({ activeProjectId: '', activeProjectRole: undefined, accessibleProjects: [] });
    mount();
    await waitFor(() => expect(latest.userProfile).not.toBeNull());
    expect(latest.mustOnboard).toBe(true);

    mocks.session = sessionOf();
    mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));
    expect(latest.mustOnboard).toBe(false);
  });

  it('com o endpoint: lista vazia = precisa de onboarding, mesmo com squad na sessão', async () => {
    mocks.memberships = data([]);
    mount();
    await waitFor(() => expect(latest.userProfile).not.toBeNull());
    expect(latest.mustOnboard).toBe(true);
    expect(latest.legacyOnly).toBe(false);
  });

  it('com o endpoint: ter vínculo basta, mesmo sem squad ativa na sessão', async () => {
    mocks.session = sessionOf({ activeProjectId: '' });
    mocks.memberships = data([ms('DDWPRIME')]);
    mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWPRIME'));
    expect(latest.mustOnboard).toBe(false);
  });

  it('legacyOnly sem squad na sessão (modo new): vai ao onboarding com o aviso', async () => {
    mocks.session = sessionOf({ activeProjectId: '', activeProjectRole: undefined, accessibleProjects: [], legacyOnly: true });
    mocks.memberships = data([], { legacyOnly: true, activeProjectId: null });
    mount();
    await waitFor(() => expect(latest.userProfile).not.toBeNull());
    expect(latest.mustOnboard).toBe(true);
    expect(latest.legacyOnly).toBe(true);
  });

  it('legacyOnly com squad na sessão (modo sombra): segue no app, com o aviso, sem laço de redirecionamento', async () => {
    mocks.memberships = data([], { legacyOnly: true, activeProjectId: null });
    mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));
    expect(latest.mustOnboard).toBe(false);
    expect(latest.legacyOnly).toBe(true);
  });
});

describe('UserProvider - isLeadership da squad ativa', () => {
  it('usa a bandeira de liderança do vínculo da squad ATIVA', async () => {
    mocks.memberships = data([ms('DDWMISSI'), ms('DDWPRIME', { roleName: 'Scrum Master', leadership: true })]);
    const { rerender } = mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));
    expect(latest.isLeadership).toBe(false);

    mocks.session = sessionOf({ activeProjectId: 'DDWPRIME' });
    rerender(
      <UserProvider>
        <Probe />
      </UserProvider>,
    );
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWPRIME'));
    // "Scrum Master" não está na lista por nome; a bandeira do vínculo é que vale
    expect(latest.isLeadership).toBe(true);
  });

  it('liderança em OUTRA squad não vale na ativa', async () => {
    mocks.memberships = data([ms('DDWMISSI'), ms('DDWPRIME', { leadership: true, roleName: 'Product Owner' })]);
    mocks.session = sessionOf({ activeProjectRole: 'Product Owner' });
    mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));
    expect(latest.isLeadership).toBe(false);
  });

  it('sem dados de vínculos, mantém a regra por nome do papel', async () => {
    mocks.session = sessionOf({ activeProjectRole: 'Product Owner' });
    mount();
    await waitFor(() => expect(latest.userProfile?.role).toBe('Product Owner'));
    expect(latest.isLeadership).toBe(true);

    mocks.session = sessionOf({ activeProjectRole: 'Developer' });
    mount();
    await waitFor(() => expect(latest.userProfile?.role).toBe('Developer'));
    expect(latest.isLeadership).toBe(false);
  });
});

describe('UserProvider - updateProfile não grava squadId nem team', () => {
  it('saveUser recebe nome/papel/avatar, nunca squadId nem team, mesmo se a tela mandar', async () => {
    mocks.memberships = data([ms('DDWMISSI'), ms('DDWPRIME')]);
    mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));

    await latest.updateProfile({ name: 'Ana S.', squadId: 'OUTRA', team: 'OUTRO' } as never);

    await waitFor(() => expect(mocks.saveUser).toHaveBeenCalledTimes(1));
    const sent = mocks.saveUser.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).toMatchObject({ id: 'u1', name: 'Ana S.', email: 'ana@totvs.com.br' });
    expect(sent).not.toHaveProperty('squadId');
    expect(sent).not.toHaveProperty('team');
    // a squad ativa continua a dos vínculos
    await waitFor(() => expect(latest.userProfile?.name).toBe('Ana S.'));
    expect(latest.userProfile?.squadId).toBe('DDWMISSI');
    expect(latest.activeSquadId).toBe('DDWMISSI');
  });

  it('o cache local do perfil não guarda a squad', async () => {
    mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));
    await latest.updateProfile({ name: 'Ana S.' });
    const cached = JSON.parse(localStorage.getItem('agileSpace_guest_profile') as string);
    expect(cached.uid).toBe('u1');
    expect(cached.profile.name).toBe('Ana S.');
    expect(cached.profile).not.toHaveProperty('squadId');
    expect(cached.profile).not.toHaveProperty('team');
  });

  it('setGuestProfile também não envia a squad', async () => {
    mount();
    await waitFor(() => expect(latest.userProfile).not.toBeNull());
    await latest.setGuestProfile('Ana S.', 'Developer');
    await waitFor(() => expect(mocks.saveUser).toHaveBeenCalledTimes(1));
    expect(mocks.saveUser.mock.calls[0][0]).not.toHaveProperty('squadId');
  });
});

describe('UserProvider - cache local antigo não é fonte de squad', () => {
  const legacyCache = (squadId: string) =>
    localStorage.setItem(
      'agileSpace_guest_profile',
      JSON.stringify({ uid: 'u1', profile: { id: 'u1', name: 'Ana', role: 'Developer', squadId, team: 'ANTIGA', isGuest: false, avatarSeed: 'Zed', dailyHours: 6 } }),
    );

  it('sessão sem squad e cache com squadId: continua sem squad (precisa de onboarding)', async () => {
    legacyCache('ANTIGA');
    mocks.session = sessionOf({ activeProjectId: '', activeProjectRole: undefined, accessibleProjects: [] });
    mount();
    await waitFor(() => expect(latest.userProfile).not.toBeNull());
    expect(latest.userProfile?.squadId).toBe('');
    expect(latest.activeSquadId).toBe('');
    expect(latest.mustOnboard).toBe(true);
  });

  it('migra em silêncio: reescreve o cache sem squadId/team e preserva avatar e carga horária', async () => {
    legacyCache('ANTIGA');
    mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));
    const cached = JSON.parse(localStorage.getItem('agileSpace_guest_profile') as string);
    expect(cached.profile).not.toHaveProperty('squadId');
    expect(cached.profile).not.toHaveProperty('team');
    expect(cached.profile).toMatchObject({ avatarSeed: 'Zed', dailyHours: 6 });
    expect(latest.userProfile?.dailyHours).toBe(6);
    expect(mocks.saveUser).not.toHaveBeenCalled();
  });

  it('cache corrompido não quebra', async () => {
    localStorage.setItem('agileSpace_guest_profile', '{nao-json');
    mount();
    await waitFor(() => expect(latest.userProfile?.squadId).toBe('DDWMISSI'));
  });
});
