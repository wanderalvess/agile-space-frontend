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
