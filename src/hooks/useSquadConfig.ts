'use client';

import { useEffect, useState } from 'react';
import { squadApi } from '@/app/squad/api';
import type { SquadConfig } from '@/lib/types';

// Config da squad (unidade de estimativa, rituais) lida por vários widgets da mesma página:
// uma busca por squad, em cache de módulo.
const cache = new Map<string, Promise<SquadConfig | null>>();
const INVALIDATE_EVENT = 'squad-config-invalidated';

function load(squadId: string): Promise<SquadConfig | null> {
  let p = cache.get(squadId);
  if (!p) {
    p = squadApi.getSquad(squadId).catch(() => {
      cache.delete(squadId);
      return null;
    });
    cache.set(squadId, p);
  }
  return p;
}

/** Chame depois de salvar a config para os widgets relerem sem recarregar a página. */
export function invalidateSquadConfig(squadId?: string) {
  if (squadId) cache.delete(squadId);
  else cache.clear();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INVALIDATE_EVENT));
}

export function useSquadConfig(squadId?: string) {
  const [config, setConfig] = useState<SquadConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onInvalidate = () => setTick(t => t + 1);
    window.addEventListener(INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(INVALIDATE_EVENT, onInvalidate);
  }, []);

  useEffect(() => {
    if (!squadId || squadId === 'Sem Time') {
      setConfig(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    load(squadId).then(c => {
      if (!alive) return;
      setConfig(c);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [squadId, tick]);

  return { config, loading };
}
