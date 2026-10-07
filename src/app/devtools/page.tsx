'use client';

import { Wrench } from 'lucide-react';
import { DevToolsHubPage } from '@/components/devtools/DevToolsHubPage';

export default function DevToolsPage() {
  return (
    <DevToolsHubPage
      title="DevTools"
      icon={<Wrench className="h-4 w-4" />}
      heading="DevTools"
      subtitle="Ferramentas do dia a dia de desenvolvimento e qualidade, no navegador. O conteúdo não sai da sua máquina."
    />
  );
}
