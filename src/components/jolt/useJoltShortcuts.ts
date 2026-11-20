'use client';

import { useEffect, useRef } from 'react';
import { matchShortcut, type JoltShortcut } from '@/lib/jolt-shortcuts';

/** Há uma janela (diálogo, folha) aberta por cima da tela: os atalhos ficam quietos até ela fechar. */
function overlayOpen(): boolean {
  return !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
}

/**
 * Liga Ctrl+Enter e Ctrl+S na página inteira. O `preventDefault` do Ctrl+S impede o "Salvar página" do navegador.
 * Dentro do Monaco o editor usa o mesmo caminho (ver JsonEditor), então cada tecla aciona a ação uma vez só.
 */
export function useJoltShortcuts(handlers: Record<JoltShortcut, () => void>) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // o Monaco já tratou esta tecla
      const action = matchShortcut(e);
      if (!action) return;
      e.preventDefault();
      if (e.repeat || overlayOpen()) return;
      ref.current[action]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
