// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyMemberships } from '../../../lib/memberships-api';

const roster = vi.hoisted(() => ({ projectId: 'DDWMISSI', projectName: 'Missi', memberCount: 1, members: [] as unknown[] }));

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toast: vi.fn(),
  createLinkRequest: vi.fn(),
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
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => mocks.authFetch(...args) }));
vi.mock('../../../app/users/api', () => ({ userApi: { saveUser: (...args: unknown[]) => mocks.saveUser(...args) } }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../../hooks/useMyMemberships', () => {
  const empty: MyMemberships = { contractVersion: '1', activeProjectId: null, legacyOnly: false, transversalLeader: false, memberships: [] };
  return { useMyMemberships: () => ({ memberships: empty, settled: true, stale: empty, refresh: vi.fn() }) };
});
vi.mock('../../../lib/link-requests-api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/link-requests-api')>()),
  createLinkRequest: mocks.createLinkRequest,
}));
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
  mocks.toast.mockReset();
  mocks.createLinkRequest.mockReset().mockResolvedValue({ id: 'r1', status: 'PENDING' });
  mocks.links.requests = [];
});

afterEach(() => cleanup());

import { ApiError } from '../../../lib/api-error';

/** Do intent até o passo de papel ("Como você participa da DDWMISSI?"). */
async function openRoleStep() {
  mount();
  fireEvent.click(await screen.findByText('Participo de uma squad'));
  fireEvent.click(await screen.findByText('DDWMISSI'));
  fireEvent.click(await screen.findByRole('button', { name: /Não estou na lista/ }));
  await screen.findByText('Como você participa da DDWMISSI?');
}

describe('OnboardingFlow - acabamento do passo de papel e do pedido de vínculo', () => {
  it('o subtítulo do papel não diz que a escolha é só para personalizar: o clique tenta entrar na squad', async () => {
    await openRoleStep();
    expect(screen.queryByText(/Só para saber o que te mostrar primeiro/)).toBeNull();
    expect(screen.getByText(/Escolha o seu papel para entrar na squad/)).toBeTruthy();
  });

  it('recusa de acesso (403) mostra o motivo uma vez só, no quadro da tela, sem aviso repetido', async () => {
    mocks.joinProject.mockRejectedValue(new ApiError('Forbidden', 403));
    await openRoleStep();
    fireEvent.click(screen.getByText('Eu construo'));

    const motivo = await screen.findByText(/Você não consta na lista desta squad/);
    expect(motivo).toBeTruthy();
    expect(screen.getAllByText(/Você não consta na lista desta squad/)).toHaveLength(1);
    expect(mocks.toast).not.toHaveBeenCalled();
    const quadro = screen.getByRole('alert');
    expect(within(quadro).getByRole('button', { name: 'Tenho um link de convite' })).toBeTruthy();
    expect(within(quadro).getByRole('button', { name: 'Pedir vínculo' })).toBeTruthy();
  });

  it('outros erros (que não são recusa de acesso) continuam avisando por toast', async () => {
    mocks.joinProject.mockRejectedValue(new ApiError('Falha interna', 500));
    await openRoleStep();
    fireEvent.click(screen.getByText('Eu construo'));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(mocks.toast.mock.calls[0][0]).toMatchObject({ title: 'Não foi possível entrar na squad', variant: 'destructive' });
  });

  it('depois de enviar o pedido de vínculo, "Meus pedidos" aparece logo abaixo da confirmação', async () => {
    mocks.joinProject.mockRejectedValue(new ApiError('Forbidden', 403));
    await openRoleStep();
    fireEvent.click(screen.getByText('Eu construo'));
    fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Pedir vínculo' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Desenvolvedor(a)' }));
    // O pedido enviado passa a vir da lista do servidor.
    mocks.links.requests = [{ id: 'r1', projectKey: 'DDWMISSI', status: 'PENDING', createdAt: new Date().toISOString(), email: 'ana@totvs.com.br' }];
    fireEvent.click(screen.getByRole('button', { name: /Enviar pedido/ }));

    await screen.findByText('Pedido enviado');
    expect(mocks.links.reload).toHaveBeenCalled();
    expect(screen.getByText(/logo abaixo/)).toBeTruthy();
    // O título "Meus pedidos" aparece na confirmação e no cabeçalho da lista; o selo prova que a lista está na tela.
    expect(screen.getAllByText(/Meus pedidos/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Pendente')).toBeTruthy();
  });

  it('o campo do link de convite, aberto, vem com explicação e não fica preso no rodapé', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Tenho um link de convite/ }));
    const campo = await screen.findByLabelText('Link do convite');
    expect(screen.getByText(/Cole o link que a liderança da squad te enviou/)).toBeTruthy();
    const container = campo.closest('[class*="max-w-[672px]"]') as HTMLElement | null;
    expect(container).toBeTruthy();
    expect(container!.className).not.toContain('mt-auto');
  });

  it('fechado, o atalho do convite continua no pé da página', async () => {
    mount();
    const atalho = await screen.findByRole('button', { name: /Tenho um link de convite/ });
    const container = atalho.closest('[class*="max-w-[672px]"]') as HTMLElement | null;
    expect(container!.className).toContain('mt-auto');
  });
});
