'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchContacts,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  openConversation,
  sendMessage,
} from './sources';
import type { ChatMessage, Contact, Conversation } from './types';
import { useHomeResource } from './useHomeResource';

const REFRESH_MS = 60_000;

/**
 * Conversas diretas da pessoa. `available` é false enquanto o servidor não tem o recurso (a aba fica vazia e
 * sem campo de escrita). `tick` muda a cada sinal do canal do usuário e refaz a lista.
 */
export function useConversationList(enabled: boolean, tick: number) {
  const res = useHomeResource<Conversation[] | null>(() => fetchConversations(), `conversations:${tick}`, null, {
    enabled,
    intervalMs: REFRESH_MS,
  });
  return { conversations: res.data ?? [], available: res.data !== null, loading: res.loading };
}

/** Pessoas com quem dá para conversar (mesma squad). Só busca quando `enabled`. */
export function useContacts(enabled: boolean) {
  return useHomeResource<Contact[]>(() => fetchContacts(), 'contacts', [], { enabled });
}

/** Mensagens de uma conversa, o envio e o "lida" ao abrir. */
export function useConversationThread(conversationId: string | null, tick: number, onChanged?: () => void) {
  const fetched = useHomeResource<ChatMessage[]>(
    () => fetchMessages(conversationId as string),
    `thread:${conversationId}:${tick}`,
    [],
    { enabled: !!conversationId },
  );
  const [sent, setSent] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [errorState, setErrorState] = useState<{ conversationId: string | null; text: string } | null>(null);
  // O erro e as mensagens enviadas pertencem a uma conversa: trocar de conversa os deixa de fora, sem reset em efeito.
  const sendError = errorState && errorState.conversationId === conversationId ? errorState.text : null;

  // Abrir a conversa marca como lida.
  useEffect(() => {
    if (!conversationId) return;
    void markConversationRead(conversationId)
      .then(() => onChanged?.())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const messages = useMemo(() => {
    const known = new Set(fetched.data.map((m) => m.id));
    return [...fetched.data, ...sent.filter((m) => m.conversationId === conversationId && !known.has(m.id))].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [fetched.data, sent, conversationId]);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (!conversationId) return false;
      setSending(true);
      setErrorState(null);
      try {
        const message = await sendMessage(conversationId, text);
        setSent((prev) => [...prev, message]);
        onChanged?.();
        return true;
      } catch (err) {
        setErrorState({ conversationId, text: err instanceof Error && err.message ? err.message : 'Não foi possível enviar.' });
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, onChanged],
  );

  return { messages, loading: fetched.loading, sending, sendError, send };
}

/** Abre (ou cria) a conversa com um contato. */
export function startConversationWith(contactId: string): Promise<Conversation> {
  return openConversation(contactId);
}
