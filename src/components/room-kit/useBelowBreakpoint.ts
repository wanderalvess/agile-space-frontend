'use client';

import { useEffect, useState } from 'react';

/**
 * Verdadeiro enquanto a viewport for menor que `px`. Serve para trocar painéis
 * fixos (desktop) por folhas (Sheet) no tablet/celular. No servidor e no
 * primeiro render devolve `false` (painel fechado por padrão, sem flash).
 */
export function useBelowBreakpoint(px: number): boolean {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${px - 1}px)`);
    const update = () => setBelow(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [px]);
  return below;
}

/**
 * Verdadeiro enquanto a media query casar (ex.: `(max-height: 820px)` para telas
 * baixas). Falso no servidor e no primeiro render.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}
