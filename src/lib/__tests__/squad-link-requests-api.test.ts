import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import {
  approveSquadLinkRequest,
  decisionErrorMessage,
  fetchApprovalAccess,
  isSquadRequestsUnavailable,
  listSquadLinkRequests,
  normalizeSquadLinkRequest,
  rejectSquadLinkRequest,
} from '../squad-link-requests-api';
import { ApiError } from '../api-error';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  authFetch.mockReset();
});

describe('fetchApprovalAccess (can-approve)', () => {
  it('lê canApprove e canApproveLeadership da rota da squad', async () => {
    authFetch.mockResolvedValue(json(200, { canApprove: true, canApproveLeadership: false }));
    expect(await fetchApprovalAccess('DDWMISSI')).toEqual({ canApprove: true, canApproveLeadership: false });
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/squads\/DDWMISSI\/link-requests\/can-approve$/);
  });

  it('liderança sem canApprove não conta (um sem o outro não faz sentido)', async () => {
    authFetch.mockResolvedValue(json(200, { canApprove: false, canApproveLeadership: true }));
    expect(await fetchApprovalAccess('X')).toEqual({ canApprove: false, canApproveLeadership: false });
  });

  it.each([404, 403, 405, 500])('%s = sem acesso, sem lançar (a aba some)', async (status) => {
    authFetch.mockResolvedValue(json(status, { message: 'x' }));
    expect(await fetchApprovalAccess('X')).toEqual({ canApprove: false, canApproveLeadership: false });
  });

  it('falha de rede também vira sem acesso', async () => {
    authFetch.mockRejectedValue(new Error('offline'));
    expect(await fetchApprovalAccess('X')).toEqual({ canApprove: false, canApproveLeadership: false });
  });

  it('sem squad nem chama o servidor', async () => {
    expect(await fetchApprovalAccess('')).toEqual({ canApprove: false, canApproveLeadership: false });
    expect(authFetch).not.toHaveBeenCalled();
  });

  it('escapa a chave da squad na URL', async () => {
    authFetch.mockResolvedValue(json(200, { canApprove: false, canApproveLeadership: false }));
    await fetchApprovalAccess('a b/c');
    expect(String(authFetch.mock.calls[0][0])).toContain('/squads/a%20b%2Fc/');
  });
});

describe('listSquadLinkRequests', () => {
  const dto = {
    id: 'r1', requester: { id: 'u1', name: 'Ana Paula', email: 'ana@totvs.com.br' }, projectKey: 'DDWMISSI', memberId: null, memberName: null,
    emailInJira: 'ana.n@totvs.com.br', message: null, status: 'PENDING', createdAt: '2026-10-17T12:00:00Z', decidedAt: null, decidedBy: null,
    decisionNote: null, kind: 'CONTRIBUTOR', requestedRoleName: 'Developer', canDecide: true,
  };

  it('pede o status e o limite, e normaliza nulos', async () => {
    authFetch.mockResolvedValue(json(200, [dto]));
    const [req] = await listSquadLinkRequests('DDWMISSI', 'APPROVED');
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/squads\/DDWMISSI\/link-requests\?status=APPROVED&size=200$/);
    expect(req).toMatchObject({ id: 'r1', kind: 'CONTRIBUTOR', requestedRoleName: 'Developer', canDecide: true, memberId: undefined, message: undefined });
  });

  it('padrão é PENDING; resposta que não é lista vira vazio', async () => {
    authFetch.mockResolvedValue(json(200, { x: 1 }));
    expect(await listSquadLinkRequests('X')).toEqual([]);
    expect(String(authFetch.mock.calls[0][0])).toContain('status=PENDING');
  });

  it('403 e 404 lançam ApiError com o status (404 = recurso indisponível)', async () => {
    authFetch.mockResolvedValue(json(403, { message: 'Sem poder' }));
    const forbidden = await listSquadLinkRequests('X').catch((e) => e);
    expect(forbidden).toBeInstanceOf(ApiError);
    expect(forbidden.status).toBe(403);
    expect(isSquadRequestsUnavailable(forbidden)).toBe(false);

    authFetch.mockResolvedValue(new Response('', { status: 404 }));
    expect(isSquadRequestsUnavailable(await listSquadLinkRequests('X').catch((e) => e))).toBe(true);
  });

  it('ignora itens sem id', () => {
    expect(normalizeSquadLinkRequest({ status: 'PENDING' })).toBeNull();
    expect(normalizeSquadLinkRequest(null)).toBeNull();
  });
});

describe('approve / reject', () => {
  it('approve faz POST na rota da squad', async () => {
    authFetch.mockResolvedValue(json(200, {}));
    await approveSquadLinkRequest('DDWMISSI', 'r1');
    const [url, init] = authFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/squads\/DDWMISSI\/link-requests\/r1\/approve$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('approve com a linha escolhida manda { memberId } no corpo', async () => {
    authFetch.mockResolvedValue(json(200, {}));
    await approveSquadLinkRequest('DDWMISSI', 'r1', 'm7');
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ memberId: 'm7' });
  });

  it('reject manda o motivo aparado, ou corpo vazio sem motivo', async () => {
    authFetch.mockResolvedValue(json(200, {}));
    await rejectSquadLinkRequest('X', 'r1', '  não é da squad ');
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ reason: 'não é da squad' });
    await rejectSquadLinkRequest('X', 'r1', '   ');
    expect(JSON.parse(authFetch.mock.calls[1][1].body)).toEqual({});
  });

  it('403, 409 e 404 lançam ApiError com o status e viram mensagens amigáveis', async () => {
    authFetch.mockResolvedValue(json(403, { message: 'Forbidden' }));
    const e403 = await approveSquadLinkRequest('X', 'r1').catch((e) => e);
    expect(e403.status).toBe(403);
    expect(decisionErrorMessage(e403)).toBe('Você não tem permissão para decidir este pedido.');

    authFetch.mockResolvedValue(json(409, { message: 'Esse pedido já foi decidido.' }));
    const e409 = await rejectSquadLinkRequest('X', 'r1').catch((e) => e);
    expect(e409.status).toBe(409);
    expect(decisionErrorMessage(e409)).toBe('Esse pedido já foi decidido.');

    authFetch.mockResolvedValue(json(404, { message: 'Not Found' }));
    expect(decisionErrorMessage(await approveSquadLinkRequest('X', 'r1').catch((e) => e))).toBe('Esse pedido não existe mais.');
  });

  it('mensagem de regra do servidor (próprio pedido) é preservada', () => {
    expect(decisionErrorMessage(new ApiError('Você não pode decidir o próprio pedido', 403))).toBe('Você não pode decidir o próprio pedido');
    expect(decisionErrorMessage(new ApiError('linha já ligada a outra conta', 409))).toBe('linha já ligada a outra conta');
    expect(decisionErrorMessage(new Error('boom'))).toBe('boom');
  });
});

describe('status CANCELLED', () => {
  it('normalize mantém CANCELLED (e status desconhecido segue virando PENDING)', () => {
    expect(normalizeSquadLinkRequest({ id: 'r1', status: 'CANCELLED' })?.status).toBe('CANCELLED');
    expect(normalizeSquadLinkRequest({ id: 'r1', status: 'OUTRO' })?.status).toBe('PENDING');
  });
});
