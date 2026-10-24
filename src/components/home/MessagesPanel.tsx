'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/hooks/home/derive';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { MESSAGE_MAX_LENGTH } from '@/hooks/home/contract';
import type { Contact, Conversation } from '@/hooks/home/types';
import { startConversationWith, useContacts, useConversationThread } from '@/hooks/home/useMessages';
import { FOCUS_RING, RetryButton } from './home-ui';

interface Props {
  conversations: Conversation[];
  /** false enquanto o servidor não tem mensagens diretas: só o estado vazio, sem escrita. */
  available: boolean;
  myId: string;
  /** Muda a cada sinal do canal do usuário. */
  tick: number;
  now: Date;
  refresh: () => void;
}

type View = { kind: 'list' } | { kind: 'contacts' } | { kind: 'thread'; other: Contact; conversationId: string };

function Thread({ view, myId, tick, now, refresh, onBack }: { view: Extract<View, { kind: 'thread' }>; myId: string; tick: number; now: Date; refresh: () => void; onBack: () => void }) {
  const { messages, sending, sendError, send } = useConversationThread(view.conversationId, tick, refresh);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    if (await send(text)) setText('');
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button type="button" onClick={onBack} aria-label="Voltar às conversas" className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60', FOCUS_RING)}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <InitialsAvatar name={view.other.name} />
        <span className="truncate text-sm font-semibold">{view.other.name}</span>
      </div>
      <ul aria-label={`Conversa com ${view.other.name}`} className="flex h-[280px] flex-col gap-1.5 overflow-y-auto p-3">
        {messages.length === 0 && <li className="m-auto text-sm text-muted-foreground">Nenhuma mensagem</li>}
        {messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <li key={m.id} className={cn('flex max-w-[85%] flex-col gap-0.5', mine ? 'self-end items-end' : 'self-start items-start')}>
              <span className={cn('whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[13px] leading-snug', mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                {m.body}
              </span>
              <span className="px-1 text-xs text-muted-foreground">{formatRelative(m.createdAt, now)}</span>
            </li>
          );
        })}
        <div ref={endRef} />
      </ul>
      {sendError && (
        <p role="alert" className="px-3 pb-1 text-xs text-destructive">
          {sendError}
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-2.5">
        <input
          aria-label="Nova mensagem"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={`Escrever para ${view.other.name.split(' ')[0]}…`}
          className={cn('h-9 min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 text-[13px] text-foreground placeholder:text-muted-foreground', FOCUS_RING)}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-bold text-primary-foreground disabled:opacity-50', FOCUS_RING)}
        >
          <Send aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
          Enviar
        </button>
      </form>
    </div>
  );
}

function Contacts({ onPick, onBack, busyId, error }: { onPick: (c: Contact) => void; onBack: () => void; busyId: string | null; error: string | null }) {
  const { data, loading, failed, refetch } = useContacts(true);
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button type="button" onClick={onBack} aria-label="Voltar às conversas" className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60', FOCUS_RING)}>
          <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <span className="text-sm font-semibold">Nova mensagem</span>
      </div>
      {error && (
        <p role="alert" className="px-3 pt-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {(failed || !loading) && data.length === 0 ? (
        <div aria-live="polite" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">{failed ? 'Não foi possível carregar' : 'Nenhum contato'}</p>
          {failed && <RetryButton onRetry={refetch} busy={loading} />}
        </div>
      ) : (
        <ul className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1.5">
          {data.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={!!busyId}
                onClick={() => onPick(c)}
                className={cn('flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-60', FOCUS_RING)}
              >
                <InitialsAvatar name={c.name} />
                <span className="truncate text-[13px] font-semibold">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Aba "Mensagens" do sino: lista de conversas, contatos para começar uma nova e a conversa com campo de escrita. */
export function MessagesPanel({ conversations, available, myId, tick, now, refresh }: Props) {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const pick = async (contact: Contact) => {
    setBusyId(contact.id);
    setOpenError(null);
    try {
      const conversation = await startConversationWith(contact.id);
      refresh();
      setView({ kind: 'thread', other: contact, conversationId: conversation.id });
    } catch (err) {
      setOpenError(err instanceof Error && err.message ? err.message : 'Não foi possível abrir a conversa.');
    } finally {
      setBusyId(null);
    }
  };

  if (view.kind === 'thread') {
    return <Thread view={view} myId={myId} tick={tick} now={now} refresh={refresh} onBack={() => setView({ kind: 'list' })} />;
  }
  if (view.kind === 'contacts') {
    return <Contacts onPick={pick} onBack={() => setView({ kind: 'list' })} busyId={busyId} error={openError} />;
  }

  return (
    <div className="flex flex-col">
      {conversations.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma mensagem</p>
      ) : (
        <ul className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto p-1.5">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setView({ kind: 'thread', other: c.other, conversationId: c.id })}
                className={cn('flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-muted/50', FOCUS_RING)}
              >
                <InitialsAvatar name={c.other.name} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold">{c.other.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(c.updatedAt, now)}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{c.lastMessage?.body ?? ''}</span>
                </span>
                {c.unreadCount > 0 && (
                  <span role="img" aria-label={`${c.unreadCount} não lidas`} className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {available && (
        <div className="border-t border-border p-2.5">
          <button
            type="button"
            onClick={() => setView({ kind: 'contacts' })}
            className={cn('inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-[13px] font-semibold text-foreground transition-colors hover:bg-muted/60', FOCUS_RING)}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            Nova mensagem
          </button>
        </div>
      )}
    </div>
  );
}
