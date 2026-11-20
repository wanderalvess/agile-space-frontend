'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { pickSquadsToQuery, squadRefsFromSession } from './derive';
import { fetchSquadInfos } from './sources';
import type { SquadInfo, SquadSummary } from './types';
import { useHomeResource } from './useHomeResource';

const NO_INFOS: Record<string, SquadInfo> = {};

/**
 * As squads a que a pessoa tem acesso (sessão do AuthContext) com o resumo de sprint e a próxima cerimônia
 * (agregado `/api/home` do backend, ou rollup e configuração por squad no servidor antigo). Trocar de squad
 * usa `switchProject` do AuthContext, o mesmo do seletor global (que também invalida o cache de vínculos).
 */
export function useMySquads() {
  const { session, switchProject } = useAuth();
  const { memberships } = useMyMemberships();
  const refs = useMemo(() => squadRefsFromSession(session, memberships), [session, memberships]);
  // Squad ativa = a da sessão validada pelos vínculos (`/me/memberships`); trocar passa por `switchProject`.
  const activeId = useActiveSquad().squadId || undefined;

  // Quem lidera muitas squads não dispara uma consulta por squad: as primeiras (ativa primeiro) ganham resumo.
  const toQuery = useMemo(() => pickSquadsToQuery(refs, activeId, null), [refs, activeId]);
  const infos = useHomeResource(() => fetchSquadInfos(toQuery), `squads:${toQuery.map((r) => r.id).join(',')}`, NO_INFOS, {
    enabled: toQuery.length > 0,
  });

  const squads = useMemo<SquadSummary[]>(
    () =>
      refs.map((r) => {
        const info = infos.data[r.id];
        return {
          id: r.id,
          name: r.name,
          roleName: r.roleName,
          isActive: r.id === activeId,
          sprintName: info?.sprintName,
          sprintPercent: info?.sprintPercent ?? null,
          daysLeft: info?.daysLeft ?? null,
          nextCeremony: info?.nextCeremony,
        };
      }),
    [refs, infos.data, activeId],
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
    loading: infos.loading,
    switchTo,
  };
}
