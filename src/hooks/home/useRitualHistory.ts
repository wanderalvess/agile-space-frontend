'use client';

import { fetchRitualHistory } from './sources';
import type { RitualKey, SquadRef, ToolSession } from './types';
import { useHomeResource } from './useHomeResource';

const EMPTY: Record<RitualKey, ToolSession[]> = { poker: [], retro: [], showcase: [], health: [], brainstorming: [] };

/** Sessões de cada ritual (mais recentes primeiro) nas squads informadas. Falha vira lista vazia. */
export function useRitualHistory(squads: SquadRef[]) {
  const key = squads.map((s) => s.id).join(',');
  return useHomeResource(() => fetchRitualHistory(squads), `history:${key}`, EMPTY, { enabled: squads.length > 0 });
}
