'use client';

import React from 'react';

/**
 * Input/textarea com estado local debounced: digitar não dispara onChange
 * (e a escrita no Firestore que ele geralmente aciona) a cada tecla, só
 * depois de `debounceMs` parado ou ao perder o foco. Enquanto focado, ignora
 * o `value` vindo de fora (evita que uma atualização em trânsito "puxe" o
 * cursor de volta enquanto a pessoa ainda digita).
 */
export const ControlledInput = React.memo(function ControlledInput({ value, onChange, debounceMs = 400, className, ...props }: any) {
  const [local, setLocal] = React.useState(value || '');
  const [focused, setFocused] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!focused) setLocal(value || '');
  }, [value, focused]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocal(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(val), debounceMs);
  };

  return (
    <input
      {...props}
      className={className}
      value={local}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => {
        setFocused(false);
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); onChange(local); }
        props.onBlur?.(e);
      }}
      onChange={handleChange}
    />
  );
});

export const ControlledTextarea = React.memo(function ControlledTextarea({ value, onChange, debounceMs = 400, className, ...props }: any) {
  const [local, setLocal] = React.useState(value || '');
  const [focused, setFocused] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!focused) setLocal(value || '');
  }, [value, focused]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocal(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(val), debounceMs);
  };

  return (
    <textarea
      {...props}
      className={className}
      value={local}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => {
        setFocused(false);
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); onChange(local); }
        props.onBlur?.(e);
      }}
      onChange={handleChange}
    />
  );
});
