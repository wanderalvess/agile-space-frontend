'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { pickBannerAnnouncement } from './derive';
import { dismissAnnouncement, fetchAnnouncements, loadDismissedAnnouncements } from './sources';
import type { HomeAnnouncement } from './types';
import { useHomeResource, useNow } from './useHomeResource';

const EMPTY: HomeAnnouncement[] = [];
const REFRESH_MS = 5 * 60_000;

/**
 * O aviso do banner da Home (um por vez) e a ação de dispensar. Com o backend novo o servidor já entrega só o
 * que vale para a pessoa e lembra a dispensa; no legado a dispensa fica no navegador. Sem aviso ou sem rede,
 * `announcement` é null.
 */
export function useHomeAnnouncements() {
  const { session } = useAuth();
  const userId = session?.id ?? '';
  const now = useNow();
  const { data, loading, failed } = useHomeResource(() => fetchAnnouncements(), 'announcements', EMPTY, {
    enabled: !!userId,
    intervalMs: REFRESH_MS,
  });

  // Dispensados lidos do armazenamento uma vez por usuário; os de agora entram em `added`.
  const stored = useMemo(() => (userId ? loadDismissedAnnouncements(userId) : new Set<string>()), [userId]);
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set());
  const dismissed = useMemo<ReadonlySet<string>>(() => new Set([...stored, ...added]), [stored, added]);

  const announcement = useMemo(() => pickBannerAnnouncement(data, dismissed, now), [data, dismissed, now]);

  const dismiss = useCallback(
    async (target: HomeAnnouncement) => {
      setAdded((prev) => new Set(prev).add(target.id));
      if (userId) await dismissAnnouncement(userId, target);
    },
    [userId],
  );

  return { announcement, announcements: data, loading, failed, dismiss };
}
