'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/** O que vai para a lixeira: um artigo (pelo título) ou vários de uma vez. */
export type TrashTarget =
  | { kind: 'single'; id: string; title: string }
  | { kind: 'batch'; ids: string[] };

interface ConfirmTrashDialogProps {
  /** `null` mantém o diálogo fechado. */
  target: TrashTarget | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function describeTarget(target: TrashTarget): string {
  if (target.kind === 'single') return `“${target.title}” vai para a lixeira.`;
  const n = target.ids.length;
  return n === 1 ? '1 artigo vai para a lixeira.' : `${n} artigos vão para a lixeira.`;
}

/**
 * Confirmação de "mover para a lixeira" (substitui o window.confirm do navegador).
 * Enquanto a operação roda, o diálogo fica aberto e os botões travados; quem chama
 * fecha (target = null) quando termina.
 */
export function ConfirmTrashDialog({ target, loading = false, onCancel, onConfirm }: ConfirmTrashDialogProps) {
  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next && !loading) onCancel();
      }}
    >
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-foreground">Mover para a lixeira?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {target ? describeTarget(target) : null} Você pode restaurar depois na lixeira.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              // Não deixa o Radix fechar sozinho: a tela fecha quando a operação termina.
              e.preventDefault();
              onConfirm();
            }}
            className={cn(
              'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              'focus-visible:ring-destructive',
            )}
          >
            {loading ? 'Movendo…' : 'Mover para a lixeira'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
