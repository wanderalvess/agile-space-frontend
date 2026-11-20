import { Suspense } from 'react';
import DataStudio from '@/components/devtools/tools/DataStudio';

// A ferramenta lê `?aba=` (useSearchParams), por isso fica dentro de um Suspense.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <DataStudio />
    </Suspense>
  );
}
