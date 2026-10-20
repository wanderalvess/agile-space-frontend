'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/ceremony-api';
import { distributionApi, isConflict, minStartDateOf, statusOf, type DistributionView } from '@/lib/sprint-planner/api';
import { dateChanges } from '@/lib/sprint-planner/distribution';
import { formatDay } from '@/lib/sprint-planner/format';
import { connectPlanSocket } from '@/lib/sprint-planner/plan-socket';

export type DistLoad = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ok'; view: DistributionView };

export const CLAIM_CONFLICT = 'Outra pessoa pegou antes. Atualizamos a lista.';

export interface ActionResult { ok: boolean; message?: string; minStartDate?: string | null }

/**
 * Estado da Distribuição: carga, ações (pegar, soltar, datas) e tempo real. Toda ação devolve a `DistributionView`
 * do servidor, que substitui a atual (a cascata do QA chega nela). O recarregamento por `REFRESH_PLAN` é silencioso:
 * não volta para "carregando", então o foco e as datas em edição (guardadas pela tela) ficam como estão.
 */
export function useDistribution(squadId: string, planId: string, enabled: boolean) {
  const { toast } = useToast();
  const [load, setLoad] = useState<DistLoad>({ state: 'loading' });
  const [live, setLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const viewRef = useRef<DistributionView | null>(null);
  const lastOwnWrite = useRef(0);

  const apply = useCallback((view: DistributionView, announce: boolean) => {
    const prev = viewRef.current;
    viewRef.current = view;
    setLoad({ state: 'ok', view });
    if (announce && prev && Date.now() - lastOwnWrite.current > 1500) {
      const changes = dateChanges(prev, view);
      const mine = changes.find((c) => c.mine);
      const other = changes.find((c) => !c.mine);
      if (mine) toast({ title: 'Suas datas mudaram', description: `${mine.key} agora vai de ${formatDay(mine.startDate)} a ${formatDay(mine.endDate)}.` });
      else if (other) toast({ title: `${other.who ?? 'Alguém'} atualizou datas`, description: `${other.key}: ${formatDay(other.startDate)} a ${formatDay(other.endDate)}.` });
    }
  }, [toast]);

  const reload = useCallback(async (quiet = true, announce = false) => {
    if (!quiet) setLoad({ state: 'loading' });
    setRefreshing(true);
    try {
      apply(await distributionApi.get(squadId, planId), announce);
    } catch (e) {
      // Recarga silenciosa que falha mantém a tela atual; só a primeira carga vira erro.
      if (!viewRef.current || !quiet) setLoad({ state: 'error', message: errorMessage(e, 'Não foi possível carregar a distribuição.') });
    } finally {
      setRefreshing(false);
    }
  }, [squadId, planId, apply]);

  useEffect(() => {
    if (!enabled) return;
    viewRef.current = null;
    void reload(false);
  }, [enabled, reload]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (!enabled) return;
    let close: (() => void) | undefined;
    try {
      close = connectPlanSocket(planId, {
        onRefresh: () => void reloadRef.current(true, true),
        onConnectionChange: setLive,
      });
    } catch {
      setLive(false);
    }
    return () => close?.();
  }, [enabled, planId]);

  /** Escrita: aplica a resposta; 409 recarrega e avisa; o resto devolve a mensagem do servidor. */
  const write = useCallback(async (fn: () => Promise<DistributionView>, fail: string, conflictMsg?: string): Promise<ActionResult> => {
    lastOwnWrite.current = Date.now();
    try {
      apply(await fn(), false);
      lastOwnWrite.current = Date.now();
      return { ok: true };
    } catch (e) {
      if (isConflict(e)) {
        const message = conflictMsg ?? errorMessage(e, fail);
        toast({ title: message, variant: 'destructive' });
        await reload(true);
        return { ok: false, message };
      }
      const message = errorMessage(e, fail);
      if (statusOf(e) !== 422) toast({ title: fail, description: message, variant: 'destructive' });
      return { ok: false, message, minStartDate: minStartDateOf(e) };
    }
  }, [apply, reload, toast]);

  const claim = useCallback((key: string, accountId?: string) => write(() => distributionApi.claim(squadId, planId, key, accountId), 'Não foi possível pegar a subtarefa', CLAIM_CONFLICT), [write, squadId, planId]);
  const release = useCallback((key: string) => write(() => distributionApi.release(squadId, planId, key), 'Não foi possível soltar a subtarefa'), [write, squadId, planId]);
  const saveDates = useCallback((key: string, start: string, end: string) => write(() => distributionApi.setDates(squadId, planId, key, start, end), 'Não foi possível salvar as datas'), [write, squadId, planId]);

  return { load, live, refreshing, reload: () => reload(true), claim, release, saveDates };
}
