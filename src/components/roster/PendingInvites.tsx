'use client';

import { useEffect, useState } from 'react';
import { Ban, ChevronDown, Copy, Mail, RefreshCw, Users } from 'lucide-react';
import type { Invite, InviteRedemption } from '@/lib/invite-api';
import { inviteApi } from '@/lib/invite-api';
import { inviteExpiryLabel, isInviteExpired, isTeamInviteFull, parseServerInstant, teamUsageLabel } from '@/lib/roster/invites';
import { IconButton, ModalButton, StatusChip, BRAND_TEXT } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { InvitesState } from './hooks/useRosterInvites';
import { ICON_STROKE, ROSTER_CARD } from './styles';

interface PendingInvitesProps {
  squadId: string;
  state: InvitesState;
  invites: Invite[];
  error: string;
  onCopy: (link: string) => void;
  onRevoke: (id: string) => void;
  onRetry: () => void;
}

function joinedAtLabel(value: string): string {
  const at = parseServerInstant(value);
  return Number.isFinite(at) ? new Date(at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
}

/**
 * Convites pendentes: papel, e-mail ou "Link aberto", prazo, copiar e revogar. O servidor mantém o convite como
 * PENDING depois de vencer; aqui o "Expirado" sai do prazo (expiresAt) e o copiar fica apagado.
 */
export function PendingInvites({ squadId, state, invites, error, onCopy, onRevoke, onRetry }: PendingInvitesProps) {
  // O relógio anda a cada minuto: um convite que vence com a tela aberta passa a "Expirado" sozinho.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Quem entrou por cada convite de equipe, carregado ao abrir a linha.
  const [openId, setOpenId] = useState<string | null>(null);
  const [joined, setJoined] = useState<Record<string, InviteRedemption[] | 'error'>>({});
  const toggleJoined = (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    inviteApi
      .listRedemptions(squadId, id)
      .then((rows) => setJoined((prev) => ({ ...prev, [id]: rows })))
      .catch(() => setJoined((prev) => ({ ...prev, [id]: 'error' })));
  };

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
          const team = !!invite.multiUse;
          const full = isTeamInviteFull(invite);
          const dead = expired || full;
          const rows = joined[invite.id];
          return (
            <li key={invite.id} className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2 transition-colors duration-fast hover:bg-muted/40">
              <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusChip tone="brand" className="shrink-0 font-bold">{invite.roleName}</StatusChip>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] text-muted-foreground">
                    {team
                      ? 'Convite para a equipe (link para várias pessoas)'
                      : invite.email || 'Link aberto (qualquer pessoa com o link entra com esse papel)'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {team && <>{teamUsageLabel(invite)} · </>}
                    {inviteExpiryLabel(invite, now)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {expired ? <StatusChip tone="warn">Expirado</StatusChip> : full && <StatusChip tone="warn">Esgotado</StatusChip>}
                {team && (
                  <IconButton
                    size="sm"
                    label={openId === invite.id ? 'Ocultar quem entrou' : 'Ver quem entrou'}
                    icon={openId === invite.id ? ChevronDown : Users}
                    className="border-transparent text-muted-foreground"
                    onClick={() => toggleJoined(invite.id)}
                  />
                )}
                <IconButton
                  size="sm"
                  label={expired ? 'Convite expirado: o link não vale mais' : full ? 'Convite esgotado: o link não aceita mais ninguém' : 'Copiar link'}
                  icon={Copy}
                  disabled={dead}
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
              </div>
              {team && openId === invite.id && (
                <div aria-label="Quem entrou" className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[13px] text-foreground">
                  {rows === undefined ? (
                    <span className="text-muted-foreground">Carregando…</span>
                  ) : rows === 'error' ? (
                    <span role="alert" className="text-muted-foreground">Não foi possível carregar quem entrou.</span>
                  ) : rows.length === 0 ? (
                    <span className="text-muted-foreground">Ninguém entrou por este link ainda.</span>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {rows.map((r) => (
                        <li key={r.userId} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate">{r.name || 'Pessoa sem nome'}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{joinedAtLabel(r.joinedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
