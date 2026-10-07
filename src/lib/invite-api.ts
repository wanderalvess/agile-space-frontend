import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export interface Invite {
  id: string;
  token: string;
  squadId: string;
  roleName: string;
  email?: string | null;
  invitedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
  acceptedByUserId?: string | null;
}

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Invite API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const inviteApi = {
  async createInvite(squadId: string, roleName: string, email?: string): Promise<Invite> {
    return req<Invite>(`/squads/${squadId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ roleName, email: email || undefined }),
    });
  },

  async listInvites(squadId: string): Promise<Invite[]> {
    return req<Invite[]>(`/squads/${squadId}/invites`);
  },

  async revokeInvite(squadId: string, id: string): Promise<void> {
    return req<void>(`/squads/${squadId}/invites/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getInvite(token: string): Promise<Invite> {
    return req<Invite>(`/invites/${encodeURIComponent(token)}`);
  },

  async acceptInvite(token: string): Promise<void> {
    await req(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });
  },

  buildInviteLink(token: string): string {
    if (typeof window === 'undefined') return `/invite/${token}`;
    return `${window.location.origin}/invite/${token}`;
  },
};
