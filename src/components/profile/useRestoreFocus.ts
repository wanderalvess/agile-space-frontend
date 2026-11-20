'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Devolve o foco a quem abriu o modal quando ele fecha. O Dialog do Radix só faz isso com um
 * DialogTrigger, e aqui o modal abre por estado (menu do usuário, botão, pedido de identidade).
 * Guarda o elemento focado ao abrir e acompanha o último foco fora do modal (o menu que abriu
 * devolve o foco ao próprio botão logo depois).
 */
export function useRestoreFocus(isOpen: boolean) {
  const target = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const active = document.activeElement;
    target.current = active instanceof HTMLElement && active !== document.body ? active : null;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || el === document.body) return;
      if (el.closest('[role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper], [data-sonner-toaster]')) return;
      target.current = el;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [isOpen]);

  /** Para o `onCloseAutoFocus` do Modal: sem alvo válido, deixa o comportamento padrão. */
  return useCallback((event: Event) => {
    const el = target.current;
    if (el && el.isConnected) {
      event.preventDefault();
      el.focus();
    }
  }, []);
}
