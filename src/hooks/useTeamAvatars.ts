'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { projectService, type ProjectMemberRoleItem } from '@/services/projectService';

// Fotos das pessoas do time (vindas do Jira na importação). Uma busca por squad, em cache de módulo,
// compartilhada por todos os componentes da página.
const cache = new Map<string, Promise<ProjectMemberRoleItem[]>>();
const INVALIDATE_EVENT = 'team-avatars-invalidated';

function load(squadId: string): Promise<ProjectMemberRoleItem[]> {
  let p = cache.get(squadId);
  if (!p) {
    p = projectService
      .getProjectByKey(squadId)
      .then(d => d.members || [])
      .catch(() => {
        cache.delete(squadId); // não guarda falha: a próxima tela tenta de novo
        return [] as ProjectMemberRoleItem[];
      });
    cache.set(squadId, p);
  }
  return p;
}

/** Chame depois de importar/atualizar o time para as fotos novas aparecerem sem recarregar a página. */
export function invalidateTeamAvatars(squadId?: string) {
  if (squadId) cache.delete(squadId);
  else cache.clear();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INVALIDATE_EVENT));
}

const norm = (s?: string) =>
  (s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface AvatarQuery {
  email?: string;
  name?: string;
  accountId?: string;
}

export function useTeamAvatars(squadId?: string) {
  const [members, setMembers] = useState<ProjectMemberRoleItem[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onInvalidate = () => setTick(t => t + 1);
    window.addEventListener(INVALIDATE_EVENT, onInvalidate);
    return () => window.removeEventListener(INVALIDATE_EVENT, onInvalidate);
  }, []);

  useEffect(() => {
    if (!squadId || squadId === 'Sem Time') {
      setMembers([]);
      return;
    }
    let alive = true;
    load(squadId).then(m => alive && setMembers(m));
    return () => {
      alive = false;
    };
  }, [squadId, tick]);

  const index = useMemo(() => {
    const byEmail = new Map<string, string>();
    const byAccount = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const m of members) {
      if (!m.avatarUrl) continue;
      if (m.email) byEmail.set(m.email.trim().toLowerCase(), m.avatarUrl);
      if (m.jiraAccountId) byAccount.set(m.jiraAccountId, m.avatarUrl);
      const n = norm(m.displayName);
      if (n) byName.set(n, m.avatarUrl);
    }
    return { byEmail, byAccount, byName };
  }, [members]);

  /** Foto da pessoa (por e-mail, conta do Jira ou nome) ou undefined se não houver. */
  const avatarFor = useCallback(
    (q: AvatarQuery): string | undefined =>
      (q.email && index.byEmail.get(q.email.trim().toLowerCase())) ||
      (q.accountId && index.byAccount.get(q.accountId)) ||
      (q.name && index.byName.get(norm(q.name))) ||
      undefined,
    [index]
  );

  return { avatarFor, members };
}
