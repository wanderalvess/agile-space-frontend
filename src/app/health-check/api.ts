import { HealthCheckBoard, HealthCheckParticipant, HealthCheckVote } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const healthCheckApi = {
  // --- Boards ---
  async getBoard(id: string): Promise<HealthCheckBoard> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${id}`);
    if (!res.ok) throw new Error('Falha ao obter dados do Radar de Saúde');
    return res.json();
  },

  async saveOrUpdateBoard(board: Partial<HealthCheckBoard>): Promise<HealthCheckBoard> {
    const res = await authFetch(`${API_BASE_URL}/health-checks`, {
      method: 'POST',
      body: JSON.stringify(board),
    });
    if (!res.ok) throw new Error('Falha ao salvar radar');
    return res.json();
  },

  async listBoards(): Promise<HealthCheckBoard[]> {
    const res = await authFetch(`${API_BASE_URL}/health-checks`);
    if (!res.ok) throw new Error('Falha ao listar radares');
    return res.json();
  },

  async deleteBoard(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${id}`, {
      method: 'DELETE',
    });
  },

  // --- Participants ---
  async getParticipants(boardId: string): Promise<HealthCheckParticipant[]> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/participants`);
    if (!res.ok) throw new Error('Falha ao obter participantes');
    return res.json();
  },

  async joinBoard(boardId: string, participant: Partial<HealthCheckParticipant>): Promise<HealthCheckParticipant> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/participants`, {
      method: 'POST',
      body: JSON.stringify(participant),
    });
    if (!res.ok) throw new Error('Falha ao entrar no radar');
    return res.json();
  },

  async leaveBoard(boardId: string, userId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/participants/${userId}`, {
      method: 'DELETE',
    });
  },

  // --- Votes ---
  async getVotes(boardId: string, participantId?: string): Promise<HealthCheckVote[]> {
    const url = participantId 
      ? `${API_BASE_URL}/health-checks/${boardId}/votes?participantId=${participantId}`
      : `${API_BASE_URL}/health-checks/${boardId}/votes`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error('Falha ao obter votos');
    return res.json();
  },

  async saveVote(boardId: string, vote: Partial<HealthCheckVote>): Promise<HealthCheckVote> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/votes`, {
      method: 'POST',
      body: JSON.stringify(vote),
    });
    if (!res.ok) throw new Error('Falha ao salvar voto');
    return res.json();
  }
};
