'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, PageShell } from '@/components/page';
import { CreateReviewDialog } from '@/components/showcase/CreateReviewDialog';
import { ReviewHub, type HubState } from '@/components/showcase/ReviewHub';
import type { ShowcaseSession } from '@/components/showcase/types';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { showcaseApi } from '@/app/showcase/api';

/** Hub da Review (/showcase): começar, métricas de aceite, última Review, passo a passo e histórico. */
export default function ShowcaseHubPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { requestIdentity } = useUserContext();
  const { squadId: activeSquadId } = useActiveSquad();

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sessions, setSessions] = useState<ShowcaseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadSessions = useCallback(async (squadId: string) => {
    setLoading(true);
    setFailed(false);
    try {
      setSessions(await showcaseApi.getSessions(squadId));
    } catch (e) {
      console.error(e);
      // Erro na própria página (com "Tentar de novo"): só um aviso passageiro deixava a tela parecendo vazia.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeSquadId) {
      // Sem squad resolvida não há o que listar: sai do carregamento em vez de ficar no esqueleto.
      setSessions([]);
      setFailed(false);
      setLoading(false);
      return;
    }
    void loadSessions(activeSquadId);
  }, [activeSquadId, loadSessions]);

  const openNew = () => {
    if (!session) requestIdentity(() => setIsSetupOpen(true));
    else setIsSetupOpen(true);
  };

  const state: HubState = !activeSquadId ? 'no-squad' : loading ? 'loading' : failed ? 'error' : 'ready';

  return (
    <PageShell documentTitle="Review">
      <PageHeader
        title="Review"
        module="showcase"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Review' }]}
        subtitle="Apresente entregas sem slides. Evidências integradas e aceites do PO registrados em tempo real durante a cerimônia."
      />
      <ReviewHub
        sessions={sessions}
        state={state}
        onRetry={() => activeSquadId && void loadSessions(activeSquadId)}
        onNewSession={openNew}
        isCreating={isCreating}
      />
      <CreateReviewDialog
        open={isSetupOpen}
        onOpenChange={setIsSetupOpen}
        onCreatingChange={setIsCreating}
        onCreated={(created) => router.push(`/showcase/${created.id}?setup=1`)}
      />
    </PageShell>
  );
}
