'use client';

import * as React from 'react';
import { BRAND_TEXT, FIELD, FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** Título de uma aba do Meu espaço: h2, frase de apoio curta e a ação principal à direita. */
export function WorkspaceSectionHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export interface SubTabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

/** Subabas em pílulas (Atalhos/Prompts/Snippets; Perfil/Conectividade) e filtros de uma lista. */
export function SubTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  role = 'tablist',
  idPrefix,
  className,
}: {
  items: readonly SubTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  /** `tablist` troca de painel (com setas); `group` só marca um filtro (botões com aria-pressed). */
  role?: 'tablist' | 'group';
  idPrefix?: string;
  className?: string;
}) {
  const isTabs = role === 'tablist';
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isTabs || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const i = items.findIndex((t) => t.id === value);
    const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
    onChange(next.id);
    e.preventDefault();
    // Foco acompanha a seta, como no padrão WAI-ARIA de abas.
    requestAnimationFrame(() => document.getElementById(`${idPrefix ?? 'subtab'}-tab-${next.id}`)?.focus());
  };
  return (
    <div role={role} aria-label={label} onKeyDown={onKeyDown} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role={isTabs ? 'tab' : undefined}
            id={isTabs ? `${idPrefix ?? 'subtab'}-tab-${t.id}` : undefined}
            aria-selected={isTabs ? on : undefined}
            aria-controls={isTabs ? `${idPrefix ?? 'subtab'}-panel` : undefined}
            aria-pressed={isTabs ? undefined : on}
            tabIndex={isTabs && !on ? -1 : 0}
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-fast max-sm:h-11',
              FOCUS_RING,
              on
                ? cn('border-primary/50 bg-primary/10 dark:bg-primary/15', BRAND_TEXT)
                : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="text-xs font-semibold tabular-nums opacity-80">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Rótulo de campo dos formulários do Meu espaço (12 px, caixa alta). */
export const FIELD_LABEL = 'text-xs font-bold uppercase tracking-wide text-muted-foreground';

/** Campo de texto de linha única (38 px; 44 no celular). */
export const TEXT_INPUT = cn(FIELD, 'h-[42px] text-sm');

/** Área de texto de várias linhas. */
export const TEXT_AREA = cn(FIELD, 'min-h-[96px] resize-y py-2.5 leading-relaxed');

/** Rótulo + controle empilhados. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className={FIELD_LABEL}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
