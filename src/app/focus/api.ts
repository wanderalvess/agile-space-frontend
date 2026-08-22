import { authFetch } from '@/lib/auth-client';

export interface FocusSessionData {
  id?: string;
  userId?: string;
  durationMinutes: number;
  taskCategory?: string;
  createdAt?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Focus Session API error ${res.status}`);
  return res.json();
}

export const focusApi = {
  async getSessions(userId: string): Promise<FocusSessionData[]> {
    return req<FocusSessionData[]>(`/focus-sessions/${userId}`);
  },

  async saveSession(userId: string, session: Partial<FocusSessionData>): Promise<FocusSessionData> {
    return req<FocusSessionData>(`/focus-sessions/${userId}`, {
      method: 'POST',
      body: JSON.stringify(session)
    });
  }
};
