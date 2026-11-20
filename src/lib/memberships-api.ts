/**
 * Cliente de `GET /api/me/memberships`: os vínculos da pessoa (Pessoa x Squad x Papel), a fonte da verdade
 * que o backend calcula a partir de `project_member_roles`. Contrato versão "1" (docs/membership-api.md do backend).
 *
 * O endpoint é novo e a homologação ainda pode estar no backend antigo: qualquer falha (404, 5xx, rede,
 * corpo fora do contrato) devolve `null` e a tela segue com o que a sessão (`AuthResponse`) traz. Nunca lança.
 */

import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api';

/** `SQUAD`: linha própria na squad. `TRIBE`/`SEGMENT`: acesso derivado de liderança transversal. */
export type MembershipScope = 'SQUAD' | 'TRIBE' | 'SEGMENT';

export interface MembershipRole {
  roleName: string;
  roleKey: string;
  leadership: boolean;
  /**
   * JIRA, MANUAL, INVITE, CLAIM, APPROVED, BACKFILL, MIGRATION ou `null` (linha anterior à V75: o backend não presume).
   * Valores desconhecidos são mantidos e simplesmente não ganham rótulo.
   */
  source: string | null;
  primary: boolean;
}

export interface Membership {
  projectId: string;
  projectName: string;
  segmentName?: string;
  tribeName?: string;
  /** Papel PRIMÁRIO na squad (o primeiro de `roles`). */
  roleName: string;
  roleKey: string;
  leadership: boolean;
  /** `scope === 'SQUAD'`. */
  direct: boolean;
  scope: MembershipScope;
  source: string | null;
  /** TODOS os papéis da pessoa nesta squad; o primeiro é o primário. */
  roles: MembershipRole[];
}

export interface MyMemberships {
  contractVersion: string;
  /** Squad ativa validada contra os vínculos; `null` se não há nenhum. */
  activeProjectId: string | null;
  /** Sem nenhuma linha de vínculo, mas com rastro do modelo antigo (squad_id, roster). */
  legacyOnly: boolean;
  transversalLeader: boolean;
  memberships: Membership[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const optStr = (v: unknown): string | undefined => str(v) || undefined;

function normalizeScope(v: unknown): MembershipScope {
  const s = str(v).toUpperCase();
  return s === 'TRIBE' || s === 'SEGMENT' ? s : 'SQUAD';
}

function normalizeRole(raw: unknown, index: number): MembershipRole | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const roleName = str(r.roleName);
  if (!roleName) return null;
  return {
    roleName,
    roleKey: str(r.roleKey),
    leadership: r.leadership === true,
    source: optStr(r.source) ?? null,
    primary: typeof r.primary === 'boolean' ? r.primary : index === 0,
  };
}

function normalizeMembership(raw: unknown): Membership | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  const projectId = str(m.projectId);
  if (!projectId) return null;
  const scope = normalizeScope(m.scope);
  const roles = (Array.isArray(m.roles) ? m.roles : []).map(normalizeRole).filter((r): r is MembershipRole => !!r);
  const roleName = str(m.roleName) || roles[0]?.roleName || '';
  const roleKey = str(m.roleKey) || roles[0]?.roleKey || '';
  const leadership = m.leadership === true;
  const source = optStr(m.source) ?? null;
  // Servidor sem a lista de papéis: o papel primário vira a única linha.
  const finalRoles = roles.length > 0 ? roles : roleName ? [{ roleName, roleKey, leadership, source, primary: true }] : [];
  return {
    projectId,
    projectName: str(m.projectName) || projectId,
    segmentName: optStr(m.segmentName),
    tribeName: optStr(m.tribeName),
    roleName,
    roleKey,
    leadership,
    direct: typeof m.direct === 'boolean' ? m.direct : scope === 'SQUAD',
    scope,
    source,
    roles: finalRoles,
  };
}

/** Valida e normaliza a resposta; `null` quando não parece o contrato (a tela cai na sessão). */
export function parseMyMemberships(body: unknown): MyMemberships | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.memberships)) return null;
  const memberships = b.memberships.map(normalizeMembership).filter((m): m is Membership => !!m);
  return {
    contractVersion: str(b.contractVersion) || '1',
    activeProjectId: optStr(b.activeProjectId) ?? null,
    legacyOnly: b.legacyOnly === true,
    transversalLeader: b.transversalLeader === true,
    memberships,
  };
}

/** Os vínculos da própria pessoa. Qualquer falha (404 no backend antigo, 5xx, rede, corpo estranho) devolve `null`. */
export async function getMyMemberships(signal?: AbortSignal): Promise<MyMemberships | null> {
  try {
    const res = await authFetch(`${API_BASE_URL}/me/memberships`, { signal });
    if (!res.ok) return null;
    return parseMyMemberships(await res.json());
  } catch {
    return null;
  }
}
