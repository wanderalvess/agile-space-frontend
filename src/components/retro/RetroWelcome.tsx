'use client';

import { useState } from 'react';
import { Eye, ListChecks, PenLine, Vote, type LucideIcon } from 'lucide-react';
import { Modal, ModalButton, useRoomPreference } from '@/components/room-kit';

export const RETRO_WELCOME_KEY = 'agile_retro_welcome_dismissed';

const STEPS: { icon: LucideIcon; label: string; hint: string }[] = [
  { icon: PenLine, label: 'Escrever', hint: 'Cada pessoa escreve sem ver os outros cartões.' },
  { icon: Eye, label: 'Revelar', hint: 'O facilitador mostra tudo de uma vez.' },
  { icon: Vote, label: 'Votar', hint: 'Cada pessoa distribui os votos que tem.' },
  { icon: ListChecks, label: 'Agir', hint: 'Os mais votados viram ações com dono e prazo.' },
];

/**
 * Boas-vindas da retro vazia: os quatro passos na ordem em que a sala acontece. "Não mostrar de novo" guarda a
 * escolha no navegador; "Começar" só fecha por esta visita.
 */
export function RetroWelcome({ title, isFacilitator, disabled = false }: { title: string; isFacilitator: boolean; disabled?: boolean }) {
  const [dismissedForever, setDismissedForever, loaded] = useRoomPreference<boolean>(RETRO_WELCOME_KEY, false, (raw) => raw === 'true');
  const [closed, setClosed] = useState(false);
  const [never, setNever] = useState(false);

  const open = loaded && !dismissedForever && !closed && !disabled;
  const close = () => {
    if (never) setDismissedForever(true);
    setClosed(true);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!next) close(); }}
      size="lg"
      className="sm:max-w-[640px]"
      title={title}
      description={isFacilitator ? 'Quatro passos, e você conduz cada um.' : 'Quatro passos, na ordem em que a sala acontece.'}
      footerStart={
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          Não mostrar de novo
        </label>
      }
      footer={<ModalButton variant="primary" onClick={close}>Começar</ModalButton>}
    >
      <ol className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 pt-1 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, label, hint }, i) => (
          <li key={label} className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-3.5">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">{i + 1}</span>
            </span>
            <span className="text-[15px] font-bold">{i + 1}. {label}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{hint}</span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
