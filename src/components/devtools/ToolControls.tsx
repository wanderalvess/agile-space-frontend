'use client';

import React from 'react';
import { Cloud, Monitor } from 'lucide-react';
import { TabBar, type TabBarItem } from '@/components/room-kit';
import { FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { toolBadge, type DevToolMeta } from '@/lib/devtools/registry';
import { cn } from '@/lib/utils';

/** Rótulo de campo das ferramentas (um só, em vez de uma cópia por página). */
export const FIELD_LABEL = 'text-xs font-semibold text-muted-foreground';

/** Cartão de seção dentro de uma ferramenta (formulários, relatórios). */
export const TOOL_CARD = 'rounded-2xl border border-border bg-card p-4 shadow-sm';

/** Selo "Roda no navegador" / "Usa serviço externo" (o mesmo no cartão do hub e na casca da ferramenta). */
export function ToolBadge({ tool, size = 'sm', className }: { tool: DevToolMeta; size?: 'sm' | 'md'; className?: string }) {
  const b = toolBadge(tool);
  const Icon = b.external ? Cloud : Monitor;
  return (
    <span
      title={b.tip}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full text-xs font-semibold',
        size === 'md' ? 'h-[26px] px-2.5' : 'h-6 px-2.5',
        b.external ? TONES.warn.chip : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      {b.label}
    </span>
  );
}

/** Grupo de opções com rótulo (barra de opções da ferramenta). */
export function OptionGroup({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className={FIELD_LABEL}>{label}</span>}
      <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Escolha entre poucas opções, em segmentos (uma só ativa). */
export function Segmented<T extends string>({
  options, value, onChange, label,
}: {
  options: readonly { value: T; label: string; title?: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[10px] border border-border bg-muted/40 p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-8 rounded-[7px] px-3.5 text-[13px] font-semibold transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50',
              FOCUS_RING,
              on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Liga e desliga uma opção. */
export function ToggleChip({
  on, onChange, children, title, disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-semibold transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50',
        FOCUS_RING,
        on ? 'border-primary/50 bg-primary/10 text-foreground dark:bg-primary/15' : 'border-border bg-transparent text-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

/** Botão de ação das ferramentas (primário cheio ou com contorno). */
export const toolButtonClass = (primary = false) =>
  cn(
    'inline-flex h-[34px] items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50',
    FOCUS_RING,
    primary
      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
      : 'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  );

export function ToolButton({
  primary, className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" {...rest} className={cn(toolButtonClass(primary), className)} />;
}

/**
 * Moldura do corpo das ferramentas com abas: abas sublinhadas, barra de opções e a área dos painéis.
 * As abas e os painéis seguem o padrão do kit (TabBar).
 */
export function ToolWorkspace<T extends string>({
  tabs, tab, onTab, bar, children, columns = 2, className,
}: {
  tabs?: readonly TabBarItem<T>[];
  tab?: T;
  onTab?: (t: T) => void;
  bar?: React.ReactNode;
  children: React.ReactNode;
  /** Colunas dos painéis a partir de `md`. */
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const cols = columns === 3 ? 'md:grid-cols-3' : columns === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2';
  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-3', className)}>
      {tabs && tab && onTab && <TabBar tabs={tabs} value={tab} onChange={onTab} label="Abas da ferramenta" idPrefix="ferramenta" className="shrink-0 px-0" />}
      {bar && (
        <section aria-label="Opções" className="flex shrink-0 flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          {bar}
        </section>
      )}
      <div
        role={tabs ? 'tabpanel' : undefined}
        id={tabs && tab ? `ferramenta-panel-${tab}` : undefined}
        aria-labelledby={tabs && tab ? `ferramenta-tab-${tab}` : undefined}
        className={cn('grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-rows-[minmax(0,1fr)] md:gap-4', cols)}
      >
        {children}
      </div>
    </div>
  );
}
