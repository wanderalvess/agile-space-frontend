'use client';

import Link from 'next/link';
import { PageHeader, PageShell, type Crumb } from '@/components/page';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

export type HubTab = 'catalogo' | 'colecoes' | 'favoritos' | 'meus';

const TABS: Array<{ id: HubTab; label: string; href: string; needsLogin: boolean }> = [
  { id: 'catalogo', label: 'Catálogo', href: '/prompt-hub', needsLogin: false },
  { id: 'colecoes', label: 'Coleções', href: '/prompt-hub/colecoes', needsLogin: false },
  { id: 'favoritos', label: 'Favoritos', href: '/prompt-hub?aba=favoritos', needsLogin: true },
  { id: 'meus', label: 'Meus itens', href: '/prompt-hub?aba=meus', needsLogin: true },
];

/** Abas do módulo. Visitante só vê Catálogo e Coleções. São links entre telas, por isso `aria-current`, não `role="tab"`. */
export function HubTabs({ active, className }: { active?: HubTab; className?: string }) {
  const { session } = useAuth();
  return (
    <nav aria-label="Seções do Prompt Hub" className={cn('-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:-mx-8 sm:px-8 2xl:-mx-12 2xl:px-12', className)}>
      {TABS.filter(tab => session || !tab.needsLogin).map(tab => {
        const on = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex h-11 items-center whitespace-nowrap border-b-2 px-4 text-sm transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              on ? 'border-primary font-bold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

interface HubFrameProps {
  /** Título da aba do navegador, sem o sufixo do portal. */
  documentTitle: string;
  active?: HubTab;
  /** Cabeçalho padrão da página (com o único h1). Omita quando a tela monta o próprio h1. */
  title?: string;
  subtitle?: React.ReactNode;
  breadcrumb?: Crumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Casca das telas do Prompt Hub: cabeçalho do portal, título, abas do módulo e o conteúdo. */
export function HubFrame({ documentTitle, active, title, subtitle, breadcrumb, actions, children }: HubFrameProps) {
  return (
    <PageShell documentTitle={`${documentTitle} | Prompt Hub`} feedbackName="Prompt Hub">
      <HubTabs active={active} />
      {title && (
        <PageHeader
          title={title}
          module="prompt-hub"
          subtitle={subtitle}
          breadcrumb={breadcrumb ?? []}
          actions={actions}
        />
      )}
      {children}
    </PageShell>
  );
}
