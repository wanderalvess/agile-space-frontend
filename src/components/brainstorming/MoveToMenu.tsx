'use client';

import * as React from 'react';
import { ArrowRightLeft, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';

export interface MoveToOption {
  id: string;
  label: string;
  /** Cor do ponto (grupo). */
  color?: string;
  /** Onde a ideia já está: aparece marcada e não faz nada ao escolher. */
  current?: boolean;
}

/**
 * "Mover para…": a alternativa ao arrastar para o toque e o teclado (arrastar do navegador não funciona no
 * celular). Abre uma lista com as colunas ou os grupos; a atual vem marcada.
 */
export function MoveToMenu({
  options,
  onSelect,
  label = 'Mover para outra coluna',
  menuLabel = 'Mover para…',
  className,
}: {
  options: readonly MoveToOption[];
  onSelect: (id: string) => void;
  /** Nome acessível do botão. */
  label?: string;
  menuLabel?: string;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton size="sm" label={label} icon={ArrowRightLeft} className={cn('border-transparent max-sm:h-11 max-sm:w-11', className)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">{menuLabel}</DropdownMenuLabel>
        {options.map((o) => (
          <DropdownMenuItem key={o.id} disabled={o.current} onSelect={() => onSelect(o.id)} className="gap-2 text-[13px]">
            {o.color && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.color }} />}
            <span className="flex-1 truncate">{o.label}</span>
            {o.current && <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-label="Onde a ideia está agora" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
