'use client';

import { useEffect, useState } from 'react';

/**
 * Há quanto tempo (ms) algo está fora, medido por esta tela: começa a contar quando `offline` vira `true` (ou quando
 * `resetKey` muda, ex.: outro facilitador) e volta a zero quando `offline` volta a `false`. Atualiza a cada segundo até
 * `untilMs`; depois disso para (o valor deixa de mudar e a tela não re-renderiza à toa).
 */
export function useOfflineElapsed(offline: boolean, resetKey: string, untilMs: number): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!offline) return;
    const start = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      if (ms >= untilMs) clearInterval(id);
    }, 1000);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
  }, [offline, resetKey, untilMs]);

  return offline ? elapsed : 0;
}
