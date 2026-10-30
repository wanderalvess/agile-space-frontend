import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { fetchCatalog, resetCatalogDetection, type CatalogRequest } from '../catalog-query';
import { DEFAULT_FILTERS } from '../catalog-logic';

function response(status: number, body?: unknown) {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    clone: () => res,
  };
  return res as unknown as Response;
}

const request = (over: Partial<CatalogRequest> = {}): CatalogRequest => ({
  filters: { ...DEFAULT_FILTERS },
  sort: 'recent',
  favoritesOnly: false,
  mineOnly: false,
  page: 0,
  size: 24,
  sessionId: 'me',
  anonymous: false,
  ...over,
});

const raw = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: `Item ${id}`,
  type: 'prompt',
  visibility: 'public',
  authorId: 'a',
  authorName: 'Ana',
  authorRole: '',
  authorSquad: '',
  useCount: 1,
  forkCount: 0,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

describe('catálogo: servidor novo e servidor antigo', () => {
  beforeEach(() => {
    authFetch.mockReset();
    resetCatalogDetection();
  });

  it('servidor novo: uma chamada de lista e outra de contagens (sem o filtro de tipo)', async () => {
    authFetch.mockImplementation(async (url: string) => {
      if (url.includes('/prompts/facets')) {
        return response(200, { total: 5, typeCounts: { prompt: 4, skill: 1 }, topTags: [{ tag: 'jira', count: 2 }], totals: { items: 5, copies: 10, collections: 2 } });
      }
      return response(200, { content: [raw('1', { favorite: true })], page: 0, size: 24, totalElements: 5, totalPages: 1 });
    });

    // A primeira consulta só descobre o modo; a contagem vem em seguida.
    const result = await fetchCatalog(request({ filters: { ...DEFAULT_FILTERS, type: 'skill', search: 'ref' } }), new Set());
    expect(result.mode).toBe('server');
    expect(result.total).toBe(5);
    expect(result.items[0].favorite).toBe(true);
    expect(result.facets?.typeCounts).toEqual({ prompt: 4, skill: 1 });

    const listUrl = authFetch.mock.calls.find(c => !String(c[0]).includes('/facets'))![0] as string;
    expect(listUrl).toContain('query=ref');
    expect(listUrl).toContain('type=skill');
    expect(listUrl).not.toContain('status=');
    expect(listUrl).toContain('sort=recent');
    const facetsUrl = authFetch.mock.calls.find(c => String(c[0]).includes('/facets'))![0] as string;
    expect(facetsUrl).not.toContain('type=');
    expect(facetsUrl).not.toContain('page=');
  });

  it('servidor novo sem a rota de contagens: a lista aparece e as contagens ficam vazias', async () => {
    authFetch.mockImplementation(async (url: string) =>
      url.includes('/facets') ? response(404) : response(200, { content: [raw('1')], page: 0, size: 24, totalElements: 1, totalPages: 1 })
    );
    const result = await fetchCatalog(request(), new Set());
    expect(result.mode).toBe('server');
    expect(result.facets).toBeNull();
  });

  it('servidor antigo: carrega o acervo e faz busca, filtro e página no navegador', async () => {
    authFetch.mockImplementation(async (url: string) => {
      if (url.includes('/prompts/collections')) return response(200, { content: [{ id: 'c1' }], number: 0, size: 200, totalElements: 1, totalPages: 1 });
      return response(200, { content: [raw('1', { title: 'Resumir issue' }), raw('2', { title: 'Revisar contrato' })], number: 0, size: 200, totalElements: 2, totalPages: 1 });
    });

    const result = await fetchCatalog(request({ filters: { ...DEFAULT_FILTERS, search: 'contrato' } }), new Set());
    expect(result.mode).toBe('legacy');
    expect(result.items.map(i => i.id)).toEqual(['2']);
    expect(result.total).toBe(1);
    expect(result.facets?.totals.items).toBe(2);

    // Segunda consulta: o acervo já está guardado, só as coleções e a lista não são pedidas de novo.
    const calls = authFetch.mock.calls.length;
    await fetchCatalog(request({ filters: { ...DEFAULT_FILTERS, search: 'issue' } }), new Set());
    expect(authFetch.mock.calls.length).toBe(calls);
  });

  it('servidor antigo: favoritos locais filtram a aba Favoritos', async () => {
    authFetch.mockImplementation(async () => response(200, { content: [raw('1'), raw('2')], number: 0, size: 200, totalElements: 2, totalPages: 1 }));
    const result = await fetchCatalog(request({ favoritesOnly: true }), new Set(['2']));
    expect(result.items.map(i => i.id)).toEqual(['2']);
  });
});
