'use client';

import React from 'react';
import { PageHeader, PageShell } from '@/components/page';
import { DevToolsHub } from '@/components/devtools/DevToolsHub';
import { getModule, type ModuleKey } from '@/lib/modules-registry';

interface DevToolsHubPageProps {
  /** Módulo do registro: dá o nome, o ícone e a migalha ("devtools" ou "qa"). */
  module: Extract<ModuleKey, 'devtools' | 'qa'>;
  subtitle: string;
  collection?: 'qa';
}

// Página de hub: DevTools e Central de Qualidade compartilham a mesma estrutura.
export function DevToolsHubPage({ module, subtitle, collection }: DevToolsHubPageProps) {
  const { label } = getModule(module);
  return (
    <PageShell documentTitle={label}>
      <PageHeader title={label} module={module} subtitle={subtitle} breadcrumb={[{ label: 'Home', href: '/' }, { label }]} />
      <DevToolsHub collection={collection} />
    </PageShell>
  );
}
