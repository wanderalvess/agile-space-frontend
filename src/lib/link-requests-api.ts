/**
 * Cliente do pedido de vínculo: a pessoa não conseguiu entrar numa squad pelos caminhos normais
 * (liderança com outro e-mail, linha que não reconhece como sua) e pede a um admin que confirme.
 *
 * Contrato do servidor:
 *  - POST /api/link-requests        -> 201 { id, status: 'PENDING' }
 *  - GET  /api/link-requests/mine   -> LinkRequest[]
 * Enquanto o servidor não tiver essas rotas (404/405), a tela mostra um aviso curto em vez de quebrar.
 */

import { authFetch } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-error';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type LinkRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateLinkRequestInput {
  projectKey: string;
  /** Linha da lista da squad sobre a qual é o pedido; ausente quando a pessoa nem aparece na lista. */
  memberId?: string;
  /** E-mail que a pessoa usa no Jira, para o admin conferir. */
  emailInJira: string;
  message?: string;
}

export interface CreatedLinkRequest {
  id: string;
  status: LinkRequestStatus;
}

export interface LinkRequest {
  id: string;
  projectKey: string;
  memberId?: string;
  memberName?: string;
  emailInJira: string;
  message?: string;
  status: LinkRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decisionNote?: string;
}

/** O servidor ainda não tem o recurso (404/405). A tela degrada com um aviso, sem tratar como falha. */
export class LinkRequestUnavailableError extends Error {
  constructor() {
    super('Pedido de vínculo ainda não está disponível');
    this.name = 'LinkRequestUnavailableError';
  }
}

const isUnavailable = (status: number) => status === 404 || status === 405;

async function failure(res: Response, fallback: string): Promise<Error> {
  if (isUnavailable(res.status)) return new LinkRequestUnavailableError();
  const text = await res.text().catch(() => '');
  let message = text;
  try {
    const json = JSON.parse(text);
    message = json.message || json.error || text;
  } catch {
    /* corpo não é JSON: vale o texto cru */
  }
  return new ApiError(message || fallback, res.status);
}

export async function createLinkRequest(input: CreateLinkRequestInput): Promise<CreatedLinkRequest> {
  const body: Record<string, string> = { projectKey: input.projectKey, emailInJira: input.emailInJira.trim() };
  if (input.memberId) body.memberId = input.memberId;
  const message = input.message?.trim();
  if (message) body.message = message;

  const res = await authFetch(`${API_BASE_URL}/link-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await failure(res, `Não foi possível enviar o pedido (${res.status})`);
  return res.json();
}

/** Pedidos da própria pessoa. Sem o recurso no servidor, devolve lista vazia. */
export async function listMyLinkRequests(): Promise<LinkRequest[]> {
  const res = await authFetch(`${API_BASE_URL}/link-requests/mine`);
  if (isUnavailable(res.status)) return [];
  if (!res.ok) throw await failure(res, `Não foi possível carregar seus pedidos (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export const isLinkRequestUnavailable = (err: unknown): err is LinkRequestUnavailableError =>
  err instanceof LinkRequestUnavailableError;
