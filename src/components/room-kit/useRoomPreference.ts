'use client';

import * as React from 'react';
import { useStableCallback } from '@/hooks/use-stable-callback';

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
): [T, (value: T) => void, boolean] {
  const [value, setValue] = React.useState<T>(initial);
  // `loaded` fica verdadeiro depois da primeira leitura do storage: quem decide abrir algo conforme a
  // preferência (aviso dispensado) espera por ele para não piscar o padrão antes do valor salvo.
  const [loaded, setLoaded] = React.useState(false);
  const parseStable = useStableCallback(parse);
  const serializeStable = useStableCallback(serialize);

  React.useEffect(() => {
    /* O storage só existe no navegador: ler depois de montar evita divergência de hidratação. */
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = parseStable(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do storage depois de montar
        if (parsed !== undefined) setValue(parsed);
      }
    } catch {
      /* storage indisponível: fica o padrão */
    }
    setLoaded(true);
  }, [key, parseStable]);

  const update = React.useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, serializeStable(next));
      } catch {
        /* sem storage: vale só nesta sessão */
      }
    },
    [key, serializeStable]
  );

  return [value, update, loaded];
}
