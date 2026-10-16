'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, CalendarDays, ListChecks, Megaphone, Wrench, type LucideIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/hooks/home/derive';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import type { HomeNotification, NotificationTab } from '@/hooks/home/types';
import { useNotifications } from '@/hooks/home/useNotifications';
import { useNow } from '@/hooks/home/useHomeResource';
import { useConversationList } from '@/hooks/home/useMessages';
import { markConversationRead } from '@/hooks/home/sources';
import { useAuth } from '@/context/AuthContext';
import { MessagesPanel } from './MessagesPanel';
import { FOCUS_RING, IconTile, TINT_TEXT } from './home-ui';

const TABS: { id: NotificationTab; label: string; empty: string }[] = [
  { id: 'foryou', label: 'Para você', empty: 'Nada por aqui' },
  { id: 'messages', label: 'Mensagens', empty: 'Nenhuma mensagem' },
  { id: 'announcements', label: 'Avisos', empty: 'Nenhum aviso' },
];

const ICONS: Record<NonNullable<HomeNotification['icon']>, LucideIcon> = {
  megaphone: Megaphone,
  wrench: Wrench,
  alert: AlertTriangle,
  calendar: CalendarDays,
  list: ListChecks,
};

function NotificationRow({ n, now }: { n: HomeNotification; now: Date }) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl p-2.5 transition-colors hover:bg-muted/50">
      {n.personName ? (
        <InitialsAvatar name={n.personName} />
      ) : (
        <IconTile icon={ICONS[n.icon ?? 'megaphone']} size="sm" className="h-8 w-8" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] leading-snug">
          <strong className="font-semibold">{n.who}</strong>
          {n.text ? <span className="text-muted-foreground"> {n.text}</span> : null}
        </span>
        {n.createdAt && <span className="text-[11px] text-muted-foreground">{formatRelative(n.createdAt, now)}</span>}
        {n.cta && (
          <Link
            href={n.cta.href}
            className={cn(
              'mt-1 inline-flex h-7 items-center self-start rounded-md bg-primary px-2.5 text-xs font-bold text-primary-foreground',
              FOCUS_RING,
            )}
          >
            {n.cta.label}
          </Link>
        )}
      </span>
      {n.unread && <span role="img" aria-label="Não lida" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
    </li>
  );
}

/** Sino do cabeçalho: contador de não lidas e central com as abas Para você, Mensagens e Avisos. */
export function NotificationCenter() {
  const { session } = useAuth();
  const { byTab, unread, unreadTotal, markAllRead, tick, refresh } = useNotifications();
  const { conversations, available } = useConversationList(!!session, tick);
  const [tab, setTab] = useState<NotificationTab>('foryou');
  const now = useNow();

  // "Marcar como lidas" vale para tudo: notificações, avisos e conversas com mensagens novas.
  const markEverythingRead = async () => {
    await markAllRead();
    const withNew = conversations.filter((c) => c.unreadCount > 0);
    if (withNew.length > 0) {
      await Promise.allSettled(withNew.map((c) => markConversationRead(c.id)));
      refresh();
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadTotal > 0 ? `Notificações, ${unreadTotal} não lidas` : 'Notificações'}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-[10px] border border-border max-sm:h-11 max-sm:w-11 text-foreground transition-colors hover:bg-muted/60 data-[state=open]:border-primary',
            FOCUS_RING,
          )}
        >
          <Bell aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
          {unreadTotal > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-primary px-1 text-[11px] font-bold text-primary-foreground"
            >
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(400px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0" aria-label="Notificações">
        <Tabs value={tab} onValueChange={(v) => setTab(v as NotificationTab)}>
          <div className="flex items-center gap-2 border-b border-border px-3.5 pt-3">
            <TabsList className="h-auto flex-1 justify-start gap-4 rounded-none bg-transparent p-0">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="h-9 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-0 text-[13px] text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {t.label}
                  {unread[t.id] > 0 && (
                    <span className={cn('inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold', TINT_TEXT)}>
                      {unread[t.id]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <button
              type="button"
              onClick={() => void markEverythingRead()}
              disabled={unreadTotal === 0}
              className={cn(
                'mb-2 rounded-md px-1 text-xs font-semibold disabled:opacity-40',
                TINT_TEXT,
                FOCUS_RING,
              )}
            >
              Marcar como lidas
            </button>
          </div>
          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-0">
              {t.id === 'messages' ? (
                <MessagesPanel conversations={conversations} available={available} myId={session?.id ?? ''} tick={tick} now={now} refresh={refresh} />
              ) : byTab[t.id].length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t.empty}</p>
              ) : (
                <ul className="flex max-h-[380px] flex-col gap-0.5 overflow-y-auto p-1.5">
                  {byTab[t.id].map((n) => (
                    <NotificationRow key={n.id} n={n} now={now} />
                  ))}
                </ul>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
