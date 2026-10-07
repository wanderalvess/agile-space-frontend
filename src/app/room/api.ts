import { Room, Participant, Vote, VotingRound } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

// Mensagem de erro com status HTTP e o corpo devolvido pelo backend — sem isso
// "Falha ao ..." não diz se foi 401, 403, 404 ou 500.
async function httpError(res: Response, fallback: string): Promise<Error> {
  let detail = '';
  try {
    const text = (await res.text()).trim();
    if (text) {
      try {
        const body = JSON.parse(text);
        detail = body.error || body.message || text;
      } catch {
        detail = text;
      }
    }
  } catch {
    // corpo ilegível: segue só com o status
  }
  return new Error(`${fallback} (HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''})`);
}


// O backend responde 409 quando duas gravações da sala partem da mesma versão (@Version). Em vez de
// cada chamada tratar isso, o salvar da sala avisa a página por este evento; ela recarrega a sala
// e informa o usuário (ver app/room/[id]/page.tsx).
export const ROOM_CONFLICT_EVENT = 'poker-room-conflict';

export class RoomConflictError extends Error {
  constructor(public readonly roomId?: string) {
    super('A sala foi atualizada por outra pessoa antes desta ação ser salva.');
    this.name = 'RoomConflictError';
  }
}

export const pokerApi = {
  async getRoom(roomId: string): Promise<Room> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}`);
    if (!res.ok) throw new Error('Falha ao carregar a sala de Poker');
    return res.json();
  },

  async saveOrUpdateRoom(room: Partial<Room>): Promise<Room> {
    const res = await authFetch(`${API_BASE_URL}/poker`, {
      method: 'POST',
      body: JSON.stringify(room),
    });
    if (res.status === 409) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(ROOM_CONFLICT_EVENT, { detail: { roomId: room.id } }));
      }
      throw new RoomConflictError(room.id);
    }
    if (!res.ok) throw new Error('Falha ao salvar a sala');
    return res.json();
  },

  async listRooms(squadId: string): Promise<Room[]> {
    const res = await authFetch(`${API_BASE_URL}/poker?squadId=${encodeURIComponent(squadId)}`);
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
      body: JSON.stringify(participant),
    });
    if (!res.ok) throw new Error('Falha ao entrar na sala');
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
  },

  async getVotes(roomId: string): Promise<Vote[]> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/votes`);
    if (!res.ok) throw new Error('Falha ao carregar votos da sala');
    return res.json();
  },

  async saveVote(roomId: string, vote: Partial<Vote>): Promise<Vote> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/votes`, {
      method: 'POST',
      body: JSON.stringify(vote),
    });
    if (!res.ok) throw new Error('Falha ao salvar voto');
    return res.json();
  },

  async removeVote(roomId: string, userId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/votes/${userId}`, {
      method: 'DELETE',
    });
  },

  async clearVotes(roomId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/votes`, {
      method: 'DELETE',
    });
  },

  async getRounds(roomId: string, limit = 100): Promise<VotingRound[]> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/rounds?limit=${limit}`);
    if (!res.ok) throw new Error('Falha ao carregar histórico de rodadas');
    return res.json();
  },

  async saveRound(roomId: string, round: Partial<VotingRound>): Promise<VotingRound> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/rounds`, {
      method: 'POST',
      body: JSON.stringify(round),
    });
    if (!res.ok) throw new Error('Falha ao salvar rodada');
    return res.json();
  },

  async clearRounds(roomId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/rounds`, {
      method: 'DELETE',
    });
  },

  async sendReaction(roomId: string, reaction: { uid: string; emoji: string; ts: string; nickname?: string }): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ type: 'REACTION', ...reaction }),
    });
  },

  // Notas de refinamento: qualquer participante da sala edita; o backend mescla só os
  // campos enviados no item (não regrava a fila inteira, então não há "última cópia vence").
  async updateIssueNotes(roomId: string, issueId: string, notes: { devNotes?: string; qaNotes?: string }): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/issues/${encodeURIComponent(issueId)}/notes`, {
      method: 'PATCH',
      body: JSON.stringify(notes),
    });
    if (!res.ok) throw await httpError(res, 'Falha ao salvar as notas');
  },

  async getChatMessages(roomId: string, channelId: string): Promise<any[]> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/chat?channelId=${encodeURIComponent(channelId)}`);
    if (!res.ok) throw await httpError(res, 'Falha ao carregar mensagens do chat');
    return res.json();
  },

  async sendChatMessage(roomId: string, message: any): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/chat`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
    if (!res.ok) throw await httpError(res, 'Falha ao enviar mensagem');
    return res.json();
  },

  async deleteChatMessage(roomId: string, messageId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/poker/${roomId}/chat/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await httpError(res, 'Falha ao apagar mensagem');
  }
};

