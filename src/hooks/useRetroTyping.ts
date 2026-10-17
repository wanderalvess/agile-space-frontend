'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  applyTyping,
  createTypingThrottle,
  nextTypingExpiry,
  pruneTyping,
  typersAt,
  typingLabel,
  type TypingEntry,
  type TypingMessage,
  type TypingScope,
} from '@/lib/retro-typing';

export interface UseRetroTypingOptions {
  /** O backend conhece o "escrevendo…" (retro com `lifecycleStatus`). Desligado: nada é enviado nem mostrado. */
  enabled: boolean;
  /** Quem sou eu (o próprio evento nunca aparece). */
  selfId?: string;
  /** Conexão atual da sala; `send` devolve `false` quando não há conexão aberta. */
  socketRef: MutableRefObject<{ send: (message: unknown) => boolean } | null>;
}

/**
 * "Escrevendo…" da Retro. Envia `TYPING` no máximo a cada 2 s (por sessão), recebe o dos outros e o apaga sozinho
 * quando vence (5 s). `onTypingEvent` vai no `case 'TYPING'` do WebSocket; `labelFor` devolve a frase de uma
 * coluna ou de um canal de chat (ou `null`).
 */
export function useRetroTyping({ enabled, selfId, socketRef }: UseRetroTypingOptions) {
  const [entries, setEntries] = useState<TypingEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const onTypingEvent = useCallback((payload: unknown) => {
    if (!enabled) return;
    const t = Date.now();
    setNow(t);
    setEntries((prev) => applyTyping(prev, payload, t, selfId));
  }, [enabled, selfId]);

  // Limpa no instante em que o próximo item vence: nada fica "escrevendo…" para sempre.
  useEffect(() => {
    const next = nextTypingExpiry(entries);
    if (next === null) return;
    const id = setTimeout(() => {
      const t = Date.now();
      setNow(t);
      setEntries((prev) => pruneTyping(prev, t));
    }, Math.max(next - Date.now(), 0) + 20);
    return () => clearTimeout(id);
  }, [entries]);

  // O limitador vive num ref criado depois de montar: só é lido dentro de eventos de teclado.
  const throttleRef = useRef<ReturnType<typeof createTypingThrottle> | null>(null);
  useEffect(() => {
    throttleRef.current = createTypingThrottle((message: TypingMessage) => socketRef.current?.send(message) ?? false);
  }, [socketRef]);
  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const notifyCard = useCallback((columnKey: string) => {
    if (enabledRef.current) throttleRef.current?.notify({ scope: 'card', columnKey });
  }, []);
  const notifyChat = useCallback((channelId: string) => {
    if (enabledRef.current) throttleRef.current?.notify({ scope: 'chat', channelId });
  }, []);

  const labelFor = useCallback(
    (scope: TypingScope, target: string, nameOf: (userId: string) => string | undefined, options?: { authorsRevealed?: boolean }): string | null =>
      enabled ? typingLabel(typersAt(entries, scope, target, now, nameOf, options)) : null,
    [enabled, entries, now]
  );

  return { onTypingEvent, notifyCard, notifyChat, labelFor };
}
