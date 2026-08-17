export interface AdminStats {
  totalUsers: number;
  totalShowcaseSessions: number;
  totalFeedbacks: number;
  totalVaultSecrets: number;
  totalFocusSessions: number;
  totalKanbanCards: number;
}

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt?: string;
}

export interface AuditLogData {
  id?: string;
  action: string;
  performedBy: string;
  details?: string;
  createdAt?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Admin API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const adminApi = {
  async getStats(): Promise<AdminStats> {
    return req<AdminStats>('/admin/stats');
  },

  async getConfig(key: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/admin/configs/${key}`);
    if (res.status === 404) return '';
    if (!res.ok) throw new Error(`Admin Config error ${res.status}`);
    return res.text();
  },

  async setConfig(key: string, value: string): Promise<void> {
    await fetch(`${API_BASE_URL}/admin/configs/${key}`, {
      method: 'POST',
      body: value
    });
  },

  async getAnnouncements(): Promise<Announcement[]> {
    return req<Announcement[]>('/admin/announcements');
  },

  async createAnnouncement(announcement: Announcement): Promise<Announcement> {
    return req<Announcement>('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(announcement)
    });
  },

  async deleteAnnouncement(id: string): Promise<void> {
    return req<void>(`/admin/announcements/${id}`, { method: 'DELETE' });
  },

  async getAuditLogs(): Promise<AuditLogData[]> {
    return req<AuditLogData[]>('/admin/audit-logs');
  },

  async logAction(action: string, performedBy: string, details?: string): Promise<AuditLogData> {
    return req<AuditLogData>(`/admin/audit-logs?action=${encodeURIComponent(action)}&performedBy=${encodeURIComponent(performedBy)}`, {
      method: 'POST',
      body: details
    });
  }
};
