'use client';

import { useState } from 'react';
import { Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD } from '@/components/room-kit/tokens';
import { ConfirmDialog } from '@/components/room-kit/ConfirmDialog';

/**
 * Recusar um pedido de vínculo, com motivo opcional. `name` é quem pediu; sem ele o diálogo fica fechado.
 * O motivo é local do diálogo e some ao fechar.
 */
export function RejectRequestDialog({ name, onCancel, onConfirm }: { name: string | null; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const close = () => {
    setReason('');
    onCancel();
  };
  return (
    <ConfirmDialog
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      tone="warn"
      icon={Ban}
      title={`Recusar o pedido de ${name ?? ''}?`}
      description="A pessoa continua sem o vínculo. O motivo, se houver, fica registrado no pedido."
      confirmLabel="Recusar pedido"
      onConfirm={() => {
        const text = reason;
        setReason('');
        onConfirm(text);
      }}
      keepOpenOnConfirm
    >
      <label htmlFor="reject-reason" className="mt-1 flex flex-col gap-1.5 text-[13px] font-semibold text-foreground">
        Motivo (opcional)
        <textarea
          id="reject-reason"
          rows={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={cn(FIELD, 'resize-none py-2.5 font-normal')}
        />
      </label>
    </ConfirmDialog>
  );
}
