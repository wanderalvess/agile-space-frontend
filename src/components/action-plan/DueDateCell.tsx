'use client';

import React, { useRef } from 'react';
import { CircleAlert, X } from 'lucide-react';
import { StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** Selo "Atrasada": ícone e texto, para a informação não depender só da cor. */
export function OverdueChip({ className }: { className?: string }) {
  return (
    <StatusChip tone="warn" className={cn('h-6 px-2.5 text-xs', className)}>
      <CircleAlert className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      Atrasada
    </StatusChip>
  );
}

export interface DueDateCellProps {
  /** Prazo atual, `yyyy-MM-dd` ou vazio. */
  value: string;
  /** Número da ação, para os nomes acessíveis. */
  number: number | undefined;
  overdue: boolean;
  /** Grava o prazo (`''` limpa). Devolve `false` quando falhou, e o campo volta ao valor anterior. */
  onSave: (value: string) => Promise<boolean> | boolean;
}

/** Prazo da ação na tabela: campo de data no lugar. Muda ao escolher o dia; "Limpar" tira o prazo; atrasada leva o selo. */
export function DueDateCell({ value, number, overdue, onSave }: DueDateCellProps) {
  const ref = useRef<HTMLInputElement>(null);
  const save = async (next: string) => {
    const ok = await onSave(next);
    // falhou: o campo volta ao prazo que o servidor tem
    if (!ok && ref.current) ref.current.value = value;
  };

  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        {/* `key` troca com o prazo: depois de salvar, o campo reabre com o valor do servidor */}
        <input
          key={value}
          ref={ref}
          type="date"
          defaultValue={value}
          aria-label={`Prazo da ação ${number ?? ''}`.trim()}
          onChange={(e) => void save(e.currentTarget.value)}
          className="h-8 w-[9.5rem] rounded-md border border-border bg-background px-1.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-xl:h-11"
        />
        {value && (
          <button
            type="button"
            aria-label={`Limpar o prazo da ação ${number ?? ''}`.trim()}
            title="Limpar o prazo"
            onClick={() => void save('')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-xl:h-11 max-xl:w-11"
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>
      {overdue && <OverdueChip />}
    </div>
  );
}
