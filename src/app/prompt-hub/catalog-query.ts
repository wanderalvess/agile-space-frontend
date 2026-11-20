import {
  filtersToParams,
  isServerPaged,
  promptApi,
  promptCollectionApi,
  publicPromptApi,
  type PromptFacets,
  type PromptListParams
} from './api';
import { legacyQuery } from './catalog-logic';
import type { SortKey } from './constants';
import type { CatalogFilters, PromptItem } from './types';

export interface CatalogRequest {
  filters: CatalogFilters;
  sort: SortKey;
  favoritesOnly: boolean;
  /** Só os itens da própria pessoa (aba "Meus itens"). */
  mineOnly: boolean;
  page: number;
  size: number;
  sessionId?: string | null;
  /** Sem login só existe a leitura pública. */
  anonymous: boolean;
}

export interface CatalogResponse {
  items: PromptItem[];
  total: number;
  totalPages: number;
  /** `server`: o servidor busca, filtra, ordena e pagina. `legacy`: o servidor antigo mandou tudo e o navegador fez o resto. */
  mode: 'server' | 'legacy';
  /** Contagens para os filtros atuais; `null` quando o servidor não as informa. */
  facets: PromptFacets | null;
}

/** Descoberto na primeira resposta e lembrado: evita testar o servidor a cada busca. */
let detectedMode: 'server' | 'legacy' | null = null;
let legacyCache: { key: string; items: PromptItem[]; collections: number | null } | null = null;

/** Chame depois de salvar, excluir, duplicar ou contar uso: o acervo guardado do servidor antigo fica velho. */
export function invalidateCatalogCache() {
  legacyCache = null;
}

/** Só para testes. */
export function resetCatalogDetection() {
  detectedMode = null;
  legacyCache = null;
}

function serverParams(req: CatalogRequest): PromptListParams {
  return {
    ...filtersToParams(req.filters),
    favorites: req.favoritesOnly,
    authorId: req.mineOnly ? req.sessionId || undefined : undefined,
    sort: req.sort,
    page: req.page,
    size: req.size,
  };
}

async function loadFacets(req: CatalogRequest): Promise<PromptFacets | null> {
  // As contagens por tipo ignoram o filtro de tipo, para os botões de tipo não zerarem ao serem clicados.
  const rest: PromptListParams = { ...serverParams(req), type: undefined };
  try {
    return req.anonymous ? await publicPromptApi.facets(rest) : await promptApi.facets(rest);
  } catch (err) {
    console.warn('[prompt-hub] contagens indisponíveis', err);
    return null;
  }
}

async function loadLegacyAll(req: CatalogRequest) {
  const key = req.anonymous ? 'anon' : String(req.sessionId);
  if (legacyCache && legacyCache.key === key) return legacyCache;

  const [shared, mine] = await Promise.all([
    req.anonymous ? publicPromptApi.listAll() : promptApi.listAll(),
    !req.anonymous && req.sessionId ? promptApi.listAll({ authorId: req.sessionId }) : Promise.resolve([] as PromptItem[]),
  ]);
  const map = new Map<string, PromptItem>();
  shared.forEach(item => map.set(item.id, item));
  mine.forEach(item => map.set(item.id, item));

  let collections: number | null = null;
  if (!req.anonymous) {
    try {
      const [publicOnes, own] = await Promise.all([
        promptCollectionApi.listAllCollections('public'),
        req.sessionId ? promptCollectionApi.listAllCollections(undefined, req.sessionId) : Promise.resolve([]),
      ]);
      collections = new Set([...publicOnes, ...own].map(c => c.id)).size;
    } catch {
      collections = null;
    }
  }
  legacyCache = { key, items: Array.from(map.values()), collections };
  return legacyCache;
}

/**
 * Uma página do catálogo. Com o servidor novo, uma chamada de lista e uma de contagens.
 * Com o servidor antigo (resposta sem `page`), carrega o acervo uma vez e faz o resto aqui.
 */
export async function fetchCatalog(req: CatalogRequest, localFavorites: Set<string>): Promise<CatalogResponse> {
  const runLegacy = async (): Promise<CatalogResponse> => {
    const all = await loadLegacyAll(req);
    const result = legacyQuery(
      all.items,
      req.filters,
      req.sort,
      req.page,
      req.size,
      { sessionId: req.sessionId || undefined, favoriteIds: localFavorites, favoritesOnly: req.favoritesOnly, mineOnly: req.mineOnly },
      all.collections
    );
    return { ...result, mode: 'legacy' };
  };

  if (detectedMode === 'legacy') return runLegacy();

  const params = serverParams(req);
  const [page, facets] = await Promise.all([
    req.anonymous ? publicPromptApi.listPage(params) : promptApi.listPage(params),
    detectedMode === 'server' ? loadFacets(req) : Promise.resolve<PromptFacets | null>(null),
  ]);

  if (!isServerPaged(page)) {
    detectedMode = 'legacy';
    return runLegacy();
  }

  detectedMode = 'server';
  return {
    items: page.content,
    total: page.totalElements,
    totalPages: page.totalPages,
    mode: 'server',
    facets: facets ?? (await loadFacets(req)),
  };
}
