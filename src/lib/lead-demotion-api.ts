/**
 * Migração do nível LEAD (Etapa 4 do vínculo; contrato em docs/membership-api.md do backend, seção "LEAD deixa de ser nível de conta").
 *
 * `POST /api/admin/membership/lead-demotion` é dry-run por padrão: só grava com `apply=true`. Rebaixa de LEAD para MEMBER
 * quem já tem vínculo de liderança (`HAS_LEADERSHIP_LINK`); quem não tem (`NO_LEADERSHIP_LINK`) só é rebaixado de propósito,
 * por conta, com `forceDemote=true`. `POST .../lead-restore` desfaz a partir do backup. Somente ADMIN.
 *
 * O backend deste ambiente pode ser anterior à Etapa 4: 404/405 na simulação geral = "não existe aqui" e a tela esconde o painel.
 */

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

export type LeadClassification = 'HAS_LEADERSHIP_LINK' | 'NO_LEADERSHIP_LINK';

/** Ver tabela `action` do contrato. Valores novos do servidor entram como `string` e a tela os trata como desconhecidos. */
export type LeadAction =
  | 'WOULD_DEMOTE'
  | 'WOULD_DEMOTE_FORCED'
  | 'DEMOTED'
  | 'DEMOTED_FORCED'
  | 'KEPT_NO_LEADERSHIP_LINK'
  | 'OVER_LIMIT';

export interface LeadUser {
  userId: string;
  email: string;
  name: string;
  active: boolean;
  classification: LeadClassification;
  /** Squads onde há linha de liderança (maiúsculas, sem repetição). */
  leadershipSquads: string[];
  action: LeadAction | string;
  /** Chaves de API ativas da pessoa (continuam válidas com os escopos atuais até renovar). */
  activeApiKeys: number;
  apiKeysNote: string | null;
}

export interface LeadDemotionSummary {
  leadUsers: number;
  hasLeadershipLink: number;
  noLeadershipLink: number;
  wouldDemote: number;
  demoted: number;
  keptNoLeadershipLink: number;
  overLimit: number;
}

export interface LeadDemotionReport {
  mode: 'DRY_RUN' | 'APPLIED';
  /** `app.membership.lead-level` em vigor no servidor. */
  leadLevel: 'off' | 'legacy' | string;
  limit: number;
  summary: LeadDemotionSummary;
  users: LeadUser[];
  warnings: string[];
}

export interface LeadRestoreUser {
  userId: string;
  email: string;
  result: 'RESTORED' | 'SKIPPED' | string;
  reason: string | null;
}

export interface LeadRestoreReport {
  restored: number;
  skipped: number;
  users: LeadRestoreUser[];
}

export interface LeadDemotionOptions {
  /** `false` (padrão) = simulação, não grava nada. */
  apply?: boolean;
  /** Tamanho do lote (1 a 200; o servidor usa 20 quando omitido). */
  limit?: number;
  /** Restringe a uma conta. */
  userId?: string;
  /** Só com `userId`: rebaixa de propósito uma conta sem liderança por vínculo. */
  forceDemote?: boolean;
}

/** Erro das chamadas: leva o status HTTP para a tela distinguir "endpoint não existe aqui" de falha. */
export class LeadDemotionApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'LeadDemotionApiError';
    this.status = status;
  }
}

/** 404/405: o backend deste ambiente ainda não tem a ferramenta. A tela esconde o painel em vez de mostrar erro. */
export function isLeadDemotionUnavailable(err: unknown): boolean {
  return err instanceof LeadDemotionApiError && (err.status === 404 || err.status === 405);
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function parseUser(raw: unknown): LeadUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const userId = str(r.userId).trim();
  if (!userId) return null;
  return {
    userId,
    email: str(r.email),
    name: str(r.name),
    active: r.active !== false,
    classification: str(r.classification).toUpperCase() === 'HAS_LEADERSHIP_LINK' ? 'HAS_LEADERSHIP_LINK' : 'NO_LEADERSHIP_LINK',
    leadershipSquads: Array.isArray(r.leadershipSquads) ? r.leadershipSquads.filter((s): s is string => typeof s === 'string' && !!s) : [],
    action: str(r.action),
    activeApiKeys: num(r.activeApiKeys),
    apiKeysNote: str(r.apiKeysNote).trim() || null,
  };
}

/** Lê o corpo do contrato; corpo fora dele (sem `summary`/`users`) devolve null. */
export function parseLeadDemotionReport(body: unknown): LeadDemotionReport | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const s = b.summary as Record<string, unknown> | undefined;
  if (!s || typeof s !== 'object' || !Array.isArray(b.users)) return null;
  const users = b.users.map(parseUser).filter((u): u is LeadUser => u !== null);
  return {
    mode: str(b.mode).toUpperCase() === 'APPLIED' ? 'APPLIED' : 'DRY_RUN',
    leadLevel: str(b.leadLevel) || 'off',
    limit: num(b.limit),
    summary: {
      leadUsers: num(s.leadUsers),
      hasLeadershipLink: num(s.hasLeadershipLink),
      noLeadershipLink: num(s.noLeadershipLink),
      wouldDemote: num(s.wouldDemote),
      demoted: num(s.demoted),
      keptNoLeadershipLink: num(s.keptNoLeadershipLink),
      overLimit: num(s.overLimit),
    },
    users,
    warnings: Array.isArray(b.warnings) ? b.warnings.filter((w): w is string => typeof w === 'string') : [],
  };
}

export function parseLeadRestoreReport(body: unknown): LeadRestoreReport | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.users)) return null;
  return {
    restored: num(b.restored),
    skipped: num(b.skipped),
    users: b.users
      .filter((u): u is Record<string, unknown> => !!u && typeof u === 'object')
      .map((u) => ({ userId: str(u.userId), email: str(u.email), result: str(u.result), reason: str(u.reason) || null })),
  };
}

async function errorFrom(res: Response, fallback: string): Promise<LeadDemotionApiError> {
  let message = '';
  try {
    const body = await res.json();
    message = typeof body?.message === 'string' ? body.message : typeof body?.error === 'string' ? body.error : '';
  } catch {
    /* corpo vazio ou não-JSON */
  }
  // Em produção o servidor não envia a mensagem do erro: o status é o que resta.
  const byStatus =
    res.status === 403 ? 'Você não tem permissão para esta ação.'
    : res.status === 401 ? 'Sua sessão expirou. Entre novamente.'
    : res.status === 409 ? 'A conta mudou desde a simulação. Simule de novo.'
    : res.status === 400 ? 'Pedido inválido para o servidor.'
    : '';
  return new LeadDemotionApiError(message.trim() || byStatus || fallback, res.status);
}

/** Monta a query: `apply` só vai quando verdadeiro, para a simulação nunca gravar por engano. */
export function leadDemotionQuery(o: LeadDemotionOptions = {}): string {
  const p = new URLSearchParams();
  if (o.apply === true) p.set('apply', 'true');
  if (o.limit != null) p.set('limit', String(o.limit));
  if (o.userId) p.set('userId', o.userId);
  if (o.userId && o.forceDemote === true) p.set('forceDemote', 'true');
  const q = p.toString();
  return q ? `?${q}` : '';
}

/** Simula (padrão) ou aplica o rebaixamento. */
export async function runLeadDemotion(options: LeadDemotionOptions = {}): Promise<LeadDemotionReport> {
  const res = await authFetch(`${API_BASE_URL}/admin/membership/lead-demotion${leadDemotionQuery(options)}`, { method: 'POST' });
  if (!res.ok) throw await errorFrom(res, 'Não foi possível consultar a migração do nível LEAD.');
  const report = parseLeadDemotionReport(await res.json().catch(() => null));
  if (!report) throw new LeadDemotionApiError('Resposta inesperada do servidor.', res.status);
  return report;
}

/** Desfaz o rebaixamento a partir do backup (todos, ou só `userId`). */
export async function restoreLeadLevel(userId?: string): Promise<LeadRestoreReport> {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const res = await authFetch(`${API_BASE_URL}/admin/membership/lead-restore${q}`, { method: 'POST' });
  if (!res.ok) throw await errorFrom(res, 'Não foi possível restaurar o nível LEAD.');
  const report = parseLeadRestoreReport(await res.json().catch(() => null));
  if (!report) throw new LeadDemotionApiError('Resposta inesperada do servidor.', res.status);
  return report;
}
