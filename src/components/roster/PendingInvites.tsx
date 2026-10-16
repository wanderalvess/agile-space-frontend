'use client';

import { useEffect, useState } from 'react';
import { Ban, Copy, Mail, RefreshCw } from 'lucide-react';
import type { Invite } from '@/lib/invite-api';
import { inviteApi } from '@/lib/invite-api';
import { inviteExpiryLabel, isInviteExpired } from '@/lib/roster/invites';
import { IconButton, ModalButton, StatusChip, BRAND_TEXT } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { InvitesState } from './hooks/useRosterInvites';
import { ICON_STROKE, ROSTER_CARD } from './styles';

interface PendingInvitesProps {
  state: InvitesState;
  invites: Invite[];
  error: string;
  onCopy: (link: string) => void;
  onRevoke: (id: string) => void;
  onRetry: () => void;
}

/**
 * Convites pendentes: papel, e-mail ou "Link aberto", prazo, copiar e revogar. O servidor mantém o convite como
 * PENDING depois de vencer; aqui o "Expirado" sai do prazo (expiresAt) e o copiar fica apagado.
 */
export function PendingInvites({ state, invites, error, onCopy, onRevoke, onRetry }: PendingInvitesProps) {
  // O relógio anda a cada minuto: um convite que vence com a tela aberta passa a "Expirado" sozinho.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (state === 'error') {
    return (
      <section role="alert" className={cn(ROSTER_CARD, 'flex flex-wrap items-center justify-between gap-3 px-4 py-3')}>
        <span className="text-sm text-muted-foreground">
          Não foi possível carregar os convites pendentes. <span className="sr-only">{error}</span>
        </span>
        <ModalButton className="h-9" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" /> Tentar de novo
        </ModalButton>
      </section>
    );
  }
  if (invites.length === 0) return null;

  return (
    <section aria-label="Convites pendentes" className={cn(ROSTER_CARD, 'flex flex-col gap-2.5 px-[18px] py-4')}>
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Mail className={cn('h-4 w-4', BRAND_TEXT)} strokeWidth={ICON_STROKE} aria-hidden="true" />
        Convites pendentes ({invites.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {invites.map((invite) => {
          const expired = isInviteExpired(invite, now);
          return (
            <li key={invite.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 transition-colors duration-fast hover:bg-muted/40">
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusChip tone="brand" className="shrink-0 font-bold">{invite.roleName}</StatusChip>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] text-muted-foreground">
                    {invite.email || 'Link aberto (qualquer pessoa com o link entra com esse papel)'}
                  </span>
                  <span className="text-xs text-muted-foreground">{inviteExpiryLabel(invite, now)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {expired && <StatusChip tone="warn">Expirado</StatusChip>}
                <IconButton
                  size="sm"
                  label={expired ? 'Convite expirado: o link não vale mais' : 'Copiar link'}
                  icon={Copy}
                  disabled={expired}
                  className="border-transparent text-muted-foreground disabled:opacity-35"
                  onClick={() => onCopy(inviteApi.buildInviteLink(invite.token))}
                />
                <IconButton
                  size="sm"
                  label="Revogar convite"
                  icon={Ban}
                  className="border-transparent text-muted-foreground"
                  onClick={() => onRevoke(invite.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
