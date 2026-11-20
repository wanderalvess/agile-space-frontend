import { Suspense } from 'react';
import DiffTool from '@/components/devtools/tools/DiffTool';

// A ferramenta lê `?aba=` (useSearchParams), por isso fica dentro de um Suspense.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <DiffTool />
    </Suspense>
  );
}
