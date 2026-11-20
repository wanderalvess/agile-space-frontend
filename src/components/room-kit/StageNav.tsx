'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from './tokens';

export interface StageNavItem {
  id: string;
  label: string;
  /** Contagem opcional ao lado do nome (cards da coluna). */
  count?: number;
}

/**
 * Navegação em pílula entre etapas ou colunas, fixa no pé da área rolável. Uma só etapa fica marcada;
 * `locked` desabilita a troca (navegação sincronizada com o facilitador) e mostra o cadeado.
 */
export function StageNav({
  items,
  value,
  onChange,
  label,
  locked = false,
  lockedLabel = 'Navegação controlada pelo facilitador',
  className,
}: {
  items: readonly StageNavItem[];
  value: string;
  onChange: (id: string) => void;
  /** Nome da navegação para leitores de tela ("Colunas"). */
  label: string;
  locked?: boolean;
  lockedLabel?: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'sticky bottom-4 z-10 flex max-w-full items-center gap-1 self-center overflow-x-auto rounded-full border border-border bg-card p-1.5',
        'shadow-[0_12px_32px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {locked && (
        <span title={lockedLabel} className="flex h-10 w-8 shrink-0 items-center justify-center text-muted-foreground">
          <Lock className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">{lockedLabel}</span>
        </span>
      )}
      {items.map((item) => {
        const on = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={on}
            disabled={locked && !on}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold uppercase tracking-wide transition-[background-color,color,box-shadow] duration-base max-sm:h-11',
              FOCUS_RING,
              on
                ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)] dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground'
                : 'text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted-foreground'
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="text-xs font-medium tabular-nums opacity-75">{item.count}</span>}
          </button>
        );
      })}
    </nav>
  );
}
