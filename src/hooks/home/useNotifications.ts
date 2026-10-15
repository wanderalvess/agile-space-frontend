'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { announcementsToNotifications, unreadByTab } from './derive';
import { fetchAnnouncements, fetchNotifications, loadReadNotifications, markNotificationsRead } from './sources';
import type { HomeAnnouncement, HomeNotification, NotificationTab } from './types';
import { useHomeResource, useNow } from './useHomeResource';

const NO_ANNOUNCEMENTS: HomeAnnouncement[] = [];
const REFRESH_MS = 2 * 60_000;

/**
 * Central do sino. Enquanto o backend não entrega notificações e mensagens (`fetchNotifications` devolve
 * null), só a aba "Avisos" tem conteúdo, vinda dos avisos; as outras duas ficam no estado vazio.
 */
export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.id ?? '';
  const enabled = !!userId;
  const now = useNow();

  const announcements = useHomeResource(() => fetchAnnouncements(), 'announcements', NO_ANNOUNCEMENTS, {
    enabled,
    intervalMs: REFRESH_MS,
  });
  const remote = useHomeResource<HomeNotification[] | null>(() => fetchNotifications(), 'notifications', null, {
    enabled,
    intervalMs: REFRESH_MS,
  });

  // Lidas do armazenamento uma vez por usuário; as marcadas agora entram em `added`.
  const stored = useMemo(() => (userId ? loadReadNotifications(userId) : new Set<string>()), [userId]);
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set());
  const readIds = useMemo<ReadonlySet<string>>(() => new Set([...stored, ...added]), [stored, added]);

  const items = useMemo<HomeNotification[]>(() => {
    const fromBackend = (remote.data ?? []).map((n) => ({ ...n, unread: n.unread && !readIds.has(n.id) }));
    return [...fromBackend, ...announcementsToNotifications(announcements.data, readIds, now)];
  }, [remote.data, announcements.data, readIds, now]);

  const byTab = useMemo(() => {
    const out: Record<NotificationTab, HomeNotification[]> = { foryou: [], messages: [], announcements: [] };
    for (const n of items) out[n.tab].push(n);
    return out;
  }, [items]);

  const unread = useMemo(() => unreadByTab(items), [items]);
  const unreadTotal = unread.foryou + unread.messages + unread.announcements;

  const markAllRead = useCallback(async () => {
    const ids = items.filter((n) => n.unread).map((n) => n.id);
    if (ids.length === 0) return;
    setAdded((prev) => new Set([...prev, ...ids]));
    if (userId) await markNotificationsRead(userId, ids);
  }, [items, userId]);

  return {
    byTab,
    unread,
    unreadTotal,
    markAllRead,
    loading: announcements.loading || remote.loading,
    /** false enquanto só os avisos alimentam o sino. */
    hasBackendFeed: remote.data !== null,
  };
}
