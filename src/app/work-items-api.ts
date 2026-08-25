import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

export const workItemsApi = {
  async getWorkItems(squadId: string): Promise<any[]> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${squadId}`);
    if (!res.ok) throw new Error('Falha ao carregar work items da squad');
    return res.json();
  },

  async getBacklogEstimated(squadId: string): Promise<any[]> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${squadId}/backlog-estimated`);
    if (!res.ok) throw new Error('Falha ao carregar backlog estimado');
    return res.json();
  },

  async commitWorkItem(squadId: string, jiraKey: string, sprintId: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${squadId}/${jiraKey}/commit`, {
      method: 'PUT',
      body: JSON.stringify({ sprint_id: sprintId }),
    });
  },

  async showcaseDecision(squadId: string, jiraKey: string, status: string, feedback: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${squadId}/${jiraKey}/showcase-decision`, {
      method: 'PUT',
      body: JSON.stringify({ status, feedback }),
    });
  },

  async estimateWorkItem(squadId: string, jiraKey: string, points: number): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${squadId}/${jiraKey}/estimate`, {
      method: 'PUT',
      body: JSON.stringify({ points_estimated: points }),
    });
    if (!res.ok) throw new Error('Falha ao estimar work item');
  },

  async getAssignedWorkItems(squadId: string, accountId: string): Promise<any[]> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${squadId}/assignee/${accountId}`);
    if (!res.ok) throw new Error('Falha ao obter work items do usuário');
    return res.json();
  },

  async getSprintStats(squadId: string, sprintId: string): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/work-items/${squadId}/sprint/${sprintId}/stats`);
    if (!res.ok) throw new Error('Falha ao obter stats da sprint');
    return res.json();
  }
};
