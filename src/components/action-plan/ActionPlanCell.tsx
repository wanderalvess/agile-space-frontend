'use client';

import React, { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Resultado de gravar uma célula: `true` (ou nada) salvou; `false` falhou sem mensagem; um texto é a mensagem
 * do servidor, mostrada junto à célula. Em qualquer falha a célula continua aberta com o que foi digitado.
 */
export type CellSaveResult = boolean | string | void;

export interface ActionPlanCellProps {
  value: string | null | undefined;
  onSave: (value: string) => Promise<CellSaveResult> | CellSaveResult;
  /** Texto do campo vazio e nome acessível ("O que será feito?"). */
  placeholder: string;
  className?: string;
}

/**
 * Célula da tabela editável no lugar: clique ou Enter abre o campo; Enter ou sair do campo salva (uma vez só);
 * Esc cancela. Se a gravação falhar o texto digitado continua na célula.
 */
export function ActionPlanCell({ value, onSave, placeholder, className }: ActionPlanCellProps) {
  const current = value ?? '';
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const cancelledRef = useRef(false);
  const errorId = useId();

  const startEditing = () => {
    // sempre parte do valor atual do servidor (outra pessoa pode ter editado desde a montagem da célula)
    setDraft(current);
    setError(null);
    cancelledRef.current = false;
    setIsEditing(true);
  };

  const commit = async () => {
    // Enter e perda de foco disparam as duas: salva uma vez só
    if (savingRef.current || cancelledRef.current) return;
    if (draft === current) {
      setError(null);
      setIsEditing(false);
      return;
    }
    savingRef.current = true;
    try {
      const result = await onSave(draft);
      if (result === false || typeof result === 'string') {
        // continua em edição com o texto digitado
        setError(typeof result === 'string' ? result : 'Não foi possível salvar.');
      } else {
        setError(null);
        setIsEditing(false);
      }
    } finally {
      savingRef.current = false;
    }
  };

  const cancel = () => {
    cancelledRef.current = true;
    setDraft(current);
    setError(null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'w-full rounded-md border border-primary/60 bg-background px-1.5 py-1 text-[13px] text-foreground outline-none ring-2 ring-ring/30',
            className,
          )}
        />
        {error && (
          <span id={errorId} role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${placeholder} ${current || 'vazio'}. Pressione Enter para editar`}
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          startEditing();
        }
      }}
      className={cn(
        'min-h-[1.75rem] min-w-0 cursor-text break-words rounded-md px-1.5 py-1 text-[13px] leading-snug transition-colors duration-fast',
        'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        current ? 'text-foreground' : 'italic text-muted-foreground',
        className,
      )}
    >
      {current || placeholder}
    </div>
  );
}
