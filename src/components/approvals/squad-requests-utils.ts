import type { ApprovalAccess, SquadLinkRequest } from '@/lib/squad-link-requests-api';

/** Abas do Time da squad. A aba "Pedidos" só existe para quem aprova. */
export type RosterTabId = 'time' | 'pedidos';

export const ROSTER_TAB_PEDIDOS = 'pedidos';

/**
 * Aba aberta, dado o `?tab=` e o que a pessoa pode fazer. `null` = ainda não dá para saber (a permissão está
 * carregando e a URL pede Pedidos). Quem não pode aprovar cai em "Time", sem erro.
 */
export function resolveRosterTab(requested: string | null, access: ApprovalAccess, accessLoaded: boolean): RosterTabId | null {
  if (requested !== ROSTER_TAB_PEDIDOS) return 'time';
  if (!accessLoaded) return null;
  return access.canApprove ? 'pedidos' : 'time';
}

/** Nome para mostrar: o nome, ou o e-mail quando o servidor não mandou nome. */
export function requesterName(req: SquadLinkRequest): string {
  return req.requester.name || req.requester.email || 'Pessoa sem nome';
}

/** Papel que a pessoa terá se o pedido for aprovado. */
export function requestedRole(req: SquadLinkRequest): string {
  return req.requestedRoleName || (req.kind === 'LEADERSHIP' ? 'liderança' : 'integrante');
}

export interface DecisionAbility {
  approve: boolean;
  reject: boolean;
  /** Por que não há botões (ou falta um deles). */
  note: string | null;
}

export const NOTE_LEADERSHIP = 'Só People Lead ou Tribe Lead aprovam liderança';
export const NOTE_SELF = 'Outra pessoa da liderança precisa decidir o seu pedido';
export const NOTE_CANNOT = 'Você não pode decidir este pedido';

/** Pedido antigo, sem linha e sem papel: quem aprova escolhe a linha do time no diálogo de aprovar. */
export const needsRowPick = (req: SquadLinkRequest): boolean => !req.memberId && !req.requestedRoleName;

/**
 * O que a pessoa pode fazer neste pedido (nunca mostre um botão que o servidor vai recusar): liderança exige
 * `canApproveLeadership`, ninguém decide o próprio pedido e `canDecide` do servidor manda quando vem.
 * Pedido sem linha e sem papel também se aprova: quem aprova escolhe a linha (`needsRowPick`).
 */
export function decisionAbility(req: SquadLinkRequest, access: ApprovalAccess, currentUserId?: string | null): DecisionAbility {
  if (currentUserId && req.requester.id && req.requester.id === currentUserId) return { approve: false, reject: false, note: NOTE_SELF };
  if (req.kind === 'LEADERSHIP' && !access.canApproveLeadership) return { approve: false, reject: false, note: NOTE_LEADERSHIP };
  if (req.canDecide === false) return { approve: false, reject: false, note: req.kind === 'LEADERSHIP' ? NOTE_LEADERSHIP : NOTE_CANNOT };
  return { approve: true, reject: true, note: null };
}

/** Frase do diálogo de aprovação: o efeito concreto. */
export function approveEffect(req: SquadLinkRequest): string {
  const name = requesterName(req);
  if (req.requestedRoleName) return `${name} passa a ter acesso à squad como ${req.requestedRoleName}.`;
  if (req.memberName) return `${name} passa a ter acesso à squad na linha “${req.memberName}” do time.`;
  if (needsRowPick(req)) return `${name} não indicou a linha do time. Escolha com quem ligar a conta.`;
  return `${name} passa a ter acesso à squad como ${requestedRole(req)}.`;
}

/** Linha de detalhe: o que a pessoa pediu, o e-mail do Jira e a mensagem. */
export function requestDetail(req: SquadLinkRequest): string {
  const target = req.memberName ? `Pede para assumir a linha “${req.memberName}” do time.` : 'Não aparece na lista do time.';
  const email = req.emailInJira ? `E-mail no Jira: ${req.emailInJira}.` : '';
  const note = req.message ? `“${req.message}”` : '';
  return [target, email, note].filter(Boolean).join(' ');
}

export const KIND_LABEL = { CONTRIBUTOR: 'Contribuidor', LEADERSHIP: 'Liderança' } as const;

export const STATUS_FILTERS = [
  { id: 'PENDING', label: 'Pendentes' },
  { id: 'APPROVED', label: 'Aprovados' },
  { id: 'REJECTED', label: 'Recusados' },
] as const;
