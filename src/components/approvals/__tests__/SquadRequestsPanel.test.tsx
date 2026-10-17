import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApprovalAccess, SquadLinkRequest } from '../../../lib/squad-link-requests-api';
vi.mock('../../../services/onboardingService', () => ({
  onboardingService: { roster: vi.fn().mockResolvedValue({ projectId: 'p', projectName: 'Missi', memberCount: 0, members: [] }) },
}));

import { SquadRequestsPanel } from '../SquadRequestsPanel';
import type { useSquadLinkRequests } from '../useSquadLinkRequests';

type Requests = ReturnType<typeof useSquadLinkRequests>;

const am: ApprovalAccess = { canApprove: true, canApproveLeadership: false };
const peopleLead: ApprovalAccess = { canApprove: true, canApproveLeadership: true };

const contributor: SquadLinkRequest = {
  id: 'r1',
  requester: { id: 'u1', name: 'Ana Paula', email: 'ana@totvs.com.br' },
  projectKey: 'DDWMISSI',
  kind: 'CONTRIBUTOR',
  requestedRoleName: 'Developer',
  emailInJira: 'ana.n@totvs.com.br',
  message: 'Entrei no time esta semana',
  status: 'PENDING',
  createdAt: '2026-10-17T12:00:00Z',
};
const leadership: SquadLinkRequest = {
  ...contributor,
  id: 'r2',
  requester: { id: 'u2', name: 'Bruno Lima', email: 'bruno@totvs.com.br' },
  kind: 'LEADERSHIP',
  requestedRoleName: undefined,
  memberId: 'm9',
  memberName: 'Bruno L.',
  message: undefined,
};

const fns = { setFilter: vi.fn(), reload: vi.fn(), approve: vi.fn(), reject: vi.fn() };

function requests(over: Partial<Requests> = {}): Requests {
  return { filter: 'PENDING', items: [], pendingCount: 0, state: 'ready', error: null, busyId: null, ...fns, ...over } as Requests;
}

const renderPanel = (r: Requests, access: ApprovalAccess = am, currentUserId: string | null = 'u-me') =>
  render(<SquadRequestsPanel requests={r} access={access} currentUserId={currentUserId} />);

beforeEach(() => {
  Object.values(fns).forEach((f) => f.mockReset());
});
afterEach(cleanup);

describe('SquadRequestsPanel: botões por permissão', () => {
  it('contribuidor: Aprovar e Recusar, com quem, papel e há quanto tempo', () => {
    renderPanel(requests({ items: [contributor], pendingCount: 1 }));
    expect(screen.getByText('Ana Paula')).toBeTruthy();
    expect(screen.getByText('Contribuidor · Developer')).toBeTruthy();
    expect(screen.getByText(/Entrei no time esta semana/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recusar' })).toBeTruthy();
  });

  it('liderança sem canApproveLeadership: sem botões e com o aviso', () => {
    renderPanel(requests({ items: [leadership], pendingCount: 1 }), am);
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Recusar' })).toBeNull();
    expect(screen.getByText('Só People Lead ou Tribe Lead aprovam liderança')).toBeTruthy();
    expect(screen.getByText(/assumir a linha “Bruno L.”/)).toBeTruthy();
  });

  it('liderança com canApproveLeadership: botões habilitados', () => {
    renderPanel(requests({ items: [leadership], pendingCount: 1 }), peopleLead);
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeTruthy();
    expect(screen.queryByText('Só People Lead ou Tribe Lead aprovam liderança')).toBeNull();
  });

  it('o próprio pedido não tem botões', () => {
    renderPanel(requests({ items: [contributor], pendingCount: 1 }), peopleLead, 'u1');
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull();
    expect(screen.getByText(/Outra pessoa da liderança/)).toBeTruthy();
  });

  it('contribuidor e liderança na mesma lista: cada um com a sua regra', () => {
    renderPanel(requests({ items: [contributor, leadership], pendingCount: 2 }), am);
    expect(screen.getAllByRole('button', { name: 'Aprovar' })).toHaveLength(1);
  });
});

describe('SquadRequestsPanel: decidir', () => {
  it('Aprovar abre a confirmação com o efeito e só aprova ao confirmar', async () => {
    renderPanel(requests({ items: [contributor], pendingCount: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Ana Paula passa a ter acesso à squad como Developer.')).toBeTruthy();
    expect(fns.approve).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aprovar pedido' }));
    expect(fns.approve).toHaveBeenCalledWith(contributor, undefined);
  });

  it('pedido antigo sem linha e sem papel: Aprovar está disponível e abre o seletor da linha', async () => {
    const old: SquadLinkRequest = { ...contributor, id: 'r3', requestedRoleName: undefined };
    renderPanel(requests({ items: [old], pendingCount: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(await within(dialog).findByText(/Todas as linhas do time já têm conta/)).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Aprovar pedido' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('cancelar a confirmação não aprova', async () => {
    renderPanel(requests({ items: [contributor], pendingCount: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(fns.approve).not.toHaveBeenCalled();
  });

  it('Recusar leva o motivo digitado (opcional)', async () => {
    renderPanel(requests({ items: [contributor], pendingCount: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Não é desta squad' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Recusar pedido' }));
    expect(fns.reject).toHaveBeenCalledWith(contributor, 'Não é desta squad');
  });

  it('Recusar sem motivo também funciona', async () => {
    renderPanel(requests({ items: [contributor], pendingCount: 1 }));
    fireEvent.click(screen.getByRole('button', { name: 'Recusar' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Recusar pedido' }));
    expect(fns.reject).toHaveBeenCalledWith(contributor, '');
  });

  it('pedido em andamento trava os botões', () => {
    renderPanel(requests({ items: [contributor], pendingCount: 1, busyId: 'r1' }));
    expect((screen.getByRole('button', { name: /Aprovar/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Recusar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('SquadRequestsPanel: filtro e estados', () => {
  it('mostra o contador de pendentes e troca o filtro', () => {
    renderPanel(requests({ items: [contributor], pendingCount: 3 }));
    expect(screen.getByRole('tab', { name: /Pendentes\s*3/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Aprovados' }));
    expect(fns.setFilter).toHaveBeenCalledWith('APPROVED');
  });

  it('Aprovados lista o histórico com quem decidiu', () => {
    const done: SquadLinkRequest = { ...contributor, status: 'APPROVED', decidedBy: 'am@totvs.com.br', decidedAt: '2026-10-17T13:00:00Z' };
    renderPanel(requests({ filter: 'APPROVED', items: [done], pendingCount: 0 }));
    expect(screen.getByText(/Ana Paula · Developer/)).toBeTruthy();
    expect(screen.getByText('am@totvs.com.br')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull();
  });

  it('vazio, carregando e erro com "Tentar de novo"', () => {
    const { unmount } = renderPanel(requests({ items: [] }));
    expect(screen.getByText('Nenhum pedido pendente')).toBeTruthy();
    unmount();

    const loading = renderPanel(requests({ state: 'loading' }));
    expect(screen.getByRole('status', { name: 'Carregando' })).toBeTruthy();
    loading.unmount();

    renderPanel(requests({ state: 'error', error: 'Não foi possível carregar os pedidos.' }));
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar os pedidos.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(fns.reload).toHaveBeenCalled();
  });
});
