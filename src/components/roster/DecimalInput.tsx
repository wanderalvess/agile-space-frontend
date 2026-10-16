'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { FIELD_INVALID } from './styles';

export interface DecimalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  /** O que está digitado, do jeito que a pessoa digitou ("5,5" ou "5.5"). */
  value: string;
  onValueChange: (text: string) => void;
  invalid?: boolean;
  /** Só dígitos (dias inteiros): vírgula e ponto são descartados. */
  integer?: boolean;
}

/**
 * Campo numérico que aceita vírgula ou ponto. O `type="number"` do navegador depende do idioma do sistema e
 * recusa "0,85" em alguns; aqui o texto fica como foi digitado e quem usa converte com `parseDecimal`.
 */
export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, onValueChange, invalid, integer, className, ...props }, ref) => (
    <input
      ref={ref}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onValueChange(e.target.value.replace(integer ? /[^\d]/g : /[^\d.,]/g, ''))}
      className={cn(className, invalid && FIELD_INVALID)}
      {...props}
    />
  )
);
DecimalInput.displayName = 'DecimalInput';
