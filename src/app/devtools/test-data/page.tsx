import { Suspense } from 'react';
import MassaDeDados from '@/components/devtools/tools/MassaDeDados';

// A ferramenta lê `?aba=` (useSearchParams), por isso fica dentro de um Suspense.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <MassaDeDados />
    </Suspense>
  );
}
