'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { inviteApi, type Invite } from '@/lib/invite-api';
import { inviteView } from '@/lib/invite-state';
import { InviteAcceptView } from '@/components/invite/InviteAcceptView';

/** Quanto tempo "Convite aceito!" fica na tela antes de levar para o squad. */
const REDIRECT_DELAY_MS = 1500;

function asError(err: unknown, fallback: string): Error {
  return err instanceof Error && err.message ? err : new Error(fallback);
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token);
  // Sem sessão a pessoa nunca chega aqui: o AuthGuard a manda para /login?returnUrl=/invite/{token}
  // (o aviso de convite do login vem de lib/login-context.ts).
  const { session, isLoading: authLoading, acceptInvite, logout } = useAuth();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (authLoading || !session) return;
    inviteApi
      .getInvite(token)
      .then(setInvite)
      .catch((err: unknown) => setError(asError(err, 'Convite não encontrado ou expirado.')));
  }, [authLoading, session, token]);

  // Depois de aceitar, "Convite aceito!" fica um instante e leva para o squad.
  useEffect(() => {
    if (!accepted) return;
    const timer = setTimeout(() => router.push('/squad'), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [accepted, router]);

  const handleAccept = useCallback(async () => {
    setIsAccepting(true);
    try {
      await acceptInvite(token);
      setAccepted(true);
    } catch (err: unknown) {
      setError(asError(err, 'Não foi possível aceitar o convite.'));
    } finally {
      setIsAccepting(false);
    }
  }, [acceptInvite, token]);

  const view = inviteView({ authLoading, hasSession: !!session, invite, error, accepted });

  return (
    <InviteAcceptView
      view={view}
      invite={invite}
      error={error}
      email={session?.email}
      accepting={isAccepting}
      onAccept={handleAccept}
      // Sair da conta leva ao /login?returnUrl=/invite/{token} (AuthGuard), e o convite reabre depois de entrar.
      onSwitchAccount={logout}
      onSkip={() => router.push('/')}
    />
  );
}
