import { UserProfile } from '@/lib/types';
import { authFetch } from '@/lib/auth-client';

export interface UserJiraConfig {
  userId?: string;
  token: string;
  domain: string;
}

export interface UserTdnConfig {
  userId?: string;
  token: string;
  baseUrl: string;
  space?: string;
  label?: string;
}

import { req as resilientReq } from '@/lib/http-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`User API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Constrói os headers base para chamadas em nome de um userId.
 * X-Caller-Id é validado pelo backend para garantir que apenas o dono
 * do recurso acessa/modifica seus dados.
 */
function callerHeaders(userId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Caller-Id': userId,
  };
}

export const userApi = {
  async getAllUsers(): Promise<UserProfile[]> {
    try {
      return await req<UserProfile[]>('/users');
    } catch (e: any) {
      console.warn("userApi.getAllUsers warning:", e.message || e);
      return [];
    }
  },

  async getUser(id: string): Promise<UserProfile | null> {
    try {
      return await req<UserProfile>(`/users/${id}`);
    } catch (e: any) {
      if (e.status === 404 || e.message?.includes('404') || e.name === 'TypeError' || e.message?.includes('Failed to fetch')) {
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
      return await req<UserJiraConfig>(`/users/${userId}/jira-config`, {
        headers: callerHeaders(userId),
      });
    } catch (e: any) {
      if (e.status === 404 || e.status === 403 || e.message?.includes('404') || e.message?.includes('403') || e.name === 'TypeError' || e.message?.includes('Failed to fetch')) {
        return null;
      }
      throw e;
    }
  },

  async saveJiraConfig(userId: string, config: UserJiraConfig): Promise<UserJiraConfig> {
    try {
      return await req<UserJiraConfig>(`/users/${userId}/jira-config`, {
        method: 'POST',
        headers: callerHeaders(userId),
        body: JSON.stringify(config)
      });
    } catch (e: any) {
      console.warn("userApi.saveJiraConfig warning (backend offline?):", e.message || e);
      return config;
    }
  },

  async deleteJiraConfig(userId: string): Promise<void> {
    try {
      await req<void>(`/users/${userId}/jira-config`, {
        method: 'DELETE',
        headers: callerHeaders(userId),
      });
    } catch (e: any) {
      console.warn("userApi.deleteJiraConfig warning (backend offline?):", e.message || e);
    }
  },

  async getTdnConfig(userId: string): Promise<UserTdnConfig | null> {
    try {
      return await req<UserTdnConfig>(`/users/${userId}/tdn-config`, {
        headers: callerHeaders(userId),
      });
    } catch (e: any) {
      if (e.status === 404 || e.status === 403 || e.message?.includes('404') || e.message?.includes('403') || e.name === 'TypeError' || e.message?.includes('Failed to fetch')) {
        return null;
      }
      throw e;
    }
  },

  async saveTdnConfig(userId: string, config: UserTdnConfig): Promise<UserTdnConfig> {
    try {
      return await req<UserTdnConfig>(`/users/${userId}/tdn-config`, {
        method: 'POST',
        headers: callerHeaders(userId),
        body: JSON.stringify(config)
      });
    } catch (e: any) {
      console.warn("userApi.saveTdnConfig warning (backend offline?):", e.message || e);
      return config;
    }
  },

  async deleteTdnConfig(userId: string): Promise<void> {
    try {
      await req<void>(`/users/${userId}/tdn-config`, {
        method: 'DELETE',
        headers: callerHeaders(userId),
      });
    } catch (e: any) {
      console.warn("userApi.deleteTdnConfig warning (backend offline?):", e.message || e);
    }
  },

  async getMyself(domain: string, token: string): Promise<any> {
    const res = await authFetch(`${API_BASE_URL}/jira/myself`, {
      method: 'POST',
      body: JSON.stringify({ domain, token })
    });
  },

  async validateJiraToken(domain: string, token: string): Promise<{ valid: boolean; user?: any; error?: string }> {
    try {
      const data = await this.getMyself(domain, token);
      return { valid: true, user: data };
    } catch (e: any) {
      return { valid: false, error: e.message };
    }
  }
};


