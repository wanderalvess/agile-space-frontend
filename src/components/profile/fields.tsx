'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FIELD } from '@/components/room-kit';

/** Rótulo dos campos do perfil (mesmo estilo dos formulários das salas). */
export const FIELD_LABEL = 'text-[13px] font-semibold text-foreground';

/** Campo de texto do kit com altura de toque no celular. */
export const FIELD_INPUT = cn(FIELD, 'h-10 text-[13px] max-sm:h-11 read-only:cursor-default read-only:bg-muted read-only:text-muted-foreground');

/** Gatilho dos seletores (Radix Select) com a mesma cara dos campos. */
export const FIELD_SELECT = cn(
  FIELD,
  'flex h-10 items-center justify-between gap-2 text-[13px] max-sm:h-11 [&>span]:line-clamp-1 [&>span]:text-left'
);

/** Item da lista dos seletores, com altura de toque no celular. */
export const SELECT_ITEM = 'rounded-lg py-2 pl-8 pr-2 text-[13px] max-sm:py-3';

/** Mensagem de erro curta, ligada ao campo por `aria-describedby`. */
export function FieldError({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {children}
    </p>
  );
}

/** Grupo rótulo + controle + erro. */
export function Field({
  htmlFor,
  label,
  className,
  children,
}: {
  htmlFor: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className={FIELD_LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}
