import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

// Quando o servidor recusa (400/403…) ele manda uma frase pronta em { message }; é ela que a pessoa deve ler.
// Sem corpo legível, vale o texto padrão de cada chamada.
async function fail(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await res.json();
    if (typeof body?.message === 'string' && body.message.trim()) message = body.message;
  } catch {
    // corpo vazio ou não-JSON: fica o texto padrão
  }
  throw new Error(message);
}

const seg = encodeURIComponent;

export const workItemsApi = {
  async getWorkItems(squadId: string): Promise<any[]> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${seg(squadId)}`);
    if (!res.ok) return fail(res, 'Falha ao carregar work items da squad');
    return res.json();
  },

  async getBacklogEstimated(squadId: string): Promise<any[]> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${seg(squadId)}/backlog-estimated`);
    if (!res.ok) return fail(res, 'Falha ao carregar backlog estimado');
    return res.json();
  },

  async commitWorkItem(squadId: string, jiraKey: string, sprintId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${seg(squadId)}/${seg(jiraKey)}/commit`, {
      method: 'PUT',
      body: JSON.stringify({ sprint_id: sprintId }),
    });
    if (!res.ok) return fail(res, 'Falha ao comitar work item na sprint');
  },

  async showcaseDecision(squadId: string, jiraKey: string, status: string, feedback: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${seg(squadId)}/${seg(jiraKey)}/showcase-decision`, {
      method: 'PUT',
      body: JSON.stringify({ status, feedback }),
    });
    if (!res.ok) return fail(res, 'Falha ao registrar a decisão da Review');
  },

  async estimateWorkItem(squadId: string, jiraKey: string, points: number): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${seg(squadId)}/${seg(jiraKey)}/estimate`, {
      method: 'PUT',
      body: JSON.stringify({ points_estimated: points }),
    });
    if (!res.ok) return fail(res, 'Falha ao estimar work item');
  },

  async getAssignedWorkItems(squadId: string, accountId: string): Promise<any[]> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${seg(squadId)}/assignee/${seg(accountId)}`);
    if (!res.ok) return fail(res, 'Falha ao obter work items do usuário');
    return res.json();
  },

  async getSprintStats(squadId: string, sprintId: string): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${seg(squadId)}/sprint/${seg(sprintId)}/stats`);
    if (!res.ok) return fail(res, 'Falha ao obter stats da sprint');
    return res.json();
  }
};
