import { isOtherEmailError, type Invite, type InviteApiError } from '@/lib/invite-api';

/** Telas da página `/invite/{token}`. */
export type InviteView =
  | 'sessao' // carregando a sessão
  | 'verificando' // buscando o convite
  | 'normal' // pode aceitar
  | 'visitante' // sem sessão: mostra o convite e leva ao login/cadastro com o link de volta
  | 'aceito' // aceitou: redireciona em 1,5 s
  | 'invalido' // erro de carga ou de aceite, com a mensagem do servidor
  | 'usado'
  | 'cancelado'
  | 'expirado'
  | 'outro-email'; // convite de outro e-mail (precisa do backend: 403 INVITE_OTHER_EMAIL)

export type UnavailableKind = 'usado' | 'cancelado' | 'expirado';

/** Texto de cada convite que não está mais pendente (mantidos como estavam no código antigo). */
export const UNAVAILABLE_TEXT: Record<UnavailableKind, string> = {
  usado: 'Este convite já foi usado.',
  cancelado: 'Este convite foi cancelado por quem o enviou.',
  expirado: 'Este convite expirou. Peça um novo link a quem te convidou.',
};

/** Convite que não está mais pendente (usado, revogado ou vencido por `status` ou por `expiresAt`). */
export function unavailableKind(invite: Pick<Invite, 'status' | 'expiresAt'> | null, now: number = Date.now()): UnavailableKind | null {
  if (!invite) return null;
  if (invite.status === 'ACCEPTED') return 'usado';
  if (invite.status === 'REVOKED') return 'cancelado';
  if (invite.status === 'EXPIRED' || new Date(invite.expiresAt).getTime() < now) return 'expirado';
  return null;
}

export interface InviteViewInput {
  authLoading: boolean;
  hasSession: boolean;
  invite: Pick<Invite, 'status' | 'expiresAt'> | null;
  error: Error | null;
  accepted: boolean;
}

/** Qual tela mostrar. A ordem é a do código antigo: aceito, erro, indisponível, verificando, normal (ou visitante, sem sessão). */
export function inviteView(input: InviteViewInput, now: number = Date.now()): InviteView {
  if (input.authLoading) return 'sessao';
  if (input.accepted) return 'aceito';
  if (input.error) return isOtherEmailError(input.error) ? 'outro-email' : 'invalido';
  const unavailable = unavailableKind(input.invite, now);
  if (unavailable) return unavailable;
  if (!input.invite) return 'verificando'; // ainda buscando o convite
  return input.hasSession ? 'normal' : 'visitante';
}

/** "Expira em 6 dias", "Expira em 5 h", "Expira em menos de 1 hora"; null se já passou ou a data é inválida. */
export function expiresInLabel(expiresAt: string, now: number = Date.now()): string | null {
  const diff = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const hours = diff / 3_600_000;
  if (hours < 1) return 'Expira em menos de 1 hora';
  if (hours < 24) return `Expira em ${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Expira em 1 dia' : `Expira em ${days} dias`;
}

/** Texto da tela "outro e-mail": o e-mail mascarado só aparece se o servidor o mandou. */
export function otherEmailText(currentEmail: string | undefined, err: InviteApiError): string {
  const entered = currentEmail ? `Você entrou como ${currentEmail}` : 'Você entrou com outra conta';
  return err.invitedEmailMasked
    ? `${entered}, mas o convite foi enviado para ${err.invitedEmailMasked}.`
    : `${entered}, mas o convite foi enviado para outro e-mail.`;
}

/** Linha "quem convidou" da tela do convite e do aviso do login; vazio quando o servidor não sabe. */
export function invitedByText(name: string | null | undefined): string | null {
  const clean = (name ?? '').trim();
  return clean ? `Convite de ${clean}` : null;
}

/** Aviso do login para quem veio de um convite: com a squad quando ela já foi carregada. */
export function loginInviteNotice(preview: { squadName?: string | null; squadId: string; invitedByName?: string | null } | null): { title: string; description: string } {
  if (!preview) {
    return {
      title: 'Você recebeu um convite para uma squad',
      description: 'Entre ou crie a sua conta; em seguida o convite abre para você aceitar.',
    };
  }
  const squad = preview.squadName || preview.squadId;
  const by = invitedByText(preview.invitedByName);
  return {
    title: `Você foi convidado para a squad ${squad}`,
    description: `${by ? `${by}. ` : ''}Entre ou crie a sua conta; em seguida o convite abre para você aceitar.`,
  };
}
