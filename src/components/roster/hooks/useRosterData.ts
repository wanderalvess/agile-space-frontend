'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSquadStore } from '@/store/useSquadStore';
import { teamApi } from '@/app/squad/api';

export type RosterLoadPhase = 'loading' | 'ready' | 'error';

/**
 * Carrega a squad e o time. Antes uma falha só ia para o console e a tela ficava como "time vazio"; agora o
 * resultado é explícito (carregando, pronto ou erro) e "Tentar de novo" refaz a leitura.
 */
export function useRosterData(squadId: string) {
  const config = useSquadStore((s) => s.config);
  const members = useSquadStore((s) => s.members);
  const fetchSquad = useSquadStore((s) => s.fetchSquad);
  const fetchMembers = useSquadStore((s) => s.fetchMembers);
  // O resultado guarda de qual squad é: trocar de squad volta para "carregando" sem precisar limpar nada no efeito.
  const [result, setResult] = useState<{ squadId: string; phase: RosterLoadPhase }>({ squadId: '', phase: 'loading' });
  const attempt = useRef(0);

  const phase: RosterLoadPhase = !squadId ? 'ready' : result.squadId === squadId ? result.phase : 'loading';

  const run = useCallback(
    async (isCurrent: () => boolean) => {
      if (!squadId) return;
      const [, membersOk] = await Promise.all([fetchSquad(squadId), fetchMembers(squadId)]);
      // Uma troca de squad (ou nova tentativa) durante a leitura invalida esta resposta.
      if (isCurrent()) setResult({ squadId, phase: membersOk ? 'ready' : 'error' });
    },
    [squadId, fetchSquad, fetchMembers]
  );

  useEffect(() => {
    let alive = true;
    void run(() => alive);
    return () => {
      alive = false;
    };
  }, [run]);

  /** "Tentar de novo": volta ao esqueleto e refaz a leitura. */
  const reload = useCallback(() => {
    const mine = ++attempt.current;
    setResult({ squadId, phase: 'loading' });
    void run(() => mine === attempt.current);
  }, [squadId, run]);

  /** Relê só o time (depois de salvar, importar, adicionar ou mudar o cargo). */
  const refreshMembers = useCallback(
    (hints?: { email?: string; jiraAccountId?: string; name?: string }, uid?: string) => fetchMembers(squadId, uid, hints),
    [squadId, fetchMembers]
  );

  return { config, members, phase, reload, refreshMembers };
}

/**
 * Quem pode mexer nas pessoas do time (Agile Master/People Lead da squad ou admin). Só decide o que a tela
 * mostra; o servidor valida de novo em cada ação.
 */
export function useCanManageTeam(squadId: string) {
  const [state, setState] = useState<{ squadId: string; canManage: boolean } | null>(null);

  useEffect(() => {
    if (!squadId) return;
    let alive = true;
    teamApi
      .canManage(squadId)
      .then((v) => alive && setState({ squadId, canManage: v }))
      .catch(() => alive && setState({ squadId, canManage: false }));
    return () => {
      alive = false;
    };
  }, [squadId]);

  const settled = !!squadId && state?.squadId === squadId;
  return { canManageTeam: settled && !!state?.canManage, permissionLoaded: settled };
}
