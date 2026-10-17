'use client';

import { Suspense } from 'react';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { SquadHub } from '@/components/squad/hub/SquadHub';

/** Hub da squad: Resumo, Quadro, Cronograma, Métricas e Painéis (aba em `?tab=`). */
export default function SquadHubPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SquadHub />
    </Suspense>
  );
}
