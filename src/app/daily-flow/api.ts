import { Worklog } from '@/store/useDailyStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface DailyReportData {
  id?: string;
  userId: string;
  yesterday: string;
  today: string;
  blockers: string;
  date: string;
  timestamp?: string;
}

export const dailyFlowApi = {
  async listWorklogs(userId: string, date: string): Promise<Worklog[]> {
    const params = new URLSearchParams();
    params.append('userId', userId);
    params.append('date', date);

    const res = await fetch(`${API_BASE_URL}/daily/worklogs?${params.toString()}`);
    if (!res.ok) throw new Error('Falha ao listar registros de tempo');
    return res.json();
  },

  async listWeeklyWorklogs(userId: string, dates: string[]): Promise<Worklog[]> {
    const params = new URLSearchParams();
    params.append('userId', userId);

    const res = await fetch(`${API_BASE_URL}/daily/worklogs/weekly?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dates),
    });
    if (!res.ok) throw new Error('Falha ao listar registros de tempo semanais');
    return res.json();
  },

  async saveOrUpdateWorklog(log: Partial<Worklog>): Promise<Worklog> {
    const res = await fetch(`${API_BASE_URL}/daily/worklogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    if (!res.ok) throw new Error('Falha ao salvar registro de tempo');
    return res.json();
  },

  async deleteWorklog(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/daily/worklogs/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir registro de tempo');
  },

  async listDailyReports(userId: string): Promise<DailyReportData[]> {
    const params = new URLSearchParams();
    params.append('userId', userId);

    const res = await fetch(`${API_BASE_URL}/daily/reports?${params.toString()}`);
    if (!res.ok) throw new Error('Falha ao obter histórico de daily reports');
    return res.json();
  },

  async saveOrUpdateDailyReport(report: DailyReportData): Promise<DailyReportData> {
    const res = await fetch(`${API_BASE_URL}/daily/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new Error('Falha ao salvar daily report');
    return res.json();
  }
};
