import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchApprovalAccess: vi.fn(),
  listSquadLinkRequests: vi.fn(),
  approveSquadLinkRequest: vi.fn(),
  rejectSquadLinkRequest: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock('../../../lib/squad-link-requests-api', async (orig) => ({
  ...(await orig<typeof import('../../../lib/squad-link-requests-api')>()),
  fetchApprovalAccess: mocks.fetchApprovalAccess,
  listSquadLinkRequests: mocks.listSquadLinkRequests,
  approveSquadLinkRequest: mocks.approveSquadLinkRequest,
  rejectSquadLinkRequest: mocks.rejectSquadLinkRequest,
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));

import { ApiError } from '../../../lib/api-error';
import type { SquadLinkRequest } from '../../../lib/squad-link-requests-api';
import { useApprovalAccess, useSquadLinkRequests } from '../useSquadLinkRequests';

const req = (id: string, status: SquadLinkRequest['status'] = 'PENDING'): SquadLinkRequest => ({
  id,
  requester: { id: `u-${id}`, name: `Pessoa ${id}`, email: `${id}@totvs.com.br` },
  projectKey: 'DDWMISSI',
  kind: 'CONTRIBUTOR',
  requestedRoleName: 'Developer',
  emailInJira: `${id}@totvs.com.br`,
  status,
  createdAt: '2026-10-17T12:00:00Z',
});

beforeEach(() => {
  Object.values(mocks).forEach((m) => 'mockReset' in m && m.mockReset());
  mocks.toast.error = vi.fn();
  mocks.listSquadLinkRequests.mockImplementation(async (_squad: string, status: string) => (status === 'PENDING' ? [req('a'), req('b')] : [req('c', 'APPROVED')]));
  mocks.approveSquadLinkRequest.mockResolvedValue(undefined);
  mocks.rejectSquadLinkRequest.mockResolvedValue(undefined);
});

describe('useApprovalAccess', () => {
  it('carrega a permissão da squad', async () => {
    mocks.fetchApprovalAccess.mockResolvedValue({ canApprove: true, canApproveLeadership: false });
    const { result } = renderHook(() => useApprovalAccess('DDWMISSI'));
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.access).toEqual({ canApprove: true, canApproveLeadership: false });
  });

  it('trocar de squad volta para "carregando" e não herda a permissão da outra', async () => {
    mocks.fetchApprovalAccess.mockImplementation(async (id: string) => ({ canApprove: id === 'A', canApproveLeadership: false }));
    const { result, rerender } = renderHook(({ id }) => useApprovalAccess(id), { initialProps: { id: 'A' } });
    await waitFor(() => expect(result.current.access.canApprove).toBe(true));
    rerender({ id: 'B' });
    expect(result.current.loaded).toBe(false);
    expect(result.current.access.canApprove).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.access.canApprove).toBe(false);
  });
});

describe('useSquadLinkRequests', () => {
  it('desligado (sem permissão) não chama o servidor', async () => {
    const { result } = renderHook(() => useSquadLinkRequests('DDWMISSI', false));
    await act(async () => {});
    expect(mocks.listSquadLinkRequests).not.toHaveBeenCalled();
    expect(result.current.pendingCount).toBeNull();
  });

  it('carrega os pendentes e conta', async () => {
    const { result } = renderHook(() => useSquadLinkRequests('DDWMISSI', true));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(mocks.listSquadLinkRequests).toHaveBeenCalledTimes(1);
  });

  it('o filtro Aprovados busca a lista própria e mantém o contador de pendentes', async () => {
    const { result } = renderHook(() => useSquadLinkRequests('DDWMISSI', true));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    act(() => result.current.setFilter('APPROVED'));
    await waitFor(() => expect(result.current.items.map((r) => r.id)).toEqual(['c']));
    expect(result.current.pendingCount).toBe(2);
    expect(mocks.listSquadLinkRequests).toHaveBeenCalledWith('DDWMISSI', 'APPROVED');
  });

  it('aprovar chama a rota da squad e relê a lista', async () => {
    const { result } = renderHook(() => useSquadLinkRequests('DDWMISSI', true));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    mocks.listSquadLinkRequests.mockImplementation(async () => [req('b')]);
    await act(async () => {
      await result.current.approve(req('a'));
    });
    expect(mocks.approveSquadLinkRequest).toHaveBeenCalledWith('DDWMISSI', 'a');
    expect(result.current.pendingCount).toBe(1);
    expect(mocks.toast).toHaveBeenCalledWith('Pedido aprovado', expect.anything());
  });

  it('409 (já decidido) avisa com texto amigável e relê a lista', async () => {
    const { result } = renderHook(() => useSquadLinkRequests('DDWMISSI', true));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    mocks.approveSquadLinkRequest.mockRejectedValue(new ApiError('Esse pedido já foi decidido.', 409));
    mocks.listSquadLinkRequests.mockClear();
    await act(async () => {
      await result.current.approve(req('a'));
    });
    expect(mocks.toast.error).toHaveBeenCalledWith('Não foi possível aprovar o pedido', { description: 'Esse pedido já foi decidido.' });
    expect(mocks.listSquadLinkRequests).toHaveBeenCalled();
    expect(result.current.busyId).toBeNull();
  });

  it('403 ao recusar mostra a falta de permissão', async () => {
    const { result } = renderHook(() => useSquadLinkRequests('DDWMISSI', true));
    await waitFor(() => expect(result.current.state).toBe('ready'));
    mocks.rejectSquadLinkRequest.mockRejectedValue(new ApiError('Forbidden', 403));
    await act(async () => {
      await result.current.reject(req('a'), 'motivo');
    });
    expect(mocks.rejectSquadLinkRequest).toHaveBeenCalledWith('DDWMISSI', 'a', 'motivo');
    expect(mocks.toast.error).toHaveBeenCalledWith('Não foi possível recusar o pedido', { description: 'Você não tem permissão para decidir este pedido.' });
  });

  it('falha ao listar vira estado de erro com mensagem; 404 explica que não está disponível', async () => {
    mocks.listSquadLinkRequests.mockRejectedValue(new ApiError('Erro interno', 500));
    const { result } = renderHook(() => useSquadLinkRequests('DDWMISSI', true));
    await waitFor(() => expect(result.current.state).toBe('error'));
    expect(result.current.error).toBe('Erro interno');

    mocks.listSquadLinkRequests.mockRejectedValue(new ApiError('Not Found', 404));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.error).toMatch(/ainda não estão disponíveis/);
  });
});
