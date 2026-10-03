'use client';

import React from 'react';
import { UserRound } from 'lucide-react';
import type { Participant } from '@/lib/types';
import { cn } from '@/lib/utils';
import { categoryLabel, participantCategory, type ChatMessage } from './chatChannels';

export type DirectPeer = {
  participant: Participant;
  channelId: string;
  lastMessage?: ChatMessage;
  unread: number;
  online: boolean;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
}

export function ChatDirectList({ peers, onSelect }: { peers: DirectPeer[]; onSelect: (channelId: string) => void }) {
  if (peers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6 text-center">
        <UserRound className="h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="text-[11px] font-bold text-slate-400">Ninguém mais na sala por enquanto.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {peers.map(({ participant, channelId, lastMessage, unread, online }) => (
        <button
          key={channelId}
          type="button"
          onClick={() => onSelect(channelId)}
          className="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
        >
          <div className="relative shrink-0">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-[11px] font-black">
              {initials(participant.nickname)}
            </div>
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900',
              online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold text-slate-900 dark:text-white truncate">{participant.nickname}</span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                {categoryLabel(participantCategory(participant))}
              </span>
            </div>
            <p className={cn('text-[10px] truncate', unread ? 'font-bold text-slate-700 dark:text-slate-200' : 'text-slate-400')}>
              {lastMessage ? (lastMessage.kind === 'code' ? '‹código›' : lastMessage.text) : 'Iniciar conversa'}
            </p>
          </div>
          {unread > 0 && <UnreadBadge count={unread} />}
        </button>
      ))}
    </div>
  );
}

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn(
      'min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shrink-0',
      className
    )}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
