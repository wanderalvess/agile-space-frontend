'use client';

import React, { useState } from 'react';
import { CircleHelp, Lightbulb } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getCategory, getDevTool } from '@/lib/devtools/registry';

interface DevToolPageProps {
  /** id da ferramenta no registro (src/lib/devtools/registry.ts). */
  toolId: string;
  children: React.ReactNode;
  /** Botões extras no cabeçalho (ex.: exemplo, limpar tudo). */
  actions?: React.ReactNode;
  /** Quando true, o corpo rola; por padrão é zero-scroll (h-dvh) e cada painel rola sozinho. */
  scrollBody?: boolean;
}

// Casca única das ferramentas: AppHeader/AppFooter do portal, cabeçalho da página com trilha
// (DevTools › ferramenta), gaveta "Como usar" e corpo com altura da janela para cada painel rolar sozinho.
export function DevToolPage({ toolId, children, actions, scrollBody = false }: DevToolPageProps) {
  const tool = getDevTool(toolId);
  const [helpOpen, setHelpOpen] = useState(false);

  if (!tool) return null;
  const category = getCategory(tool.category);

  return (
    <PageShell documentTitle={`${tool.title} | DevTools`} feedbackName={tool.title} width="wide" contentClassName="gap-4">
      <PageHeader
        title={tool.title}
        module="devtools"
        subtitle={tool.description}
        breadcrumb={[{ label: 'DevTools', href: '/devtools' }, { label: category.label }, { label: tool.title }]}
        actions={
          <>
            {actions}
            <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)} className="h-9 gap-1.5 rounded-xl text-xs font-semibold">
              <CircleHelp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Como usar
            </Button>
          </>
        }
      />

      <div
        className={
          scrollBody
            ? 'min-h-[24rem] flex-1'
            : 'h-[max(40rem,calc(100dvh-14rem))] min-h-0 overflow-hidden'
        }
      >
        {children}
      </div>

      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-headline text-xl font-black uppercase tracking-tight">
              <Lightbulb className="h-5 w-5 text-primary" /> Como usar
            </SheetTitle>
            <SheetDescription>{tool.description}</SheetDescription>
          </SheetHeader>
          <ol className="mt-6 space-y-3">
            {tool.howTo.map((step, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">{i + 1}</span>
                <span className="text-sm font-medium leading-relaxed text-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs font-medium text-muted-foreground">
            Tudo roda no seu navegador: o conteúdo colado aqui não é enviado a nenhum servidor, salvo nas ferramentas que dizem o contrário.
          </p>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
