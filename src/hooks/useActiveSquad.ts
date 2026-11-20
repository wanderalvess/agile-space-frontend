'use client';

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { findMembership, resolveActiveSquadId } from '@/lib/memberships';
import type { Membership } from '@/lib/memberships-api';

export interface ActiveSquad {
  /** Chave da squad ativa; `''` quando a pessoa não tem squad. */
  squadId: string;
  /** Nome da squad ativa (cai na chave). */
  squadName: string;
  /** Papel primário na squad ativa; `''` se o servidor não informou. */
  roleName: string;
  /** Vínculo da squad ativa, quando o servidor devolve `/me/memberships`. */
  membership?: Membership;
}

/**
 * A squad ativa da pessoa, num lugar só: `session.activeProjectId` validada contra os vínculos
 * (`/me/memberships`). Sem o endpoint, é a da sessão como está. As telas usam isto em vez de misturar
 * `userProfile.squadId` e `session.activeProjectId`.
 */
export function useActiveSquad(): ActiveSquad {
  const { session } = useAuth();
  const { memberships } = useMyMemberships();
  const sessionActive = session?.activeProjectId;
  const projectName = session?.activeProjectName;
  const projectRole = session?.activeProjectRole;
  return useMemo(() => {
    const squadId = resolveActiveSquadId(sessionActive, memberships);
    const membership = findMembership(memberships, squadId);
    const isSessionSquad = !!squadId && squadId.toLowerCase() === (sessionActive ?? '').trim().toLowerCase();
    return {
      squadId,
      squadName: membership?.projectName || (isSessionSquad ? projectName : '') || squadId,
      roleName: membership?.roleName || (isSessionSquad ? (projectRole ?? '') : ''),
      membership,
    };
  }, [sessionActive, projectName, projectRole, memberships]);
}
