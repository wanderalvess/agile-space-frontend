/**
 * Regras puras sobre os vínculos (sem React, sem rede): squad ativa validada, "precisa de onboarding",
 * liderança da squad ativa e rótulos de origem/alcance. Testadas em `lib/__tests__/memberships.test.ts`.
 */

import type { Membership, MembershipScope, MyMemberships } from '@/lib/memberships-api';

/** Rótulos pt-BR da origem do vínculo. `BACKFILL` é carga de migração, então também é "Migrado". */
const SOURCE_LABELS: Record<string, string> = {
  JIRA: 'Importado do Jira',
  CLAIM: 'Reivindicado',
  APPROVED: 'Aprovado',
  INVITE: 'Convite',
  MANUAL: 'Manual',
  MIGRATION: 'Migrado',
  BACKFILL: 'Migrado',
};

/** Rótulo da origem; `null` (linha antiga) ou valor desconhecido = não mostra origem. */
export function sourceLabel(source?: string | null): string | null {
  if (!source) return null;
  return SOURCE_LABELS[source.trim().toUpperCase()] ?? null;
}

/** "Liderança da tribo" / "Liderança do segmento" para vínculos derivados; `null` para vínculo direto da squad. */
export function scopeLabel(scope?: MembershipScope | null): string | null {
  if (scope === 'TRIBE') return 'Liderança da tribo';
  if (scope === 'SEGMENT') return 'Liderança do segmento';
  return null;
}

/** "Sem Time" é o marcador do servidor para quem ainda não tem squad: não é uma squad. */
function realId(id?: string | null): string {
  const value = (id ?? '').trim();
  const lower = value.toLowerCase();
  return value && lower !== 'sem time' && lower !== 'sem squad' ? value : '';
}

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Vínculo de uma squad (sem diferenciar caixa). */
export function findMembership(m: MyMemberships | null | undefined, squadId?: string | null): Membership | undefined {
  if (!m) return undefined;
  return m.memberships.find((x) => same(x.projectId, squadId));
}

/** Há dados de vínculos utilizáveis (endpoint existe e a pessoa tem pelo menos um). */
export function hasMemberships(m: MyMemberships | null | undefined): m is MyMemberships {
  return !!m && m.memberships.length > 0;
}

/**
 * Squad ativa. A da sessão vale se está nos vínculos (devolve o id canônico do vínculo); se não está, a que o
 * servidor validou (`activeProjectId` do endpoint) ou a primeira por precedência. Sem dados de vínculos
 * (endpoint ausente, ainda carregando ou conta só com rastro legado), a da sessão como está.
 */
export function resolveActiveSquadId(sessionActiveId: string | null | undefined, m: MyMemberships | null | undefined): string {
  const fromSession = realId(sessionActiveId);
  if (!hasMemberships(m)) return fromSession;
  const own = findMembership(m, fromSession);
  if (own) return own.projectId;
  const validated = findMembership(m, m.activeProjectId);
  return (validated ?? m.memberships[0]).projectId;
}

export interface OnboardInput {
  /** Vínculos já conferidos para a sessão atual; `null` se o endpoint não existe/falhou ou ainda não voltou. */
  memberships: MyMemberships | null | undefined;
  /** `legacyOnly` que a própria sessão trouxe (modo `new`). */
  sessionLegacyOnly?: boolean;
  /** Squad ativa do perfil (`userProfile.squadId`). */
  profileSquadId?: string | null;
}

/**
 * A pessoa precisa passar pelo onboarding (tela de espera)? Com o endpoint: sim se não há nenhum vínculo.
 * Exceção: conta só com rastro legado (`legacyOnly`) que ainda tem uma squad na sessão (modo sombra) segue
 * usando o app, com o aviso "peça à liderança", em vez de ser expulsa do que já acessava.
 * Sem o endpoint: o critério de antes (sem squad ativa).
 */
export function deriveMustOnboard({ memberships, sessionLegacyOnly, profileSquadId }: OnboardInput): boolean {
  if (!memberships) return !profileSquadId;
  if (memberships.memberships.length > 0) return false;
  const legacyOnly = memberships.legacyOnly || !!sessionLegacyOnly;
  return !(legacyOnly && !!realId(profileSquadId));
}

/** Conta sem vínculo nenhum, só com rastro do modelo antigo (aviso "peça à liderança"). */
export function isLegacyOnly(memberships: MyMemberships | null | undefined, sessionLegacyOnly?: boolean): boolean {
  if (memberships && memberships.memberships.length > 0) return false;
  return !!memberships?.legacyOnly || !!sessionLegacyOnly;
}

/**
 * Liderança na squad ativa: `leadership` do vínculo (qualquer um dos papéis nela). `undefined` quando não há
 * dados de vínculos dessa squad, para o chamador cair na regra por nome do papel.
 */
export function leadershipOfActiveSquad(m: MyMemberships | null | undefined, activeSquadId?: string | null): boolean | undefined {
  const ms = findMembership(m, activeSquadId);
  if (!ms) return undefined;
  return ms.leadership || ms.roles.some((r) => r.leadership);
}
