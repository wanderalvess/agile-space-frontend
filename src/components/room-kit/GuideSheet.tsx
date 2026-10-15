'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { BookOpen, X, type LucideIcon } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { IconTile } from './primitives';
import { FOCUS_RING, TONES } from './tokens';

export interface GuideTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface GuideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Abas: "Como funciona", conteúdo específico da sala e "Atalhos". */
  tabs: GuideTab[];
  /** Link do rodapé (Manual completo). */
  manualHref?: string;
}

/**
 * Guia da sala: folha lateral com abas. Cada sala passa o conteúdo; a casca
 * (cabeçalho, abas sublinhadas, rodapé com o manual) é a mesma.
 */
export function GuideSheet({ open, onOpenChange, title, description, icon: Icon = BookOpen, tabs, manualHref }: GuideSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-border bg-card p-0 sm:max-w-[520px] [&>button]:hidden">
        <div aria-hidden="true" className={cn('h-0.5 shrink-0', TONES.brand.hairline)} />
        <header className="flex shrink-0 items-start gap-3.5 px-6 pb-4 pt-5">
          <IconTile icon={Icon} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <SheetTitle className="text-[22px] font-bold leading-tight tracking-tight text-foreground">{title}</SheetTitle>
            <SheetDescription className={cn('text-[13px] text-muted-foreground', !description && 'sr-only')}>
              {description ?? title}
            </SheetDescription>
          </div>
          <SheetClose
            aria-label={`Fechar ${title.toLowerCase()}`}
            className={cn('-mr-1.5 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground', FOCUS_RING)}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </SheetClose>
        </header>
        <TabsPrimitive.Root defaultValue={tabs[0]?.id} className="flex min-h-0 flex-1 flex-col">
          <TabsPrimitive.List className="flex shrink-0 gap-5 border-b border-border px-6">
            {tabs.map((t) => (
              <TabsPrimitive.Trigger
                key={t.id}
                value={t.id}
                className={cn(
                  '-mb-px h-10 border-b-2 border-transparent text-sm text-muted-foreground transition-colors duration-[220ms]',
                  'data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-foreground',
                  FOCUS_RING
                )}
              >
                {t.label}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          {tabs.map((t) => (
            <TabsPrimitive.Content key={t.id} value={t.id} className="room-rise min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5 focus-visible:outline-none">
              {t.content}
            </TabsPrimitive.Content>
          ))}
        </TabsPrimitive.Root>
        {manualHref && (
          <footer className="flex shrink-0 items-center gap-2 border-t border-border bg-muted/40 px-6 py-3.5">
            <a
              href={manualHref}
              className={cn('inline-flex h-[38px] items-center gap-2 rounded-[10px] border border-border px-3.5 text-[13px] font-semibold text-foreground hover:bg-accent', FOCUS_RING)}
            >
              <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Manual completo
            </a>
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Tecla estilizada (<kbd>) para a aba de atalhos. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[22px] items-center justify-center rounded-md border border-border bg-muted px-1.5 text-xs font-bold tabular-nums shadow-[0_2px_0_hsl(var(--border))]">
      {children}
    </kbd>
  );
}
