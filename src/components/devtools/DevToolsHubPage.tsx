'use client';

import React, { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { DevToolsHub } from '@/components/devtools/DevToolsHub';
import { DevToolsGuide } from '@/components/devtools/DevToolsGuide';
import { toolButtonClass } from '@/components/devtools/ToolControls';
import { getModule } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';

const SUBTITLE =
  'Formate, converta, compare e gere dados no dia a dia. A maioria roda no seu navegador; as que usam serviço externo trazem um selo.';

// Página do hub do DevTools. A antiga Central de qualidade é o filtro "Qualidade" desta mesma tela (/devtools?grupo=qualidade).
export function DevToolsHubPage({ subtitle = SUBTITLE }: { subtitle?: string }) {
  const { label } = getModule('devtools');
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <PageShell documentTitle={label}>
      <PageHeader
        title={label}
        module="devtools"
        subtitle={subtitle}
        breadcrumb={[{ label: 'Home', href: '/' }, { label }]}
        actions={
          <button type="button" onClick={() => setGuideOpen(true)} aria-label="Abrir o guia do DevTools" className={cn(toolButtonClass(), 'h-10')}>
            <CircleHelp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Guia
          </button>
        }
      />
      <DevToolsHub onOpenGuide={() => setGuideOpen(true)} />
      <DevToolsGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </PageShell>
  );
}
