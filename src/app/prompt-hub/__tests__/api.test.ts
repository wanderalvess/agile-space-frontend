import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { publicPromptApi, promptApi, ApiError } from '../api';

function response(status: number, body?: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body);
  const res = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (text ? JSON.parse(text) : undefined),
    clone: () => res,
  };
  return res as unknown as Response;
}

describe('publicPromptApi (leitura sem login)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    authFetch.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('usa a rota pública sem token e nunca o authFetch', async () => {
    fetchMock.mockResolvedValue(
      response(200, { content: [{ id: 'a', title: 'T', type: 'prompt', tags: null }], totalPages: 1, totalElements: 1, size: 50, number: 0 })
    );

    const items = await publicPromptApi.listAll();

    expect(fetchMock.mock.calls[0][0]).toContain('/public/prompt-hub/items?page=0&size=50');
    expect(fetchMock.mock.calls[0][1]).toBeUndefined();
    expect(authFetch).not.toHaveBeenCalled();
    expect(items[0]).toMatchObject({ id: 'a', visibility: 'public', authorId: '', tags: [] });
  });

  it('percorre todas as páginas', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, { content: [{ id: '1' }], totalPages: 2, totalElements: 2, size: 1, number: 0 }))
      .mockResolvedValueOnce(response(200, { content: [{ id: '2' }], totalPages: 2, totalElements: 2, size: 1, number: 1 }));

    const items = await publicPromptApi.listAll(1);

    expect(items.map(i => i.id)).toEqual(['1', '2']);
  });

  it('item privado ou inexistente vira ApiError 404', async () => {
    fetchMock.mockResolvedValue(response(404));
    await expect(publicPromptApi.get('x')).rejects.toBeInstanceOf(ApiError);
    await expect(publicPromptApi.get('x')).rejects.toMatchObject({ status: 404 });
  });
});

describe('promptApi erros', () => {
  beforeEach(() => authFetch.mockReset());

  it('explica 403 e 400 em português com o status preservado', async () => {
    authFetch.mockResolvedValueOnce(response(403));
    await expect(promptApi.deletePrompt('x')).rejects.toMatchObject({ status: 403, message: expect.stringContaining('permissão') });
    authFetch.mockResolvedValueOnce(response(400));
    await expect(promptApi.createPrompt({})).rejects.toMatchObject({ status: 400, message: expect.stringContaining('tamanho') });
  });
});
