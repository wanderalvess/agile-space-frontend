'use client';

import { useEffect } from 'react';

/**
 * Título da aba no padrão "{título} | Portal Tech V&D" para telas que não usam o PageShell
 * (Base de conhecimento, índice do Manual). Reafirma o título enquanto a tela está montada,
 * porque o metadata estático do layout raiz volta a escrevê-lo depois da hidratação.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const wanted = `${title} | Portal Tech V&D`;
    document.title = wanted;
    const titleEl = document.querySelector('title');
    if (!titleEl || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      if (document.title !== wanted) document.title = wanted;
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [title]);
}
