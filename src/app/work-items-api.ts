const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

export const workItemsApi = {
  async getWorkItems(squadId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/work-items/${squadId}`);
    if (!res.ok) throw new Error('Falha ao carregar work items da squad');
    return res.json();
  },

  async getBacklogEstimated(squadId: string): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/work-items/${squadId}/backlog-estimated`);
    if (!res.ok) throw new Error('Falha ao carregar backlog estimado');
    return res.json();
  },

  async commitWorkItem(squadId: string, jiraKey: string, sprintId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/work-items/${squadId}/${jiraKey}/commit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sprint_id: sprintId }),
    });
    if (!res.ok) throw new Error('Falha ao commitar work item');
  },

  async showcaseDecision(squadId: string, jiraKey: string, status: string, feedback: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/work-items/${squadId}/${jiraKey}/showcase-decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, feedback }),
    });
    if (!res.ok) throw new Error('Falha ao enviar decisão de showcase');
  },

  async getSprintStats(squadId: string, sprintId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/work-items/${squadId}/sprint/${sprintId}/stats`);
    if (!res.ok) throw new Error('Falha ao obter stats da sprint');
    return res.json();
  }
};
