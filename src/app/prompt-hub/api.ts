import type {
  CatalogFilters,
  PromptComment,
  PromptItem,
  PromptType,
  PromptVersionDetail,
  PromptVersionSummary,
  StatusFilter,
  UsageWeek
} from './types';
import type { SortKey } from './constants';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/** Erro de API que preserva o status HTTP para a tela decidir a mensagem (login, permissão, limite de tamanho). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Algum campo está vazio ou passou do tamanho permitido.',
  401: 'Entre na sua conta para continuar.',
  403: 'Você não tem permissão para fazer isso.',
  404: 'Item não encontrado, ou você não tem acesso a ele.',
};

/** Monta um erro legível: usa o motivo do servidor quando existe e cai numa frase por status. */
async function apiError(res: Response, fallback: string): Promise<ApiError> {
  let detail = '';
  try {
    const body = await res.clone().json();
    detail = typeof body?.message === 'string' ? body.message : '';
  } catch {
    // corpo vazio ou não JSON
  }
  const reason = detail || STATUS_MESSAGES[res.status] || `Erro ${res.status}`;
  return new ApiError(`${fallback}: ${reason}`, res.status);
}

/** A rota não existe neste servidor (backend antigo): a tela esconde o recurso em vez de quebrar. */
export const isMissingRoute = (err: unknown): boolean =>
  err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501);

/**
 * Página como o servidor devolve. O servidor novo manda `page`; o antigo mandava `number`.
 * É essa diferença que diz se busca, filtro, ordem e paginação já acontecem no servidor.
 */
export interface PageResponse<T> {
  content: T[];
  page?: number;
  number?: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const isServerPaged = (page: Pick<PageResponse<unknown>, 'page'>): boolean => typeof page.page === 'number';

/** Filtros aceitos por GET /api/prompts (todos opcionais; sem nenhum, vale o formato antigo). */
export interface PromptListParams {
  query?: string;
  type?: PromptType;
  visibility?: 'all' | 'public' | 'private';
  /** Ausente = tudo menos arquivados; `all` = todas as situações. */
  status?: StatusFilter;
  impact?: string;
  tag?: string;
  favorites?: boolean;
  authorId?: string;
  sort?: SortKey;
  page?: number;
  size?: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

/** Números do catálogo para os filtros atuais (contagem por tipo, etiquetas mais usadas e totais do topo). */
export interface PromptFacets {
  total: number;
  typeCounts: Partial<Record<PromptType, number>>;
  topTags: TagCount[];
  totals: { items: number; copies: number; collections: number };
}

/** Traduz os filtros da tela para os parâmetros do servidor. Valores padrão não são enviados. */
export function filtersToParams(filters: CatalogFilters): PromptListParams {
  return {
    query: filters.search.trim() || undefined,
    type: filters.type === 'all' ? undefined : filters.type,
    visibility: filters.visibility === 'all' ? undefined : filters.visibility,
    // Servidor novo: sem `status` esconde os arquivados; `status=all` traz tudo.
    status: filters.status === 'active' ? undefined : filters.status,
    impact: filters.impact === 'all' ? undefined : filters.impact,
    tag: filters.tag || undefined,
  };
}

export function buildListQuery(params: PromptListParams, options: { paged?: boolean } = {}): string {
  const search = new URLSearchParams();
  const put = (key: string, value: string | number | boolean | undefined | null) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  };
  put('query', params.query);
  put('type', params.type);
  put('visibility', params.visibility);
  put('status', params.status);
  put('impact', params.impact);
  put('tag', params.tag);
  if (params.favorites) put('favorites', true);
  put('authorId', params.authorId);
  if (options.paged !== false) {
    // `sort` sempre vai: com ele (ou qualquer filtro) o servidor usa o formato novo; só `page` e `size` o antigo também recebe.
    put('sort', params.sort ?? 'recent');
    put('page', params.page ?? 0);
    put('size', params.size ?? 24);
  }
  return search.toString();
}

/** Só os filtros (sem página, tamanho nem ordem): é o que a rota de contagens aceita. */
export function filtersOnly(params: PromptListParams): PromptListParams {
  return {
    query: params.query,
    type: params.type,
    visibility: params.visibility,
    status: params.status,
    impact: params.impact,
    tag: params.tag,
    favorites: params.favorites,
    authorId: params.authorId,
  };
}

/** Garante os campos que a tela lê, qualquer que seja a versão do servidor. */
export function normalizeItem(raw: Partial<PromptItem> & { id: string }): PromptItem {
  return {
    ...raw,
    title: raw.title ?? '',
    type: raw.type ?? 'prompt',
    visibility: raw.visibility === 'public' ? 'public' : 'private',
    authorId: raw.authorId ?? '',
    authorName: raw.authorName ?? '',
    authorRole: raw.authorRole ?? '',
    authorSquad: raw.authorSquad ?? '',
    useCount: raw.useCount ?? 0,
    forkCount: raw.forkCount ?? 0,
    tags: raw.tags ?? [],
    createdAt: raw.createdAt ?? '',
  };
}

const normalizePage = (body: PageResponse<PromptItem>): PageResponse<PromptItem> => ({
  ...body,
  content: (body.content ?? []).map(normalizeItem),
});

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const promptApi = {
  async listPage(params: PromptListParams = {}): Promise<PageResponse<PromptItem>> {
    const res = await authFetch(`${API_BASE_URL}/prompts?${buildListQuery(params)}`);
    if (!res.ok) throw await apiError(res, 'Falha ao listar os itens');
    return normalizePage(await res.json());
  },

  /** Busca todas as páginas (até um teto). Serve a telas que precisam do acervo inteiro, como o editor de coleção. */
  async listAll(params: PromptListParams = {}, pageSize = 200, maxPages = 10): Promise<PromptItem[]> {
    const all: PromptItem[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      const res = await promptApi.listPage({ ...params, page, size: pageSize });
      all.push(...res.content);
      if (page + 1 >= res.totalPages) break;
    }
    return all;
  },

  /** Contagens para os filtros atuais. `null` quando o servidor ainda não tem a rota. */
  async facets(params: PromptListParams = {}): Promise<PromptFacets | null> {
    const res = await authFetch(`${API_BASE_URL}/prompts/facets?${buildListQuery(filtersOnly(params), { paged: false })}`);
    if (isMissingRoute(new ApiError('', res.status))) return null;
    if (!res.ok) throw await apiError(res, 'Falha ao contar os itens');
    return res.json();
  },

  async getPromptById(id: string): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar o item');
    return normalizeItem(await res.json());
  },

  async createPrompt(prompt: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(prompt),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao criar o item');
    return normalizeItem(await res.json());
  },

  async saveOrUpdateSkill(prompt: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/skill-upsert`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(prompt),
    });
    if (!res.ok) throw await apiError(res, `Falha ao importar "${prompt.title || 'skill'}"`);
    return normalizeItem(await res.json());
  },

  /**
   * Cria vários itens de uma vez. Se o lote falhar, cai para item a item (skill por upsert, para
   * a importação poder ser repetida sem duplicar). Devolve o que entrou e o que não passou, por arquivo.
   */
  async createPromptsBatch(prompts: Partial<PromptItem>[]): Promise<{ created: PromptItem[]; failures: BatchFailure[] }> {
    try {
      const res = await authFetch(`${API_BASE_URL}/prompts/batch`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(prompts),
      });
      if (res.ok) {
        const created: PromptItem[] = await res.json();
        return { created: created.map(normalizeItem), failures: [] };
      }
      console.warn(`[promptApi] POST /prompts/batch retornou ${res.status}, tentando item a item`);
    } catch (err) {
      console.warn('[promptApi] POST /prompts/batch falhou (rede), tentando item a item:', err);
    }
    return promptApi.createOneByOne(prompts);
  },

  /** Importa item a item, sem derrubar o resto quando um falha. */
  async createOneByOne(prompts: Partial<PromptItem>[]): Promise<{ created: PromptItem[]; failures: BatchFailure[] }> {
    const created: PromptItem[] = [];
    const failures: BatchFailure[] = [];
    for (const prompt of prompts) {
      try {
        created.push(prompt.type === 'skill' ? await promptApi.saveOrUpdateSkill(prompt) : await promptApi.createPrompt(prompt));
      } catch (err) {
        failures.push({ prompt, error: err instanceof Error ? err.message : 'erro desconhecido' });
      }
    }
    return { created, failures };
  },

  async updatePrompt(id: string, prompt: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(prompt),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao atualizar o item');
    return normalizeItem(await res.json());
  },

  async deletePrompt(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw await apiError(res, 'Falha ao excluir o item');
  },

  async usePrompt(id: string): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}/use`, { method: 'POST' });
    if (!res.ok) throw await apiError(res, 'Falha ao contar o uso');
    return normalizeItem(await res.json());
  },

  /** Duplica para a biblioteca privada de quem chama e conta a duplicação, numa única operação no servidor. */
  async clonePrompt(id: string, authorSnapshot: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}/clone`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(authorSnapshot),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao duplicar o item');
    return normalizeItem(await res.json());
  },

  /** Favorito guardado na conta (servidor novo). Devolve o estado final. */
  async setFavorite(id: string, favorite: boolean): Promise<boolean> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}/favorite`, {
      method: favorite ? 'POST' : 'DELETE',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao atualizar o favorito');
    try {
      const body = await res.json();
      return typeof body?.favorite === 'boolean' ? body.favorite : favorite;
    } catch {
      return favorite;
    }
  },

  async listVersions(id: string): Promise<PromptVersionSummary[]> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}/versions`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar as versões');
    return res.json();
  },

  async getVersion(id: string, versionNumber: number): Promise<PromptVersionDetail> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}/versions/${versionNumber}`);
    if (!res.ok) throw await apiError(res, 'Falha ao abrir a versão');
    return res.json();
  },

  async restoreVersion(id: string, versionNumber: number): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}/versions/${versionNumber}/restore`, {
      method: 'POST',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao restaurar a versão');
    return normalizeItem(await res.json());
  },

  async usage(id: string, weeks = 8): Promise<UsageWeek[]> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(id)}/usage?weeks=${weeks}`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar o uso');
    return res.json();
  },

  async deleteComment(promptId: string, commentId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(promptId)}/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao remover o comentário');
  },

  async getComments(promptId: string): Promise<PromptComment[]> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(promptId)}/comments`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar os comentários');
    return res.json();
  },

  async addComment(promptId: string, comment: Partial<PromptComment>): Promise<PromptComment> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${encodeURIComponent(promptId)}/comments`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(comment),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao adicionar o comentário');
    return res.json();
  },
};

export interface BatchFailure {
  prompt: Partial<PromptItem>;
  error: string;
}

/** Item como a leitura anônima o devolve: sem authorId nem qualquer identificador interno. */
type PublicPromptDTO = Omit<PromptItem, 'authorId' | 'visibility'>;

const fromPublic = (dto: PublicPromptDTO): PromptItem =>
  normalizeItem({ ...dto, authorId: '', visibility: 'public' });

/**
 * Leitura sem login (`/api/public/prompt-hub`): só itens públicos, só GET. Usa fetch puro, sem token.
 * Qualquer escrita, comentário, coleção ou item privado continua exigindo login.
 */
export const publicPromptApi = {
  async listPage(params: PromptListParams = {}): Promise<PageResponse<PromptItem>> {
    // Visibilidade e favoritos não existem sem login.
    const rest = { ...params, visibility: undefined, favorites: undefined };
    const res = await fetch(`${API_BASE_URL}/public/prompt-hub/items?${buildListQuery({ size: 50, ...rest })}`);
    if (!res.ok) throw await apiError(res, 'Falha ao listar a biblioteca pública');
    const body: PageResponse<PublicPromptDTO> = await res.json();
    return { ...body, content: (body.content ?? []).map(fromPublic) };
  },

  async listAll(pageSize = 50, maxPages = 20): Promise<PromptItem[]> {
    const all: PromptItem[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      const res = await publicPromptApi.listPage({ page, size: pageSize });
      all.push(...res.content);
      if (page + 1 >= res.totalPages) break;
    }
    return all;
  },

  async facets(params: PromptListParams = {}): Promise<PromptFacets | null> {
    const filters = { ...filtersOnly(params), visibility: undefined, favorites: undefined };
    const res = await fetch(`${API_BASE_URL}/public/prompt-hub/facets?${buildListQuery(filters, { paged: false })}`);
    if (isMissingRoute(new ApiError('', res.status))) return null;
    if (!res.ok) throw await apiError(res, 'Falha ao contar os itens');
    return res.json();
  },

  async get(id: string): Promise<PromptItem> {
    const res = await fetch(`${API_BASE_URL}/public/prompt-hub/items/${encodeURIComponent(id)}`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar o item');
    return fromPublic(await res.json());
  },
};

/**
 * Formato retornado pelo backend para uma Coleção — os itens já vêm embutidos
 * (join `ManyToMany`), não há subcoleção separada para buscar à parte.
 */
export interface PromptCollectionDTO {
  id: string;
  name: string;
  description?: string;
  visibility: string;
  ownerId: string;
  ownerName: string;
  items: PromptItem[];
  createdAt: string;
  /** Só quando o servidor informa. */
  updatedAt?: string;
  /** Itens que a pessoa não pode ver (privados de outras pessoas), quando o servidor já os conta. */
  hiddenCount?: number;
  /** Total de itens da trilha, visíveis ou não, quando o servidor informa. */
  itemCount?: number;
  /** Esta pessoa pode editar e excluir a coleção (dona ou administradora). */
  canEdit?: boolean;
}

/** Payload de criação/atualização: os itens só precisam trazer o `id`, o backend resolve o resto. */
export interface PromptCollectionPayload {
  name?: string;
  description?: string;
  visibility?: string;
  ownerId?: string;
  ownerName?: string;
  items?: { id: string }[];
}

export const promptCollectionApi = {
  async listCollections(
    visibility?: string,
    ownerId?: string,
    page = 0,
    size = 50
  ): Promise<PageResponse<PromptCollectionDTO>> {
    const params = new URLSearchParams();
    if (visibility) params.append('visibility', visibility);
    if (ownerId) params.append('ownerId', ownerId);
    params.append('page', page.toString());
    params.append('size', size.toString());

    const res = await authFetch(`${API_BASE_URL}/prompts/collections?${params.toString()}`);
    if (!res.ok) throw await apiError(res, 'Falha ao listar as coleções');
    return res.json();
  },

  /** Todas as páginas (até um teto), para a tela de coleções não ficar truncada. */
  async listAllCollections(visibility?: string, ownerId?: string, pageSize = 200, maxPages = 10): Promise<PromptCollectionDTO[]> {
    const all: PromptCollectionDTO[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      const res = await promptCollectionApi.listCollections(visibility, ownerId, page, pageSize);
      all.push(...res.content);
      if (page + 1 >= res.totalPages) break;
    }
    return all;
  },

  async getCollection(id: string): Promise<PromptCollectionDTO> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections/${encodeURIComponent(id)}`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar a coleção');
    return res.json();
  },

  async createCollection(data: PromptCollectionPayload): Promise<PromptCollectionDTO> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao criar a coleção');
    return res.json();
  },

  async updateCollection(id: string, data: PromptCollectionPayload): Promise<PromptCollectionDTO> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao atualizar a coleção');
    return res.json();
  },

  async deleteCollection(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw await apiError(res, 'Falha ao remover a coleção');
  },
};

/**
 * Leitura anônima de coleções públicas (`/api/public/prompt-hub/collections`). Se o servidor ainda não
 * tem a rota, devolve `null` e a tela pede o login em vez de mostrar erro.
 */
export const publicCollectionApi = {
  async list(): Promise<PromptCollectionDTO[] | null> {
    const res = await fetch(`${API_BASE_URL}/public/prompt-hub/collections?page=0&size=200`);
    if (res.status === 401 || res.status === 403 || isMissingRoute(new ApiError('', res.status))) return null;
    if (!res.ok) throw await apiError(res, 'Falha ao listar as coleções públicas');
    const body = await res.json();
    const content: PromptCollectionDTO[] = Array.isArray(body) ? body : (body.content ?? []);
    return content.map(c => ({ ...c, items: (c.items ?? []).map(fromPublicItem) }));
  },

  async get(id: string): Promise<PromptCollectionDTO | null> {
    const res = await fetch(`${API_BASE_URL}/public/prompt-hub/collections/${encodeURIComponent(id)}`);
    if (res.status === 401 || res.status === 403 || isMissingRoute(new ApiError('', res.status))) return null;
    if (!res.ok) throw await apiError(res, 'Falha ao carregar a coleção');
    const c: PromptCollectionDTO = await res.json();
    return { ...c, items: (c.items ?? []).map(fromPublicItem) };
  },
};

const fromPublicItem = (item: PromptItem): PromptItem => normalizeItem({ ...item, authorId: item.authorId ?? '', visibility: 'public' });
