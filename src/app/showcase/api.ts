import { ShowcaseSession } from '@/components/showcase/types';
import { authFetch, getAuthToken } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8002/ws';

import { req as resilientReq } from '@/lib/http-client';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Showcase API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const showcaseApi = {
  async getSessions(limit = 50): Promise<ShowcaseSession[]> {
    return req<ShowcaseSession[]>(`/showcase-sessions?limit=${limit}`);
  },

  async getSession(id: string): Promise<ShowcaseSession | null> {
    try {
      return await req<ShowcaseSession>(`/showcase-sessions/${id}`);
    } catch (e: any) {
      if (e.status === 404 || e.message?.includes('404')) return null;
      throw e;
    }
  },

  async saveSession(session: Partial<ShowcaseSession>): Promise<ShowcaseSession> {
    return req<ShowcaseSession>('/showcase-sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  },

  getWebSocketUrl(id: string): string {
    return `${WS_BASE_URL}/showcase/${id}?token=${encodeURIComponent(getAuthToken() || '')}`;
  }
};
