'use client';

import { Search } from 'lucide-react';
import { FIELD, StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { ICON_STROKE } from './styles';

export interface DataToolbarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Nome acessível da caixa. Padrão: o placeholder. */
    ariaLabel?: string;
  };
  /** Filtros (use SelectField do kit, altura 38). */
  filters?: React.ReactNode;
  /** Contador "3 de 12 integrantes". */
  count?: { shown: number; total: number; noun: string };
  /** Botões à direita (regra, colunas, exportar). */
  actions?: React.ReactNode;
  className?: string;
}

/** Barra acima de uma lista: busca, filtros, contador e ações. */
export function DataToolbar({ search, filters, count, actions, className }: DataToolbarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {search && (
        <div className="relative w-full sm:w-[340px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground"
            strokeWidth={ICON_STROKE}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.ariaLabel ?? search.placeholder ?? 'Buscar'}
            className={cn(FIELD, 'h-[38px] pl-9 text-sm max-sm:h-11')}
          />
        </div>
      )}
      {filters}
      {count && (
        <StatusChip tone="neutral" className="h-8 px-3.5 text-[13px]">
          <span aria-live="polite">
            {count.shown} de {count.total} {count.noun}
          </span>
        </StatusChip>
      )}
      <span className="hidden flex-1 sm:block" />
      {actions}
    </div>
  );
}
