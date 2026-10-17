'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { BRAND_TEXT, FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';

export interface IdentityNavItem<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
  /** Contador ao lado do rótulo (ex.: número de vínculos). */
  count?: number;
  /** Ponto de estado (ex.: Jira conectado). */
  dot?: boolean;
}

/**
 * Navegação das seções: lista vertical à esquerda no computador, faixa rolável no celular.
 * É um tablist (setas movem a seleção); o painel de cada aba segue `${idPrefix}-panel-${id}`.
 */
export function IdentityNav<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
}: {
  items: readonly IdentityNavItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const i = items.findIndex((t) => t.id === value);
    let next = i;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % items.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i + items.length - 1) % items.length;
    else if (e.key === 'Home') next = 0;
    else next = items.length - 1;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[items[next].id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="scrollbar-thin flex gap-1 overflow-x-auto p-2 md:sticky md:top-0 md:flex-col md:gap-1 md:overflow-visible md:p-3"
    >
      {items.map((item) => {
        const on = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[item.id] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={on}
            aria-controls={`${idPrefix}-panel-${item.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 text-sm max-sm:gap-1.5 max-sm:px-2.5 transition-colors duration-fast max-sm:h-11 md:w-full',
              FOCUS_RING,
              on
                ? 'bg-primary/10 font-semibold text-foreground dark:bg-primary/15'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon aria-hidden="true" className={cn('h-[18px] w-[18px] shrink-0 max-sm:hidden', on && BRAND_TEXT)} strokeWidth={1.5} />
            <span className="md:flex-1 md:text-left">{item.label}</span>
            {!!item.count && (
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                  on ? 'bg-primary/15 text-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {item.count}
              </span>
            )}
            {item.dot && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
          </button>
        );
      })}
    </div>
  );
}
