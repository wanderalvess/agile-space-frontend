import { BrainstormingBoard, BrainstormingIdea, BrainstormingGroup, Participant } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';
import { ensureOk } from '@/lib/ceremony-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/** Campos que o facilitador pode mudar de uma vez; as configurações são mescladas chave a chave no servidor. */
export type BrainstormingBoardPatch = {
  title?: string;
  phase?: BrainstormingBoard['phase'];
  timer?: BrainstormingBoard['timer'];
  settings?: Partial<BrainstormingBoard['settings']>;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const brainstormingApi = {
  // --- Boards ---
  async getBoard(id: string): Promise<BrainstormingBoard> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${id}`);
    await ensureOk(res, 'Falha ao obter dados do mural de Brainstorming');
    return res.json();
  },

  /** Cria o mural. Mudanças em mural existente usam patchBoard: gravar o mural inteiro desfaz o que outra pessoa mudou. */
  async saveOrUpdateBoard(board: Partial<BrainstormingBoard>): Promise<BrainstormingBoard> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(board),
    });
    await ensureOk(res, 'Falha ao salvar mural');
    return res.json();
  },

  /** Atualização parcial (só facilitador): fase, timer, título e configurações (mescladas chave a chave). */
  async patchBoard(id: string, patch: BrainstormingBoardPatch): Promise<BrainstormingBoard> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${id}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    });
    await ensureOk(res, 'Não foi possível salvar a alteração da sessão');
    return res.json();
  },

  async listBoards(squadId: string): Promise<BrainstormingBoard[]> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings?squadId=${encodeURIComponent(squadId)}`);
    await ensureOk(res, 'Falha ao listar murais');
    return res.json();
  },

  async deleteBoard(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${id}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Falha ao deletar mural');
  },

  // --- Participants ---
  async getParticipants(boardId: string): Promise<Participant[]> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/participants`);
    await ensureOk(res, 'Falha ao obter participantes');
    return res.json();
  },

  async joinBoard(boardId: string, participant: Partial<Participant>): Promise<Participant> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/participants`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(participant),
    });
    await ensureOk(res, 'Falha ao entrar no mural');
    return res.json();
  },

  async leaveBoard(boardId: string, userId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/participants/${userId}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Falha ao sair do mural');
  },

  // --- Ideas ---
  async getIdeas(boardId: string): Promise<BrainstormingIdea[]> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas`);
    await ensureOk(res, 'Falha ao obter ideias');
    return res.json();
  },

  /** Cria uma ideia (autor e votos são definidos pelo servidor). */
  async saveOrUpdateIdea(boardId: string, idea: Partial<BrainstormingIdea>): Promise<BrainstormingIdea> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(idea),
    });
    await ensureOk(res, 'Não foi possível salvar a ideia');
    return res.json();
  },

  /**
   * Edição parcial: só os campos enviados mudam (texto, posição, grupo, ligação, qualificadores).
   * `groupId: null` / `parentId: null` limpam; campo ausente não é tocado. Votos nunca passam por aqui.
   */
  async patchIdea(
    boardId: string,
    ideaId: string,
    patch: Partial<Pick<BrainstormingIdea, 'content' | 'position' | 'qualifiers' | 'groupId' | 'parentId' | 'color'>>,
  ): Promise<BrainstormingIdea> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas/${ideaId}`, {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(patch),
    });
    await ensureOk(res, 'Não foi possível salvar a alteração da ideia');
    return res.json();
  },

  /** Liga/desliga o voto de quem está logado (atômico no servidor). */
  async toggleVote(boardId: string, ideaId: string): Promise<BrainstormingIdea> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas/${ideaId}/vote`, {
      method: 'POST',
    });
    await ensureOk(res, 'Não foi possível registrar o voto');
    return res.json();
  },

  /** Funde a ideia de origem na de destino (texto, votos e ligações) numa só operação. */
  async mergeIdeas(boardId: string, targetId: string, sourceId: string): Promise<BrainstormingIdea> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas/${targetId}/merge/${sourceId}`, {
      method: 'POST',
    });
    await ensureOk(res, 'Não foi possível fundir as ideias');
    return res.json();
  },

  async deleteIdea(boardId: string, ideaId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/ideas/${ideaId}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Não foi possível apagar a ideia');
  },

  // --- Groups ---
  async getGroups(boardId: string): Promise<BrainstormingGroup[]> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/groups`);
    await ensureOk(res, 'Falha ao obter grupos');
    return res.json();
  },

  async saveOrUpdateGroup(boardId: string, group: Partial<BrainstormingGroup>): Promise<BrainstormingGroup> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/groups`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(group),
    });
    await ensureOk(res, 'Não foi possível salvar o grupo');
    return res.json();
  },

  async deleteGroup(boardId: string, groupId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/brainstormings/${boardId}/groups/${groupId}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Não foi possível apagar o grupo');
  }
};
