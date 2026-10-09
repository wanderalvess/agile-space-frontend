'use client';

import React from 'react';

/**
 * Estado local debounced para input/textarea: digitar não dispara onChange (e o save da Review) a
 * cada tecla, só depois de `debounceMs` parado ou ao perder o foco. Enquanto focado, ignora o
 * `value` vindo de fora (evita que uma atualização em trânsito "puxe" o texto de volta).
 *
 * O que ainda está pendente é enviado ao desmontar (card recolhido, aba trocada, card removido
 * por outra pessoa): antes o timer era cancelado e os últimos caracteres digitados se perdiam.
 */
function useDebouncedField<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string | undefined,
  onChange: (v: string) => void,
  debounceMs: number,
) {
  const [local, setLocal] = React.useState<string>(value || '');
  const [focused, setFocused] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = React.useRef<string | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    if (!focused && pendingRef.current === null) setLocal(value || '');
  }, [value, focused]);

  const flush = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingRef.current !== null) {
      const pending = pendingRef.current;
      pendingRef.current = null;
      onChangeRef.current(pending);
    }
  }, []);

  // Desmontar com texto pendente = enviar, não descartar.
  React.useEffect(() => flush, [flush]);

  const handleChange = (e: React.ChangeEvent<T>) => {
    const val = e.target.value;
    setLocal(val);
    pendingRef.current = val;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(flush, debounceMs);
  };

  return { local, handleChange, flush, setFocused };
}

export const ControlledInput = React.memo(function ControlledInput({ value, onChange, debounceMs = 400, className, ...props }: any) {
  const { local, handleChange, flush, setFocused } = useDebouncedField<HTMLInputElement>(value, onChange, debounceMs);
  return (
    <input
      {...props}
      className={className}
      value={local}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => {
        setFocused(false);
        flush();
        props.onBlur?.(e);
      }}
      onChange={handleChange}
    />
  );
});

export const ControlledTextarea = React.memo(function ControlledTextarea({ value, onChange, debounceMs = 400, className, ...props }: any) {
  const { local, handleChange, flush, setFocused } = useDebouncedField<HTMLTextAreaElement>(value, onChange, debounceMs);
  return (
    <textarea
      {...props}
      className={className}
      value={local}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => {
        setFocused(false);
        flush();
        props.onBlur?.(e);
      }}
      onChange={handleChange}
    />
  );
});
