'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { IconButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { PAGE_CARD } from './styles';

export interface DataColumn<T> {
  id: string;
  /** Texto do cabeçalho. No modo cartão (tela estreita) vira o rótulo de cada valor. */
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Faixa de grid da coluna no desktop (ex.: "120px", "minmax(0,1.6fr)"). Padrão: "minmax(0,1fr)". */
  width?: string;
  align?: 'start' | 'end';
  /** Coluna de identificação (nome, título): ocupa a linha inteira no modo cartão e vai sem rótulo. */
  primary?: boolean;
}

export type StackBelow = 'md' | 'lg' | 'xl';

/** Classes literais por ponto de quebra: abaixo dele cada linha vira um cartão. */
const STACK: Record<StackBelow, { head: string; row: string; label: string; primary: string; actions: string; first: string; border: string }> = {
  md: {
    head: 'hidden md:grid md:[grid-template-columns:var(--cols)]',
    row: 'md:items-center md:gap-3 md:px-5 md:py-2.5 md:[grid-template-columns:var(--cols)]',
    label: 'md:hidden',
    primary: 'md:col-span-1',
    actions: 'md:col-span-1 md:flex-nowrap',
    first: 'md:first:border-t',
    border: 'md:border-border',
  },
  lg: {
    head: 'hidden lg:grid lg:[grid-template-columns:var(--cols)]',
    row: 'lg:items-center lg:gap-3 lg:px-5 lg:py-2.5 lg:[grid-template-columns:var(--cols)]',
    label: 'lg:hidden',
    primary: 'lg:col-span-1',
    actions: 'lg:col-span-1 lg:flex-nowrap',
    first: 'lg:first:border-t',
    border: 'lg:border-border',
  },
  xl: {
    head: 'hidden xl:grid xl:[grid-template-columns:var(--cols)]',
    row: 'xl:items-center xl:gap-3 xl:px-5 xl:py-2.5 xl:[grid-template-columns:var(--cols)]',
    label: 'xl:hidden',
    primary: 'xl:col-span-1',
    actions: 'xl:col-span-1 xl:flex-nowrap',
    first: 'xl:first:border-t',
    border: 'xl:border-border',
  },
};

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Nome da tabela para leitor de tela. */
  ariaLabel: string;
  /** Painel que abre embaixo da linha. Com ele, a última coluna ganha o botão de expandir. */
  renderExpanded?: (row: T) => React.ReactNode;
  /** Linha aberta (controlado). Sem isso a tabela guarda o estado sozinha. */
  expandedId?: string | null;
  onExpandedChange?: (id: string | null) => void;
  /** Rótulo do botão de expandir (recebe a linha). Padrão: "Mostrar detalhes". */
  expandLabel?: (row: T) => string;
  /** Cabeçalho que cola logo abaixo do AppHeader ao rolar (a partir de 1024 px). Padrão: sim. */
  stickyHeader?: boolean;
  /** Abaixo deste ponto cada linha vira um cartão. Padrão: "xl" (1280 px). */
  stackBelow?: StackBelow;
  /** Mostrado no lugar das linhas quando `rows` está vazio (use EmptyState). */
  empty?: React.ReactNode;
  /** Rodapé do cartão (filtro sem resultado, paginação). */
  footer?: React.ReactNode;
  className?: string;
}

/** Tabela simples: cabeçalho fixo, linhas em grid que viram cartões em tela estreita e linha expansível. */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  ariaLabel,
  renderExpanded,
  expandedId,
  onExpandedChange,
  expandLabel,
  stickyHeader = true,
  stackBelow = 'xl',
  empty,
  footer,
  className,
}: DataTableProps<T>) {
  const stack = STACK[stackBelow];
  const [innerOpen, setInnerOpen] = React.useState<string | null>(null);
  const controlled = expandedId !== undefined;
  const openId = controlled ? expandedId : innerOpen;
  const baseId = React.useId();

  const toggle = (id: string) => {
    const next = openId === id ? null : id;
    if (!controlled) setInnerOpen(next);
    onExpandedChange?.(next);
  };

  const tracks = [...columns.map((c) => c.width ?? 'minmax(0,1fr)'), ...(renderExpanded ? ['40px'] : [])].join(' ');
  const style = { '--cols': tracks } as React.CSSProperties;

  return (
    <section aria-label={ariaLabel} className={cn(PAGE_CARD, 'overflow-clip', className)}>
      <div role="table" aria-label={ariaLabel} aria-rowcount={rows.length + 1} style={style}>
        <div
          role="row"
          className={cn(
            'items-center gap-3 bg-muted px-5 py-3 text-xs font-bold leading-tight text-muted-foreground',
            stack.head,
            stickyHeader && 'lg:sticky lg:top-[65px] lg:z-10',
          )}
        >
          {columns.map((c) => (
            <span key={c.id} role="columnheader" className={cn(c.align === 'end' && 'text-right')}>
              {c.header}
            </span>
          ))}
          {renderExpanded && (
            <span role="columnheader" className="sr-only">
              Detalhes
            </span>
          )}
        </div>

        {rows.map((row) => {
          const id = getRowId(row);
          const open = openId === id;
          const panelId = `${baseId}-${id}-panel`;
          return (
            <div key={id} role="rowgroup" className={cn('border-t border-border first:border-t-0', stack.first)}>
              <div
                role="row"
                className={cn(
                  'grid grid-cols-2 items-start gap-x-4 gap-y-3 px-4 py-3.5 transition-colors duration-fast hover:bg-muted/40 sm:grid-cols-3',
                  stack.row,
                )}
              >
                {columns.map((c) => (
                  <div
                    key={c.id}
                    role="cell"
                    className={cn(
                      'flex min-w-0 flex-col gap-1',
                      c.primary && cn('col-span-full', stack.primary),
                      c.align === 'end' && 'items-end text-right',
                    )}
                  >
                    {!c.primary && <span className={cn('text-xs font-semibold text-muted-foreground', stack.label)}>{c.header}</span>}
                    {c.cell(row)}
                  </div>
                ))}
                {renderExpanded && (
                  <div role="cell" className={cn('col-span-full flex justify-end', stack.actions)}>
                    <IconButton
                      size="sm"
                      label={expandLabel ? expandLabel(row) : open ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                      icon={ChevronDown}
                      aria-expanded={open}
                      aria-controls={open ? panelId : undefined}
                      className={cn('border-transparent [&_svg]:motion-safe:transition-transform', stack.border, open && '[&_svg]:rotate-180')}
                      onClick={() => toggle(id)}
                    />
                  </div>
                )}
              </div>
              {renderExpanded && open && (
                <div id={panelId} role="region" aria-label="Detalhes" className="border-t border-border bg-muted/30 px-4 py-4 xl:px-5">
                  {renderExpanded(row)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rows.length === 0 && empty}
      {footer}
    </section>
  );
}
