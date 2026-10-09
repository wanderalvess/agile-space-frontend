import type { UserProfile } from '@/lib/types';

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
