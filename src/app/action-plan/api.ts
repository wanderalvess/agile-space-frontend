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

  /** Entra no plano: o participante é quem está logado. */
  async addParticipant(boardId: string): Promise<ActionPlanBoard> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${boardId}/participants`, {
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
