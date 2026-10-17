/**
 * Vínculos da pessoa (Pessoa × Squad × Papel), só leitura. Vêm da sessão (`GET /auth/me` ->
 * `accessibleProjects`), completados pelo que o `UserContext` já carrega (`/squads/by-user`).
 * Funções puras, sem React, para serem testadas.
 */

import type { SquadMember } from '@/lib/types';

/** Projeto acessível como o `GET /auth/me` o devolve. */
export interface SessionProject {
  projectId: string;
  projectName?: string;
  segmentName?: string;
  tribeName?: string;
  roleName?: string;
  directAssignment?: boolean;
  leadership?: boolean;
}

export interface SessionLinks {
  accessibleProjects?: SessionProject[];
  activeProjectId?: string;
  activeProjectName?: string;
  activeProjectRole?: string;
}

export interface MyLink {
  /** Chave da squad (a mesma de `activeProjectId`). */
  id: string;
  name: string;
  /** Papel na squad; vazio quando o servidor não informou. */
  role: string;
  leadership: boolean;
  /** `false` quando o acesso vem de uma liderança transversal (tribo/segmento), não de um vínculo direto. */
  direct: boolean;
  /** De onde vem o acesso indireto ("Tribo X"). */
  via?: string;
  tribe?: string;
  segment?: string;
  active: boolean;
}

/** Papéis de liderança, quando o servidor não manda a bandeira `leadership`. */
const LEADERSHIP_ROLE_PATTERN = /(agile master|scrum master|product owner|tech lead|people lead|tribe lead|agile coach|\bpo\b)/i;

export function isLeadershipRole(role?: string | null): boolean {
  return !!role && LEADERSHIP_ROLE_PATTERN.test(role);
}

/** "Sem Time" é o marcador do servidor para quem ainda não tem squad: não é uma squad. */
export function isRealSquadId(id?: string | null): id is string {
  const value = (id ?? '').trim();
  return !!value && value.toLowerCase() !== 'sem time';
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Monta a lista de vínculos: squad ativa primeiro, depois liderança, depois por nome.
 * Sem lista de projetos acessíveis (conta de uma squad só), cai na squad ativa da sessão.
 */
export function buildMyLinks(session: SessionLinks | null | undefined, userSquads: SquadMember[] | undefined, activeId?: string): MyLink[] {
  if (!session) return [];
  const active = (activeId ?? session.activeProjectId ?? '').trim();
  const roleBySquad = new Map<string, string>();
  for (const s of userSquads ?? []) {
    if (s?.squadId && s.role?.trim()) roleBySquad.set(s.squadId, s.role.trim());
  }

  const seen = new Set<string>();
  const links: MyLink[] = [];
  const push = (p: SessionProject) => {
    const id = (p.projectId ?? '').trim();
    if (!isRealSquadId(id) || seen.has(id)) return;
    seen.add(id);
    const role = (p.roleName ?? '').trim() || roleBySquad.get(id) || (id === session.activeProjectId ? (session.activeProjectRole ?? '').trim() : '');
    const direct = p.directAssignment !== false;
    links.push({
      id,
      name: (p.projectName ?? '').trim() || id,
      role,
      leadership: p.leadership ?? isLeadershipRole(role),
      direct,
      via: direct ? undefined : p.tribeName || p.segmentName || undefined,
      tribe: p.tribeName || undefined,
      segment: p.segmentName || undefined,
      active: id === active,
    });
  };

  for (const p of session.accessibleProjects ?? []) push(p);
  if (links.length === 0 && isRealSquadId(session.activeProjectId)) {
    push({ projectId: session.activeProjectId, projectName: session.activeProjectName });
  }

  return links.sort(
    (a, b) => Number(b.active) - Number(a.active) || Number(b.leadership) - Number(a.leadership) || a.name.localeCompare(b.name, 'pt-BR'),
  );
}

/** Vínculo da squad ativa, se houver. */
export function activeLinkOf(links: MyLink[]): MyLink | undefined {
  return links.find((l) => l.active);
}

/** Busca sem acento nem caixa por nome, chave, papel e tribo. Consulta vazia devolve tudo. */
export function filterMyLinks(links: MyLink[], query: string): MyLink[] {
  const q = normalize(query.trim());
  if (!q) return links;
  return links.filter((l) => normalize([l.name, l.id, l.role, l.tribe ?? '', l.segment ?? ''].join(' ')).includes(q));
}

/** Rótulo do tipo de vínculo. */
export function linkKindLabel(link: Pick<MyLink, 'leadership'>): 'Liderança' | 'Contribuidor' {
  return link.leadership ? 'Liderança' : 'Contribuidor';
}

/** Duas letras para a placa da squad: a chave sem símbolos ("DDWMISSI" -> "DD"). */
export function squadBadge(link: Pick<MyLink, 'id' | 'name'>): string {
  const source = (link.id || link.name).replace(/[^A-Za-zÀ-ÿ0-9]/g, '');
  return source.slice(0, 2).toUpperCase() || '?';
}

/** "1 vínculo" / "3 vínculos". */
export function countLabel(n: number): string {
  return `${n} ${n === 1 ? 'vínculo' : 'vínculos'}`;
}
