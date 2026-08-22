import { ActionPlanBoard, ActionPlanTask } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const actionPlanApi = {
  async createBoard(board: Partial<ActionPlanBoard>): Promise<ActionPlanBoard> {
    const res = await authFetch(`${API_BASE_URL}/action-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
    if (!res.ok) throw new Error('Falha ao criar o plano de ação');
    return res.json();
  },

  async getBoardById(id: string): Promise<ActionPlanBoard> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar o plano de ação');
    return res.json();
  },

  async addParticipant(boardId: string, participantId: string): Promise<ActionPlanBoard> {
    const params = new URLSearchParams();
    params.append('participantId', participantId);
    const res = await authFetch(`${API_BASE_URL}/action-plans/${boardId}/participants?${params.toString()}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Falha ao adicionar participante');
    return res.json();
  },

  async listTasks(boardId: string): Promise<ActionPlanTask[]> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${boardId}/tasks`);
    if (!res.ok) throw new Error('Falha ao listar tarefas do plano de ação');
    return res.json();
  },

  async createTask(boardId: string, task: Partial<ActionPlanTask>): Promise<ActionPlanTask> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${boardId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error('Falha ao criar tarefa do plano de ação');
    return res.json();
  },

  async updateTask(taskId: string, task: Partial<ActionPlanTask>): Promise<ActionPlanTask> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error('Falha ao atualizar tarefa');
    return res.json();
  },

  async deleteTask(taskId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/tasks/${taskId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir tarefa');
  }
};
