import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PasswordResetRequest } from '@/app/admin/api';
import { buildResetLink } from '@/lib/password-api';
import type { LinkRequest } from '@/lib/admin-link-requests-api';

/** Link de redefinição recém-gerado. Aparece uma vez só: o servidor guarda apenas o hash do token. */
export interface ResetLink {
  email: string;
  url: string;
  expiresAt?: string;
}

/** Monta o link a partir da resposta que gera o token; sem `resetToken` não há link para mostrar. */
export function resetLinkFrom(result: Pick<PasswordResetRequest, 'resetToken' | 'tokenExpiresAt'>, email: string, origin: string): ResetLink | null {
  if (!result.resetToken) return null;
  return { email, url: buildResetLink(result.resetToken, origin), expiresAt: result.tokenExpiresAt };
}

/** "até 15/10 às 14:32", ou vazio se o servidor não mandou a validade. */
export function expiryLabel(expiresAt?: string): string {
  if (!expiresAt) return '';
  const d = new Date(expiresAt);
  return Number.isNaN(d.getTime()) ? '' : `até ${format(d, "dd/MM 'às' HH:mm", { locale: ptBR })}`;
}

/** Rótulo do histórico de redefinições. */
export function resetStatusLabel(status: PasswordResetRequest['status']): string {
  switch (status) {
    case 'COMPLETED':
      return 'Senha redefinida';
    case 'REJECTED':
      return 'Recusada';
    case 'PENDING':
      return 'Pendente';
    default:
      return 'Link gerado';
  }
}

function time(iso?: string | null): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Pendentes (as mais antigas primeiro, como chegaram) e as 5 decididas mais recentes. */
export function splitResets(requests: PasswordResetRequest[]): { pending: PasswordResetRequest[]; history: PasswordResetRequest[] } {
  const pending = requests.filter((r) => r.status === 'PENDING');
  const history = requests
    .filter((r) => r.status !== 'PENDING')
    .sort((a, b) => time(b.approvedAt ?? b.requestedAt) - time(a.approvedAt ?? a.requestedAt))
    .slice(0, 5);
  return { pending, history };
}

/** Pedidos de vínculo: pendentes (mais novos primeiro) e os 5 decididos mais recentes. */
export function splitLinkRequests(requests: LinkRequest[]): { pending: LinkRequest[]; history: LinkRequest[] } {
  const pending = requests.filter((r) => r.status === 'PENDING').sort((a, b) => time(b.createdAt) - time(a.createdAt));
  const history = requests
    .filter((r) => r.status !== 'PENDING')
    .sort((a, b) => time(b.decidedAt ?? b.createdAt) - time(a.decidedAt ?? a.createdAt))
    .slice(0, 5);
  return { pending, history };
}

/** Linha da aba "Todas": um pedido pendente de qualquer tipo. */
export type ApprovalRow =
  | { kind: 'link'; id: string; request: LinkRequest }
  | { kind: 'reset'; id: string; request: PasswordResetRequest };

/** Vínculos primeiro, depois redefinições (como no board). */
export function buildApprovalRows(pendingLinks: LinkRequest[], pendingResets: PasswordResetRequest[]): ApprovalRow[] {
  return [
    ...pendingLinks.map((request): ApprovalRow => ({ kind: 'link', id: `link-${request.id}`, request })),
    ...pendingResets.map((request): ApprovalRow => ({ kind: 'reset', id: `reset-${request.id}`, request })),
  ];
}

/** O contador da aba soma pendentes; `null` = sem número (ainda carregando ou indisponível). */
export function approvalCounts(opts: { links: number | null; resets: number | null }): { all: number | null; links: number | null; resets: number | null } {
  const all = opts.links === null && opts.resets === null ? null : (opts.links ?? 0) + (opts.resets ?? 0);
  return { all, links: opts.links, resets: opts.resets };
}

/** Detalhe do pedido de vínculo: quem pede, o e-mail do Jira e a mensagem, se houver. */
export function linkRequestDetail(r: LinkRequest): string {
  const who = r.memberName ? `Pede vínculo com ${r.memberName} no Jira, e-mail ${r.emailInJira}.` : `E-mail no Jira: ${r.emailInJira}.`;
  const account = `Conta atual: ${r.requester.email}.`;
  return r.message?.trim() ? `${who} ${account} “${r.message.trim()}”` : `${who} ${account}`;
}

// Formatadores de data vivem em components/approvals/when.ts (compartilhados com a aba Pedidos da squad).
export { fullWhen, relativeWhen, shortWhen } from '@/components/approvals/when';
