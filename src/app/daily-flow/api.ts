import { Worklog } from '@/store/useDailyStore';
import { authFetch } from '@/lib/auth-client';
import type { DailyDigestResult } from '@/lib/dailyDigestExtract';

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

export interface DailyCheckinData {
  id?: string;
  userId: string;
  userName: string;
  userRole?: string;
  userAvatar?: string;
  squadId: string;
  date: string;
  yesterday?: string;
  today: string;
  blockers: string;
  blockerDuration?: string;
  hasBlocker: boolean;
  isPrivate?: boolean;
}

export interface DailyDigestExtractResponse extends DailyDigestResult {
  source: 'ai' | 'rules';
  warning?: string;
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
      body: JSON.stringify(log),
    });
    if (!res.ok) throw new Error('Falha ao salvar worklog');
    return res.json();
  },

  async deleteWorklog(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/daily/worklogs/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao excluir worklog');
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
  },

  // --- Daily Digest com IA ---
  async extractDigest(rawText: string, useAi: boolean, apiKey?: string): Promise<DailyDigestExtractResponse> {
    const res = await fetch('/api/daily-digest/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, useAi, apiKey }),
    });
    if (!res.ok) throw new Error('Falha ao extrair resumo da daily');
    return res.json();
  },

  async listCheckins(squadId: string, date: string): Promise<DailyCheckinData[]> {
    try {
      const params = new URLSearchParams({ squadId, date });
      const res = await authFetch(`${API_BASE_URL}/daily-checkins?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    } catch (err) {
      console.warn('Backend offline ou inacessível ao buscar daily checkins:', err);
      return [];
    }
  },

  async saveCheckinsBatch(checkins: DailyCheckinData[]): Promise<DailyCheckinData[]> {
    const res = await authFetch(`${API_BASE_URL}/daily-checkins/batch`, {
      method: 'POST',
      body: JSON.stringify(checkins),
    });
    if (!res.ok) throw new Error('Falha ao salvar os checkins da daily');
    return res.json();
  },
};
