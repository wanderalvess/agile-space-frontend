'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supportApi, type SupportTicket, type SupportTicketReply, type SupportTicketType } from '@/app/support/api';
import { POLL_INTERVAL_MS, hasUnread, mergeTicket, withReadMark } from './support-utils';

export type ListPhase = 'loading' | 'ready' | 'error';
export type RepliesState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; items: SupportTicketReply[] };

/**
 * Chamados do usuário e a conversa aberta. Carrega a lista, abre/marca como lido, e atualiza sozinho: a cada ~30 s
 * (só com a aba visível) e ao voltar para a janela. Atualização silenciosa nunca troca a tela por "carregando".
 */
export function useSupportTickets(enabled: boolean, initialSelectedId: string | null) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [phase, setPhase] = useState<ListPhase>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [replies, setReplies] = useState<RepliesState>({ phase: 'loading' });
  const selectedRef = useRef<string | null>(initialSelectedId);
  const ticketsRef = useRef<SupportTicket[]>([]);
  const phaseRef = useRef<ListPhase>('loading');
  // Os callbacks assíncronos e o temporizador leem o estado mais recente por estas referências.
  useEffect(() => {
    selectedRef.current = selectedId;
    ticketsRef.current = tickets;
    phaseRef.current = phase;
  });

  const markRead = useCallback((id: string) => {
    setTickets((prev) => prev.map((t) => (t.id === id && hasUnread(t) ? withReadMark(t) : t)));
    // Servidor antigo (sem /read) ou falha de rede: o selo some na tela e volta na próxima carga, sem erro para a pessoa.
    void supportApi.markRead(id).catch(() => undefined);
  }, []);

  const loadReplies = useCallback(async (id: string, silent: boolean) => {
    if (!silent) setReplies({ phase: 'loading' });
    try {
      const items = await supportApi.getReplies(id);
      if (selectedRef.current === id) setReplies({ phase: 'ready', items });
    } catch {
      if (selectedRef.current === id && !silent) setReplies({ phase: 'error' });
    }
  }, []);

  const loadList = useCallback(async (silent: boolean) => {
    if (!silent) setPhase('loading');
    try {
      const data = await supportApi.listMine();
      setTickets(data);
      setPhase('ready');
      // Chegou resposta nova no chamado que está aberto: lê de novo e marca como lido.
      const open = selectedRef.current ? data.find((t) => t.id === selectedRef.current) : undefined;
      if (open && silent) {
        void loadReplies(open.id, true);
        if (hasUnread(open)) markRead(open.id);
      }
    } catch {
      if (!silent) setPhase('error');
    }
  }, [loadReplies, markRead]);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da lista
    void loadList(false);
  }, [enabled, loadList]);

  // Abriu um chamado (clique, ou link do sino): carrega a conversa e marca como lido.
  useEffect(() => {
    if (!selectedId || phase !== 'ready') return;
    const exists = ticketsRef.current.find((t) => t.id === selectedId);
    if (!exists) return;
    void loadReplies(selectedId, false);
    if (hasUnread(exists)) markRead(selectedId);
  }, [selectedId, phase, loadReplies, markRead]);

  // Atualização periódica só com a aba visível, e ao focar a janela.
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === 'visible' && phaseRef.current === 'ready') void loadList(true);
    };
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [enabled, loadList]);

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  const create = useCallback(async (payload: { subject: string; message: string; type: SupportTicketType; requesterName?: string }) => {
    const created = await supportApi.createTicket(payload);
    setTickets((prev) => [created, ...prev]);
    setPhase('ready');
    setSelectedId(created.id);
    return created;
  }, []);

  const reply = useCallback(async (id: string, message: string, authorName?: string) => {
    const created = await supportApi.addReply(id, { message, authorName });
    setReplies((r) => (r.phase === 'ready' && selectedRef.current === id ? { phase: 'ready', items: [...r.items, created] } : r));
    return created;
  }, []);

  const close = useCallback(async (id: string) => {
    const updated = await supportApi.closeTicket(id);
    setTickets((prev) => mergeTicket(prev, updated));
    return updated;
  }, []);

  const reopen = useCallback(async (id: string) => {
    const updated = await supportApi.reopenTicket(id);
    setTickets((prev) => mergeTicket(prev, updated));
    return updated;
  }, []);

  /** O servidor discordou do estado local (ex.: 409): relê a lista sem trocar a tela por "carregando". */
  const refresh = useCallback(() => loadList(true), [loadList]);

  return {
    tickets,
    phase,
    selectedId,
    select,
    replies,
    retryList: () => loadList(false),
    retryReplies: () => (selectedId ? loadReplies(selectedId, false) : Promise.resolve()),
    create,
    reply,
    close,
    reopen,
    refresh,
  };
}
