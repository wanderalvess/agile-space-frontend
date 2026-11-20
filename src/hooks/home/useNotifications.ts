'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getAuthToken } from '@/lib/auth-client';
import { announcementsToNotifications, unreadByTab } from './derive';
import { fetchAnnouncements, fetchNotifications, loadReadNotifications, markNotificationsRead } from './sources';
import { NO_UNREAD, type HomeAnnouncement, type HomeNotification, type NotificationFeed, type NotificationTab, type UnreadCounts } from './types';
import { useHomeResource, useNow } from './useHomeResource';
import { buildUserChannelUrl, startUserChannel } from './userChannel';

const NO_ANNOUNCEMENTS: HomeAnnouncement[] = [];
/** Rede de segurança do canal em tempo real: relê a cada minuto. */
const REFRESH_MS = 60_000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/**
 * Central do sino. Com o backend novo, "Para você" e "Avisos" vêm das notificações do servidor, com os
 * contadores dele, e o canal `/ws/user` dispara a releitura (`tick` muda a cada sinal). Sem o endpoint
 * (`fetchNotifications` devolve null), só a aba "Avisos" tem conteúdo, vinda dos avisos, e a leitura fica
 * guardada no navegador.
 */
export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.id ?? '';
  const enabled = !!userId;
  const now = useNow();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId) return;
    return startUserChannel({
      buildUrl: () => buildUserChannelUrl(getAuthToken(), API_BASE_URL),
      onSignal: refresh,
    });
  }, [userId, refresh]);

  const remote = useHomeResource<NotificationFeed | null>(() => fetchNotifications(), `notifications:${tick}`, null, {
    enabled,
    intervalMs: REFRESH_MS,
  });
  const legacyAnnouncements = useHomeResource(() => fetchAnnouncements(), 'announcements', NO_ANNOUNCEMENTS, {
    enabled: enabled && remote.data === null && !remote.loading,
    intervalMs: REFRESH_MS,
  });

  // Lidas do armazenamento uma vez por usuário (legado); as marcadas agora entram em `added`.
  const stored = useMemo(() => (userId ? loadReadNotifications(userId) : new Set<string>()), [userId]);
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set());
  const readIds = useMemo<ReadonlySet<string>>(() => new Set([...stored, ...added]), [stored, added]);
  // Depois de "marcar como lidas" o contador do servidor zera até chegar a próxima leitura.
  const [zeroedFor, setZeroedFor] = useState<NotificationFeed | null>(null);

  const hasBackendFeed = remote.data !== null;

  const items = useMemo<HomeNotification[]>(() => {
    if (remote.data) return remote.data.items.map((n) => ({ ...n, unread: n.unread && !readIds.has(n.id) }));
    return announcementsToNotifications(legacyAnnouncements.data, readIds, now);
  }, [remote.data, legacyAnnouncements.data, readIds, now]);

  const byTab = useMemo(() => {
    const out: Record<NotificationTab, HomeNotification[]> = { foryou: [], messages: [], announcements: [] };
    for (const n of items) out[n.tab].push(n);
    return out;
  }, [items]);

  const unread = useMemo<UnreadCounts>(() => {
    if (remote.data) return zeroedFor === remote.data ? NO_UNREAD : remote.data.unread;
    const local = unreadByTab(items);
    return { ...local, total: local.foryou + local.messages + local.announcements };
  }, [remote.data, zeroedFor, items]);

  const markAllRead = useCallback(async () => {
    const ids = items.filter((n) => n.unread).map((n) => n.id);
    setAdded((prev) => new Set([...prev, ...ids]));
    if (remote.data) setZeroedFor(remote.data);
    if (ids.length > 0 && userId) await markNotificationsRead(userId, ids);
    if (remote.data) refresh();
  }, [items, remote.data, userId, refresh]);

  return {
    byTab,
    unread,
    unreadTotal: unread.total,
    markAllRead,
    loading: remote.loading || legacyAnnouncements.loading,
    /** false enquanto só os avisos alimentam o sino. */
    hasBackendFeed,
    /** Muda a cada sinal do canal do usuário; a lista de mensagens usa para reler. */
    tick,
    refresh,
  };
}
