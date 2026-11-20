'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recebe o que a pessoa colou (link completo ou só o token); quem chama valida e navega. */
  onSubmit: (raw: string) => void;
}

/** Rodapé de saídas sempre disponíveis: abrir um link de convite (aceita o link inteiro ou só o token). */
export function InviteFooter({ open, onOpenChange, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const submit = () => {
    if (value.trim()) onSubmit(value);
  };

  return (
    // Fechado, o atalho fica no pé da página (mt-auto). Aberto, o campo sobe para perto do conteúdo:
    // preso no rodapé ele ficava longe do cartão e parecia solto.
    <div className={cn('flex w-full max-w-[672px] flex-col items-center gap-3 pt-3', !open && 'mt-auto')}>
      {open ? (
        <div className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
          <span className="text-[13px] font-semibold text-foreground">Link do convite</span>
          <span className="text-xs leading-relaxed text-muted-foreground">Cole o link que a liderança da squad te enviou (ou só o código dele).</span>
          <div className="flex w-full items-center gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') onOpenChange(false);
              }}
              placeholder="Cole aqui o link do convite"
              aria-label="Link do convite"
              autoFocus
              className="h-10 min-w-0 flex-1 rounded-xl text-sm"
            />
            <Button type="button" onClick={submit} disabled={!value.trim()} className="h-10 shrink-0 rounded-[10px] text-[13px] font-bold">
              Abrir
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-10 shrink-0 px-2.5 text-[13px] text-muted-foreground">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className={cn('inline-flex items-center gap-1.5 rounded-sm font-semibold transition-colors hover:text-foreground', FOCUS_RING)}
          >
            <Link2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} /> Tenho um link de convite
          </button>
          <span aria-hidden="true">·</span>
          <span>Dá para trocar de squad depois</span>
        </div>
      )}
    </div>
  );
}
