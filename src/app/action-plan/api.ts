import { ActionPlanBoard, ActionPlanTask } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';
import { ensureOk } from '@/lib/ceremony-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const actionPlanApi = {
  async listBoards(sprintId: string): Promise<ActionPlanBoard[]> {
    const res = await authFetch(`${API_BASE_URL}/action-plans?sprintId=${encodeURIComponent(sprintId)}`);
    await ensureOk(res, 'Falha ao listar planos de ação');
    return res.json();
  },

  /** Planos de ação da squad (todas as sprints). */
  async listBoardsBySquad(squadId: string): Promise<ActionPlanBoard[]> {
    const res = await authFetch(`${API_BASE_URL}/action-plans?squadId=${encodeURIComponent(squadId)}`);
    await ensureOk(res, 'Falha ao listar planos de ação');
    return res.json();
  },

  /** Criador, id e datas são definidos pelo servidor a partir do login; o que vier no corpo é ignorado. */
  async createBoard(board: Partial<ActionPlanBoard>): Promise<ActionPlanBoard> {
    const res = await authFetch(`${API_BASE_URL}/action-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
    await ensureOk(res, 'Falha ao criar o plano de ação');
    return res.json();
  },

  async getBoardById(id: string): Promise<ActionPlanBoard> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${id}`);
    await ensureOk(res, 'Falha ao carregar o plano de ação');
    return res.json();
  },

  /** Renomeia o plano e/ou muda quem vê (`isPublic`). Só o criador ou um administrador; campo ausente não muda. */
  async updateBoard(id: string, patch: { title?: string; isPublic?: boolean }): Promise<ActionPlanBoard> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await ensureOk(res, 'Falha ao atualizar o plano de ação');
    return res.json();
  },

  /** Apaga o plano com todas as ações. Só o criador ou um administrador. */
  async deleteBoard(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${id}`, { method: 'DELETE' });
    await ensureOk(res, 'Falha ao apagar o plano de ação');
  },

  /**
   * Entra no plano: sem `participantId` o participante é quem está logado. Com ele, o criador (ou um
   * administrador) convida outra pessoa pelo ID da conta.
   */
  async addParticipant(boardId: string, participantId?: string): Promise<ActionPlanBoard> {
    const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : '';
    const res = await authFetch(`${API_BASE_URL}/action-plans/${boardId}/participants${query}`, {
      method: 'POST',
    });
    await ensureOk(res, 'Falha ao adicionar participante');
    return res.json();
  },

  async listTasks(boardId: string): Promise<ActionPlanTask[]> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${boardId}/tasks`);
    await ensureOk(res, 'Falha ao listar tarefas do plano de ação');
    return res.json();
  },

  async createTask(boardId: string, task: Partial<ActionPlanTask>): Promise<ActionPlanTask> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${boardId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    await ensureOk(res, 'Falha ao criar tarefa do plano de ação');
    return res.json();
  },

  /** Edição parcial: só os campos enviados mudam; texto vazio ("") limpa o campo. */
  async updateTask(taskId: string, task: Partial<ActionPlanTask>): Promise<ActionPlanTask> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    await ensureOk(res, 'Falha ao atualizar tarefa');
    return res.json();
  },

  async deleteTask(taskId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/tasks/${taskId}`, {
      method: 'DELETE',
    });
    await ensureOk(res, 'Falha ao excluir tarefa');
  }
};
