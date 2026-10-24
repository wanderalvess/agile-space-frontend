'use client';

import React from 'react';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PersonAvatar } from '@/components/room-kit';
import { categoryLabel, participantCategory, type ChatMessage, type ChatParticipant } from './chatChannels';

export type DirectPeer = {
  participant: ChatParticipant;
  channelId: string;
  lastMessage?: ChatMessage;
  unread: number;
  online: boolean;
};

export function ChatDirectList({ peers, onSelect }: { peers: DirectPeer[]; onSelect: (channelId: string) => void }) {
  if (peers.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <UserRound className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
        <p className="m-0 text-sm text-muted-foreground">Ninguém mais na sala por enquanto.</p>
      </div>
    );
  }

  return (
    <ul className="m-0 flex flex-1 list-none flex-col gap-0.5 overflow-y-auto p-2">
      {peers.map(({ participant, channelId, lastMessage, unread, online }) => (
        <li key={channelId}>
          <button
            type="button"
            onClick={() => onSelect(channelId)}
            className="flex w-full items-center gap-3 rounded-[10px] p-2.5 text-left transition-colors duration-fast hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="relative shrink-0">
              <PersonAvatar name={participant.nickname} size="lg" />
              <span
                aria-hidden="true"
                className={cn('absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-card', online ? 'bg-emerald-500' : 'bg-muted-foreground/40')}
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold">{participant.nickname}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{categoryLabel(participantCategory(participant))}</span>
              </span>
              <span className={cn('truncate text-xs', unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {lastMessage ? (lastMessage.kind === 'code' ? 'Trecho de código' : lastMessage.text) : 'Iniciar conversa'}
              </span>
            </span>
            {unread > 0 && <UnreadBadge count={unread} />}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold tabular-nums text-primary-foreground',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
