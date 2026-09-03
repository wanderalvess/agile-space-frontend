import { KnowledgeDocument } from '@/lib/knowledge-types';
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
    const res = await fetch('/api/knowledge/embed', {
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
    if (!res.ok) throw new Error('Falha ao salvar documento');
    return res.json();
  },

  async updateDocument(id: string, doc: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    const embedding = doc.content ? await tryEmbed(`${doc.title ?? ''}\n\n${doc.content}`) : undefined;
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(embedding ? { ...doc, embedding } : doc),
    });
    if (!res.ok) throw new Error('Falha ao atualizar documento');
    return res.json();
  },

  async deleteDocument(id: string, deletedBy: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('deletedBy', deletedBy);
    const res = await authFetch(`${API_BASE_URL}/knowledge/${id}?${params.toString()}`, {
      method: 'DELETE',
    });
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
