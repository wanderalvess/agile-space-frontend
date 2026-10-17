'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusChip } from './primitives';
import { FOCUS_RING } from './tokens';

/**
 * Barra do modo apresentação: no lugar do cabeçalho da sala, uma faixa fina com o aviso "Apresentando", o
 * nome da sessão, o que a sala quiser à direita (cronômetro, navegação, ação do facilitador) e o botão de
 * sair. A sala cuida da tecla Esc; aqui ela só aparece como dica no botão.
 */
export function PresentationBar({
  title,
  label = 'Apresentando',
  children,
  onExit,
  className,
}: {
  title: string;
  label?: string;
  /** Controles à direita, antes do botão de sair. */
  children?: React.ReactNode;
  onExit: () => void;
  className?: string;
}) {
  return (
    <header className={cn('flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-2.5 md:px-6', className)}>
      <div className="flex min-w-0 items-center gap-3">
        <StatusChip tone="danger" dot className="uppercase tracking-wide">{label}</StatusChip>
        <span className="truncate text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 md:gap-3">
        {children}
        <button
          type="button"
          onClick={onExit}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent max-sm:h-11',
            FOCUS_RING
          )}
        >
          <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Sair da apresentação
          <kbd className="hidden rounded border border-border px-1 text-xs md:inline">Esc</kbd>
        </button>
      </div>
    </header>
  );
}
