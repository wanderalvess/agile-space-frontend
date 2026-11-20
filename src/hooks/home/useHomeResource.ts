'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HomeResource } from './types';

interface Options {
  /** Refaz a busca de tempos em tempos (só com a aba visível). */
  intervalMs?: number;
  /** false = não busca e devolve o estado vazio. */
  enabled?: boolean;
  /** Busca de novo quando a aba volta a ficar visível ou a janela ganha foco (ex.: depois de criar uma sala em outra aba). */
  refetchOnFocus?: boolean;
}

/**
 * Busca com estado vazio garantido: se `load` rejeitar, `data` continua sendo o último valor bom (ou `initial`)
 * e `failed` fica true. Nunca lança para a árvore de componentes.
 * `key` identifica a consulta; mudou, busca de novo.
 */
export function useHomeResource<T>(load: () => Promise<T>, key: string, initial: T, options: Options = {}): HomeResource<T> {
  const { intervalMs, enabled = true, refetchOnFocus = false } = options;
  const loadRef = useRef(load);
  const initialRef = useRef(initial);
  useEffect(() => {
    loadRef.current = load;
  });

  const [state, setState] = useState<Omit<HomeResource<T>, 'refetch'>>({ data: initial, loading: enabled, failed: false });
  // "Tentar de novo": muda a tentativa e o efeito abaixo refaz a busca do zero (com o estado de carregando).
  const [attempt, setAttempt] = useState(0);
  const refetch = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState({ data: initialRef.current, loading: false, failed: false });
      return;
    }
    let cancelled = false;

    const run = async (first: boolean) => {
      if (first) setState((s) => ({ ...s, loading: true }));
      try {
        const data = await loadRef.current();
        if (!cancelled) setState({ data, loading: false, failed: false });
      } catch {
        if (!cancelled) setState((s) => ({ data: first ? initialRef.current : s.data, loading: false, failed: true }));
      }
    };

    void run(true);
    const timer = intervalMs
      ? setInterval(() => {
          if (typeof document === 'undefined' || document.visibilityState === 'visible') void run(false);
        }, intervalMs)
      : undefined;

    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void run(false);
    };
    if (refetchOnFocus && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (refetchOnFocus && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
      }
    };
  }, [key, enabled, intervalMs, refetchOnFocus, attempt]);

  return { ...state, refetch };
}

/** "Agora" que se atualiza sozinho, para textos relativos. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
