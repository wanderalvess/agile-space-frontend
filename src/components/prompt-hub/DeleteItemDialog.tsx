'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/room-kit';
import { promptApi } from '@/app/prompt-hub/api';
import { invalidateCatalogCache } from '@/app/prompt-hub/catalog-query';
import { isAdminOverride } from '@/app/prompt-hub/catalog-logic';
import type { PromptItem } from '@/app/prompt-hub/types';
import { itemTitle } from './Chips';

/** Confirmação de exclusão de um item. Avisa quando a administradora exclui o item de outra pessoa. */
export function DeleteItemDialog({
  item,
  sessionId,
  onClose,
  onDeleted,
}: {
  item: PromptItem | null;
  sessionId?: string | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (!item) return;
    setLoading(true);
    try {
      await promptApi.deletePrompt(item.id);
      invalidateCatalogCache();
      toast.success('Item excluído');
      onClose();
      onDeleted(item.id);
    } catch (err) {
      toast.error('Erro ao excluir', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfirmDialog
      open={!!item}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      tone="danger"
      icon={Trash2}
      title={`Excluir "${item ? itemTitle(item) : 'item'}"?`}
      description="O item, a discussão e o lugar dele nas coleções saem da biblioteca. Não dá para desfazer."
      confirmLabel="Excluir item"
      loading={loading}
      loadingLabel="Excluindo…"
      keepOpenOnConfirm
      onConfirm={confirm}
    >
      {item && isAdminOverride(item, sessionId) && (
        <p className="rounded-[10px] border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[13px] text-foreground">
          Você está excluindo um item de outra pessoa, como administrador.
        </p>
      )}
    </ConfirmDialog>
  );
}
