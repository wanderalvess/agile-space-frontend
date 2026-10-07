'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, CircleHelp, Lightbulb } from 'lucide-react';
import { RoomHeader } from '@/components/layout/RoomHeader';
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

// Casca única das ferramentas: cabeçalho unificado, trilha (DevTools › Categoria),
// gaveta "Como usar" e corpo em 100dvh. Cada ferramenta só entrega o miolo.
export function DevToolPage({ toolId, children, actions, scrollBody = false }: DevToolPageProps) {
  const tool = getDevTool(toolId);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (tool) document.title = `${tool.title} | DevTools | Portal Tech V&D`;
  }, [tool]);

  if (!tool) return null;
  const Icon = tool.icon;
  const category = getCategory(tool.category);

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <RoomHeader
        title={tool.title}
        toolIcon={<Icon className="h-4 w-4" />}
        actions={
          <div className="flex items-center gap-2">
            {actions}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelpOpen(true)}
              className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
            >
              <CircleHelp className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Como usar</span>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
              <Link href="/devtools">
                <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">DevTools</span>
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-4 py-2 md:px-6">
        <nav aria-label="Trilha" className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          <Link href="/devtools" className="hover:text-primary">DevTools</Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <span>{category.label}</span>
        </nav>
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">{tool.description}</p>
      </div>

      <main className={scrollBody ? 'min-h-0 flex-1 overflow-y-auto p-3 md:p-4' : 'min-h-0 flex-1 overflow-hidden p-3 md:p-4'}>
        {children}
      </main>

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
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary">{i + 1}</span>
                <span className="text-sm font-medium leading-relaxed text-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[11px] font-medium text-muted-foreground">
            Tudo roda no seu navegador: o conteúdo colado aqui não é enviado a nenhum servidor, salvo nas ferramentas que dizem o contrário.
          </p>
        </SheetContent>
      </Sheet>
    </div>
  );
}
