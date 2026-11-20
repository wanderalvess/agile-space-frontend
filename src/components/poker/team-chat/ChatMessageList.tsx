'use client';

import React, { useEffect, useRef } from 'react';
import { MessagesSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/components/room-kit';
import { categoryLabel, type ChatMessage } from './chatChannels';
import { ChatMessageContent } from './ChatMessageContent';

const GROUP_WINDOW_MS = 3 * 60 * 1000;

function formatTime(ts: string) {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessageList({
  messages,
  selfId,
  canModerate,
  emptyHint,
  onDelete,
}: {
  messages: ChatMessage[];
  selfId: string;
  canModerate: boolean;
  emptyHint: string;
  onDelete: (messageId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <MessagesSquare className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
        <p className="m-0 text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} role="log" aria-live="polite" aria-label="Mensagens" className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-4">
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const isOwn = msg.senderId === selfId;
        const startsGroup = !prev || prev.senderId !== msg.senderId ||
          new Date(msg.ts).getTime() - new Date(prev.ts).getTime() > GROUP_WINDOW_MS;

        return (
          <div key={msg.id} className={cn('group flex w-full gap-2.5', isOwn && 'flex-row-reverse', startsGroup && i > 0 && 'mt-2.5')}>
            {!isOwn && (startsGroup ? <PersonAvatar name={msg.senderName} userId={msg.senderId} size="md" className="mt-0.5" /> : <span className="w-8 shrink-0" aria-hidden="true" />)}
            <div className={cn('flex min-w-0 max-w-[85%] flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
              {startsGroup && (
                <span className="flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground">
                  <strong className="max-w-[160px] truncate font-semibold text-foreground">{isOwn ? 'Você' : msg.senderName}</strong>
                  {!isOwn && <span>{categoryLabel(msg.senderCategory)}</span>}
                  <span className="tabular-nums">· {formatTime(msg.ts)}</span>
                </span>
              )}
              <div className={cn('flex min-w-0 max-w-full items-center gap-1', isOwn && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'min-w-0 max-w-full rounded-xl px-3 py-2 text-[13px] leading-[1.45]',
                    msg.kind === 'code' && 'w-[320px] p-1',
                    isOwn ? 'bg-primary text-primary-foreground' : 'border border-border bg-muted/50 text-foreground'
                  )}
                >
                  <ChatMessageContent text={msg.text} kind={msg.kind} isOwn={isOwn} />
                </div>
                {(isOwn || canModerate) && (
                  <button
                    type="button"
                    onClick={() => onDelete(msg.id)}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity duration-fast hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-red-300"
                    title="Apagar mensagem"
                    aria-label="Apagar mensagem"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
