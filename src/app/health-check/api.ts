import { HealthCheckBoard, HealthCheckParticipant, HealthCheckVote } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';
import { ensureOk } from '@/lib/ceremony-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const healthCheckApi = {
  // --- Boards ---
  async getBoard(id: string): Promise<HealthCheckBoard> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${id}`);
    await ensureOk(res, 'Falha ao obter dados do Radar de Saúde');
    return res.json();
  },

  /** Cria o radar. Encerrar usa finishBoard: o resumo é calculado no servidor. */
  async saveOrUpdateBoard(board: Partial<HealthCheckBoard>): Promise<HealthCheckBoard> {
    const res = await authFetch(`${API_BASE_URL}/health-checks`, {
      method: 'POST',
      body: JSON.stringify(board),
    });
    await ensureOk(res, 'Falha ao salvar radar');
    return res.json();
  },

  /** Encerra a votação (só o criador): o servidor calcula médias e destaques com todos os votos já gravados. */
  async finishBoard(id: string): Promise<HealthCheckBoard> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${id}/finish`, {
      method: 'POST',
    });
    await ensureOk(res, 'Não foi possível encerrar a votação');
    return res.json();
  },

  async listBoards(squadId: string): Promise<HealthCheckBoard[]> {
    const res = await authFetch(`${API_BASE_URL}/health-checks?squadId=${encodeURIComponent(squadId)}`);
    await ensureOk(res, 'Falha ao listar radares');
    return res.json();
  },

  async deleteBoard(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${id}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Não foi possível apagar o radar');
  },

  // --- Participants ---
  async getParticipants(boardId: string): Promise<HealthCheckParticipant[]> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/participants`);
    await ensureOk(res, 'Falha ao obter participantes');
    return res.json();
  },

  async joinBoard(boardId: string, participant: Partial<HealthCheckParticipant>): Promise<HealthCheckParticipant> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/participants`, {
      method: 'POST',
      body: JSON.stringify(participant),
    });
    await ensureOk(res, 'Falha ao entrar no radar');
    return res.json();
  },

  async leaveBoard(boardId: string, userId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/participants/${userId}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Não foi possível sair do radar');
  },

  // --- Votes ---
  /**
   * Votação aberta: devolve só os votos de quem está logado. Radar encerrado: todos os votos, sem identificar
   * quem votou (o servidor remove id e papel do votante).
   */
  async getVotes(boardId: string): Promise<HealthCheckVote[]> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/votes`);
    await ensureOk(res, 'Falha ao obter votos');
    return res.json();
  },

  /** O voto é sempre de quem está logado; o servidor define o votante, o papel e a hora. */
  async saveVote(boardId: string, vote: Pick<HealthCheckVote, 'dimensionKey' | 'value'> & { comment?: string }): Promise<HealthCheckVote> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${boardId}/votes`, {
      method: 'POST',
      body: JSON.stringify(vote),
    });
    await ensureOk(res, 'Não foi possível registrar o voto');
    return res.json();
  }
};
