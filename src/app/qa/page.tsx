'use client';

import { DevToolsHubPage } from '@/components/devtools/DevToolsHubPage';

// A Central de Qualidade é uma visão do DevTools: as mesmas ferramentas, filtradas pelas que servem ao QA.
export default function QaHubPage() {
  return (
    <DevToolsHubPage
      module="qa"
      subtitle="Ferramentas de teste do DevTools reunidas num lugar só: massa de dados, Zephyr, BDD, automação, mocks e utilitários de API."
      collection="qa"
    />
  );
}
