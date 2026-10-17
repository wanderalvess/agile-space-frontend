'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ControlledInput, ControlledTextarea } from './ControlledFields';

/** Campo de uma linha dentro do card (dev, QA, versões, links, métricas). */
export const CARD_INPUT =
  'h-9 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] text-foreground placeholder:text-muted-foreground ' +
  'transition-colors focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Bloco com fundo suave que agrupa campos (execução, métricas). */
export const CARD_PANEL = 'rounded-xl border border-border bg-muted/30 p-4';

/** Rótulo de um campo: ícone de linha e texto de 13 px, na cor do tom (problema, solução, critérios). */
export function FieldLabel({ icon: Icon, label, color = 'text-muted-foreground' }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <p className={cn('m-0 flex items-center gap-1.5 text-[13px] font-semibold', color)}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {label}
    </p>
  );
}

export function TextField({
  id, label, icon, value, onChange, placeholder, labelColor, multiline = false, minRows = 3,
}: {
  id: string; label: string; icon: React.ElementType; value: string;
  onChange: (v: string) => void; placeholder: string;
  /** Cor do rótulo (token do tom: erro para o problema, sucesso para a solução, marca para os critérios). */
  labelColor?: string;
  multiline?: boolean; minRows?: number;
}) {
  const baseClass = cn(
    'w-full rounded-xl border border-border bg-muted/40 px-3 text-sm leading-relaxed text-foreground transition-colors',
    'placeholder:text-muted-foreground focus:bg-background focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="contents">
        <FieldLabel icon={icon} label={label} color={labelColor} />
      </label>
      {multiline ? (
        <ControlledTextarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={minRows} className={cn(baseClass, 'resize-none py-2.5')} />
      ) : (
        <ControlledInput id={id} value={value} onChange={onChange} placeholder={placeholder} className={cn(baseClass, 'h-9 py-0')} />
      )}
    </div>
  );
}
