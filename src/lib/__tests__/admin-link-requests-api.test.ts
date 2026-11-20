import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LinkRequestsApiError,
  approveLinkRequest,
  isLinkRequestsUnavailable,
  listLinkRequests,
  rejectLinkRequest,
} from '../admin-link-requests-api';

const fetchMock = vi.fn();

function reply(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('sem corpo');
      return body;
    },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('listLinkRequests', () => {
  it('sem filtro chama /admin/link-requests e devolve o array', async () => {
    reply(200, [{ id: '1' }]);
    expect(await listLinkRequests()).toEqual([{ id: '1' }]);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/admin\/link-requests$/);
  });

  it('com status manda ?status=', async () => {
    reply(200, []);
    await listLinkRequests('PENDING');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/admin\/link-requests\?status=PENDING$/);
  });

  it('resposta que não é array vira lista vazia', async () => {
    reply(200, { x: 1 });
    expect(await listLinkRequests()).toEqual([]);
  });

  it('404 e 405 contam como "ainda não disponível"; outros erros não', async () => {
    reply(404, { message: 'Not Found' });
    const notFound = await listLinkRequests().catch((e) => e);
    reply(405);
    const notAllowed = await listLinkRequests().catch((e) => e);
    reply(500, { message: 'Falha interna' });
    const failed = await listLinkRequests().catch((e) => e);
    expect(isLinkRequestsUnavailable(notFound)).toBe(true);
    expect(isLinkRequestsUnavailable(notAllowed)).toBe(true);
    expect(isLinkRequestsUnavailable(failed)).toBe(false);
    expect(failed).toBeInstanceOf(LinkRequestsApiError);
    expect(failed.message).toBe('Falha interna');
    expect(isLinkRequestsUnavailable(new Error('x'))).toBe(false);
  });
});

describe('approveLinkRequest / rejectLinkRequest', () => {
  it('aprovar faz POST em /approve com o id codificado', async () => {
    reply(204);
    await approveLinkRequest('a/b');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/admin\/link-requests\/a%2Fb\/approve$/);
    expect(init.method).toBe('POST');
  });

  it('recusar manda o motivo aparado no corpo; sem motivo manda {}', async () => {
    reply(204);
    await rejectLinkRequest('7', '  e-mail não confere  ');
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ reason: 'e-mail não confere' }));
    reply(204);
    await rejectLinkRequest('7', '   ');
    expect(fetchMock.mock.calls[1][1].body).toBe('{}');
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/admin\/link-requests\/7\/reject$/);
  });

  it('erro do servidor vira exceção com a mensagem dele', async () => {
    reply(409, { message: 'Pedido já decidido' });
    await expect(approveLinkRequest('7')).rejects.toThrow('Pedido já decidido');
    reply(500);
    await expect(rejectLinkRequest('7')).rejects.toThrow('Não foi possível recusar o pedido.');
  });
});
