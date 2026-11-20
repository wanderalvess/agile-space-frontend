'use client';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/components/room-kit/tokens';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Contagem ao lado do rótulo (ex.: chamados por status). */
  count?: number;
}

/** Filtro em segmentos (Todos / Ativos / Inativos): botões com `aria-pressed`, altura de 38 px (44 px no celular). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex gap-0.5 rounded-[10px] border border-border bg-muted/50 p-[3px]', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 text-[13px] font-semibold transition-colors duration-fast max-sm:h-10',
              FOCUS_RING,
              on ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="text-xs font-bold tabular-nums text-muted-foreground">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
