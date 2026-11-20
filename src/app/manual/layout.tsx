import type { ReactNode } from 'react';
import { PageShell } from '@/components/page';

/**
 * Casca do Manual: cabeçalho e rodapé do portal e largura ampla. O título e o h1 ficam em cada página
 * (o índice e cada tópico). Sem `documentTitle` de propósito: cada tópico define o próprio título da aba
 * (`generateMetadata` em `[topic]/page.tsx`).
 */
export default function ManualLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell feedbackName="Manual" width="wide">
      {children}
    </PageShell>
  );
}
