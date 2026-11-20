'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Largura e altura (px) de um elemento, acompanhando o redimensionamento.
 * Devolve `[ref, tamanho]`: o `ref` é uma função, então funciona mesmo quando o
 * elemento só aparece depois (troca de tela dentro do mesmo componente).
 * O tamanho é 0 x 0 até a primeira medição (servidor e primeiro render), então
 * quem usa deve ter um desenho de reserva para esse instante.
 */
export function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, { width: number; height: number }] {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const ref = useCallback((el: T | null) => setNode(el), []);
  useEffect(() => {
    if (!node) return;
    const read = () => {
      const w = Math.round(node.clientWidth);
      const h = Math.round(node.clientHeight);
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [ref, size];
}
