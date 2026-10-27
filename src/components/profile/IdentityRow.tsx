'use client';

import * as React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';

export interface IdentityRowProps {
  /** Identifica a linha (ids de aria). */
  id: string;
  icon: LucideIcon;
  /** Rótulo pequeno: Cargo, Squads, Jira... */
  label: string;
  /** Valor atual, em destaque. */
  value: React.ReactNode;
  /** Texto do botão com a linha fechada: Pedir ajuste, Gerenciar, Conectar... */
  actionLabel: string;
  open: boolean;
  onToggle: () => void;
  /** Conteúdo expandido; só é montado com a linha aberta. */
  children: React.ReactNode;
}

/**
 * Linha da ficha: placa de ícone, rótulo, valor e a ação à direita. A ação expande a linha ali mesmo (acordeão):
 * `aria-expanded`/`aria-controls` no botão, que vira "Fechar". No celular a linha inteira é o alvo do toque.
 * Ao abrir, o foco vai para o painel; ao fechar com o foco dentro dele, volta ao botão.
 */
export function IdentityRow({ id, icon: Icon, label, value, actionLabel, open, onToggle, children }: IdentityRowProps) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const wasOpen = React.useRef(open);
  const panelId = `identity-row-${id}-panel`;
  const labelId = `identity-row-${id}-label`;

  React.useEffect(() => {
    if (open && !wasOpen.current) {
      panelRef.current?.focus({ preventScroll: false });
    }
    wasOpen.current = open;
  }, [open]);

  const toggle = () => {
    if (open && panelRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    onToggle();
  };

  return (
    <div className="border-t border-border">
      <div className="relative flex min-h-[72px] items-center gap-3.5 py-2 pl-6 pr-3 max-sm:pl-4 max-sm:pr-2">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={labelId} className="text-xs text-muted-foreground">
            {label}
          </span>
          <span className="truncate text-[15px] font-semibold text-foreground">{value}</span>
        </div>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label={`${open ? 'Fechar' : actionLabel}, ${label}`}
          onClick={toggle}
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-primary transition-colors duration-fast hover:bg-accent',
            '[.theme-totvs:not(.dark)_&]:text-foreground',
            // No celular a linha toda responde ao toque.
            'max-sm:after:absolute max-sm:after:inset-0 max-sm:after:content-[""]',
            FOCUS_RING,
          )}
        >
          {open ? 'Fechar' : actionLabel}
          <ChevronRight aria-hidden="true" className={cn('h-4 w-4 transition-transform duration-fast motion-reduce:transition-none', open && 'rotate-90')} strokeWidth={1.5} />
        </button>
      </div>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="region"
          aria-labelledby={labelId}
          tabIndex={-1}
          className="flex flex-col gap-3 pb-5 pl-[78px] pr-6 outline-none max-sm:px-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
