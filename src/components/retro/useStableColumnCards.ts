'use client';

/* eslint-disable react-hooks/refs -- cache de memoização: o ref é lido e gravado só dentro do useMemo, nunca vira saída da renderização */

import { useMemo, useRef } from 'react';
import type { RetroCard } from '@/lib/types';
import { groupCardsByColumn } from './retro-room-logic';

/**
 * Cards agrupados por coluna, reaproveitando a MESMA lista de uma coluna enquanto o conteúdo dela não mudou
 * (comparado por referência de cada card). Sem isso, cada voto ou edição de UM card produzia listas novas
 * para todas as colunas e invalidava o `React.memo` de cada uma.
 */
export function useStableColumnCards(cards: readonly RetroCard[]): Record<string, RetroCard[]> {
  const previous = useRef<Record<string, RetroCard[]>>({});
  return useMemo(() => {
    const grouped = groupCardsByColumn(cards);
    const stable: Record<string, RetroCard[]> = {};
    for (const key of Object.keys(grouped)) {
      const next = grouped[key];
      const before = previous.current[key];
      stable[key] = before && before.length === next.length && before.every((c, i) => c === next[i]) ? before : next;
    }
    previous.current = stable;
    return stable;
  }, [cards]);
}
