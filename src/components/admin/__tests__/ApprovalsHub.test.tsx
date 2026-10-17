import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listLinkRequests: vi.fn(),
  approveLinkRequest: vi.fn(),
  rejectLinkRequest: vi.fn(),
  getPasswordResets: vi.fn(),
  approvePasswordReset: vi.fn(),
}));

vi.mock('../../../lib/admin-link-requests-api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/admin-link-requests-api')>()),
  listLinkRequests: mocks.listLinkRequests,
  approveLinkRequest: mocks.approveLinkRequest,
  rejectLinkRequest: mocks.rejectLinkRequest,
}));
vi.mock('../../../app/admin/api', () => ({
  adminApi: { getPasswordResets: mocks.getPasswordResets, approvePasswordReset: mocks.approvePasswordReset },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { LinkRequestsApiError } from '../../../lib/admin-link-requests-api';
import { ApprovalsHub } from '../approvals/ApprovalsHub';

const pendingLink = {
  id: 'l1',
  requester: { id: 'u1', name: 'Marina Costa', email: 'marina@totvs.com.br' },
  projectKey: 'DDWMISSI',
  memberName: 'Marina C.',
  emailInJira: 'marina.costa@totvs.com.br',
  status: 'PENDING' as const,
  createdAt: '2026-10-14T10:00:00Z',
};
const pendingReset = { id: 'r1', userEmail: 'joao@totvs.com.br', userName: 'João', status: 'PENDING', requestedAt: '2026-10-14T11:00:00Z' };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.listLinkRequests.mockResolvedValue([pendingLink]);
  mocks.getPasswordResets.mockResolvedValue([pendingReset]);
  mocks.approveLinkRequest.mockResolvedValue(undefined);
  mocks.rejectLinkRequest.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('ApprovalsHub (admin)', () => {
  it('mostra vínculos e redefinições pendentes na aba Todas, com contadores', async () => {
    render(<ApprovalsHub />);
    expect(await screen.findByText('Marina Costa')).toBeTruthy();
    expect(screen.getByText('João')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Todas\s*2/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Vínculos\s*1/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Redefinições\s*1/ })).toBeTruthy();
  });

  it('aprova o vínculo pela rota do admin', async () => {
    render(<ApprovalsHub />);
    fireEvent.click(await screen.findByRole('button', { name: /Aprovar vínculo/ }));
    await waitFor(() => expect(mocks.approveLinkRequest).toHaveBeenCalledWith('l1'));
  });

  it('recusa com motivo pelo diálogo compartilhado', async () => {
    render(<ApprovalsHub />);
    fireEvent.click(await screen.findByRole('button', { name: 'Recusar' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: 'Não é da squad' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Recusar pedido' }));
    await waitFor(() => expect(mocks.rejectLinkRequest).toHaveBeenCalledWith('l1', 'Não é da squad'));
  });

  it('endpoint de vínculos indisponível (404) mostra aviso, sem erro', async () => {
    mocks.listLinkRequests.mockRejectedValue(new LinkRequestsApiError('nf', 404));
    render(<ApprovalsHub />);
    expect(await screen.findByText(/ainda não estão disponíveis neste ambiente/)).toBeTruthy();
    expect(screen.getByText('João')).toBeTruthy();
  });

  it('a aba Redefinições continua com "Aprovar & Gerar Link"', async () => {
    render(<ApprovalsHub />);
    fireEvent.click(await screen.findByRole('tab', { name: /Redefinições/ }));
    expect(await screen.findByText('Solicitações de Redefinição de Senha')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Aprovar & Gerar Link/ }).length).toBeGreaterThan(0);
  });
});
