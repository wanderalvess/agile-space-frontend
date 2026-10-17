'use client';

import { useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { useStableCallback } from '@/hooks/use-stable-callback';

/** Fundo do PNG: o da página no tema atual (claro ou escuro), para a imagem não sair com fundo transparente ou fixo. */
export function pageBackground(): string {
  if (typeof document === 'undefined') return '#ffffff';
  const body = getComputedStyle(document.body).backgroundColor;
  if (body && body !== 'rgba(0, 0, 0, 0)' && body !== 'transparent') return body;
  return '#ffffff';
}

/** Gera o PNG do elemento e baixa. Devolve false se não deu (o erro vai ao console). */
export async function downloadElementAsPng(node: HTMLElement, fileName: string): Promise<boolean> {
  try {
    const dataUrl = await toPng(node, { backgroundColor: pageBackground(), cacheBust: true, style: { borderRadius: '0' } });
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    return true;
  } catch (error) {
    console.error('Não foi possível gerar a imagem', error);
    return false;
  }
}

/**
 * Executa `run` uma vez cada vez que `request` muda, nunca na montagem. O pedido de imagem é um número que a sala
 * incrementa: quem chega à etapa depois não dispara um pedido antigo (antes o PNG "pendente" baixava sozinho na
 * visita seguinte ao Mural).
 */
export function useExportRequest(request: number | undefined, run: () => void | Promise<void>) {
  const handled = useRef(request ?? 0);
  const stableRun = useStableCallback(run);
  useEffect(() => {
    if (request === undefined || request === handled.current) return;
    handled.current = request;
    void stableRun();
  }, [request, stableRun]);
}
