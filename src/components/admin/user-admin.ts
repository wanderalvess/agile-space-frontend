import { ROLES, type UserProfile } from '@/lib/types';

export type StatusFilter = 'all' | 'active' | 'inactive';

export function isAdminUser(u: Pick<UserProfile, 'role'>): boolean {
  return (u.role || '').toUpperCase() === 'ADMIN';
}

export function isActiveUser(u: Pick<UserProfile, 'active'>): boolean {
  return u.active !== false;
}

/** Quantos admins ativos há na lista (a tela usa para avisar antes de o servidor recusar). */
export function activeAdminCount(users: UserProfile[]): number {
  return users.filter((u) => isAdminUser(u) && isActiveUser(u)).length;
}

/** Busca por nome, e-mail ou id do Jira (sem acento nem caixa), mais filtros de status e de papel/cargo. */
export function filterUsers(
  users: UserProfile[],
  opts: { search: string; status: StatusFilter; role: string },
): UserProfile[] {
  const norm = (v?: string) => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const term = norm(opts.search.trim());
  return users.filter((u) => {
    const matchSearch = !term || [u.name, u.email, u.jiraAccountId].some((f) => norm(f).includes(term));
    const matchStatus =
      opts.status === 'all' || (opts.status === 'active' ? isActiveUser(u) : !isActiveUser(u));
    const matchRole =
      opts.role === 'all' || (opts.role === 'admin' ? isAdminUser(u) : u.jobTitle === opts.role);
    return matchSearch && matchStatus && matchRole;
  });
}

/** Extrai a mensagem útil de "User API error 409: {...json do Spring...}" ou de um Error comum. */
export function apiErrorMessage(err: unknown, fallback = 'Não foi possível concluir a ação.'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const jsonStart = raw.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const body = JSON.parse(raw.slice(jsonStart));
      const msg = body?.message || body?.error;
      if (typeof msg === 'string' && msg.trim() && !/^(Conflict|Bad Request|Forbidden)$/i.test(msg)) return msg;
    } catch {
      /* corpo não é JSON */
    }
  }
  // Em produção o servidor não envia a mensagem do erro (include-message: never): o status é o que resta.
  if (/\b409\b/.test(raw)) return 'Ação bloqueada: não dá para remover o acesso de administrador de si mesmo nem do último administrador ativo.';
  if (/\b403\b/.test(raw)) return 'Você não tem permissão para esta ação.';
  if (/\b401\b/.test(raw)) return 'Sua sessão expirou. Entre novamente.';
  return fallback;
}

/** "nunca entrou", "hoje", "há 3 dias" ou a data, para a coluna de último acesso. */
export function describeLastAccess(lastLoginAt?: string | null, now: Date = new Date()): string {
  if (!lastLoginAt) return 'Sem registro';
  const t = new Date(lastLoginAt).getTime();
  if (Number.isNaN(t)) return 'Sem registro';
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 30) return `Há ${days} dias`;
  return new Date(t).toLocaleDateString('pt-BR');
}

/** Opções do filtro "Cargo": todos, administradores (pelo nível de acesso) e a lista completa de cargos. */
export const CARGO_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'all', label: 'Todos os cargos' },
  { value: 'admin', label: 'Administradores' },
  ...ROLES.map((r) => ({ value: r, label: r })),
];

export type AccessLevel = 'ADMIN' | 'LEAD' | 'MEMBER';

/** O que cada nível de acesso permite (mostrado na lista de escolha). LEAD ainda existe nos dados. */
export const ACCESS_LEVEL_INFO: Record<AccessLevel, string> = {
  ADMIN: 'Abre a Administração e todas as squads',
  LEAD: 'Todas as squads, sem Administração',
  MEMBER: 'Só as squads em que está',
};

/** Nível de acesso da conta em maiúsculas; sem papel conhecido vale MEMBER. */
export function accessLevelOf(u: Pick<UserProfile, 'role'>): AccessLevel {
  const r = (u.role || '').toUpperCase();
  return r === 'ADMIN' || r === 'LEAD' ? r : 'MEMBER';
}

/** Por que o Status ou o Nível desta linha está travado (null = livre). A tela mostra no cadeado; o servidor confere de novo. */
export function lockReasons(
  u: Pick<UserProfile, 'id' | 'role' | 'active'>,
  ctx: { currentUserId?: string | null; adminCount: number },
): { status: string | null; nivel: string | null } {
  const self = !!ctx.currentUserId && u.id === ctx.currentUserId;
  const lastAdmin = isAdminUser(u) && isActiveUser(u) && ctx.adminCount <= 1;
  return {
    status: self ? 'você não pode desativar a própria conta' : lastAdmin ? 'é o último administrador ativo' : null,
    nivel: isAdminUser(u) ? (self ? 'você não pode mudar o próprio nível' : lastAdmin ? 'é o último administrador ativo' : null) : null,
  };
}

/** Dar ADMIN a quem ainda não é pede confirmação (não há desfazer automático). */
export function needsAdminConfirm(u: Pick<UserProfile, 'role'>, nextLevel: string): boolean {
  return nextLevel === 'ADMIN' && !isAdminUser(u);
}

/** Há busca, cargo ou status aplicado? (habilita "Limpar filtros") */
export function hasActiveFilters(f: { search: string; status: StatusFilter; role: string }): boolean {
  return f.search.trim() !== '' || f.status !== 'all' || f.role !== 'all';
}

/** "Exibindo 30 de 112 usuários", com o total filtrado quando há filtro. */
export function usersCountLabel(shown: number, matched: number, total: number): string {
  const base = `Exibindo ${shown} de ${total} ${total === 1 ? 'usuário' : 'usuários'}`;
  return matched === total ? base : `${base} · ${matched} ${matched === 1 ? 'corresponde' : 'correspondem'} aos filtros`;
}

export type SquadLink = { squadId: string; role?: string };

/** O que a linha "Squads" dos detalhes mostra: vínculos reais, só a squad ativa, nenhum vínculo ou erro. */
export type SquadsSummary =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'links'; links: SquadLink[] }
  | { kind: 'active'; squadId: string }
  | { kind: 'none' };

/** `links === undefined` = carregando, `null` = a chamada falhou (não é "sem vínculo"). */
export function squadsSummary(links: SquadLink[] | null | undefined, activeSquadId?: string | null): SquadsSummary {
  if (links === undefined) return { kind: 'loading' };
  if (links === null) return { kind: 'error' };
  if (links.length > 0) return { kind: 'links', links };
  return activeSquadId ? { kind: 'active', squadId: activeSquadId } : { kind: 'none' };
}

/** Squad mostrada na coluna da lista. */
export function squadLabelOf(u: Pick<UserProfile, 'squadId' | 'team'>): string {
  return u.squadId || u.team || 'Sem squad';
}
