'use client';

import { ShieldCheck } from 'lucide-react';
import { DevToolsHubPage } from '@/components/devtools/DevToolsHubPage';

// A Central de Qualidade é uma visão do DevTools: as mesmas ferramentas, filtradas pelas que servem ao QA.
export default function QaHubPage() {
  return (
    <DevToolsHubPage
      title="Central de Qualidade"
      icon={<ShieldCheck className="h-4 w-4" />}
      heading="Central de Qualidade"
      subtitle="Ferramentas de teste do DevTools reunidas num lugar só: massa de dados, Zephyr, BDD, automação, mocks e utilitários de API."
      collection="qa"
    />
  );
}
