'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, MessagesSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isParticipantOnline } from '@/lib/poker-utils';
import { cn } from '@/lib/utils';
import { pokerApi } from '@/app/room/api';
import {
  GENERAL_CHANNEL, categoryLabel, dmChannelId, dmPeerId, participantCategory, roleChannelId,
  type ChatMessage, type ChatMessageKind, type ChatParticipant,
} from './chatChannels';
import { ChatComposer } from './ChatComposer';
import { ChatDirectList, UnreadBadge, type DirectPeer } from './ChatDirectList';
import { ChatMessageList } from './ChatMessageList';
import { useChatReadState } from './useChatReadState';

type Tab = 'geral' | 'role' | 'dm';

interface TeamChatProps {
  roomId: string;
  // Título do painel, ex.: "Chat da Sala" (Poker) / "Chat da Retro".
  title?: string;
  currentUser: ChatParticipant;
  participants: ChatParticipant[];
  canModerate: boolean;
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
  messagesByChannel: Record<string, ChatMessage[]>;
  onSendMessage: (text: string, kind: ChatMessageKind, channelId: string) => void;
  onDeleteMessage: (messageId: string, channelId: string) => void;
}

export function TeamChat({
  roomId,
  title = 'Chat da Sala',
  currentUser,
  participants,
  canModerate,
  isOpen,
  onClose,
  onUnreadChange,
  messagesByChannel,
  onSendMessage,
  onDeleteMessage,
}: TeamChatProps) {
  const [tab, setTab] = useState<Tab>('geral');
  const [activeDm, setActiveDm] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { markRead, unreadCount } = useChatReadState(roomId, currentUser.id);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const myCategory = participantCategory(currentUser);
  const roleChannel = myCategory ? roleChannelId(myCategory) : null;
  const others = useMemo(() => participants.filter(p => p.id !== currentUser.id), [participants, currentUser.id]);
  const dmChannels = useMemo(() => others.map(p => dmChannelId(currentUser.id, p.id)), [others, currentUser.id]);

  // Quem saiu da sala leva a DM junto; volta pra lista.
  useEffect(() => {
    if (activeDm && !dmChannels.includes(activeDm)) setActiveDm(null);
  }, [activeDm, dmChannels]);

  useEffect(() => {
    if (tab === 'role' && !roleChannel) setTab('geral');
  }, [tab, roleChannel]);

  const activeChannel = tab === 'geral' ? GENERAL_CHANNEL : tab === 'role' ? roleChannel : activeDm;
  const activeMessages = (activeChannel && messagesByChannel[activeChannel]) || [];

  useEffect(() => {
    if (!isOpen || !activeChannel || activeMessages.length === 0) return;
    markRead(activeChannel, activeMessages[activeMessages.length - 1].ts);
  }, [isOpen, activeChannel, activeMessages, markRead]);

  const generalUnread = unreadCount(GENERAL_CHANNEL, messagesByChannel[GENERAL_CHANNEL]);
  const roleUnread = roleChannel ? unreadCount(roleChannel, messagesByChannel[roleChannel]) : 0;
  const peers: DirectPeer[] = useMemo(() => others
    .map(p => {
      const channelId = dmChannelId(currentUser.id, p.id);
      const msgs = messagesByChannel[channelId];
      return {
        participant: p,
        channelId,
        lastMessage: msgs?.[msgs.length - 1],
        unread: unreadCount(channelId, msgs),
        online: isParticipantOnline(p, now),
      };
    })
    .sort((a, b) => (b.lastMessage?.ts ?? '').localeCompare(a.lastMessage?.ts ?? '') || a.participant.nickname.localeCompare(b.participant.nickname)),
  [others, currentUser.id, messagesByChannel, unreadCount, now]);

  const dmUnread = peers.reduce((sum, p) => sum + p.unread, 0);
  const totalUnread = generalUnread + roleUnread + dmUnread;

  useEffect(() => {
    onUnreadChange(totalUnread);
  }, [totalUnread, onUnreadChange]);

  const handleSend = (text: string, kind: ChatMessageKind) => {
    if (!activeChannel) return;
    onSendMessage(text, kind, activeChannel);
  };

  const handleDelete = (messageId: string) => {
    if (!activeChannel) return;
    onDeleteMessage(messageId, activeChannel);
  };

  const dmPeer = activeDm ? others.find(p => p.id === dmPeerId(activeDm, currentUser.id)) : null;
  const tabs: { id: Tab; label: string; unread: number }[] = [
    { id: 'geral', label: 'Geral', unread: generalUnread },
    ...(roleChannel ? [{ id: 'role' as const, label: categoryLabel(myCategory), unread: roleUnread }] : []),
    { id: 'dm', label: 'Diretas', unread: dmUnread },
  ];

  const emptyHint = tab === 'geral'
    ? 'Ninguém falou nada ainda. Mande a primeira mensagem para a sala.'
    : tab === 'role'
      ? `Canal só entre ${categoryLabel(myCategory)} desta sala.`
      : `Conversa privada com ${dmPeer?.nickname ?? 'o participante'}.`;
  const placeholder = tab === 'geral'
    ? 'Mensagem para todos…'
    : tab === 'role'
      ? `Mensagem para ${categoryLabel(myCategory)}…`
      : `Mensagem para ${dmPeer?.nickname ?? ''}…`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          className="fixed right-4 left-4 sm:left-auto top-24 bottom-4 w-auto sm:w-[420px] sm:max-w-[calc(100vw-2rem)] z-[100] flex flex-col overflow-x-hidden"
        >
          <div className="flex-1 min-h-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 shadow-sm">
                    <MessagesSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-600 opacity-60">Time</span>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white italic">{title}</h3>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl text-slate-400" aria-label="Fechar chat">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div role="tablist" className="mt-3 flex gap-1 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80">
                {tabs.map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={tab === t.id}
                    onClick={() => { setTab(t.id); if (t.id !== 'dm') setActiveDm(null); }}
                    className={cn(
                      'flex-1 h-8 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
                      tab === t.id
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    )}
                  >
                    <span className="truncate">{t.label}</span>
                    {t.unread > 0 && <UnreadBadge count={t.unread} />}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'dm' && activeDm && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <Button variant="ghost" size="icon" onClick={() => setActiveDm(null)} className="h-8 w-8 rounded-xl text-slate-500" aria-label="Voltar para conversas">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="text-[12px] font-bold text-slate-900 dark:text-white truncate">{dmPeer?.nickname}</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Privado</span>
              </div>
            )}

            {tab === 'dm' && !activeDm ? (
              <ChatDirectList peers={peers} onSelect={setActiveDm} />
            ) : (
              <>
                <ChatMessageList
                  key={`list-${activeChannel}`}
                  messages={activeMessages}
                  selfId={currentUser.id}
                  canModerate={canModerate && tab !== 'dm'}
                  emptyHint={emptyHint}
                  onDelete={handleDelete}
                />
                <ChatComposer key={`composer-${activeChannel}`} placeholder={placeholder} onSend={handleSend} />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
