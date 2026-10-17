'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { squadRefsFromSession } from '@/hooks/home/derive';
import type { SquadSummary } from '@/hooks/home/types';

/**
 * Squad ativa e troca de squad para o cabeçalho de toda tela. Lê só a sessão (sem chamar o servidor), então
 * é barato em qualquer página. A troca usa `switchProject` do AuthContext; se falhar, avisa e mantém a atual.
 * A Home tem a versão dela (`useMySquads`), que acrescenta o resumo de sprint e o escopo "Todas as squads".
 */
export function useSquadSwitcher() {
  const { session, switchProject } = useAuth();
  const { toast } = useToast();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const refs = useMemo(() => squadRefsFromSession(session), [session]);
  const activeId = session?.activeProjectId;

  const squads = useMemo<SquadSummary[]>(
    () =>
      refs.map((r) => ({
        id: r.id,
        name: r.name,
        roleName: r.roleName,
        isActive: r.id === activeId,
        sprintPercent: null,
        daysLeft: null,
      })),
    [refs, activeId],
  );

  const pick = useCallback(
    async (squadId: string | null) => {
      if (!squadId || squadId === activeId || switchingTo) return;
      setSwitchingTo(squadId);
      try {
        await switchProject(squadId);
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível trocar de squad',
          description: err instanceof Error && err.message ? err.message : 'Tente novamente em instantes.',
        });
      } finally {
        setSwitchingTo(null);
      }
    },
    [activeId, switchingTo, switchProject, toast],
  );

  return { squads, activeId, isMulti: refs.length > 1, switchingTo, pick };
}
