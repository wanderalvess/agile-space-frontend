import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { cancelLinkRequest, createLinkRequest, isLinkRequestUnavailable, listMyLinkRequests } from '../link-requests-api';
import { ApiError } from '../api-error';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('pedido de vínculo (cliente)', () => {
  beforeEach(() => authFetch.mockReset());

  it('envia POST /link-requests com o corpo enxuto', async () => {
    authFetch.mockResolvedValue(json(201, { id: 'r1', status: 'PENDING' }));
    const created = await createLinkRequest({ projectKey: 'DDWMISSI', memberId: 'm1', emailInJira: ' elisa@parceiro.com ', message: '  uso outro e-mail ' });
    expect(created).toEqual({ id: 'r1', status: 'PENDING' });
    const [url, init] = authFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/link-requests$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ projectKey: 'DDWMISSI', memberId: 'm1', emailInJira: 'elisa@parceiro.com', message: 'uso outro e-mail' });
  });

  it('omite memberId e mensagem vazios', async () => {
    authFetch.mockResolvedValue(json(201, { id: 'r2', status: 'PENDING' }));
    await createLinkRequest({ projectKey: 'DDWMISSI', emailInJira: 'a@x.com', message: '   ' });
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ projectKey: 'DDWMISSI', emailInJira: 'a@x.com' });
  });

  it('sem linha na lista: manda kind CONTRIBUTOR e requestedRoleName', async () => {
    authFetch.mockResolvedValue(json(201, { id: 'r3', status: 'PENDING' }));
    await createLinkRequest({ projectKey: 'DDWMISSI', emailInJira: 'a@x.com', kind: 'CONTRIBUTOR', requestedRoleName: ' QA ' });
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ projectKey: 'DDWMISSI', emailInJira: 'a@x.com', kind: 'CONTRIBUTOR', requestedRoleName: 'QA' });
  });

  it('com memberId o papel não vai (o servidor recusa memberId + requestedRoleName)', async () => {
    authFetch.mockResolvedValue(json(201, { id: 'r4', status: 'PENDING' }));
    await createLinkRequest({ projectKey: 'DDWMISSI', memberId: 'm1', emailInJira: 'a@x.com', requestedRoleName: 'QA' });
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ projectKey: 'DDWMISSI', memberId: 'm1', emailInJira: 'a@x.com' });
  });

  it('404 e 405 viram "ainda não está disponível"', async () => {
    for (const status of [404, 405]) {
      authFetch.mockResolvedValue(new Response('', { status }));
      const err = await createLinkRequest({ projectKey: 'X', emailInJira: 'a@x.com' }).catch((e) => e);
      expect(isLinkRequestUnavailable(err)).toBe(true);
      expect(err.message).toBe('Pedido de vínculo ainda não está disponível');
    }
  });

  it('outro erro traz a mensagem do servidor e o status', async () => {
    authFetch.mockResolvedValue(json(409, { message: 'Já existe um pedido pendente' }));
    const err = await createLinkRequest({ projectKey: 'X', emailInJira: 'a@x.com' }).catch((e) => e);
    expect(isLinkRequestUnavailable(err)).toBe(false);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Já existe um pedido pendente');
    expect(err.status).toBe(409);
  });

  it('lista os meus pedidos', async () => {
    const rows = [{ id: 'r1', projectKey: 'DDWMISSI', emailInJira: 'a@x.com', status: 'PENDING', createdAt: '2026-10-15T10:00:00Z' }];
    authFetch.mockResolvedValue(json(200, rows));
    expect(await listMyLinkRequests()).toEqual(rows);
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/link-requests\/mine$/);
  });

  it('sem o recurso no servidor, a lista vem vazia; resposta torta também', async () => {
    authFetch.mockResolvedValue(new Response('', { status: 404 }));
    expect(await listMyLinkRequests()).toEqual([]);
    authFetch.mockResolvedValue(json(200, { nao: 'é lista' }));
    expect(await listMyLinkRequests()).toEqual([]);
  });

  it('erro de servidor na lista é lançado', async () => {
    authFetch.mockResolvedValue(json(500, { message: 'boom' }));
    await expect(listMyLinkRequests()).rejects.toThrow('boom');
  });

  describe('cancelLinkRequest', () => {
    it('200: POST /link-requests/{id}/cancel sem corpo e devolve o pedido CANCELLED', async () => {
      const row = { id: 'r1', projectKey: 'DDWMISSI', emailInJira: 'a@x.com', status: 'CANCELLED', createdAt: '2026-10-17T12:00:00Z', decidedAt: '2026-10-17T12:05:00Z' };
      authFetch.mockResolvedValue(json(200, row));
      expect(await cancelLinkRequest('r1')).toEqual(row);
      const [url, init] = authFetch.mock.calls[0];
      expect(String(url)).toMatch(/\/link-requests\/r1\/cancel$/);
      expect(init.method).toBe('POST');
      expect(init.body).toBeUndefined();
    });

    it('codifica o id na URL', async () => {
      authFetch.mockResolvedValue(json(200, {}));
      await cancelLinkRequest('a/b');
      expect(String(authFetch.mock.calls[0][0])).toMatch(/\/link-requests\/a%2Fb\/cancel$/);
    });

    it.each([
      [403, 'Só quem fez o pedido pode cancelá-lo.'],
      [404, 'Esse pedido não existe mais.'],
      [409, 'Esse pedido já foi decidido.'],
    ])('%i vira ApiError com texto amigável (404 não é "indisponível")', async (status, message) => {
      authFetch.mockResolvedValue(json(status, { message: 'texto cru do servidor' }));
      const err = await cancelLinkRequest('r1').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(isLinkRequestUnavailable(err)).toBe(false);
      expect(err.status).toBe(status);
      expect(err.message).toBe(message);
    });

    it('outro erro usa a mensagem do servidor, ou um texto fixo', async () => {
      authFetch.mockResolvedValue(json(500, { message: 'boom' }));
      expect((await cancelLinkRequest('r1').catch((e) => e)).message).toBe('boom');
      authFetch.mockResolvedValue(new Response('', { status: 500 }));
      expect((await cancelLinkRequest('r1').catch((e) => e)).message).toBe('Não foi possível cancelar o pedido (500)');
    });
  });
});
