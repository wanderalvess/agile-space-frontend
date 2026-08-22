import { Room, Participant, Vote, VotingRound } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const pokerApi = {
  async getRoom(roomId: string): Promise<Room> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}`);
    if (!res.ok) throw new Error('Falha ao carregar a sala de Poker');
    return res.json();
  },

  async saveOrUpdateRoom(room: Partial<Room>): Promise<Room> {
    const res = await authFetch(`${API_BASE_URL}/poker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(room),
    });
    if (!res.ok) throw new Error('Falha ao salvar configurações da sala');
    return res.json();
  },

  async listRooms(): Promise<Room[]> {
    const res = await authFetch(`${API_BASE_URL}/poker`);
    if (!res.ok) throw new Error('Falha ao listar salas de Poker');
    return res.json();
  },

  async getParticipants(roomId: string): Promise<Participant[]> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/participants`);
    if (!res.ok) throw new Error('Falha ao obter participantes');
    return res.json();
  },

  async joinRoom(roomId: string, participant: Partial<Participant>): Promise<Participant> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(participant),
    });
    if (!res.ok) throw new Error('Falha ao entrar na sala de Poker');
    return res.json();
  },

  async sendHeartbeat(roomId: string, userId: string): Promise<void> {
    try {
      await authFetch(`${API_BASE_URL}/poker/${roomId}/heartbeat/${userId}`, {
        method: 'POST',
      });
    } catch (e) {
      // Ignora falhas pontuais de heartbeat de rede ou reinício de servidor
    }
  },

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/participants/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao sair da sala');
  },

  async getVotes(roomId: string): Promise<Vote[]> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/votes`);
    if (!res.ok) throw new Error('Falha ao carregar votos da sala');
    return res.json();
  },

  async saveVote(roomId: string, vote: Partial<Vote>): Promise<Vote> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vote),
    });
    if (!res.ok) throw new Error('Falha ao votar');
    return res.json();
  },

  async removeVote(roomId: string, userId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/votes/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao remover voto');
  },

  async clearVotes(roomId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/votes`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao limpar votos da rodada');
  },

  async getRounds(roomId: string, limit = 100): Promise<VotingRound[]> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/rounds?limit=${limit}`);
    if (!res.ok) throw new Error('Falha ao carregar histórico de rodadas');
    return res.json();
  },

  async saveRound(roomId: string, round: Partial<VotingRound>): Promise<VotingRound> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(round),
    });
    if (!res.ok) throw new Error('Falha ao arquivar rodada no histórico');
    return res.json();
  },

  async clearRounds(roomId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/rounds`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao limpar histórico de rodadas');
  },

  async sendReaction(roomId: string, reaction: { uid: string; emoji: string; ts: string; nickname?: string }): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'REACTION', ...reaction }),
    });
    if (!res.ok) throw new Error('Falha ao enviar reação');
  }
};
