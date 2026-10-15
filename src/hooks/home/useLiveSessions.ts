'use client';

import { fetchLiveSessions } from './sources';
import type { SquadRef, ToolSession } from './types';
import { useHomeResource } from './useHomeResource';

const NONE: ToolSession[] = [];
const REFRESH_MS = 45_000;

/**
 * Sessões acontecendo agora nas squads informadas. Hoje derivado das listas de cada ritual
 * (ver `sources.fetchLiveSessions`); quando existir o endpoint único de "ao vivo", só a fonte muda.
 * Falha de qualquer ritual/squad apenas some da lista.
 */
export function useLiveSessions(squads: SquadRef[]) {
  const key = squads.map((s) => s.id).join(',');
  return useHomeResource(() => fetchLiveSessions(squads), `live:${key}`, NONE, {
    enabled: squads.length > 0,
    intervalMs: REFRESH_MS,
  });
}
