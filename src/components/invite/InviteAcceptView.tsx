'use client';

import { AlertCircle, CheckCircle2, Loader2, Mail, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND_TEXT, FOCUS_RING } from '@/components/room-kit/tokens';
import { AccessButton, AccessCard, AccessPage, CenteredHeading, StateTile } from '@/components/access/access-ui';
import { isOtherEmailError, type Invite } from '@/lib/invite-api';
import { UNAVAILABLE_TEXT, expiresInLabel, otherEmailText, type InviteView, type UnavailableKind } from '@/lib/invite-state';

export interface InviteAcceptViewProps {
  view: InviteView;
  invite: Invite | null;
  /** Erro de carga ou de aceite (a mensagem é a do servidor). */
  error: Error | null;
  /** E-mail da conta que está logada. */
  email?: string;
  accepting: boolean;
  onAccept: () => void;
  /** Sai da conta atual e volta ao login com o convite como destino. */
  onSwitchAccount: () => void;
  /** "Agora não" e "Ir para o início": vai para a página inicial sem aceitar. */
  onSkip: () => void;
}

const CHIP = 'inline-flex h-[30px] items-center rounded-full border border-border px-3.5 text-[13px] font-bold text-foreground';

/** Telas da página do convite. Só desenho: quem busca o convite e aceita é a página. */
export function InviteAcceptView({ view, invite, error, email, accepting, onAccept, onSwitchAccount, onSkip }: InviteAcceptViewProps) {
  if (view === 'sessao') {
    return (
      <AccessPage>
        <div role="status" className="py-16 text-[13px] font-bold text-muted-foreground">
          Carregando…
        </div>
      </AccessPage>
    );
  }

  if (view === 'aceito') {
    return (
      <AccessPage>
        <AccessCard role="status" className="items-center py-9 text-center">
          <StateTile icon={CheckCircle2} tone="success" />
          <CenteredHeading title="Convite aceito!" text="Redirecionando pro seu squad…" />
        </AccessCard>
      </AccessPage>
    );
  }

  if (view === 'verificando') {
    return (
      <AccessPage>
        <AccessCard role="status" aria-live="polite" className="items-center py-9 text-center">
          <span aria-hidden="true" className={cn('flex h-[52px] items-center justify-center', BRAND_TEXT)}>
            <Loader2 className="h-10 w-10 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
          </span>
          <h1 className="text-[22px] font-bold leading-tight text-foreground">Verificando convite…</h1>
        </AccessCard>
      </AccessPage>
    );
  }

  if (view === 'normal' && invite) {
    const expires = expiresInLabel(invite.expiresAt);
    return (
      <AccessPage>
        <AccessCard>
          <div className="flex flex-col items-center gap-3 text-center">
            <StateTile icon={Users} />
            <CenteredHeading
              title="Convite pro squad"
              text={
                <>
                  Você foi convidado pra entrar como <strong className="font-bold text-foreground">{invite.roleName}</strong>.
                </>
              }
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <span className={CHIP}>Squad: {invite.squadName || invite.squadId}</span>
            <span className={CHIP}>Papel: {invite.roleName}</span>
          </div>
          {email && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-3">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <span className="min-w-0 flex-1 text-[13px] text-foreground [overflow-wrap:anywhere]">
                Entrando como {email}
              </span>
              <button
                type="button"
                onClick={onSwitchAccount}
                className={cn('shrink-0 rounded-md px-1 py-0.5 text-[13px] font-semibold hover:underline', BRAND_TEXT, FOCUS_RING)}
              >
                Trocar conta
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            <AccessButton variant="primary" onClick={onAccept} disabled={accepting} className="sm:w-full">
              {accepting ? 'Aceitando...' : 'Aceitar Convite'}
            </AccessButton>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AccessButton variant="ghost" onClick={onSkip} disabled={accepting} className="w-auto">
                Agora não
              </AccessButton>
              {expires && <span className="text-xs text-muted-foreground">{expires}</span>}
            </div>
          </div>
        </AccessCard>
      </AccessPage>
    );
  }

  // Estados de erro: inválido (mensagem do servidor), usado, cancelado, expirado e convite de outro e-mail.
  const unavailable: UnavailableKind | null = view === 'usado' || view === 'cancelado' || view === 'expirado' ? view : null;
  const otherEmail = view === 'outro-email' && error && isOtherEmailError(error);
  const tone = otherEmail ? 'brand' : unavailable ? 'warn' : 'danger';
  const title = otherEmail ? 'Esse convite é para outro e-mail' : unavailable ? 'Convite indisponível' : 'Convite inválido';
  const text = otherEmail
    ? otherEmailText(email, error)
    : unavailable
      ? UNAVAILABLE_TEXT[unavailable]
      : error?.message || 'Convite não encontrado ou expirado.';

  return (
    <AccessPage>
      <AccessCard role="alert" className="items-center gap-[18px] text-center">
        <StateTile icon={otherEmail ? Mail : AlertCircle} tone={tone} />
        <CenteredHeading title={title} text={text} />
        <div className="flex w-full flex-col-reverse items-stretch justify-center gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <AccessButton variant={otherEmail ? 'secondary' : 'primary'} onClick={onSkip}>
            Ir para o início
          </AccessButton>
          {otherEmail && (
            <AccessButton variant="primary" onClick={onSwitchAccount}>
              Trocar de conta
            </AccessButton>
          )}
        </div>
      </AccessCard>
    </AccessPage>
  );
}
