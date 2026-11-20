'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isUnavailableError, showcaseApi } from '@/app/showcase/api';
import { orderSquadJqls, squadJqlErrorMessage, type SquadJqlVisibility } from './squad-jql';
import type { ShowcaseJqlQuery } from './types';

/**
 * `unavailable`: o backend não tem as consultas da squad (404/405) ou a pessoa não lê esta squad (403): a tela mostra só as
 * do navegador, sem erro. `error`: falha passageira (rede, 5xx), com "tentar de novo".
 */
export type SquadJqlStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export type SquadJqlResult = { ok: true } | { ok: false; message: string };

/** Consultas JQL compartilhadas com a squad. Só consulta o servidor com `enabled` (diálogo aberto na aba da API). */
export function useSquadJqls(squadId: string | undefined, enabled: boolean) {
  const [state, setState] = useState<{ squadId: string | undefined; status: SquadJqlStatus; items: ShowcaseJqlQuery[] }>({ squadId, status: 'idle', items: [] });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = squadId?.trim();
    if (!id) return;
    const mine = ++seq.current;
    setState((s) => ({ squadId: id, status: s.squadId === id && s.status === 'ready' ? 'ready' : 'loading', items: s.squadId === id ? s.items : [] }));
    try {
      const list = await showcaseApi.listSquadJql(id);
      if (mine !== seq.current) return;
      setState({ squadId: id, status: 'ready', items: orderSquadJqls(list) });
    } catch (err) {
      if (mine !== seq.current) return;
      const status = (err as { status?: number })?.status;
      setState({ squadId: id, status: isUnavailableError(err) || status === 403 || status === 401 ? 'unavailable' : 'error', items: [] });
    }
  }, [squadId]);

  useEffect(() => {
    if (!enabled || !squadId?.trim()) return;
    void load();
  }, [enabled, squadId, load]);

  const current = state.squadId === squadId?.trim() || state.squadId === squadId;
  const status: SquadJqlStatus = !squadId?.trim() ? 'unavailable' : current ? state.status : 'idle';
  const items = current ? state.items : [];

  const save = useCallback(async (name: string, jql: string, visibility: SquadJqlVisibility): Promise<SquadJqlResult> => {
    const id = squadId?.trim();
    if (!id) return { ok: false, message: 'Esta Review não tem squad.' };
    try {
      const created = await showcaseApi.saveSquadJql({ squadId: id, name: name.trim(), jql: jql.trim(), visibility });
      setState((s) => ({ squadId: id, status: 'ready', items: orderSquadJqls([created, ...s.items.filter((q) => q.id !== created.id)]) }));
      return { ok: true };
    } catch (err) {
      return { ok: false, message: squadJqlErrorMessage(err, 'Não foi possível salvar a consulta na squad.') };
    }
  }, [squadId]);

  const remove = useCallback(async (queryId: string): Promise<SquadJqlResult> => {
    try {
      await showcaseApi.deleteSquadJql(queryId);
      setState((s) => ({ ...s, items: s.items.filter((q) => q.id !== queryId) }));
      return { ok: true };
    } catch (err) {
      if ((err as { status?: number })?.status === 404) {
        // Já não existe (outra pessoa apagou): some da lista do mesmo jeito.
        setState((s) => ({ ...s, items: s.items.filter((q) => q.id !== queryId) }));
        return { ok: true };
      }
      return { ok: false, message: squadJqlErrorMessage(err, 'Não foi possível apagar a consulta.') };
    }
  }, []);

  return { status, items, save, remove, reload: load };
}
