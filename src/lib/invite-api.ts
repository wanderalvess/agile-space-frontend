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
  /** Só na página do convite: nome legível da squad (sem projeto cadastrado, vem vazio e fica a chave). */
  squadName?: string | null;
}

/** Mensagem em português para mostrar à pessoa; o corpo cru do Spring ({"status":400,...}) não serve para isso. */
export async function inviteErrorMessage(res: Response): Promise<string> {
  let serverMessage = '';
  try {
    const body = await res.json();
    serverMessage = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : '';
  } catch {
    /* corpo vazio ou não-JSON */
  }
  if (serverMessage && !/^(Bad Request|Forbidden|Not Found|Unauthorized)$/i.test(serverMessage)) return serverMessage;
  if (res.status === 404) return 'Convite não encontrado. Confira o link com quem te convidou.';
  if (res.status === 403) return 'Você não tem permissão para esta ação de convite.';
  if (res.status === 401) return 'Sua sessão expirou. Entre novamente.';
  return `Não foi possível concluir (erro ${res.status}).`;
}

/** Erro das chamadas de convite com o status HTTP à mão (403 = sem permissão; 429 = limite de requisições). */
export class InviteApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'InviteApiError';
    this.status = status;
  }
}

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new InviteApiError(res.status, await inviteErrorMessage(res));
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

  buildInviteLink(token: string): string {
    if (typeof window === 'undefined') return `/invite/${token}`;
    return `${window.location.origin}/invite/${token}`;
  },
};
