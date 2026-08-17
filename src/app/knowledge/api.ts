import { KnowledgeDocument } from '@/lib/knowledge-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}

export const knowledgeApi = {
  async listDocuments(query?: string, tags?: string[], page = 0, size = 50): Promise<PageResponse<KnowledgeDocument>> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (tags && tags.length > 0) params.append('tags', tags.join(','));
    params.append('page', page.toString());
    params.append('size', size.toString());

    const res = await fetch(`${API_BASE_URL}/knowledge?${params.toString()}`);
    if (!res.ok) throw new Error('Falha ao listar documentos da base de conhecimento');
    return res.json();
  },

  async getDocumentById(id: string): Promise<KnowledgeDocument> {
    const res = await fetch(`${API_BASE_URL}/knowledge/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar o documento');
    return res.json();
  },

  async saveOrUpdateDocument(doc: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    const res = await fetch(`${API_BASE_URL}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
    if (!res.ok) throw new Error('Falha ao salvar/importar o documento');
    return res.json();
  },

  async updateDocument(id: string, doc: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    const res = await fetch(`${API_BASE_URL}/knowledge/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    });
    if (!res.ok) throw new Error('Falha ao atualizar o documento');
    return res.json();
  },

  async deleteDocument(id: string, deletedBy: string): Promise<void> {
    const params = new URLSearchParams();
    params.append('deletedBy', deletedBy);
    const res = await fetch(`${API_BASE_URL}/knowledge/${id}?${params.toString()}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir o documento');
  },

  async incrementViews(id: string): Promise<KnowledgeDocument> {
    const res = await fetch(`${API_BASE_URL}/knowledge/${id}/view`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Falha ao registrar visualização');
    return res.json();
  }
};
