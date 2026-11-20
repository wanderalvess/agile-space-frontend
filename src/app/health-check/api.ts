import { HealthCheckBoard, HealthCheckParticipant, HealthCheckVote } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';
import { ensureOk } from '@/lib/ceremony-api';
import type { HealthProgress } from '@/lib/health-check-progress';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/**
 * Resultado de uma chamada a uma rota que só existe no backend novo. `unavailable` = 404/405 (backend antigo:
 * a tela esconde o recurso, sem erro); `forbidden` = 403 (a pessoa não é o facilitador).
 */
export type OptionalResult<T> = { status: 'ok'; data: T } | { status: 'unavailable' } | { status: 'forbidden' };

async function optional<T>(res: Response, fallback: string, read: () => Promise<T>): Promise<OptionalResult<T>> {
  if (res.status === 404 || res.status === 405) return { status: 'unavailable' };
  if (res.status === 403) return { status: 'forbidden' };
  await ensureOk(res, fallback);
  return { status: 'ok', data: await read() };
}

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
  },

  // --- Quem já respondeu (backend novo) ---
  /**
   * Contagens leves; só o criador/ADMIN recebe `pendingParticipantIds`. 404/405 = backend antigo (ou radar
   * apagado, que a sala já trata): devolve `unavailable` em vez de lançar.
   */
  async getProgress(boardId: string): Promise<OptionalResult<HealthProgress>> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${encodeURIComponent(boardId)}/progress`);
    return optional(res, 'Não foi possível carregar o andamento das respostas', () => res.json() as Promise<HealthProgress>);
  },

  // --- Apresentação sincronizada (backend novo) ---
  /** Publica a etapa em que o facilitador está. Só criador/ADMIN, e só depois de encerrado (409 antes disso). */
  async setPresentationStage(boardId: string, stage: string): Promise<OptionalResult<HealthCheckBoard | null>> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${encodeURIComponent(boardId)}/presentation`, {
      method: 'PUT',
      body: JSON.stringify({ stage }),
    });
    return optional(res, 'Não foi possível publicar a etapa da apresentação', async () => ((await res.json().catch(() => null)) ?? null) as HealthCheckBoard | null);
  },

  /** Limpa a etapa publicada (fim da apresentação). */
  async clearPresentationStage(boardId: string): Promise<OptionalResult<HealthCheckBoard | null>> {
    const res = await authFetch(`${API_BASE_URL}/health-checks/${encodeURIComponent(boardId)}/presentation`, { method: 'DELETE' });
    return optional(res, 'Não foi possível encerrar a apresentação para os participantes', async () => ((await res.json().catch(() => null)) ?? null) as HealthCheckBoard | null);
  },
};
