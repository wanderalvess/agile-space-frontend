'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from './tokens';

export interface TabBarItem<T extends string = string> {
  id: T;
  label: string;
  /** Contagem opcional ao lado do rótulo. */
  count?: number;
}

/**
 * Abas sublinhadas controladas (Geral/Diretas no chat, Link/Convite no
 * compartilhar, Jira/Em lote/Sessões anteriores na importação). Quem usa
 * renderiza o painel da aba ativa; o `id` do painel segue `${idPrefix}-panel-${id}`.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix = 'tabbar',
  className,
}: {
  tabs: readonly TabBarItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix?: string;
  className?: string;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.id === value);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    e.preventDefault();
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn('flex gap-5 border-b border-border px-6', className)}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={on}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px flex h-10 items-center gap-1.5 border-b-2 text-sm transition-colors duration-base',
              FOCUS_RING,
              on ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="text-[11px] tabular-nums text-muted-foreground">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
