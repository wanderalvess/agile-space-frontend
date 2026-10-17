'use client';

import * as React from 'react';

/**
 * Preferência pessoal da sala guardada no navegador (visão quadro/foco, som do timer, aviso dispensado).
 * Começa no padrão (igual no servidor e no cliente, sem divergência de hidratação) e lê o valor salvo logo
 * depois de montar. Qualquer falha do storage (modo privado, bloqueado) é ignorada: a sala segue com o padrão.
 * `parse` recebe o texto salvo e devolve o valor ou `undefined` se não servir.
 */
export function useRoomPreference<T>(
  key: string,
  initial: T,
  parse: (raw: string) => T | undefined,
  serialize: (value: T) => string = String
): [T, (value: T) => void] {
  const [value, setValue] = React.useState<T>(initial);
  const parseRef = React.useRef(parse);
  parseRef.current = parse;
  const serializeRef = React.useRef(serialize);
  serializeRef.current = serialize;

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return;
      const parsed = parseRef.current(raw);
      if (parsed !== undefined) setValue(parsed);
    } catch {
      /* storage indisponível: fica o padrão */
    }
  }, [key]);

  const update = React.useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, serializeRef.current(next));
      } catch {
        /* sem storage: vale só nesta sessão */
      }
    },
    [key]
  );

  return [value, update];
}
