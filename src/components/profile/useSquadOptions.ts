'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/auth-client';
import type { SquadMember, UserProfile } from '@/lib/types';

export interface RawSquad {
  id: string;
  name: string;
  jiraProjectKey: string;
}

interface DbProject {
  id: string;
  name: string;
}

export interface Option {
  id: string;
  name: string;
}

/**
 * Projetos e squads que a pessoa pode escolher no perfil. Vem do banco (`/projects`, `/projects/user/{id}`,
 * `/squads`) e é filtrado pelo que está vinculado a ela; sem vínculo, mostra tudo.
 */
export function useSquadOptions({
  isOpen,
  userProfile,
  userSquads,
}: {
  isOpen: boolean;
  userProfile: UserProfile | null;
  userSquads: SquadMember[] | undefined;
}) {
  const [rawSquads, setRawSquads] = useState<RawSquad[]>([]);
  const [dbProjects, setDbProjects] = useState<DbProject[]>([]);
  const [userDbProjectIds, setUserDbProjectIds] = useState<string[]>([]);
  const [isSquadsLoaded, setIsSquadsLoaded] = useState(false);

  // Carrega projetos (tabela projects) e squads (tabela squads) da API
  useEffect(() => {
    if (!isOpen) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

    // 1. Busca diretamente na tabela `projects` (/api/projects)
    authFetch(`${apiUrl}/projects`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const mapped = data
            .map((p) => ({
              id: String(p.id || p.jiraProjectKey || '').trim(),
              name: String(p.name || p.id || '').trim(),
            }))
            .filter((p) => p.id);
          setDbProjects(mapped);
        }
      })
      .catch((err) => console.warn('Erro ao carregar tabela projects:', err));

    // 2. Busca os projetos vinculados ao usuário logado na tabela `projects`
    const userIdent = userProfile?.email || userProfile?.id;
    if (userIdent) {
      authFetch(`${apiUrl}/projects/user/${encodeURIComponent(userIdent)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((res: any) => {
          // O backend devolve a lista em `projects` (`accessibleProjects` nunca existiu: a lista ficava sempre vazia).
          const accessible = res && (res.projects ?? res.accessibleProjects);
          if (Array.isArray(accessible)) {
            const pIds = accessible.map((p: any) => String(p.projectId || '').trim()).filter(Boolean);
            setUserDbProjectIds(pIds);
          }
        })
        .catch(() => {});
    }

    // 3. Busca squads diretamente na tabela `squads` (/api/squads)
    authFetch(`${apiUrl}/squads`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const parsed: RawSquad[] = data
            .filter((s) => s && (s.id || s.jiraProjectKey))
            .map((s) => ({
              id: String(s.id || s.jiraProjectKey).trim(),
              name: String(s.name || s.jiraProjectKey || s.id).trim(),
              jiraProjectKey: String(s.jiraProjectKey || s.id).trim(),
            }));
          setRawSquads(parsed);
        }
      })
      .catch((err) => console.warn('Erro ao carregar tabela squads:', err))
      .finally(() => setIsSquadsLoaded(true));
  }, [isOpen, userProfile?.email, userProfile?.id]);

  // 1. Identificadores de Squads/Projetos vinculados no banco ao usuário logado
  const userSquadIds = (() => {
    const ids = new Set<string>();
    if (userSquads && Array.isArray(userSquads)) {
      userSquads.forEach((s) => {
        if (s.squadId) ids.add(s.squadId.trim());
      });
    }
    userDbProjectIds.forEach((id) => ids.add(id));
    if (userProfile?.squadId) ids.add(userProfile.squadId.trim());
    return ids;
  })();

  // 2. Filtra exclusivamente as squads/projetos do banco que possuem vínculo com o usuário
  const allowedRawSquads = (() => {
    if (userSquadIds.size > 0) {
      const filtered = rawSquads.filter((s) => userSquadIds.has(s.id) || userSquadIds.has(s.jiraProjectKey));
      if (filtered.length > 0) return filtered;
    }
    return rawSquads;
  })();

  // 3. Deriva a lista de Projetos vinculados diretamente da tabela `projects` no PostgreSQL
  const availableProjects: Option[] = (() => {
    const map = new Map<string, string>();

    // Prioriza os projetos da tabela `projects` que têm vínculo com o usuário
    userDbProjectIds.forEach((id) => {
      const found = dbProjects.find((p) => p.id.toLowerCase() === id.toLowerCase());
      map.set(id, found ? found.name : id);
    });

    // Se o mapa ainda estiver vazio, usa os projetos do banco
    if (map.size === 0 && dbProjects.length > 0) {
      dbProjects.forEach((p) => {
        if (!map.has(p.id)) map.set(p.id, p.name);
      });
    }

    // Complementa com projetos vinculados nas squads salvas
    allowedRawSquads.forEach((s) => {
      const key = (s.jiraProjectKey || s.id || '').trim();
      const name = (s.name || s.jiraProjectKey || s.id || '').trim();
      if (key && !map.has(key)) map.set(key, name);
    });

    if (userProfile?.squadId && !map.has(userProfile.squadId)) {
      const match = rawSquads.find((rs) => rs.id === userProfile.squadId);
      const projKey = match ? match.jiraProjectKey || match.id : userProfile.squadId;
      if (projKey && !map.has(projKey)) map.set(projKey, projKey);
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  })();

  // 4. Squads vinculadas ao projeto escolhido (exclusivamente do banco)
  const squadsForProject = (projectId: string): Option[] => {
    if (!projectId || projectId === 'other') return [];
    const target = projectId.toLowerCase();
    return allowedRawSquads
      .filter((s) => (s.jiraProjectKey || s.id || '').toLowerCase() === target && s.id.toLowerCase() !== target)
      .map((s) => ({ id: s.id, name: s.name || s.id }));
  };

  return { rawSquads, isSquadsLoaded, availableProjects, squadsForProject };
}
