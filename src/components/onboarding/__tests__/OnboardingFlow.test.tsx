// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyMemberships } from '../../../lib/memberships-api';

const roster = vi.hoisted(() => ({ projectId: 'DDWMISSI', projectName: 'Missi', memberCount: 1, members: [] as unknown[] }));

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  saveUser: vi.fn(),
  authFetch: vi.fn(),
  createProject: vi.fn(),
  joinProject: vi.fn(),
  claimRosterMember: vi.fn(),
  auth: {} as Record<string, unknown>,
  links: { requests: [] as unknown[], reload: vi.fn() },
  search: { query: 'miss', setQuery: vi.fn(), phase: 'ok', results: [] as unknown[], searchedText: 'miss', retry: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => mocks.authFetch(...args) }));
vi.mock('../../../app/users/api', () => ({ userApi: { saveUser: (...args: unknown[]) => mocks.saveUser(...args) } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../../hooks/useMyMemberships', () => {
  const empty: MyMemberships = { contractVersion: '1', activeProjectId: null, legacyOnly: false, transversalLeader: false, memberships: [] };
  return { useMyMemberships: () => ({ memberships: empty, settled: true, stale: empty, refresh: vi.fn() }) };
});
vi.mock('../../../hooks/useMyLinkRequests', () => ({ useMyLinkRequests: () => mocks.links }));
vi.mock('../../../hooks/useSquadSearch', () => ({
  useSquadSearch: () => mocks.search,
}));
vi.mock('../../../services/onboardingService', () => ({
  onboardingService: {
    suggestions: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue([roster]),
    roster: vi.fn().mockResolvedValue(roster),
  },
}));
vi.mock('../../../components/jira/JiraProfieldsImport', () => ({
  JiraProfieldsImport: ({ skipAction }: { skipAction?: { label: string; onClick: () => void } }) => (
    <button type="button" onClick={skipAction?.onClick}>
      {skipAction?.label}
    </button>
  ),
}));

import { UserProvider } from '../../../context/UserContext';
import { OnboardingFlow } from '../OnboardingFlow';

const mount = () =>
  render(
    <UserProvider>
      <OnboardingFlow />
    </UserProvider>,
  );

beforeEach(() => {
  // Objetos estáveis entre renders (um `session` novo a cada render reexecutaria o efeito do UserProvider sem parar).
  mocks.search.results = [roster];
  mocks.auth = {
    // Conta sem nenhuma squad: cai no onboarding.
    session: { id: 'u1', name: 'Ana Souza', email: 'ana@totvs.com.br', role: 'MEMBER', activeProjectId: '' },
    isLoading: false,
    logout: vi.fn(),
    createProject: mocks.createProject,
    joinProject: mocks.joinProject,
    claimRosterMember: mocks.claimRosterMember,
  };
  localStorage.clear();
  window.scrollTo = vi.fn();
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.saveUser.mockReset().mockResolvedValue(undefined);
  mocks.authFetch.mockReset().mockResolvedValue({ ok: false, json: async () => ({}) } as unknown as Response);
  mocks.createProject.mockReset().mockResolvedValue({});
  mocks.joinProject.mockReset().mockResolvedValue({});
});

afterEach(() => cleanup());

describe('OnboardingFlow - entrar em squad não grava squadId do usuário', () => {
  it('criar squad cria só o vínculo (createProject) e segue para a home, sem saveUser', async () => {
    mount();
    fireEvent.click(await screen.findByText('Sou Agile Master ou People Lead'));
    fireEvent.click(await screen.findByText('Criar uma squad sem o Jira'));
    fireEvent.change(await screen.findByLabelText('Nome da squad'), { target: { value: 'Squad Fenix' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar e entrar/ }));

    await waitFor(() => expect(mocks.createProject).toHaveBeenCalledTimes(1));
    expect(mocks.createProject.mock.calls[0][0]).toMatchObject({ name: 'Squad Fenix' });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/'));
    expect(mocks.saveUser).not.toHaveBeenCalled();
  });

  it('entrar numa squad com um papel usa só joinProject, sem saveUser', async () => {
    mount();
    fireEvent.click(await screen.findByText('Participo de uma squad'));
    fireEvent.click(await screen.findByText(/Missi/));
    fireEvent.click(await screen.findByText(/Não estou na lista/));
    fireEvent.click(await screen.findByText('Eu construo'));

    await waitFor(() => expect(mocks.joinProject).toHaveBeenCalledWith('DDWMISSI', 'Developer'));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(mocks.saveUser).not.toHaveBeenCalled();
  });
});
