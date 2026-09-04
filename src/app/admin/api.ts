export interface AdminStats {
  totalUsers: number;
  totalShowcaseSessions: number;
  totalFeedbacks: number;
  totalVaultSecrets: number;
  totalFocusSessions: number;
  totalKanbanCards: number;
  totalReleases: number;
  totalPokerRooms: number;
  totalRetroBoards: number;
  totalSprintPlannings: number;
  totalHealthCheckBoards: number;
  totalBrainstormingBoards: number;
  totalDailyCheckins: number;
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

export interface PasswordResetRequest {
  id: string;
  userEmail: string;
  userName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  tempPassword?: string;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface ApiKeyData {
  id: string;
  name: string;
  ownerUserId?: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  rawKey: string;
  createdAt: string;
}

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
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
    const res = await authFetch(`${API_BASE_URL}/admin/configs/${key}`);
    if (res.status === 404) return '';
    if (!res.ok) throw new Error(`Admin Config error ${res.status}`);
    return res.text();
  },

  async setConfig(key: string, value: string): Promise<void> {
    await authFetch(`${API_BASE_URL}/admin/configs/${key}`, {
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
  },

  async getSessions(): Promise<any[]> {
    return req<any[]>('/admin/sessions');
  },

  async deleteSession(id: string, type: string): Promise<void> {
    return req<void>(`/admin/sessions/${encodeURIComponent(id)}?type=${encodeURIComponent(type)}`, { method: 'DELETE' });
  },

  async getPasswordResets(): Promise<PasswordResetRequest[]> {
    return req<PasswordResetRequest[]>('/admin/password-resets');
  },

  async approvePasswordReset(id: string): Promise<PasswordResetRequest> {
    return req<PasswordResetRequest>(`/admin/password-resets/${encodeURIComponent(id)}/approve`, {
      method: 'POST'
    });
  },

  async getApiKeys(): Promise<ApiKeyData[]> {
    return req<ApiKeyData[]>('/admin/api-keys');
  },

  async createApiKey(name: string): Promise<CreatedApiKey> {
    return req<CreatedApiKey>('/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async revokeApiKey(id: string): Promise<void> {
    return req<void>(`/admin/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
  }
};

// Lidos antes do login (branding, banner de anúncio) — sem JWT, isento do
// gate de role=ADMIN que protege /admin/*. Usa fetch puro (não authFetch)
// porque essas telas rodam acima do AuthProvider na árvore de providers.
export const publicApi = {
  async getSystemConfig(): Promise<Record<string, string>> {
    const res = await fetch(`${API_BASE_URL}/public/system-config`);
    if (!res.ok) throw new Error(`Public config error ${res.status}`);
    return res.json();
  },

  async getAnnouncements(): Promise<Announcement[]> {
    const res = await fetch(`${API_BASE_URL}/public/announcements`);
    if (!res.ok) throw new Error(`Public announcements error ${res.status}`);
    return res.json();
  }
};
