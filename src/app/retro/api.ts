import { RetroBoard, RetroCard, RetroParticipant } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';
import type { ChatMessage } from '@/components/poker/team-chat/chatChannels';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/** Erro de uma chamada da retro; `status` deixa a tela distinguir "não existe" de "falhou". */
export class RetroApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'RetroApiError';
    this.status = status;
  }
}

/**
 * Lança se a resposta não for 2xx. Mensagens de 4xx vêm do servidor (já em português, ex.: limite de
 * votos); erros 5xx e de rede usam o texto padrão da chamada, sem vazar stack ou JSON cru.
 */
async function ensureOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  let message = fallback;
  if (res.status >= 400 && res.status < 500) {
    try {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (typeof json?.message === 'string' && json.message.trim()) message = json.message;
      } catch {
        if (text && text.length < 200 && !text.trim().startsWith('<')) message = text;
      }
    } catch { /* corpo ilegível: fica o texto padrão */ }
  }
  throw new RetroApiError(message, res.status);
}

export const retroApi = {
  async listBoards(params?: { sprintId?: string; team?: string; squadId?: string }): Promise<RetroBoard[]> {
    const query = new URLSearchParams();
    if (params?.sprintId) query.set('sprintId', params.sprintId);
    if (params?.team) query.set('team', params.team);
    if (params?.squadId) query.set('squadId', params.squadId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await authFetch(`${API_BASE_URL}/retros${qs}`);
    await ensureOk(res, 'Falha ao listar quadros de retrospectiva');
    return res.json();
  },

  async getBoard(boardId: string): Promise<RetroBoard> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}`);
    await ensureOk(res, 'Falha ao carregar o quadro de retrospectiva');
    return res.json();
  },

  /** Cria um quadro. Mudanças em quadro existente usam patchBoard: gravar o quadro inteiro desfaz o que outra pessoa mudou. */
  async saveOrUpdateBoard(board: Partial<RetroBoard>): Promise<RetroBoard> {
    const res = await authFetch(`${API_BASE_URL}/retros`, {
      method: 'POST',
      body: JSON.stringify(board),
    });
    await ensureOk(res, 'Falha ao salvar quadro');
    return res.json();
  },

  /** Atualização parcial: só os campos enviados mudam. */
  async patchBoard(boardId: string, patch: Partial<RetroBoard>): Promise<RetroBoard> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await ensureOk(res, 'Falha ao atualizar o quadro');
    return res.json();
  },

  /** Zera os votos de todos os cards e desliga a votação. */
  async resetVotes(boardId: string): Promise<RetroBoard> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/votes/reset`, { method: 'POST' });
    await ensureOk(res, 'Falha ao resetar a votação');
    return res.json();
  },

  /** Liga/desliga o voto da própria pessoa no card; o servidor aplica o limite por painel. */
  async toggleVote(boardId: string, cardId: string): Promise<RetroCard> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards/${encodeURIComponent(cardId)}/vote`, { method: 'POST' });
    await ensureOk(res, 'Falha ao registrar o voto');
    return res.json();
  },

  /** Funde `sourceId` em `targetId` de forma atômica (textos, votos sem repetição e exclusão do original). */
  async mergeCards(boardId: string, targetId: string, sourceId: string): Promise<RetroCard> {
    const res = await authFetch(
      `${API_BASE_URL}/retros/${boardId}/cards/${encodeURIComponent(targetId)}/merge/${encodeURIComponent(sourceId)}`,
      { method: 'POST' }
    );
    await ensureOk(res, 'Falha ao fundir os cards');
    return res.json();
  },

  /** A própria pessoa assume o controle do quadro (uma única flag de facilitador). */
  async transferControl(boardId: string): Promise<RetroBoard> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/transfer-control`, { method: 'POST' });
    await ensureOk(res, 'Falha ao assumir o controle');
    return res.json();
  },

  async getParticipants(boardId: string): Promise<RetroParticipant[]> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/participants`);
    await ensureOk(res, 'Falha ao carregar participantes');
    return res.json();
  },

  async addOrUpdateParticipant(boardId: string, participant: Partial<RetroParticipant>): Promise<RetroParticipant> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/participants`, {
      method: 'POST',
      body: JSON.stringify(participant),
    });
    await ensureOk(res, 'Falha ao adicionar participante');
    return res.json();
  },

  async removeParticipant(boardId: string, userId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/participants/${userId}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Falha ao remover participante');
  },

  async getCards(boardId: string): Promise<RetroCard[]> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards`);
    await ensureOk(res, 'Falha ao obter cartões do quadro');
    return res.json();
  },

  async saveOrUpdateCard(boardId: string, card: Partial<RetroCard>): Promise<RetroCard> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards`, {
      method: 'POST',
      body: JSON.stringify(card),
    });
    await ensureOk(res, 'Falha ao salvar cartão');
    return res.json();
  },

  async deleteCard(boardId: string, cardId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards/${cardId}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Falha ao apagar o cartão');
  },

  async importActions(boardId: string, cards: RetroCard[]): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/cards/import`, {
      method: 'POST',
      body: JSON.stringify(cards),
    });
    await ensureOk(res, 'Falha ao importar as ações');
  },

  // Chat do time (canais: geral, role-<Categoria>, dm_<uidA>_<uidB>)
  async getChatMessages(boardId: string, channelId: string): Promise<ChatMessage[]> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/chat?channelId=${encodeURIComponent(channelId)}`);
    await ensureOk(res, 'Falha ao carregar mensagens do chat');
    return res.json();
  },

  async sendChatMessage(boardId: string, message: Partial<ChatMessage> & { channelId: string }): Promise<ChatMessage> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/chat`, {
      method: 'POST',
      body: JSON.stringify(message),
    });
    await ensureOk(res, 'Falha ao enviar mensagem');
    return res.json();
  },

  async deleteChatMessage(boardId: string, messageId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/retros/${boardId}/chat/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Falha ao apagar mensagem');
  }
};
