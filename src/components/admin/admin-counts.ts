import type { AdminTabId } from './admin-tabs';

/** Números que a barra lateral mostra. `null` = ainda não carregou ou falhou (a barra não mostra número). */
export interface AdminCounts {
  /** Redefinições de senha aguardando aprovação. */
  resets: number | null;
  /** Pedidos de vínculo aguardando aprovação (0 também quando o servidor deste ambiente ainda não tem o recurso). */
  links: number | null;
  /** Chamados com status Aberto. */
  ticketsOpen: number | null;
}

export const EMPTY_COUNTS: AdminCounts = { resets: null, links: null, ticketsOpen: null };

/** Aprovações = redefinições + vínculos pendentes. */
export function approvalsTotal(c: Pick<AdminCounts, 'resets' | 'links'>): number | null {
  if (c.resets === null && c.links === null) return null;
  return (c.resets ?? 0) + (c.links ?? 0);
}

/** Contador de cada item da barra lateral; zero e desconhecido não aparecem. */
export function navCount(id: AdminTabId, c: AdminCounts): number | null {
  const n = id === 'aprovacoes' ? approvalsTotal(c) : id === 'chamados' ? c.ticketsOpen : null;
  return n && n > 0 ? n : null;
}

/** Rótulo curto para leitor de tela: "Aprovações, 4 pendentes". */
export function navCountLabel(id: AdminTabId, n: number): string {
  if (id === 'aprovacoes') return `${n} ${n === 1 ? 'pendente' : 'pendentes'}`;
  if (id === 'chamados') return `${n} ${n === 1 ? 'aberto' : 'abertos'}`;
  return String(n);
}
