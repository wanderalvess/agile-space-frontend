'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { FIELD } from './tokens';

export interface SelectFieldOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectFieldOption[];
  /** Id do gatilho, para o `htmlFor` do rótulo. */
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Lista suspensa do kit. Substitui o `<select>` nativo, cuja lista aberta é desenhada pelo
 * navegador (fundo branco e texto de sistema) e ignora o tema. Esta lista usa os tokens do
 * tema (popover, borda, destaque), então vale nos 7 temas x claro/escuro.
 */
export function SelectField({ value, onChange, options, id, disabled, className, ...rest }: SelectFieldProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-label={rest['aria-label']}
        className={cn(FIELD, 'h-9 gap-2 bg-muted/40 px-3 text-[13px] ring-offset-0 focus:ring-offset-0', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border bg-popover text-popover-foreground">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
