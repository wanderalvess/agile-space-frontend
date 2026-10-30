import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

/** Tipo do chamado (campo próprio). Chamado antigo vem sem `type`: o tipo ia embutido no assunto. */
export type SupportTicketType = 'support' | 'bug' | 'suggestion' | 'feedback';

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  requesterId: string;
  requesterName?: string;
  requesterEmail?: string;
  createdAt: string;
  updatedAt?: string;
  /** Ausente em chamado antigo e em servidor antigo. */
  type?: SupportTicketType | null;
  /** SUP-0042. Ausente em servidor antigo (a tela deriva um do id). */
  protocol?: string | null;
  /** Respostas do time ainda não lidas pelo solicitante (só na lista "mine"). */
  unreadReplies?: number;
  hasUnreadReply?: boolean;
  requesterLastReadAt?: string | null;
}

export interface SupportTicketReply {
  id: string;
  ticketId: string;
  authorId?: string;
  authorName?: string;
  isAdmin: boolean;
  /** O Jackson serializa o getter `isAdmin()` do Lombok como "admin"; a tela lê os dois (ver replyIsAdmin). */
  admin?: boolean;
  message: string;
  createdAt: string;
}

export interface CreateTicketPayload {
  subject: string;
  message: string;
  type?: SupportTicketType;
  requesterName?: string;
}

export interface AddReplyPayload {
  message: string;
  authorName?: string;
}

/** Erro da API de chamados com o status HTTP (a tela trata 404 e 409 de forma própria). */
export class SupportApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Support API error ${status}`);
    this.name = 'SupportApiError';
    this.status = status;
  }
}

async function ensureOk(res: Response): Promise<Response> {
  if (!res.ok) throw new SupportApiError(res.status);
  return res;
}

export const supportApi = {
  async createTicket(payload: CreateTicketPayload): Promise<SupportTicket> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await ensureOk(res)).json();
  },

  async listMine(): Promise<SupportTicket[]> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/mine`);
    return (await ensureOk(res)).json();
  },

  async listAll(status?: SupportTicketStatus): Promise<SupportTicket[]> {
    const url = status
      ? `${API_BASE_URL}/support/tickets?status=${encodeURIComponent(status)}`
      : `${API_BASE_URL}/support/tickets`;
    const res = await authFetch(url);
    return (await ensureOk(res)).json();
  },

  async updateStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/status?status=${encodeURIComponent(status)}`, {
      method: 'PATCH',
    });
    return (await ensureOk(res)).json();
  },

  /** O solicitante fecha o próprio chamado. */
  async closeTicket(id: string): Promise<SupportTicket> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/close`, { method: 'PATCH' });
    return (await ensureOk(res)).json();
  },

  /** O solicitante reabre o próprio chamado (só se estiver fechado; senão 409). */
  async reopenTicket(id: string): Promise<SupportTicket> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/reopen`, { method: 'PATCH' });
    return (await ensureOk(res)).json();
  },

  /** O solicitante abriu o chamado: zera "Nova resposta" e o aviso do sino. */
  async markRead(id: string): Promise<SupportTicket> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/read`, { method: 'POST' });
    return (await ensureOk(res)).json();
  },

  async getReplies(id: string): Promise<SupportTicketReply[]> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/replies`);
    return (await ensureOk(res)).json();
  },

  async addReply(id: string, payload: AddReplyPayload): Promise<SupportTicketReply> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await ensureOk(res)).json();
  },

  async deleteTicket(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}`, {
      method: 'DELETE',
    });
    await ensureOk(res);
  },
};
