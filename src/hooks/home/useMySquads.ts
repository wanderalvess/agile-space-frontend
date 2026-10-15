'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { pickSquadsToQuery, sprintProgress, squadRefsFromSession, upcomingCeremonies } from './derive';
import { fetchSquadSnapshot, type SquadSnapshot } from './sources';
import type { SquadSummary } from './types';
import { useHomeResource, useNow } from './useHomeResource';

const NO_SNAPSHOTS: Record<string, SquadSnapshot> = {};

/**
 * As squads a que a pessoa tem acesso (sessão do AuthContext) com o resumo de sprint e a próxima cerimônia
 * cadastrada. Trocar de squad usa `switchProject` do AuthContext, o mesmo do seletor global.
 */
export function useMySquads() {
  const { session, switchProject } = useAuth();
  const now = useNow();
  const refs = useMemo(() => squadRefsFromSession(session), [session]);
  const activeId = session?.activeProjectId;

  // Quem lidera muitas squads não dispara uma consulta por squad: as primeiras (ativa primeiro) ganham resumo.
  const toQuery = useMemo(() => pickSquadsToQuery(refs, activeId, null), [refs, activeId]);
  const snapshots = useHomeResource(
    async () => {
      const entries = await Promise.all(toQuery.map(async (r) => [r.id, await fetchSquadSnapshot(r.id)] as const));
      return Object.fromEntries(entries) as Record<string, SquadSnapshot>;
    },
    `squads:${toQuery.map((r) => r.id).join(',')}`,
    NO_SNAPSHOTS,
    { enabled: toQuery.length > 0 },
  );

  const squads = useMemo<SquadSummary[]>(
    () =>
      refs.map((r) => {
        const snap = snapshots.data[r.id];
        const progress = sprintProgress(snap?.rollup, now);
        const manual = snap?.config?.ceremonyMode === 'manual' ? snap.config.ceremonies : undefined;
        return {
          id: r.id,
          name: r.name,
          roleName: r.roleName,
          isActive: r.id === activeId,
          sprintName: snap?.rollup?.sprintName,
          sprintPercent: progress.percent,
          daysLeft: progress.daysLeft,
          nextCeremony: upcomingCeremonies(manual, now, 1)[0],
        };
      }),
    [refs, snapshots.data, activeId, now],
  );

  const switchTo = useCallback(
    async (squadId: string) => {
      if (!squadId || squadId === activeId) return;
      await switchProject(squadId);
    },
    [activeId, switchProject],
  );

  return {
    squads,
    activeId,
    activeSquad: squads.find((s) => s.isActive) ?? squads[0],
    isMulti: refs.length > 1,
    loading: snapshots.loading,
    switchTo,
  };
}
