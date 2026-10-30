'use client';

import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Modal, ModalButton, PersonAvatar } from '@/components/room-kit';
import type { Participant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { participantName } from './brainstorm-ceremony';

export interface TransferFacilitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quem pode receber a facilitação (participantes da sala, menos quem facilita agora). */
  candidates: readonly Participant[];
  /** Quem tem a sala aberta agora; `null` = o servidor não informa (sem "online"/"offline"). */
  onlineIds?: ReadonlySet<string> | null;
  busy?: boolean;
  onConfirm: (userId: string) => void;
}

/**
 * "Passar a facilitação…": escolhe uma pessoa da sala. Quem recebe ganha os poderes de facilitador na hora
 * (etapas, cronômetro, ocultar e revelar, apagar ideias, configurações); quem passa os perde.
 */
export function TransferFacilitationDialog(props: TransferFacilitationDialogProps) {
  // O conteúdo só existe com a janela aberta: a escolha começa vazia a cada abertura.
  return props.open ? <TransferFacilitationContent {...props} /> : null;
}

function TransferFacilitationContent({ open, onOpenChange, candidates, onlineIds = null, busy = false, onConfirm }: TransferFacilitationDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // A pessoa escolhida pode sair da sala enquanto a janela está aberta.
  const chosen = candidates.some((p) => p.id === selected) ? selected : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      icon={ArrowRightLeft}
      title="Passar a facilitação"
      description="Escolha quem passa a conduzir a sessão. Você deixa de ter os controles de facilitador."
      preventClose={busy}
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={() => chosen && onConfirm(chosen)} disabled={!chosen || busy}>
            {busy ? 'Passando…' : 'Passar a facilitação'}
          </ModalButton>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">Mais ninguém entrou na sala ainda. Convide alguém pelo link.</p>
      ) : (
        <div role="radiogroup" aria-label="Quem passa a facilitar" className="flex flex-col gap-1.5">
          {candidates.map((p) => {
            const name = participantName(p);
            const online = onlineIds ? onlineIds.has(p.id) : undefined;
            const active = chosen === p.id;
            return (
              <label
                key={p.id}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
                  active ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent/40',
                  'focus-within:ring-2 focus-within:ring-ring'
                )}
              >
                <input type="radio" name="brain-transfer" value={p.id} checked={active} onChange={() => setSelected(p.id)} className="sr-only" />
                <PersonAvatar name={name} userId={p.id} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{name}</span>
                {online !== undefined && <span className="shrink-0 text-xs text-muted-foreground">{online ? 'online' : 'fora da sala'}</span>}
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
