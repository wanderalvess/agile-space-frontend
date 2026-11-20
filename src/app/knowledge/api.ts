import { KnowledgeDocument, KnowledgeVersion } from '@/lib/knowledge-types';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

// Gera o embedding local (rota Next same-origin — api.ts roda no browser e não
// pode importar '@/lib/embeddings' direto, isso puxaria onnxruntime-node, que
// não roda em browser). Nunca lança: se falhar, o save/busca segue sem embedding
// em vez de travar o fluxo principal por causa de um problema no motor de IA local.
async function tryEmbed(text: string): Promise<number[] | undefined> {
  try {
    const res = await authFetch('/api/knowledge/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Título + fatia generosa do conteúdo: o modelo tem janela de contexto de
      // poucas centenas de tokens, mandar o documento inteiro não ajuda em nada.
      body: JSON.stringify({ text: text.slice(0, 2000) }),
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.embedding;
  } catch (e) {
    console.error('Erro ao gerar embedding local:', e);
    return undefined;
  }
}

/** Mensagem do servidor (400/403 trazem o motivo em pt-BR); cai no texto padrão se o corpo não ajudar. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === 'string' && body.message) return body.message;
  } catch { /* corpo vazio */ }
  return fallback;
}

export const knowledgeApi = {
  async listDocuments(query?: string, tags?: string[], page = 0, size = 50, status?: string): Promise<PageResponse<KnowledgeDocument>> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (tags && tags.length > 0) params.append('tags', tags.join(','));
    if (status) params.append('status', status);
    params.append('page', page.toString());
    params.append('size', size.toString());

    const res = await authFetch(`${API_BASE_URL}/knowledge?${params.toString()}`);
    if (!res.ok) throw new Error('Falha ao listar documentos da base de conhecimento');
    return res.json();
  },

  async getDocumentById(id: string): Promise<KnowledgeDocument> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar o documento');
    return res.json();
  },

  async saveOrUpdateDocument(doc: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    const embedding = doc.content ? await tryEmbed(`${doc.title ?? ''}\n\n${doc.content}`) : undefined;
    const res = await authFetch(`${API_BASE_URL}/knowledge`, {
      method: 'POST',
      body: JSON.stringify(embedding ? { ...doc, embedding } : doc),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao salvar documento'));
    return res.json();
  },

  async updateDocument(id: string, doc: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    const embedding = doc.content ? await tryEmbed(`${doc.title ?? ''}\n\n${doc.content}`) : undefined;
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(embedding ? { ...doc, embedding } : doc),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao atualizar documento'));
    return res.json();
  },

  /**
   * Muda só o estado de um documento já carregado (ex.: arquivado -> publicado). Reenvia o documento como está,
   * sem novo vetor: o servidor mantém o que já tinha quando o texto não muda. Só quem edita o documento consegue.
   */
  async setDocumentStatus(doc: KnowledgeDocument, status: 'published' | 'archived'): Promise<KnowledgeDocument> {
    const { embedding: _embedding, canEdit: _canEdit, ...rest } = doc;
    const res = await authFetch(`${API_BASE_URL}/knowledge/${doc.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...rest, status }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao mudar o estado do documento'));
    return res.json();
  },

  async deleteDocument(id: string, _deletedBy?: string): Promise<void> {
    // O servidor usa o login (não o parâmetro) para saber quem apagou e só deixa o autor ou um admin apagar.
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}`, {
      method: 'DELETE',
    });
    if (res.status === 403) throw new Error(await errorMessage(res, 'Só o autor ou a liderança editam este documento.'));
    if (res.status === 404) throw new Error('Documento não encontrado.');
    if (!res.ok) throw new Error('Falha ao apagar o documento');
  },

  async listVersions(id: string): Promise<KnowledgeVersion[]> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}/versions`);
    if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao carregar o histórico'));
    return res.json();
  },

  async getVersion(id: string, versionNumber: number): Promise<KnowledgeVersion> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}/versions/${versionNumber}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao carregar a versão'));
    return res.json();
  },

  /**
   * Restaura uma versão (o servidor cria uma nova versão com aquele conteúdo e descarta o vetor de busca).
   * Em seguida reindexamos: salvar o mesmo texto com o vetor novo não cria outra versão.
   */
  async restoreVersion(id: string, versionNumber: number): Promise<KnowledgeDocument> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}/versions/${versionNumber}/restore`, { method: 'POST' });
    if (!res.ok) throw new Error(await errorMessage(res, 'Falha ao restaurar a versão'));
    const restored: KnowledgeDocument = await res.json();
    const embedding = restored.content ? await tryEmbed(`${restored.title ?? ''}

${restored.content}`) : undefined;
    if (embedding) {
      const reindex = await authFetch(`${API_BASE_URL}/knowledge/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...restored, embedding }),
      });
      if (reindex.ok) return reindex.json();
    }
    return restored;
  },

  async incrementViews(id: string): Promise<KnowledgeDocument> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}/view`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Falha ao incrementar visualizações');
    return res.json();
  },

  // Busca semântica local (embedding via transformers.js, sem LLM). Lança em
  // caso de erro — quem chama decide o fallback (ex: PokerChat cai pra busca
  // por palavra-chave / docs recentes).
  async semanticSearch(queryText: string, limit = 10): Promise<PageResponse<KnowledgeDocument>> {
    const embedding = await tryEmbed(queryText);
    if (!embedding) throw new Error('Falha ao gerar embedding da busca');

    const res = await authFetch(`${API_BASE_URL}/knowledge/search/semantic?size=${limit}`, {
      method: 'POST',
      body: JSON.stringify({ embedding }),
    });
    if (!res.ok) throw new Error('Falha na busca semântica da base de conhecimento');
    return res.json();
  }
};
