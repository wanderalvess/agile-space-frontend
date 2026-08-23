import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

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
}

export interface SupportTicketReply {
  id: string;
  ticketId: string;
  authorId?: string;
  authorName?: string;
  isAdmin: boolean;
  message: string;
  createdAt: string;
}

export interface CreateTicketPayload {
  subject: string;
  message: string;
  requesterName?: string;
}

export interface AddReplyPayload {
  message: string;
  authorName?: string;
}

export const supportApi = {
  async createTicket(payload: CreateTicketPayload): Promise<SupportTicket> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Support API error ${res.status}`);
    return res.json();
  },

  async listMine(): Promise<SupportTicket[]> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/mine`);
    if (!res.ok) throw new Error(`Support API error ${res.status}`);
    return res.json();
  },

  async listAll(status?: SupportTicketStatus): Promise<SupportTicket[]> {
    const url = status
      ? `${API_BASE_URL}/support/tickets?status=${encodeURIComponent(status)}`
      : `${API_BASE_URL}/support/tickets`;
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`Support API error ${res.status}`);
    return res.json();
  },

  async updateStatus(id: string, status: SupportTicketStatus): Promise<SupportTicket> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/status?status=${encodeURIComponent(status)}`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error(`Support API error ${res.status}`);
    return res.json();
  },

  async getReplies(id: string): Promise<SupportTicketReply[]> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/replies`);
    if (!res.ok) throw new Error(`Support API error ${res.status}`);
    return res.json();
  },

  async addReply(id: string, payload: AddReplyPayload): Promise<SupportTicketReply> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Support API error ${res.status}`);
    return res.json();
  },

  async deleteTicket(id: string): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/support/tickets/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Support API error ${res.status}`);
  },
};
