/**
 * Pedidos de vínculo vistos pela própria squad: quem aprova (Agile Master, Scrum Master, Product Owner, People
 * Lead da squad; liderança só People Lead/Tribe Lead) decide aqui, sem passar pelo admin.
 *
 * Contrato do servidor (docs/link-requests-squad-api.md do backend):
 *  - GET  /api/squads/{id}/link-requests/can-approve        -> { canApprove, canApproveLeadership }
 *  - GET  /api/squads/{id}/link-requests?status=&size=      -> pedidos (PENDING | APPROVED | REJECTED | ALL), mais novos primeiro
 *  - POST /api/squads/{id}/link-requests/{reqId}/approve    -> pedido decidido (corpo opcional { memberId })
 *  - POST /api/squads/{id}/link-requests/{reqId}/reject     -> pedido decidido (corpo opcional { reason })
 *
 * Servidor antigo ou recurso desligado respondem 404/405: a aba "Pedidos" simplesmente não aparece
 * (`fetchApprovalAccess` nunca lança; qualquer falha vira "sem acesso").
 */

import { authFetch } from '@/lib/auth-client';
import { ApiError } from '@/lib/api-error';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type SquadRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SquadRequestFilter = SquadRequestStatus | 'ALL';
/** CONTRIBUTOR: pessoa comum (papel da lista de auto-cadastro). LEADERSHIP: linha de liderança do time. */
export type SquadRequestKind = 'CONTRIBUTOR' | 'LEADERSHIP';

export interface SquadLinkRequest {
  id: string;
  requester: { id: string; name: string; email: string };
  projectKey: string;
  kind: SquadRequestKind;
  /** Papel que a pessoa pediu (contribuidor sem linha) ou papel da linha que quer assumir. */
  requestedRoleName?: string;
  memberId?: string;
  /** Linha do time que a pessoa pediu para assumir, se houver. */
  memberName?: string;
  emailInJira: string;
  message?: string;
  status: SquadRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
  /** O servidor diz se quem pergunta pode decidir ESTE pedido (liderança que o Agile Master vê mas não decide). */
  canDecide?: boolean;
}

export interface ApprovalAccess {
  canApprove: boolean;
  canApproveLeadership: boolean;
}

export const NO_APPROVAL_ACCESS: ApprovalAccess = { canApprove: false, canApproveLeadership: false };

const squadPath = (squadId: string) => `${API_BASE_URL}/squads/${encodeURIComponent(squadId)}/link-requests`;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Aceita campos ausentes ou nulos do servidor; o que a tela precisa sai sempre preenchido. */
export function normalizeSquadLinkRequest(raw: unknown): SquadLinkRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = text(r.id);
  if (!id) return null;
  const requester = (r.requester && typeof r.requester === 'object' ? r.requester : {}) as Record<string, unknown>;
  const status: SquadRequestStatus = r.status === 'APPROVED' || r.status === 'REJECTED' ? r.status : 'PENDING';
  return {
    id,
    requester: { id: text(requester.id) ?? '', name: text(requester.name) ?? '', email: text(requester.email) ?? '' },
    projectKey: text(r.projectKey) ?? '',
    kind: r.kind === 'LEADERSHIP' ? 'LEADERSHIP' : 'CONTRIBUTOR',
    requestedRoleName: text(r.requestedRoleName),
    memberId: text(r.memberId),
    memberName: text(r.memberName),
    emailInJira: text(r.emailInJira) ?? '',
    message: text(r.message),
    status,
    createdAt: text(r.createdAt) ?? '',
    decidedAt: text(r.decidedAt),
    decidedBy: text(r.decidedBy),
    decisionNote: text(r.decisionNote),
    canDecide: typeof r.canDecide === 'boolean' ? r.canDecide : undefined,
  };
}

async function failure(res: Response, fallback: string): Promise<ApiError> {
  let message = '';
  try {
    const body = await res.json();
    message = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : '';
  } catch {
    /* corpo vazio ou não-JSON */
  }
  return new ApiError(message.trim() || fallback, res.status);
}

/** 404/405: o servidor deste ambiente não tem o recurso (ou a chave está desligada). */
export const isSquadRequestsUnavailable = (err: unknown): boolean =>
  err instanceof ApiError && (err.status === 404 || err.status === 405);

/**
 * Quem decide o quê nesta squad. Nunca lança: 404, 403, rede ou resposta estranha = sem acesso, e a aba
 * "Pedidos" não aparece. O servidor valida de novo em cada decisão.
 */
export async function fetchApprovalAccess(squadId: string): Promise<ApprovalAccess> {
  if (!squadId) return NO_APPROVAL_ACCESS;
  try {
    const res = await authFetch(`${squadPath(squadId)}/can-approve`);
    if (!res.ok) return NO_APPROVAL_ACCESS;
    const data = await res.json();
    const canApprove = data?.canApprove === true;
    return { canApprove, canApproveLeadership: canApprove && data?.canApproveLeadership === true };
  } catch {
    return NO_APPROVAL_ACCESS;
  }
}

/** Máximo de `size` por página do servidor; a tela mostra os mais recentes e não pagina. */
export const LIST_LIMIT = 200;

export async function listSquadLinkRequests(squadId: string, status: SquadRequestFilter = 'PENDING'): Promise<SquadLinkRequest[]> {
  const res = await authFetch(`${squadPath(squadId)}?status=${encodeURIComponent(status)}&size=${LIST_LIMIT}`);
  if (!res.ok) throw await failure(res, 'Não foi possível carregar os pedidos.');
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(normalizeSquadLinkRequest).filter((r): r is SquadLinkRequest => r !== null);
}

export async function approveSquadLinkRequest(squadId: string, requestId: string): Promise<void> {
  const res = await authFetch(`${squadPath(squadId)}/${encodeURIComponent(requestId)}/approve`, { method: 'POST' });
  if (!res.ok) throw await failure(res, 'Não foi possível aprovar o pedido.');
}

/** `reason` é opcional; vazio não é enviado. */
export async function rejectSquadLinkRequest(squadId: string, requestId: string, reason?: string): Promise<void> {
  const trimmed = reason?.trim();
  const res = await authFetch(`${squadPath(squadId)}/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
    body: JSON.stringify(trimmed ? { reason: trimmed } : {}),
  });
  if (!res.ok) throw await failure(res, 'Não foi possível recusar o pedido.');
}

/** A mensagem do servidor, se for uma frase em português da regra de negócio (o resto vira texto fixo). */
function businessMessage(err: Error): string | null {
  return /pedido|você|linha|conta|liderança/i.test(err.message) ? err.message : null;
}

/** Texto amigável para o toast de uma decisão que falhou (403 sem permissão, 409 já decidido, 404 sumiu). */
export function decisionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const own = businessMessage(err);
    if (err.status === 403) return own ?? 'Você não tem permissão para decidir este pedido.';
    if (err.status === 409) return own ?? 'Esse pedido já foi decidido.';
    if (err.status === 404) return 'Esse pedido não existe mais.';
    if (err.status === 422) return own ?? 'O pedido não pode ser aprovado desse jeito.';
  }
  return err instanceof Error && err.message ? err.message : 'Tente novamente.';
}
