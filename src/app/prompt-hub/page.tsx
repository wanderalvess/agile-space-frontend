'use client';

import { Suspense, useEffect, useState } from 'react';
import { LoadingSkeleton } from '@/components/page';
import { HubFrame } from '@/components/prompt-hub/HubFrame';
import { Catalog } from '@/components/prompt-hub/Catalog';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';

function PromptHubContent() {
  const { session, isLoading: authLoading } = useAuth();
  const { mustOnboard, setIsPublicExploration } = useUserContext();
  const [publicOnly, setPublicOnly] = useState(false);

  // Sair da página desliga a exploração pública, para ela não valer nas outras telas.
  useEffect(() => () => setIsPublicExploration(false), [setIsPublicExploration]);

  // Quem entrou deixa de ver "só públicos" automaticamente.
  useEffect(() => {
    if (session) return;
    setPublicOnly(false);
  }, [session]);

  if (authLoading) {
    return (
      <HubFrame documentTitle="Biblioteca de IA" active="catalogo">
        <h1 className="sr-only">Biblioteca de IA</h1>
        <LoadingSkeleton variant="cards" rows={6} label="Carregando a biblioteca" />
      </HubFrame>
    );
  }

  // Logada, mas sem cargo e squad: o catálogo pede o perfil antes. A pessoa pode só olhar os modelos públicos.
  const needsProfile = !!session && mustOnboard && !publicOnly;

  return (
    <Catalog
      needsProfile={needsProfile}
      publicOnly={!!session && publicOnly}
      onSkipProfile={() => {
        setPublicOnly(true);
        setIsPublicExploration(true);
      }}
    />
  );
}

export default function PromptHubPage() {
  return (
    <Suspense
      fallback={
        <HubFrame documentTitle="Biblioteca de IA" active="catalogo">
          <h1 className="sr-only">Biblioteca de IA</h1>
          <LoadingSkeleton variant="cards" rows={6} label="Carregando a biblioteca" />
        </HubFrame>
      }
    >
      <PromptHubContent />
    </Suspense>
  );
}
