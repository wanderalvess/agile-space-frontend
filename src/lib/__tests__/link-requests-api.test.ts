import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { createLinkRequest, isLinkRequestUnavailable, listMyLinkRequests } from '../link-requests-api';
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
});
