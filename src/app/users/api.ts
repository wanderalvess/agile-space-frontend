import { UserProfile } from '@/lib/types';

export interface UserJiraConfig {
  userId?: string;
  token: string;
  domain: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`User API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const userApi = {
  async getUser(id: string): Promise<UserProfile | null> {
    try {
      return await req<UserProfile>(`/users/${id}`);
    } catch (e: any) {
      if (e.message?.includes('404') || e.name === 'TypeError' || e.message?.includes('Failed to fetch')) {
        return null;
      }
      throw e;
    }
  },

  async saveUser(user: Partial<UserProfile>): Promise<UserProfile> {
    try {
      return await req<UserProfile>('/users', {
        method: 'POST',
        body: JSON.stringify(user)
      });
    } catch (e: any) {
      console.warn("userApi.saveUser warning (backend offline?):", e.message || e);
      return user as UserProfile;
    }
  },

  async getJiraConfig(userId: string): Promise<UserJiraConfig | null> {
    try {
      return await req<UserJiraConfig>(`/users/${userId}/jira-config`);
    } catch (e: any) {
      if (e.message?.includes('404') || e.name === 'TypeError' || e.message?.includes('Failed to fetch')) {
        return null;
      }
      throw e;
    }
  },

  async saveJiraConfig(userId: string, config: UserJiraConfig): Promise<UserJiraConfig> {
    try {
      return await req<UserJiraConfig>(`/users/${userId}/jira-config`, {
        method: 'POST',
        body: JSON.stringify(config)
      });
    } catch (e: any) {
      console.warn("userApi.saveJiraConfig warning (backend offline?):", e.message || e);
      return config;
    }
  },

  async deleteJiraConfig(userId: string): Promise<void> {
    try {
      return await req<void>(`/users/${userId}/jira-config`, { method: 'DELETE' });
    } catch (e: any) {
      console.warn("userApi.deleteJiraConfig warning (backend offline?):", e.message || e);
    }
  }
};
