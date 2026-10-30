'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/room-kit';

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
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(next) => {
        if (!next && !loading) onCancel();
      }}
      tone="danger"
      icon={Trash2}
      title="Mover para a lixeira?"
      description={`${target ? describeTarget(target) : ''} Você pode restaurar depois na lixeira.`.trim()}
      confirmLabel="Mover para a lixeira"
      loading={loading}
      loadingLabel="Movendo…"
      keepOpenOnConfirm
      onConfirm={onConfirm}
    />
  );
}
