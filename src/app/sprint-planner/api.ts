const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export const sprintPlanningApi = {
  async getPlanner(id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/sprint-plannings/${id}`);
    if (!res.ok) throw new Error('Falha ao carregar planejamento');
    return res.json();
  },

  async saveOrUpdatePlanner(planner: any): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/sprint-plannings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planner),
    });
    if (!res.ok) throw new Error('Falha ao salvar planejamento');
    return res.json();
  },

  async deletePlanner(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/sprint-plannings/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao deletar planejamento');
  }
};
