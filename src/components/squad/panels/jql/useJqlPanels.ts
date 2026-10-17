'use client';

// Estado das consultas JQL: painéis do navegador (localStorage por squad) e painéis da squad (API, via
// useSquadPanelsStore), juntos numa lista só. Quem cria é o único que edita, atualiza e exclui um painel da squad.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SquadApiError } from '@/app/squad/api';
import { getJiraCredentials } from '@/hooks/useJiraSettings';
import { useToast } from '@/hooks/use-toast';
import {
  PANEL_TABLE_SHOWN,
  approximatePanelResult,
  buildPanelResult,
  runPanelQuery,
  type PanelQueryResult,
  type PanelQuerySpec,
} from '@/lib/squad-panel-engine';
import type { SquadIssueSnapshot } from '@/lib/types';
import { useSquadPanelsStore } from '@/store/useSquadPanelsStore';
import {
  defaultTemplates,
  formatClock,
  localStorageKey,
  localToCard,
  parseStoredPanels,
  serverToCard,
  type LocalJqlPanel,
  type PanelCardModel,
  type PanelForm,
} from './jql-model';

interface Options {
  squadId: string;
  userId: string;
  userName: string;
  /** Issues já sincronizadas da squad: base da aproximação quando o Jira não responde. */
  squadIssues: SquadIssueSnapshot[];
  /** true quando as issues já carregaram (as consultas dos modelos esperam por elas). */
  issuesReady: boolean;
}

const messageOf = (err: unknown, fallback: string): string => (err instanceof Error && err.message ? err.message : fallback);

const specOf = (p: { jql: string; chartType: PanelQuerySpec['chartType']; groupBy: PanelQuerySpec['groupBy']; aggregateMetric: PanelQuerySpec['aggregateMetric'] }): PanelQuerySpec => ({
  jql: p.jql,
  chartType: p.chartType,
  groupBy: p.groupBy,
  aggregateMetric: p.aggregateMetric,
});

export function useJqlPanels({ squadId, userId, userName, squadIssues, issuesReady }: Options) {
  const { toast } = useToast();
  const store = useSquadPanelsStore();
  const [localPanels, setLocalPanels] = useState<LocalJqlPanel[]>([]);
  const [localReady, setLocalReady] = useState(false);
  const [runningKeys, setRunningKeys] = useState<Set<string>>(new Set());
  const autoRanFor = useRef('');

  const setRunning = useCallback((key: string, on: boolean) => {
    setRunningKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  // 1. Painéis do navegador (ou os quatro modelos, se não houver nenhum salvo).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- carga do localStorage ao trocar de squad */
    setLocalReady(false);
    let saved: LocalJqlPanel[] | null = null;
    try {
      saved = parseStoredPanels(localStorage.getItem(localStorageKey(squadId)));
    } catch (e) {
      console.warn('Erro ao ler painéis salvos:', e);
    }
    setLocalPanels(saved ?? defaultTemplates(squadId));
    setLocalReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [squadId]);

  const persistLocal = useCallback(
    (next: LocalJqlPanel[]) => {
      setLocalPanels(next);
      try {
        localStorage.setItem(localStorageKey(squadId), JSON.stringify(next));
      } catch (e) {
        console.error('Erro ao salvar painéis personalizados:', e);
      }
    },
    [squadId],
  );

  // 2. Painéis da squad, no servidor.
  useEffect(() => {
    if (!squadId) return;
    store.reset();
    void store.fetchPanels(squadId);
    return () => store.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squadId]);

  // 3. Roda a consulta de um painel do navegador: Jira com o token da pessoa; sem resposta, aproximação.
  const executeLocal = useCallback(
    async (panel: LocalJqlPanel): Promise<LocalJqlPanel> => {
      const spec = specOf(panel);
      const creds = await getJiraCredentials(userId);
      let result: PanelQueryResult | null = null;
      if (creds?.domain && creds?.token && panel.jql) {
        try {
          result = await runPanelQuery(creds, spec);
        } catch (err) {
          console.warn('Erro ao executar a consulta direto no Jira, usando as issues da squad:', err);
        }
      }
      // Só sem resposta do Jira cai na aproximação. Uma consulta que de fato dá 0 resultado volta com total 0.
      const approximate = !result && squadIssues.length > 0;
      if (!result) result = approximate ? approximatePanelResult(spec, squadIssues) : buildPanelResult([], spec);
      return {
        ...panel,
        resultTotal: result.resultTotal,
        resultRows: result.resultRows,
        resultIssues: result.resultIssues?.slice(0, PANEL_TABLE_SHOWN),
        lastUpdated: formatClock(new Date()),
        approximate,
      };
    },
    [userId, squadIssues],
  );

  // 4. Modelos nascem sem resultado: roda cada um uma vez, para não mostrar zeros como se fossem dado.
  useEffect(() => {
    if (!localReady || !issuesReady || !squadId || autoRanFor.current === squadId) return;
    const pending = localPanels.filter((p) => !p.lastUpdated);
    autoRanFor.current = squadId;
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      let current = localPanels;
      for (const p of pending) {
        if (cancelled) return;
        setRunning(`local:${p.id}`, true);
        try {
          const updated = await executeLocal(p);
          current = current.map((x) => (x.id === p.id ? updated : x));
          setLocalPanels(current);
        } finally {
          setRunning(`local:${p.id}`, false);
        }
      }
      if (!cancelled) persistLocal(current);
    })();
    return () => {
      cancelled = true;
    };
    // roda uma vez por squad, depois que os dados carregaram
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localReady, issuesReady, squadId]);

  const cards = useMemo<PanelCardModel[]>(
    () => [...store.panels.map((p) => serverToCard(p, userId)), ...localPanels.map(localToCard)],
    [store.panels, localPanels, userId],
  );

  const running = useMemo(() => {
    const keys = new Set(runningKeys);
    store.runningIds.forEach((id) => keys.add(`squad:${id}`));
    return keys;
  }, [runningKeys, store.runningIds]);

  const refresh = useCallback(
    async (card: PanelCardModel) => {
      if (!card.canEdit) return;
      if (card.storage === 'squad') {
        try {
          await store.runPanel(squadId, card.id, userId);
          toast({ title: 'Painel atualizado', description: `Dados do painel “${card.title}” sincronizados com o Jira.` });
        } catch (err: unknown) {
          toast({ title: 'Erro ao atualizar', description: messageOf(err, 'Não foi possível sincronizar o painel no momento.'), variant: 'destructive' });
        }
        return;
      }
      const target = localPanels.find((p) => p.id === card.id);
      if (!target) return;
      setRunning(card.key, true);
      try {
        const updated = await executeLocal(target);
        persistLocal(localPanels.map((p) => (p.id === card.id ? updated : p)));
        toast({
          title: 'Painel atualizado',
          description: updated.approximate
            ? 'O Jira não respondeu à consulta; o resultado usa as issues já sincronizadas.'
            : `Dados do painel “${card.title}” sincronizados com o Jira.`,
        });
      } catch {
        toast({ title: 'Erro ao atualizar', description: 'Não foi possível sincronizar o painel no momento.', variant: 'destructive' });
      } finally {
        setRunning(card.key, false);
      }
    },
    [executeLocal, localPanels, persistLocal, setRunning, squadId, store, toast, userId],
  );

  /** Salva (cria ou edita). Devolve true quando deu certo e o modal pode fechar. */
  const save = useCallback(
    async (form: PanelForm, editing: PanelCardModel | null): Promise<boolean> => {
      if (!form.title.trim() || !form.jql.trim()) {
        toast({ title: 'Campos obrigatórios', description: 'Preencha o título e a consulta JQL.', variant: 'destructive' });
        return false;
      }
      const storage = editing ? editing.storage : form.storage;
      const hasGroup = form.chartType === 'bar' || form.chartType === 'pie';

      if (storage === 'squad') {
        const input = {
          title: form.title.trim(),
          jql: form.jql.trim(),
          chartType: form.chartType,
          groupBy: hasGroup ? form.groupBy : ('none' as const),
          aggregateMetric: hasGroup ? form.aggregateMetric : ('count' as const),
          visibility: form.visibility,
        };
        try {
          let id: string;
          if (editing) {
            await store.updatePanel(squadId, editing.id, input);
            id = editing.id;
          } else {
            id = await store.createPanel(squadId, userName, input);
          }
          toast(
            form.visibility === 'squad'
              ? { title: 'Painel compartilhado com a squad', description: 'Quem é da squad já vê o painel.' }
              : { title: 'Painel salvo', description: `O painel personalizado “${input.title}” foi salvo com sucesso.` },
          );
          // Traz os números sem travar o modal: a falha aparece no próprio cartão (lastRunError).
          void store.runPanel(squadId, id, userId).catch(() => undefined);
          return true;
        } catch (err: unknown) {
          const forbidden = err instanceof SquadApiError && err.status === 403;
          toast(
            forbidden && editing
              ? { title: 'Só quem criou pode alterar', description: 'Painel de outra pessoa da squad: sem editar nem excluir.', variant: 'destructive' }
              : { title: 'Não foi possível salvar na squad', description: messageOf(err, 'O servidor não respondeu.'), variant: 'destructive' },
          );
          return false;
        }
      }

      const id = editing?.id || `panel-${Date.now()}`;
      const base: LocalJqlPanel = {
        id,
        title: form.title.trim(),
        jql: form.jql.trim(),
        chartType: form.chartType,
        groupBy: hasGroup ? form.groupBy : 'status',
        aggregateMetric: hasGroup ? form.aggregateMetric : 'count',
        visibility: form.visibility,
      };
      const key = `local:${id}`;
      // O painel aparece já (consultando) e ganha os números quando a consulta termina.
      const placeholder = editing ? localPanels.map((p) => (p.id === id ? { ...base } : p)) : [base, ...localPanels];
      setLocalPanels(placeholder);
      setRunning(key, true);
      try {
        const resolved = await executeLocal(base);
        persistLocal(placeholder.map((p) => (p.id === id ? resolved : p)));
        toast({ title: 'Painel salvo', description: `O painel personalizado “${base.title}” foi salvo com sucesso.` });
      } catch {
        persistLocal(placeholder);
      } finally {
        setRunning(key, false);
      }
      return true;
    },
    [executeLocal, localPanels, persistLocal, setRunning, squadId, store, toast, userId, userName],
  );

  const remove = useCallback(
    async (card: PanelCardModel): Promise<void> => {
      if (!card.canEdit) return;
      if (card.storage === 'squad') {
        try {
          await store.deletePanel(squadId, card.id);
          toast({ title: 'Painel removido', description: 'O painel foi excluído.' });
        } catch (err: unknown) {
          const forbidden = err instanceof SquadApiError && err.status === 403;
          toast({
            title: forbidden ? 'Só quem criou pode alterar' : 'Não foi possível excluir na squad',
            description: forbidden ? 'Painel de outra pessoa da squad: sem editar nem excluir.' : messageOf(err, 'O servidor não respondeu.'),
            variant: 'destructive',
          });
        }
        return;
      }
      persistLocal(localPanels.filter((p) => p.id !== card.id));
      toast({ title: 'Painel removido', description: 'O painel foi excluído.' });
    },
    [localPanels, persistLocal, squadId, store, toast],
  );

  return {
    cards,
    running,
    serverLoading: store.isLoading,
    serverUnavailable: store.panelsUnavailable,
    refresh,
    save,
    remove,
  };
}
