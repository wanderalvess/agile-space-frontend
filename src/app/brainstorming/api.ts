import { BrainstormingBoard, BrainstormingIdea, BrainstormingGroup, Participant } from '@/lib/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const brainstormingApi = {
  // --- Boards ---
  async getBoard(id: string): Promise<BrainstormingBoard> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${id}`);
    if (!res.ok) throw new Error('Falha ao obter dados do mural de Brainstorming');
    return res.json();
  },

  async saveOrUpdateBoard(board: Partial<BrainstormingBoard>): Promise<BrainstormingBoard> {
    const res = await fetch(`${API_BASE_URL}/brainstormings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
    if (!res.ok) throw new Error('Falha ao salvar mural');
    return res.json();
  },

  async listBoards(): Promise<BrainstormingBoard[]> {
    const res = await fetch(`${API_BASE_URL}/brainstormings`);
    if (!res.ok) throw new Error('Falha ao listar murais');
    return res.json();
  },

  async deleteBoard(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao deletar mural');
  },

  // --- Participants ---
  async getParticipants(boardId: string): Promise<Participant[]> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/participants`);
    if (!res.ok) throw new Error('Falha ao obter participantes');
    return res.json();
  },

  async joinBoard(boardId: string, participant: Partial<Participant>): Promise<Participant> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(participant),
    });
    if (!res.ok) throw new Error('Falha ao entrar no mural');
    return res.json();
  },

  async leaveBoard(boardId: string, userId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/participants/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao sair do mural');
  },

  // --- Ideas ---
  async getIdeas(boardId: string): Promise<BrainstormingIdea[]> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas`);
    if (!res.ok) throw new Error('Falha ao obter ideias');
    return res.json();
  },

  async saveOrUpdateIdea(boardId: string, idea: Partial<BrainstormingIdea>): Promise<BrainstormingIdea> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(idea),
    });
    if (!res.ok) throw new Error('Falha ao salvar ideia');
    return res.json();
  },

  async deleteIdea(boardId: string, ideaId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas/${ideaId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao deletar ideia');
  },

  // --- Groups ---
  async getGroups(boardId: string): Promise<BrainstormingGroup[]> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/groups`);
    if (!res.ok) throw new Error('Falha ao obter grupos');
    return res.json();
  },

  async saveOrUpdateGroup(boardId: string, group: Partial<BrainstormingGroup>): Promise<BrainstormingGroup> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group),
    });
    if (!res.ok) throw new Error('Falha ao salvar grupo');
    return res.json();
  },

  async deleteGroup(boardId: string, groupId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/brainstormings/${boardId}/groups/${groupId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao deletar grupo');
  }
};
