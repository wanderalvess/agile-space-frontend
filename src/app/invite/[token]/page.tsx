'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { inviteApi, isRateLimitError, type Invite, type InvitePreview } from '@/lib/invite-api';
import { clearPendingInvite, savePendingInvite } from '@/lib/pending-invite';
import { loginUrlForInvite } from '@/lib/login-context';
import { inviteView } from '@/lib/invite-state';
import { InviteAcceptView } from '@/components/invite/InviteAcceptView';
import { PageShell } from '@/components/page';

/** Quanto tempo "Convite aceito!" fica na tela antes de levar para o squad. */
const REDIRECT_DELAY_MS = 1500;

function asError(err: unknown, fallback: string): Error {
  return err instanceof Error && err.message ? err : new Error(fallback);
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token);
  // Sem sessão a página é aberta (rota aberta no AuthGuard): mostra o convite pela pré-visualização pública e leva
  // a entrar ou criar a conta com `/invite/{token}` como returnUrl. O aviso do login vem de lib/login-context.ts.
  const { session, isLoading: authLoading, acceptInvite, logout } = useAuth();

  const [invite, setInvite] = useState<Invite | InvitePreview | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  // "Tentar de novo" depois de um 429: de onde veio o erro e um contador para refazer a busca do convite.
  const [errorSource, setErrorSource] = useState<'load' | 'accept'>('load');
  const [reloadKey, setReloadKey] = useState(0);

  const hasSession = !!session;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const load = hasSession ? inviteApi.getInvite(token) : inviteApi.getPreview(token);
    load
      .then((data) => {
        if (cancelled) return;
        setInvite(data);
        setError(null);
        // Sem conta: guarda o convite para o login voltar a ele mesmo se o returnUrl se perder.
        if (!hasSession && data.status === 'PENDING') savePendingInvite(token);
        // Convite que não serve mais não deve puxar a pessoa de volta depois.
        if (data.status !== 'PENDING') clearPendingInvite();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 429 não diz nada sobre o convite: mantém o convite pendente guardado para o login voltar a ele.
        if (!isRateLimitError(err)) clearPendingInvite();
        setErrorSource('load');
        setError(asError(err, 'Convite não encontrado ou expirado.'));
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, hasSession, token, reloadKey]);

  // Depois de aceitar, "Convite aceito!" fica um instante e leva para o squad.
  useEffect(() => {
    if (!accepted) return;
    const timer = setTimeout(() => router.push('/squad'), REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [accepted, router]);

  const handleAccept = useCallback(async () => {
    setIsAccepting(true);
    setError(null);
    try {
      await acceptInvite(token);
      clearPendingInvite();
      setAccepted(true);
    } catch (err: unknown) {
      setErrorSource('accept');
      setError(asError(err, 'Não foi possível aceitar o convite.'));
    } finally {
      setIsAccepting(false);
    }
  }, [acceptInvite, token]);

  const handleRetry = useCallback(() => {
    if (errorSource === 'accept') {
      void handleAccept();
      return;
    }
    setError(null);
    setInvite(null);
    setReloadKey((k) => k + 1);
  }, [errorSource, handleAccept]);

  const view = inviteView({ authLoading, hasSession, invite, error, accepted });

  return (
    <PageShell documentTitle="Convite" header={{ squadControl: null, minimal: !hasSession, signInHref: loginUrlForInvite(token, 'login') }} width="narrow" contentClassName="gap-0 p-0 sm:p-0 2xl:px-0 pb-0 sm:pb-0 pt-0 sm:pt-0">
    <InviteAcceptView
      view={view}
      invite={invite}
      error={error}
      email={session?.email}
      accepting={isAccepting}
      onAccept={handleAccept}
      onRetry={handleRetry}
      // Sair da conta leva ao /login?returnUrl=/invite/{token} (AuthGuard), e o convite reabre depois de entrar.
      onSwitchAccount={logout}
      onSignIn={() => router.push(loginUrlForInvite(token, 'login'))}
      onSignUp={() => router.push(loginUrlForInvite(token, 'register'))}
      onSkip={() => {
        clearPendingInvite();
        router.push('/');
      }}
    />
    </PageShell>
  );
}
