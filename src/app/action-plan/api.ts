import { ActionPlanBoard, ActionPlanTask, ActionPlanTaskInput, PlanSourceType } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';
import { ensureOk } from '@/lib/ceremony-api';
import { PlanSourceConflictError } from '@/lib/action-plan-origin';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const actionPlanApi = {
  /**
   * Lista planos. Com uma `sprintId` (texto) é a lista da sprint, como sempre. Com um objeto: por squad e/ou por
   * origem (`sourceType` + `sourceId` = "o plano desta sessão"). Cada plano da lista traz `tasksTotal`/`tasksDone`
   * quando o backend é o novo; no antigo os filtros de origem são ignorados (use `findPlanBySource` no resultado).
   */
  async listBoards(
    filter: string | { sprintId?: string; squadId?: string; sourceType?: PlanSourceType; sourceId?: string },
  ): Promise<ActionPlanBoard[]> {
    const f = typeof filter === 'string' ? { sprintId: filter } : filter;
    const qs = new URLSearchParams();
    if (f.sprintId) qs.set('sprintId', f.sprintId);
    if (f.squadId) qs.set('squadId', f.squadId);
    if (f.sourceType) qs.set('sourceType', f.sourceType);
    if (f.sourceId) qs.set('sourceId', f.sourceId);
    const res = await authFetch(`${API_BASE_URL}/action-plans?${qs.toString()}`);
    await ensureOk(res, 'Falha ao listar planos de ação');
    return res.json();
  },

  /** Planos de ação da squad (todas as sprints). */
  async listBoardsBySquad(squadId: string): Promise<ActionPlanBoard[]> {
    return actionPlanApi.listBoards({ squadId });
  },

  /**
   * Criador, id e datas são definidos pelo servidor a partir do login; o que vier no corpo é ignorado.
   * Com `sourceType` + `sourceId` (+ `sourceTitle`) o plano guarda de onde veio; origem repetida na mesma squad
   * volta 409, que sai daqui como `PlanSourceConflictError` (com `existingPlanId` quando o plano é visível).
   */
  async createBoard(board: Partial<ActionPlanBoard>): Promise<ActionPlanBoard> {
    const res = await authFetch(`${API_BASE_URL}/action-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
    if (res.status === 409) {
      let message = 'Já existe um plano de ação criado a partir desta origem.';
      let existingPlanId: string | undefined;
      try {
        const json = JSON.parse(await res.text());
        if (typeof json?.message === 'string' && json.message.trim()) message = json.message;
        if (typeof json?.existingPlanId === 'string' && json.existingPlanId) existingPlanId = json.existingPlanId;
      } catch { /* corpo ilegível: fica o texto padrão */ }
      throw new PlanSourceConflictError(message, existingPlanId);
    }
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

  async createTask(boardId: string, task: ActionPlanTaskInput): Promise<ActionPlanTask> {
    const res = await authFetch(`${API_BASE_URL}/action-plans/${boardId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    await ensureOk(res, 'Falha ao criar tarefa do plano de ação');
    return res.json();
  },

  /**
   * Edição parcial: só os campos enviados mudam; texto vazio ("") limpa o campo. `dueDate` (yyyy-MM-dd) muda o
   * prazo; para limpar, `clearDueDate: true`. A origem da ação (`sourceItemId`, `sourceLabel`) não muda depois de criada.
   */
  async updateTask(taskId: string, task: ActionPlanTaskInput): Promise<ActionPlanTask> {
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
