'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { inviteApi, InviteApiError, type Invite } from '@/lib/invite-api';

export type InvitesState = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error';

/**
 * Convites da squad. `eligible` diz se esta pessoa provavelmente pode convidar (admin, gestão do time ou a própria
 * squad): só então a lista é pedida. Um 403 do servidor (liderança de outra squad) esconde a ação em vez de falhar
 * em silêncio; outro erro vira aviso na própria seção, com "Tentar de novo".
 */
interface InvitesData {
  squadId: string;
  state: InvitesState;
  pending: Invite[];
  error: string;
}
const IDLE: InvitesData = { squadId: '', state: 'idle', pending: [], error: '' };

export function useRosterInvites(squadId: string, eligible: boolean) {
  const { toast } = useToast();
  const [data, setData] = useState<InvitesData>(IDLE);
  // O resultado é de uma squad: trocar de squad (ou perder a elegibilidade) volta ao estado inicial sem efeito.
  const { state, pending, error } = eligible && data.squadId === squadId ? data : IDLE;

  const refresh = useCallback(async () => {
    if (!squadId || !eligible) return;
    try {
      const all = await inviteApi.listInvites(squadId);
      // O servidor mantém PENDING depois de vencer: quem decide "Expirado" é o expiresAt (ver isInviteExpired).
      setData({ squadId, state: 'ready', pending: all.filter((i) => i.status === 'PENDING'), error: '' });
    } catch (err: unknown) {
      if (err instanceof InviteApiError && err.status === 403) {
        setData({ squadId, state: 'forbidden', pending: [], error: '' });
      } else {
        setData({ squadId, state: 'error', pending: [], error: (err as Error)?.message || 'Tente novamente.' });
      }
    }
  }, [squadId, eligible]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canInvite = eligible && state !== 'forbidden';

  /** Gera um convite e devolve o link (lança se o servidor recusar; quem chama decide o aviso). */
  const create = useCallback(
    async (roleName: string, email?: string) => {
      const invite = await inviteApi.createInvite(squadId, roleName, email);
      return inviteApi.buildInviteLink(invite.token);
    },
    [squadId]
  );

  /** Gera o convite de equipe (link multiuso) e devolve o link. */
  const createTeam = useCallback(
    async (roleName: string, maxUses: number | null, validityDays: number) => {
      const invite = await inviteApi.createTeamInvite(squadId, roleName, maxUses, validityDays);
      return inviteApi.buildInviteLink(invite.token);
    },
    [squadId]
  );

  const copyLink = useCallback(
    async (link: string) => {
      const ok = await copyToClipboard(link);
      if (ok) toast({ title: 'Link copiado', description: 'Cole no e-mail, WhatsApp ou Slack.' });
      else toast({ title: 'Não foi possível copiar', description: 'Selecione o link e copie manualmente.', variant: 'destructive' });
    },
    [toast]
  );

  const revoke = useCallback(
    async (id: string) => {
      if (!squadId) return;
      try {
        await inviteApi.revokeInvite(squadId, id);
        setData((prev) => ({ ...prev, pending: prev.pending.filter((i) => i.id !== id) }));
        toast({ title: 'Convite revogado' });
      } catch (err: unknown) {
        toast({ title: 'Erro ao revogar', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
      }
    },
    [squadId, toast]
  );

  return { state, pending, error, canInvite, refresh, create, createTeam, copyLink, revoke };
}
