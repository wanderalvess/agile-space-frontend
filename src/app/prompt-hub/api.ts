import { PromptItem, PromptComment } from './types';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

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
    if (!res.ok) throw new Error('Falha ao listar prompts');
    return res.json();
  },

  async getPromptById(id: string): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar o prompt');
    return res.json();
  },

  async createPrompt(prompt: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    if (!res.ok) throw new Error('Falha ao criar o prompt');
    return res.json();
  },

  async updatePrompt(id: string, prompt: Partial<PromptItem>): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt),
    });
    if (!res.ok) throw new Error('Falha ao atualizar o prompt');
    return res.json();
  },

  async deletePrompt(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao deletar o prompt');
  },

  async usePrompt(id: string): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}/use`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Falha ao contabilizar uso');
    return res.json();
  },

  async forkPrompt(id: string): Promise<PromptItem> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${id}/fork`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Falha ao clonar o prompt');
    return res.json();
  },

  async getComments(promptId: string): Promise<PromptComment[]> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${promptId}/comments`);
    if (!res.ok) throw new Error('Falha ao carregar comentários');
    return res.json();
  },

  async addComment(promptId: string, comment: Partial<PromptComment>): Promise<PromptComment> {
    const res = await authFetch(`${API_BASE_URL}/prompts/${promptId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment),
    });
    if (!res.ok) throw new Error('Falha ao adicionar comentário');
    return res.json();
  }
};
