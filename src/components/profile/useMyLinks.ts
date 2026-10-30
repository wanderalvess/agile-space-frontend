'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { useToast } from '@/hooks/use-toast';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { activeLinkOf, buildMyLinks, type MyLink } from '@/lib/my-links';

/**
 * "Meus vínculos": as squads da pessoa e os papéis dela em cada uma, só leitura. A lista vem de
 * `GET /me/memberships` (todos os papéis, origem e alcance); sem o endpoint, da sessão (`accessibleProjects`
 * do `/auth/me`) e do `UserContext` (papéis de `/squads/by-user`). A única escrita é "Tornar ativa", que usa
 * o `switchProject` da sessão (e ele invalida o cache de vínculos).
 */
export function useMyLinks() {
  const { session, switchProject } = useAuth();
  const { userSquads } = useUserContext();
  const { memberships } = useMyMemberships();
  const { toast } = useToast();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const { squadId: activeId } = useActiveSquad();
  const links = useMemo(() => buildMyLinks(session, userSquads, activeId, memberships), [session, userSquads, activeId, memberships]);
  const active = useMemo(() => activeLinkOf(links), [links]);

  /** Troca a squad ativa. Devolve `true` quando a troca pegou. */
  const activate = useCallback(
    async (link: MyLink): Promise<boolean> => {
      if (link.active || switchingTo) return false;
      setSwitchingTo(link.id);
      try {
        await switchProject(link.id);
        toast({ title: `Squad ativa: ${link.name}` });
        return true;
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível trocar de squad',
          description: (err instanceof Error && err.message) || 'Tente novamente em instantes.',
        });
        return false;
      } finally {
        setSwitchingTo(null);
      }
    },
    [switchProject, switchingTo, toast],
  );

  return { links, active, activate, switchingTo, canSwitch: links.length > 1 };
}
