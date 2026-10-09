import { PromptItem, PromptComment } from './types';
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

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

export const promptApi = {
  async listPrompts(query?: string, authorId?: string, page = 0, size = 50): Promise<PageResponse<PromptItem>> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (authorId) params.append('authorId', authorId);
    params.append('page', page.toString());
    params.append('size', size.toString());

    const res = await authFetch(`${API_BASE_URL}/prompts?${params.toString()}`);
    if (!res.ok) throw await apiError(res, 'Falha ao listar prompts');
    return res.json();
  },

  /** Busca todas as páginas (até um teto) para o catálogo não ficar truncado no primeiro lote. */
  async listAllPrompts(authorId?: string, pageSize = 200, maxPages = 10): Promise<PromptItem[]> {
    const all: PromptItem[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      const res = await promptApi.listPrompts(undefined, authorId, page, pageSize);
      all.push(...res.content);
      if (page + 1 >= res.totalPages) break;
    }
    return all;
  },

  async getPromptById(id: string): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar o prompt');
    return res.json();
  },

  async createPrompt(prompt: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao criar o prompt');
    return res.json();
  },

  async saveOrUpdateSkill(prompt: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/skill-upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    if (!res.ok) throw await apiError(res, `Falha ao importar "${prompt.title || 'skill'}"`);
    return res.json();
  },

  async createPromptsBatch(prompts: Partial<PromptItem>[]): Promise<PromptItem[]> {
    try {
      const res = await authFetch(`${API_BASE_URL}/prompts/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompts),
      });
      if (res.ok) {
        return res.json();
      }
      console.warn(`[promptApi] POST /prompts/batch retornou ${res.status}, tentando item a item`);
    } catch (err) {
      console.warn('[promptApi] POST /prompts/batch falhou (rede), tentando item a item:', err);
    }

    // Fallback item a item — mantém upsert por autor+título pra skill (idempotência),
    // e reporta falhas em vez de engolir silenciosamente.
    const results: PromptItem[] = [];
    const failures: { title?: string; error: string }[] = [];
    for (const prompt of prompts) {
      try {
        const created = prompt.type === 'skill'
          ? await promptApi.saveOrUpdateSkill(prompt)
          : await promptApi.createPrompt(prompt);
        results.push(created);
      } catch (err: any) {
        failures.push({ title: prompt.title, error: err?.message || 'erro desconhecido' });
      }
    }

    if (failures.length > 0) {
      const details = failures.map(f => `${f.title || 'sem título'}: ${f.error}`).join('; ');
      throw new Error(`${results.length} de ${prompts.length} importados. Falhas — ${details}`);
    }

    return results;
  },

  async updatePrompt(id: string, prompt: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao atualizar o prompt');
    return res.json();
  },

  async deletePrompt(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao deletar o prompt');
  },

  async usePrompt(id: string): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}/use`, {
      method: 'POST',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao contabilizar uso');
    return res.json();
  },

  async forkPrompt(id: string): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}/fork`, {
      method: 'POST',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao clonar o prompt');
    return res.json();
  },

  /** Duplica para a biblioteca privada de quem chama e conta o clone, numa única operação no servidor. */
  async clonePrompt(id: string, authorSnapshot: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authorSnapshot),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao duplicar o item');
    return res.json();
  },

  async deleteComment(promptId: string, commentId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${promptId}/comments/${commentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao remover o comentário');
  },

  async getComments(promptId: string): Promise<PromptComment[]> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${promptId}/comments`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar comentários');
    return res.json();
  },

  async addComment(promptId: string, comment: Partial<PromptComment>): Promise<PromptComment> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${promptId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao adicionar comentário');
    return res.json();
  }
};

/** Item como a leitura anônima o devolve: sem authorId nem qualquer identificador interno. */
type PublicPromptDTO = Omit<PromptItem, 'authorId' | 'visibility'>;

const fromPublic = (dto: PublicPromptDTO): PromptItem => ({
  ...dto,
  authorId: '',
  visibility: 'public',
  tags: dto.tags ?? [],
});

/**
 * Leitura sem login (`/api/public/prompt-hub`): só itens públicos, só GET. Usa fetch puro, sem token.
 * Qualquer escrita, comentário, coleção ou item privado continua exigindo login.
 */
export const publicPromptApi = {
  async listPage(page = 0, size = 50): Promise<PageResponse<PromptItem>> {
    const res = await fetch(`${API_BASE_URL}/public/prompt-hub/items?page=${page}&size=${size}`);
    if (!res.ok) throw await apiError(res, 'Falha ao listar a biblioteca pública');
    const body: PageResponse<PublicPromptDTO> = await res.json();
    return { ...body, content: body.content.map(fromPublic) };
  },

  async listAll(pageSize = 50, maxPages = 20): Promise<PromptItem[]> {
    const all: PromptItem[] = [];
    for (let page = 0; page < maxPages; page += 1) {
      const res = await publicPromptApi.listPage(page, pageSize);
      all.push(...res.content);
      if (page + 1 >= res.totalPages) break;
    }
    return all;
  },

  async get(id: string): Promise<PromptItem> {
    const res = await fetch(`${API_BASE_URL}/public/prompt-hub/items/${encodeURIComponent(id)}`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar o item');
    return fromPublic(await res.json());
  },
};

/**
 * Formato retornado pelo backend para uma Coleção — os itens já vêm embutidos
 * (join `ManyToMany`), não há mais subcoleção separada para buscar à parte.
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
    if (!res.ok) throw await apiError(res, 'Falha ao listar coleções');
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
    const res = await authFetch(`${API_BASE_URL}/prompts/collections/${id}`);
    if (!res.ok) throw await apiError(res, 'Falha ao carregar a coleção');
    return res.json();
  },

  async createCollection(data: PromptCollectionPayload): Promise<PromptCollectionDTO> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao criar a coleção');
    return res.json();
  },

  async updateCollection(id: string, data: PromptCollectionPayload): Promise<PromptCollectionDTO> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw await apiError(res, 'Falha ao atualizar a coleção');
    return res.json();
  },

  async deleteCollection(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao remover a coleção');
  },

  async addItemToCollection(collectionId: string, promptId: string): Promise<PromptCollectionDTO> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections/${collectionId}/items/${promptId}`, {
      method: 'POST',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao adicionar item à coleção');
    return res.json();
  },

  async removeItemFromCollection(collectionId: string, promptId: string): Promise<PromptCollectionDTO> {
    const res = await authFetch(`${API_BASE_URL}/prompts/collections/${collectionId}/items/${promptId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await apiError(res, 'Falha ao remover item da coleção');
    return res.json();
  }
};
