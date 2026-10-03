'use client';

import React, { useEffect, useRef } from 'react';
import { MessagesSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
        <MessagesSquare className="h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="text-[11px] font-bold text-slate-400">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1">
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const isOwn = msg.senderId === selfId;
        const startsGroup = !prev || prev.senderId !== msg.senderId ||
          new Date(msg.ts).getTime() - new Date(prev.ts).getTime() > GROUP_WINDOW_MS;

        return (
          <div key={msg.id} className={cn('group flex w-full', isOwn ? 'justify-end' : 'justify-start', startsGroup && i > 0 && 'pt-2')}>
            <div className={cn('flex flex-col min-w-0 max-w-[88%]', isOwn ? 'items-end' : 'items-start')}>
              {startsGroup && (
                <div className={cn('flex items-center gap-1.5 mb-0.5 px-1', isOwn && 'flex-row-reverse')}>
                  <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 truncate max-w-[160px]">
                    {isOwn ? 'Você' : msg.senderName}
                  </span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                    {categoryLabel(msg.senderCategory)}
                  </span>
                  <span className="text-[9px] text-slate-400">{formatTime(msg.ts)}</span>
                </div>
              )}
              <div className={cn('flex items-center gap-1 max-w-full min-w-0', isOwn && 'flex-row-reverse')}>
                <div className={cn(
                  'px-3 py-2 rounded-[1.1rem] text-[12px] font-medium leading-relaxed shadow-sm min-w-0 max-w-full',
                  msg.kind === 'code' && 'p-1 w-[320px] max-w-full',
                  isOwn
                    ? 'bg-indigo-600 text-white rounded-tr-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-tl-md'
                )}>
                  <ChatMessageContent text={msg.text} kind={msg.kind} isOwn={isOwn} />
                </div>
                {(isOwn || canModerate) && (
                  <button
                    type="button"
                    onClick={() => onDelete(msg.id)}
                    className="shrink-0 p-1 rounded-lg text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    title="Apagar mensagem"
                    aria-label="Apagar mensagem"
                  >
                    <Trash2 className="h-3 w-3" />
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
