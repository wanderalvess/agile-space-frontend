'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { squadApi } from '@/app/squad/api';
import { useJiraSettings } from '@/hooks/useJiraSettings';
import { decideAutoSync } from '@/lib/painel-sync';
import type { SquadDashboardData } from '@/hooks/useSquadDashboardData';
import type { JiraSyncState } from './SummaryWelcome';

/**
 * Sincronização automática com o Jira da aba Resumo: quem já conectou o Jira (ex.: ao importar o time) não deve
 * precisar "conectar de novo". Tenta uma vez por visita enquanto a squad ainda não tem dado. Sem token salvo o
 * backend responde pedindo a configuração: isso vira o convite para conectar, não um erro.
 *
 * Vive no hub (não na aba) para a tentativa valer por visita mesmo se a pessoa trocar de aba e voltar.
 */
export function useSummarySync(data: Pick<SquadDashboardData, 'squadId' | 'hasSquad' | 'loading' | 'issues' | 'rollup' | 'refresh'>, active: boolean) {
  const { squadId, hasSquad, loading, issues, rollup, refresh } = data;
  // O estado vale para a squad em que foi gravado: trocar de squad volta ao início sem precisar de um efeito.
  const [raw, setRaw] = useState<{ squadId: string; state: JiraSyncState; error: string | null }>({ squadId: '', state: 'idle', error: null });
  const syncState: JiraSyncState = raw.squadId === squadId ? raw.state : 'idle';
  const syncError = raw.squadId === squadId ? raw.error : null;
  const setSyncState = useCallback((state: JiraSyncState, error: string | null = null) => setRaw({ squadId, state, error }), [squadId]);
  const autoSyncTried = useRef('');

  // Só chama o servidor quando a pessoa tem Jira configurado (sem isso ele responde 400): sem Jira, mostra direto o convite.
  const { settings: jiraSettings, loading: jiraSettingsLoading } = useJiraSettings();
  const hasJira = !!(jiraSettings?.domain && jiraSettings?.token);
  const hasData = issues.length > 0 || !!rollup;

  const runJiraSync = useCallback(async () => {
    if (!squadId) return;
    setSyncState('syncing');
    try {
      await squadApi.sync(squadId, true);
      await refresh();
      setSyncState('done');
    } catch (err: unknown) {
      const message: string = (err as Error)?.message || 'Erro ao sincronizar com o Jira.';
      if (/token|configure|conex[aã]o jira/i.test(message)) {
        setSyncState('no-jira');
      } else {
        setSyncState('error', message);
      }
    }
  }, [squadId, refresh, setSyncState]);

  useEffect(() => {
    if (!active) return;
    const decision = decideAutoSync({
      loading,
      hasSquad,
      hasData,
      alreadyTried: autoSyncTried.current === squadId,
      jiraLoading: jiraSettingsLoading,
      hasJira,
    });
    if (decision === 'skip' || decision === 'wait') return;
    autoSyncTried.current = squadId;
    if (decision === 'no-jira') {
      setSyncState('no-jira');
      return;
    }
    void runJiraSync();
  }, [active, loading, hasSquad, hasData, squadId, runJiraSync, jiraSettingsLoading, hasJira, setSyncState]);

  return { syncState, syncError, runJiraSync };
}
