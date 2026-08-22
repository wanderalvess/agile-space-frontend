export interface VaultSecret {
  id?: string;
  payload: string;
  iv: string;
  expirationType: 'once' | '1h' | '24h';
  createdAt?: string;
  expiresAt?: string;
  isBurned?: boolean;
}

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Vault API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const vaultApi = {
  async createSecret(secret: VaultSecret): Promise<VaultSecret> {
    return req<VaultSecret>('/vault-secrets', {
      method: 'POST',
      body: JSON.stringify(secret),
    });
  },

  async getSecret(id: string): Promise<VaultSecret | null> {
    try {
      return await req<VaultSecret>(`/vault-secrets/${id}`);
    } catch (e: any) {
      if (e.message?.includes('404')) return null;
      throw e;
    }
  }
};
