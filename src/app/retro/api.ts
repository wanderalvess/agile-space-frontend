import { RetroBoard, RetroCard, RetroParticipant } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const retroApi = {
  async listBoards(): Promise<RetroBoard[]> {
    const res = await authFetch(`${API_BASE_URL}/retros`);
    if (!res.ok) throw new Error('Falha ao listar quadros de retrospectiva');
    return res.json();
  },

  async getBoard(boardId: string): Promise<RetroBoard> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}`);
    if (!res.ok) throw new Error('Falha ao carregar o quadro de retrospectiva');
    return res.json();
  },

  async saveOrUpdateBoard(board: Partial<RetroBoard>): Promise<RetroBoard> {
    const res = await authFetch(`${API_BASE_URL}/retros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
    if (!res.ok) throw new Error('Falha ao salvar configurações do quadro');
    return res.json();
  },

  async getParticipants(boardId: string): Promise<RetroParticipant[]> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/participants`);
    if (!res.ok) throw new Error('Falha ao carregar participantes');
    return res.json();
  },

  async addOrUpdateParticipant(boardId: string, participant: Partial<RetroParticipant>): Promise<RetroParticipant> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(participant),
    });
    if (!res.ok) throw new Error('Falha ao registrar participante');
    return res.json();
  },

  async removeParticipant(boardId: string, userId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/participants/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao remover participante');
  },

  async getCards(boardId: string): Promise<RetroCard[]> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards`);
    if (!res.ok) throw new Error('Falha ao obter cartões do quadro');
    return res.json();
  },

  async saveOrUpdateCard(boardId: string, card: Partial<RetroCard>): Promise<RetroCard> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    if (!res.ok) throw new Error('Falha ao salvar cartão');
    return res.json();
  },

  async deleteCard(boardId: string, cardId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards/${cardId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir cartão');
  },

  async importActions(boardId: string, cards: RetroCard[]): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cards),
    });
    if (!res.ok) throw new Error('Falha ao importar itens de ação');
  }
};
