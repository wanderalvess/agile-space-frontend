'use client';

import React from 'react';

/**
 * Estado local debounced para input/textarea: digitar não dispara onChange (e o save da Review) a
 * cada tecla, só depois de `debounceMs` parado ou ao perder o foco.
 *
 * Rascunho sujo (digitado e ainda não enviado) NUNCA é sobrescrito por valor vindo de fora, com ou sem foco:
 * se outra pessoa gravou um valor diferente enquanto a pessoa digitava, o valor remoto fica guardado, o envio
 * do rascunho é segurado (enviar agora gravaria por cima do dela, sem 409 possível, pois a tela já tem a versão
 * nova) e o campo mostra "Reaplicar a minha / Descartar". Campo limpo (sem rascunho), mesmo com foco, acompanha o
 * valor remoto.
 *
 * O que ainda está pendente é enviado ao desmontar (card recolhido, aba trocada, card removido
 * por outra pessoa): antes o timer era cancelado e os últimos caracteres digitados se perdiam.
 */
function useDebouncedField<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string | undefined,
  onChange: (v: string) => void,
  debounceMs: number,
) {
  const current = value || '';
  const [local, setLocal] = React.useState<string>(current);
  const [remote, setRemote] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = React.useRef<string | null>(null);
  // Valor do campo quando o rascunho começou: se o de fora continua igual a ele, ninguém mexeu.
  const baseRef = React.useRef<string>(current);
  const valueRef = React.useRef(current);
  valueRef.current = current;
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const held = remote !== null && remote !== local && pendingRef.current !== null;
  const heldRef = React.useRef(false);
  heldRef.current = held;

  React.useEffect(() => {
    if (pendingRef.current === null) {
      setLocal(current);
      setRemote(null);
    } else if (current === pendingRef.current || current === baseRef.current) {
      setRemote(null);
    } else {
      setRemote(current);
    }
  }, [current]);

  const flush = React.useCallback((force = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (heldRef.current && !force) return;
    if (pendingRef.current !== null) {
      const pending = pendingRef.current;
      pendingRef.current = null;
      onChangeRef.current(pending);
    }
  }, []);

  // Desmontar com texto pendente = enviar, não descartar.
  React.useEffect(() => () => flush(true), [flush]);

  const handleChange = (e: React.ChangeEvent<T>) => {
    const val = e.target.value;
    if (pendingRef.current === null) baseRef.current = valueRef.current;
    setLocal(val);
    pendingRef.current = val;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => flush(), debounceMs);
  };

  const reapply = () => {
    setRemote(null);
    baseRef.current = valueRef.current;
    heldRef.current = false;
    flush(true);
  };

  const discard = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRef.current = null;
    setRemote(null);
    setLocal(valueRef.current);
  };

  return { local, handleChange, flush: () => flush(), held, reapply, discard };
}

function ConflictNotice({ onReapply, onDiscard }: { onReapply: () => void; onDiscard: () => void }) {
  return (
    <div role="alert" className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
      <p className="m-0 min-w-0 flex-1 basis-48 text-xs text-foreground">
        Outra pessoa alterou este campo enquanto você digitava. O seu texto continua aqui e ainda não foi gravado.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onDiscard} className="h-7 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground hover:bg-muted">
          Descartar
        </button>
        <button type="button" onClick={onReapply} className="h-7 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          Reaplicar a minha
        </button>
      </div>
    </div>
  );
}

export const ControlledInput = React.memo(function ControlledInput({ value, onChange, debounceMs = 400, className, ...props }: any) {
  const { local, handleChange, flush, held, reapply, discard } = useDebouncedField<HTMLInputElement>(value, onChange, debounceMs);
  return (
    <>
      <input
        {...props}
        className={className}
        value={local}
        onBlur={(e) => {
          flush();
          props.onBlur?.(e);
        }}
        onChange={handleChange}
      />
      {held && <ConflictNotice onReapply={reapply} onDiscard={discard} />}
    </>
  );
});

export const ControlledTextarea = React.memo(function ControlledTextarea({ value, onChange, debounceMs = 400, className, ...props }: any) {
  const { local, handleChange, flush, held, reapply, discard } = useDebouncedField<HTMLTextAreaElement>(value, onChange, debounceMs);
  return (
    <>
      <textarea
        {...props}
        className={className}
        value={local}
        onBlur={(e) => {
          flush();
          props.onBlur?.(e);
        }}
        onChange={handleChange}
      />
      {held && <ConflictNotice onReapply={reapply} onDiscard={discard} />}
    </>
  );
});
