import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { publicPromptApi, promptApi, ApiError, buildListQuery, filtersOnly, isServerPaged } from '../api';

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

    expect(fetchMock.mock.calls[0][0]).toContain('/public/prompt-hub/items?sort=recent&page=0&size=50');
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

describe('listagem com busca, filtros, ordem e página no servidor', () => {
  beforeEach(() => authFetch.mockReset());

  it('monta os parâmetros do contrato e não manda os que estão no padrão', () => {
    expect(buildListQuery({})).toBe('sort=recent&page=0&size=24');
    expect(
      buildListQuery({ query: 'refinamento', type: 'skill', visibility: 'private', status: 'all', impact: 'alto', tag: 'jira', favorites: true, authorId: 'u1', sort: 'cloned', page: 2, size: 24 })
    ).toBe('query=refinamento&type=skill&visibility=private&status=all&impact=alto&tag=jira&favorites=true&authorId=u1&sort=cloned&page=2&size=24');
    expect(buildListQuery({ favorites: false })).not.toContain('favorites');
  });

  it('as contagens recebem só os filtros, sem página nem ordem', () => {
    const only = filtersOnly({ query: 'a', sort: 'used', page: 3, size: 24, type: 'gem' });
    expect(buildListQuery(only, { paged: false })).toBe('query=a&type=gem');
  });

  it('reconhece o servidor novo pelo campo "page" e normaliza os itens', async () => {
    authFetch.mockResolvedValue(
      response(200, { content: [{ id: 'a', title: 'T', visibility: 'squad', tags: null, favorite: true, canEdit: true }], page: 0, size: 24, totalElements: 1, totalPages: 1 })
    );
    const page = await promptApi.listPage({ query: 'x' });
    expect(authFetch.mock.calls[0][0]).toContain('/prompts?query=x&sort=recent&page=0&size=24');
    expect(isServerPaged(page)).toBe(true);
    expect(page.content[0]).toMatchObject({ visibility: 'private', tags: [], favorite: true, canEdit: true });
  });

  it('o servidor antigo (campo "number") não conta como paginado no servidor', async () => {
    authFetch.mockResolvedValue(response(200, { content: [], number: 0, size: 24, totalElements: 0, totalPages: 0 }));
    expect(isServerPaged(await promptApi.listPage())).toBe(false);
  });

  it('contagens: rota ausente devolve null; outro erro é erro', async () => {
    authFetch.mockResolvedValueOnce(response(404));
    expect(await promptApi.facets({ query: 'x' })).toBeNull();
    authFetch.mockResolvedValueOnce(response(500));
    await expect(promptApi.facets()).rejects.toMatchObject({ status: 500 });
    authFetch.mockResolvedValueOnce(response(200, { total: 3, typeCounts: { prompt: 3 }, topTags: [], totals: { items: 3, copies: 9, collections: 1 } }));
    expect(await promptApi.facets()).toMatchObject({ total: 3 });
  });

  it('favoritar usa POST e desfavoritar usa DELETE', async () => {
    authFetch.mockResolvedValueOnce(response(200, { favorite: true }));
    expect(await promptApi.setFavorite('p1', true)).toBe(true);
    expect(authFetch.mock.calls[0][0]).toContain('/prompts/p1/favorite');
    expect(authFetch.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    authFetch.mockResolvedValueOnce(response(200, { favorite: false }));
    expect(await promptApi.setFavorite('p1', false)).toBe(false);
    expect(authFetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });

  it('versões e uso chamam as rotas do contrato', async () => {
    authFetch.mockResolvedValueOnce(response(200, [{ versionNumber: 2, title: 'T', changedAt: '', current: true }]));
    expect(await promptApi.listVersions('p1')).toHaveLength(1);
    expect(authFetch.mock.calls[0][0]).toContain('/prompts/p1/versions');
    authFetch.mockResolvedValueOnce(response(200, { versionNumber: 1, title: 'Antiga', changedAt: '', current: false }));
    await promptApi.getVersion('p1', 1);
    expect(authFetch.mock.calls[1][0]).toContain('/prompts/p1/versions/1');
    authFetch.mockResolvedValueOnce(response(200, { id: 'p1', title: 'Antiga' }));
    await promptApi.restoreVersion('p1', 1);
    expect(authFetch.mock.calls[2][0]).toContain('/prompts/p1/versions/1/restore');
    expect(authFetch.mock.calls[2][1]).toMatchObject({ method: 'POST' });
    authFetch.mockResolvedValueOnce(response(200, [{ weekStart: '2026-10-12', uses: 3, clones: 1 }]));
    await promptApi.usage('p1', 8);
    expect(authFetch.mock.calls[3][0]).toContain('/prompts/p1/usage?weeks=8');
  });

  it('rota de versões ausente vira ApiError 404 (a tela esconde o cartão)', async () => {
    authFetch.mockResolvedValue(response(404));
    await expect(promptApi.listVersions('p1')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('importação em lote', () => {
  beforeEach(() => authFetch.mockReset());

  it('se o lote falha, cai para item a item e informa o que não passou', async () => {
    authFetch
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(200, { id: '1', title: 'Skill', type: 'skill' }))
      .mockResolvedValueOnce(response(400));
    const skill = { title: 'Skill', type: 'skill' as const };
    const recurso = { title: 'Recurso', type: 'resource' as const };
    const { created, failures } = await promptApi.createPromptsBatch([skill, recurso]);
    expect(authFetch.mock.calls[1][0]).toContain('/prompts/skill-upsert');
    expect(authFetch.mock.calls[2][0]).toMatch(/\/prompts$/);
    expect(created.map(c => c.id)).toEqual(['1']);
    expect(failures).toHaveLength(1);
    expect(failures[0].prompt).toBe(recurso);
  });
});
