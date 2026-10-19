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

/** Pré-visualização do convite para quem ainda não entrou (GET /public/invites/{token}, sem sessão). */
export interface InvitePreview {
  squadId: string;
  /** Nome legível da squad; vazio quando só existe a chave. */
  squadName?: string | null;
  roleName: string;
  /** Nome de quem convidou, quando o servidor o conhece. */
  invitedByName?: string | null;
  status: Invite['status'];
  expiresAt: string;
  /** E-mail do destinatário mascarado (c••••@dominio), só em convite endereçado. */
  emailMasked?: string | null;
}

/** Código que o backend deve mandar (403) quando o convite é de um e-mail e a pessoa entrou com outro. */
export const INVITE_OTHER_EMAIL = 'INVITE_OTHER_EMAIL';

/**
 * Erro das chamadas de convite: além da mensagem em português, leva o status HTTP e, se o servidor mandar,
 * o `code` e o e-mail mascarado do convite (`invitedEmailMasked`). A tela decide o desenho por eles.
 */
export class InviteApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly invitedEmailMasked?: string;

  constructor(message: string, status: number, code?: string, invitedEmailMasked?: string) {
    super(message);
    this.name = 'InviteApiError';
    this.status = status;
    this.code = code;
    this.invitedEmailMasked = invitedEmailMasked;
  }
}

/**
 * "Esse convite é para outro e-mail". Hoje o `GET /invites/{token}` responde 404 genérico a quem não é o
 * destinatário, então isto nunca é verdade; liga sozinho quando o backend passar a responder
 * `403 { code: 'INVITE_OTHER_EMAIL', invitedEmailMasked: 'c••••@totvs.com.br' }`.
 */
export function isOtherEmailError(err: unknown): err is InviteApiError {
  return err instanceof InviteApiError && err.status === 403 && err.code === INVITE_OTHER_EMAIL;
}

function friendlyInviteMessage(status: number, serverMessage: string): string {
  if (serverMessage && !/^(Bad Request|Forbidden|Not Found|Unauthorized)$/i.test(serverMessage)) return serverMessage;
  if (status === 404) return 'Convite não encontrado. Confira o link com quem te convidou.';
  if (status === 403) return 'Você não tem permissão para esta ação de convite.';
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  return `Não foi possível concluir (erro ${status}).`;
}

/** Erro de uma resposta HTTP de convite, já com a mensagem para mostrar à pessoa. */
export async function inviteErrorFrom(res: Response): Promise<InviteApiError> {
  let serverMessage = '';
  let code: string | undefined;
  let masked: string | undefined;
  try {
    const body = await res.json();
    serverMessage = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : '';
    if (typeof body?.code === 'string') code = body.code;
    if (typeof body?.invitedEmailMasked === 'string') masked = body.invitedEmailMasked;
  } catch {
    /* corpo vazio ou não-JSON */
  }
  return new InviteApiError(friendlyInviteMessage(res.status, serverMessage), res.status, code, masked);
}

/** Mensagem em português para mostrar à pessoa; o corpo cru do Spring ({"status":400,...}) não serve para isso. */
export async function inviteErrorMessage(res: Response): Promise<string> {
  return (await inviteErrorFrom(res)).message;
}

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw await inviteErrorFrom(res);
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

  /** Sem sessão: serve a página do convite e o aviso do login. 404 = link que não existe. */
  async getPreview(token: string): Promise<InvitePreview> {
    const res = await fetch(`${API_BASE_URL}/public/invites/${encodeURIComponent(token)}`);
    if (!res.ok) throw await inviteErrorFrom(res);
    return res.json();
  },

  buildInviteLink(token: string): string {
    if (typeof window === 'undefined') return `/invite/${token}`;
    return `${window.location.origin}/invite/${token}`;
  },
};
