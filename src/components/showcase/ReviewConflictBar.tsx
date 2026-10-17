'use client';

import { AlertTriangle } from 'lucide-react';
import { ModalButton, TONES } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { conflictSummary, fieldLabel, previewValue } from './card-sync';
import type { CardConflict } from './useShowcaseRoom';

export interface ReviewConflictBarProps {
  conflicts: readonly CardConflict[];
  /** "Reaplicar" grava de novo o que a pessoa digitou por cima do card atual; "Descartar" fica com o gravado. */
  onResolve: (conflictId: string, action: 'reapply' | 'discard') => void;
}

/**
 * Aviso curto de edição simultânea: outra pessoa mudou o mesmo campo do mesmo card ao mesmo tempo. A tela já mostra o
 * que está gravado; o que a pessoa digitou fica aqui, para reaplicar sem perder o texto.
 */
export function ReviewConflictBar({ conflicts, onResolve }: ReviewConflictBarProps) {
  if (conflicts.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-col gap-2 px-3 pt-3 sm:px-4 xl:px-6" role="region" aria-label="Alterações que não foram gravadas">
      {conflicts.map((c) => (
        <div key={c.id} role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', TONES.warn.text)} strokeWidth={1.5} aria-hidden="true" />
          <div className="min-w-0 flex-1 basis-48">
            <p className={cn('m-0 text-[13px] font-semibold', TONES.warn.text)}>{conflictSummary(c.taskKey, c.changes)}</p>
            <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
              {c.changes.slice(0, 3).map((ch) => (
                <li key={ch.path} className="line-clamp-2 text-xs text-foreground [overflow-wrap:anywhere]" title={previewValue(ch.value, 600)}>
                  <span className="font-semibold">Você digitou, {fieldLabel(ch.path)}:</span> {previewValue(ch.value)}
                </li>
              ))}
              {c.changes.length > 3 && <li className="text-xs text-muted-foreground">e mais {c.changes.length - 3}</li>}
            </ul>
          </div>
          <div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:justify-end">
            <ModalButton className="h-8 px-3 text-[13px]" onClick={() => onResolve(c.id, 'discard')}>Descartar</ModalButton>
            <ModalButton variant="primary" className="h-8 px-3 text-[13px]" onClick={() => onResolve(c.id, 'reapply')}>Reaplicar a minha</ModalButton>
          </div>
        </div>
      ))}
    </div>
  );
}
