export interface AdminStats {
  totalUsers: number;
  totalShowcaseSessions: number;
  totalFeedbacks: number;
  totalKanbanCards: number;
  totalReleases: number;
  totalPokerRooms: number;
  totalRetroBoards: number;
  totalSprintPlannings: number;
  totalHealthCheckBoards: number;
  totalBrainstormingBoards: number;
  totalSessions: number;
  totalParticipations: number;
  avgSessionDurationMinutes: number | null;
  sessionDurationSampleSize: number;
}

/** Aviso v2 (contrato home-api, seção 1): tipo, público, vigência e link. */
export type Announcement = AnnouncementDto;

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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  /** Token do link de redefinição: só vem na resposta que gera o link (o servidor guarda apenas o hash). */
  resetToken?: string;
  tokenExpiresAt?: string;
  usedAt?: string;
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
  expiresAt?: string | null;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  rawKey: string;
  createdAt: string;
}

import { authFetch } from '@/lib/auth-client';
import { adminAnnouncementsApi, type AnnouncementDto, type AnnouncementInput } from '@/lib/home-api';

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

  getAnnouncements(): Promise<Announcement[]> {
    return adminAnnouncementsApi.list();
  },

  createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
    return adminAnnouncementsApi.create(input);
  },

  updateAnnouncement(id: string, input: AnnouncementInput): Promise<Announcement> {
    return adminAnnouncementsApi.update(id, input);
  },

  deleteAnnouncement(id: string): Promise<void> {
    return adminAnnouncementsApi.remove(id);
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

  /** Redefinição iniciada pelo admin: gera e aprova de uma vez e devolve o link (resetToken) de uso único. */
  async resetUserPassword(userId: string): Promise<PasswordResetRequest> {
    return req<PasswordResetRequest>(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {
      method: 'POST'
    });
  },

  async getApiKeys(): Promise<ApiKeyData[]> {
    return req<ApiKeyData[]>('/admin/api-keys');
  },

  /** expiresIn: '30' | '90' | '180' | 'never'. Omitido = 90 dias. */
  async createApiKey(name: string, expiresIn?: string): Promise<CreatedApiKey> {
    const expiry = !expiresIn ? {} : expiresIn === 'never' ? { neverExpires: 'true' } : { expiresInDays: expiresIn };
    return req<CreatedApiKey>('/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, ...expiry }),
    });
  },

  async renewApiKey(id: string, expiresIn?: string): Promise<ApiKeyData> {
    const expiry = !expiresIn ? {} : expiresIn === 'never' ? { neverExpires: true } : { expiresInDays: Number(expiresIn) };
    return req<ApiKeyData>(`/admin/api-keys/${encodeURIComponent(id)}/renew`, {
      method: 'POST',
      body: JSON.stringify(expiry),
    });
  },

  async revokeApiKey(id: string): Promise<void> {
    return req<void>(`/admin/api-keys/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
  }
};

// Lidos antes do login (branding) — sem JWT, isento do
// gate de role=ADMIN que protege /admin/*. Usa fetch puro (não authFetch)
// porque essas telas rodam acima do AuthProvider na árvore de providers.
export const publicApi = {
  async getSystemConfig(): Promise<Record<string, string>> {
    try {
      const res = await fetch(`${API_BASE_URL}/public/system-config`);
      if (!res.ok) return {};
      return await res.json();
    } catch {
      return {};
    }
  },
};
