'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { activeLinkOf, buildMyLinks, type MyLink } from '@/lib/my-links';

/**
 * "Meus vínculos": as squads da pessoa e o papel dela em cada uma, só leitura. A lista vem da sessão
 * (`accessibleProjects` do `/auth/me`) e do `UserContext` (squad ativa e papéis de `/squads/by-user`),
 * sem endpoint próprio. A única escrita é "Tornar ativa", que usa o `switchProject` da sessão.
 */
export function useMyLinks() {
  const { session, switchProject } = useAuth();
  const { userProfile, userSquads } = useUserContext();
  const { toast } = useToast();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const activeId = userProfile?.squadId || session?.activeProjectId || '';
  const links = useMemo(() => buildMyLinks(session, userSquads, activeId), [session, userSquads, activeId]);
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
