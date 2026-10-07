import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/**
 * Espelha `KnowledgeConversation` do backend. `messages` é um blob JSON (TEXT
 * column) contendo o array de mensagens serializado — o backend anexa uma
 * mensagem por vez via `appendMessage` e persiste a lista inteira de novo a
 * cada chamada. O cliente precisa dar `JSON.parse(messages)` para ler o array.
 */
export interface KnowledgeConversationDTO {
  id: string;
  userId: string;
  title: string;
  messages: string;
  createdAt: string;
  updatedAt: string;
}

/** Espelha `KnowledgeUserAiSettings`. `byokApiKey` é criptografada em repouso no backend; aqui trafega em texto plano. */
export interface KnowledgeUserAiSettingsDTO {
  userId?: string;
  model?: string;
  byokApiKey?: string;
  updatedAt?: string;
}

/** Espelha `KnowledgeTokenUsage`. Sem quebra por prompt/completion nem histórico mensal — apenas o total acumulado. */
export interface KnowledgeTokenUsageDTO {
  userId: string;
  userName?: string;
  totalTokens: number;
  updatedAt?: string;
}

export const knowledgeChatApi = {
  async listConversations(): Promise<KnowledgeConversationDTO[]> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/conversations`);
    if (!res.ok) throw new Error('Falha ao listar conversas');
    return res.json();
  },

  async getConversation(id: string): Promise<KnowledgeConversationDTO> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/conversations/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar a conversa');
    return res.json();
  },

  async createConversation(title: string): Promise<KnowledgeConversationDTO> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Falha ao criar a conversa');
    return res.json();
  },

  async renameConversation(id: string, title: string): Promise<KnowledgeConversationDTO> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/conversations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error('Falha ao renomear a conversa');
    return res.json();
  },

  async deleteConversation(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/conversations/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir a conversa');
  },

  /** Anexa uma única mensagem (objeto opaco) à conversa; o backend retorna a conversa já atualizada. */
  async appendMessage(id: string, message: unknown): Promise<KnowledgeConversationDTO> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!res.ok) throw new Error('Falha ao salvar a mensagem');
    return res.json();
  },

  async getAiSettings(): Promise<KnowledgeUserAiSettingsDTO> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/ai-settings`);
    if (!res.ok) throw new Error('Falha ao carregar as configurações de IA');
    return res.json();
  },

  async saveAiSettings(updates: Partial<KnowledgeUserAiSettingsDTO>): Promise<KnowledgeUserAiSettingsDTO> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/ai-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Falha ao salvar as configurações de IA');
    return res.json();
  },

  async getTokenUsage(): Promise<KnowledgeTokenUsageDTO> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/token-usage`);
    if (!res.ok) throw new Error('Falha ao carregar o consumo de tokens');
    return res.json();
  },

  async incrementTokenUsage(tokens: number): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/token-usage/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens }),
    });
    if (!res.ok) throw new Error('Falha ao registrar o consumo de tokens');
  },

  /** Visão administrativa: top 10 usuários por tokens consumidos (sem realtime — busca única). */
  async getTopTokenUsage(): Promise<KnowledgeTokenUsageDTO[]> {
    const res = await authFetch(`${API_BASE_URL}/knowledge/token-usage/top`);
    if (!res.ok) throw new Error('Falha ao carregar o ranking de consumo de tokens');
    return res.json();
  },
};
