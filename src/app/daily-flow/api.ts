import { Worklog } from '@/store/useDailyStore';
import { authFetch } from '@/lib/auth-client';

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
    try {
      const params = new URLSearchParams();
      params.append('userId', userId);
      params.append('date', date);

      const res = await authFetch(`${API_BASE_URL}/daily/worklogs?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    } catch (err) {
      console.warn('Backend offline ou inacessível ao buscar worklogs:', err);
      return [];
    }
  },

  async listWeeklyWorklogs(userId: string, dates: string[]): Promise<Worklog[]> {
    try {
      const params = new URLSearchParams();
      params.append('userId', userId);

      const res = await authFetch(`${API_BASE_URL}/daily/worklogs/weekly?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dates),
      });
      if (!res.ok) return [];
      return res.json();
    } catch (err) {
      console.warn('Backend offline ou inacessível ao buscar worklogs semanais:', err);
      return [];
    }
  },

  async saveOrUpdateWorklog(log: Partial<Worklog>): Promise<Worklog> {
    const res = await authFetch(`${API_BASE_URL}/daily/worklogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    if (!res.ok) throw new Error('Falha ao salvar registro de tempo');
    return res.json();
  },

  async deleteWorklog(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/daily/worklogs/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir registro de tempo');
  },

  async listDailyReports(userId: string): Promise<DailyReportData[]> {
    try {
      const params = new URLSearchParams();
      params.append('userId', userId);

      const res = await authFetch(`${API_BASE_URL}/daily/reports?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    } catch (err) {
      console.warn('Backend offline ou inacessível ao buscar daily reports:', err);
      return [];
    }
  },

  async saveOrUpdateDailyReport(report: DailyReportData): Promise<DailyReportData> {
    const res = await authFetch(`${API_BASE_URL}/daily/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new Error('Falha ao salvar daily report');
    return res.json();
  },

  async deleteDailyReport(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/daily/reports/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir daily report');
  }
};
