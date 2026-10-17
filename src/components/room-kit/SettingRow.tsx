'use client';

import * as React from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * Linha de ajuste da sala: título, uma frase de apoio e interruptor. Vale para o modal de configurações e
 * para as opções do "Nova sessão". O rótulo é clicável (`htmlFor`) e o interruptor leva `role="switch"` do Radix.
 */
export function SettingRow({
  id,
  title,
  desc,
  checked,
  onChange,
  disabled,
  children,
  className,
}: {
  id: string;
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Conteúdo logo abaixo da linha, só quando ligada (ex.: o campo da pergunta do check-in). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-border py-3 last:border-b-0', className)}>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className={cn('flex min-w-0 flex-col gap-0.5', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
        </label>
        <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className="shrink-0" />
      </div>
      {checked && children}
    </div>
  );
}
