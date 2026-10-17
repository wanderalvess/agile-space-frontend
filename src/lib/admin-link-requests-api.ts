import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type LinkRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Pedido de vínculo de liderança: a pessoa diz que o e-mail do Jira é outro e pede a um admin que a vincule. */
export interface LinkRequest {
  id: string;
  requester: { id: string; name: string; email: string };
  projectKey: string;
  memberId?: string | null;
  memberName?: string | null;
  emailInJira: string;
  message?: string | null;
  status: LinkRequestStatus;
  createdAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisionNote?: string | null;
  kind?: 'CONTRIBUTOR' | 'LEADERSHIP' | null;
  /** Papel de contribuidor pedido por quem não aparece na lista do time. */
  requestedRoleName?: string | null;
}

/** Erro das chamadas de vínculo: leva o status HTTP para a tela distinguir "endpoint ainda não existe" de falha. */
export class LinkRequestsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'LinkRequestsApiError';
    this.status = status;
  }
}

/** 404/405: o backend deste ambiente ainda não tem os pedidos de vínculo. A tela mostra um aviso, não um erro. */
export function isLinkRequestsUnavailable(err: unknown): boolean {
  return err instanceof LinkRequestsApiError && (err.status === 404 || err.status === 405);
}

async function errorFrom(res: Response, fallback: string): Promise<LinkRequestsApiError> {
  let message = '';
  try {
    const body = await res.json();
    message = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : '';
  } catch {
    /* corpo vazio ou não-JSON */
  }
  return new LinkRequestsApiError(message.trim() || fallback, res.status);
}

/** Lista os pedidos; sem `status` vêm todos. */
export async function listLinkRequests(status?: LinkRequestStatus): Promise<LinkRequest[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authFetch(`${API_BASE_URL}/admin/link-requests${query}`);
  if (!res.ok) throw await errorFrom(res, 'Não foi possível carregar os pedidos de vínculo.');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function approveLinkRequest(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/admin/link-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' });
  if (!res.ok) throw await errorFrom(res, 'Não foi possível aprovar o vínculo.');
}

/** `reason` é opcional; vazio não é enviado. */
export async function rejectLinkRequest(id: string, reason?: string): Promise<void> {
  const trimmed = reason?.trim();
  const res = await authFetch(`${API_BASE_URL}/admin/link-requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify(trimmed ? { reason: trimmed } : {}),
  });
  if (!res.ok) throw await errorFrom(res, 'Não foi possível recusar o pedido.');
}
