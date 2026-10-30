'use client';

import { Suspense } from 'react';
import { DevToolsHubPage } from '@/components/devtools/DevToolsHubPage';

// `useSearchParams` (o filtro `?grupo=`) exige Suspense na compilação estática.
export default function DevToolsPage() {
  return (
    <Suspense fallback={null}>
      <DevToolsHubPage />
    </Suspense>
  );
}
