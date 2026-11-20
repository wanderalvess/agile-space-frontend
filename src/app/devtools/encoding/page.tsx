import { Suspense } from 'react';
import Encoding from '@/components/devtools/tools/Encoding';

// A ferramenta lê `?aba=` (useSearchParams), por isso fica dentro de um Suspense.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Encoding />
    </Suspense>
  );
}
