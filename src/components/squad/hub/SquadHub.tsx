'use client';

/**
 * Hub da squad (`/squad`): Resumo, Quadro, Cronograma, Métricas e Painéis numa tela só, com a aba na URL
 * (`?tab=resumo|quadro|cronograma|metricas|paineis`). O Resumo é o antigo /painel.
 *
 * O nome da squad aparece uma vez, no seletor do cabeçalho do portal; aqui o título é "Squad".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw, RotateCcw, Settings2, UserCog, Workflow } from 'lucide-react';
import { EmptyState, LoadingSkeleton, PageHeader, PageShell } from '@/components/page';
import { ModalButton, SelectField, TabBar } from '@/components/room-kit';
import { ModuleIntegrationButton } from '@/components/shared/ModuleIntegrationDialog';
import { SquadWorkflowPhasesDialog } from '@/components/squad/SquadWorkflowPhasesDialog';
import { useCanManageTeam } from '@/components/roster/hooks/useRosterData';
import { useUserContext } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { getJiraCredentials, useJiraSettings } from '@/hooks/useJiraSettings';
import { useSquadDashboardData } from '@/hooks/useSquadDashboardData';
import {
  CURRENT_SPRINT,
  HUB_TABS,
  buildSprintChoices,
  hubHref,
  resolveHubLocation,
  selectedSprintValue,
  sprintSelectorVisible,
  type HubTab,
  type MetricsView,
} from '@/lib/squad-hub';
import { formatShortDate, sprintTimeProgress } from '@/lib/squad-metrics';
import { latestSyncAt } from '@/lib/team-people';
import { SQUAD_ADMIN_ROLES, SQUAD_LEADERSHIP_VIEW_ROLES, SQUAD_PEOPLE_ADMIN_ROLES, type SquadWorkflowPhase } from '@/lib/types';
import { useSquadStore } from '@/store/useSquadStore';
import { MetricsTab } from './MetricsTab';
import { SquadConfigDialog } from './SquadConfigDialog';
import { SummaryTab } from './SummaryTab';
import { timeAgo } from './SprintCard';
import { useSummarySync } from './useSummarySync';

const SquadScrumBoard = dynamic(() => import('@/components/squad/SquadScrumBoard').then((m) => m.SquadScrumBoard), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="cards" rows={3} label="Carregando o quadro" />,
});
const SquadPlansTimeline = dynamic(() => import('@/components/squad/SquadPlansTimeline').then((m) => m.SquadPlansTimeline), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="table" label="Carregando o cronograma" />,
});
const SquadPanelsTab = dynamic(() => import('@/components/squad/panels/SquadPanelsTab'), {
  ssr: false,
  loading: () => <LoadingSkeleton variant="cards" rows={3} label="Carregando os painéis" />,
});

const ACTION = 'h-9 gap-2 px-2.5 text-[13px] max-sm:min-h-11 max-sm:min-w-11 xl:px-3';
const LABEL = 'hidden xl:inline';

export function SquadHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userProfile, isInitializing } = useUserContext();
  const { toast } = useToast();

  const location = resolveHubLocation(searchParams.get('tab'), searchParams.get('view'));
  const tab = location.tab;

  const {
    config, rollup, issuesSnapshot, myClaim, dailySnapshots,
    viewingSprintId, viewedRollup, isForceResyncingSprint,
    isLoading, isSyncing,
    fetchSquad, fetchSquadDetail, fetchMembers, fetchMyIssues, fetchDailySnapshots,
    saveSquadConfig, syncSquad, selectSprint, forceResyncSprint, reset: resetSquadStore,
  } = useSquadStore();

  const rawSquadId = userProfile?.squadId || '';
  const hasSquad = !!rawSquadId && rawSquadId !== 'Sem Time';
  const squadId = hasSquad ? rawSquadId : '';
  const role = userProfile?.role as string | undefined;
  const isLeadership = !!role && (SQUAD_ADMIN_ROLES as string[]).includes(role);
  const isLeadershipViewer = !!role && (SQUAD_LEADERSHIP_VIEW_ROLES as string[]).includes(role);
  const isPeopleAdmin = !!role && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(role);
  const { canManageTeam } = useCanManageTeam(squadId);

  const { settings: jiraSettings, loading: jiraSettingsLoading, saveSettings: saveJiraSettings } = useJiraSettings();
  // Enquanto as credenciais carregam, não afirma que o Jira está desconectado.
  const jiraConnected = jiraSettingsLoading || !!jiraSettings?.token;

  // ?settings=1 abre direto a configuração (Jira) — quem quer conectar sem procurar a engrenagem.
  const [isSettingsOpen, setIsSettingsOpen] = useState(searchParams.get('settings') === '1');
  const [isPhasesOpen, setIsPhasesOpen] = useState(false);

  // Dados do Resumo (placar, issues, time). A mesma sprint em foco vale para o hub inteiro (ver o seletor).
  const data = useSquadDashboardData();
  const summarySync = useSummarySync(data, tab === 'resumo');

  // ── Dados da squad na store (Quadro, Cronograma, Métricas) ──
  const prevSquadIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!squadId) return;
    if (prevSquadIdRef.current && prevSquadIdRef.current !== squadId) resetSquadStore();
    prevSquadIdRef.current = squadId;
    fetchSquad(squadId);
  }, [squadId, fetchSquad, resetSquadStore]);

  useEffect(() => {
    if (squadId) fetchSquadDetail(squadId);
  }, [squadId, fetchSquadDetail]);

  useEffect(() => {
    const userIdentifier = userProfile?.id || userProfile?.email;
    if (userIdentifier && squadId) {
      fetchMembers(squadId, userIdentifier, { email: userProfile?.email, jiraAccountId: userProfile?.jiraAccountId, name: userProfile?.name });
    }
  }, [userProfile?.id, userProfile?.email, userProfile?.jiraAccountId, userProfile?.name, squadId, fetchMembers]);

  useEffect(() => {
    if (squadId && myClaim?.jiraAccountId) fetchMyIssues(squadId, myClaim.jiraAccountId);
  }, [squadId, myClaim?.jiraAccountId, fetchMyIssues]);

  useEffect(() => {
    if (squadId) fetchDailySnapshots(squadId);
  }, [squadId, fetchDailySnapshots]);

  // ── Navegação por abas (URL) ──
  const goTo = useCallback(
    (next: HubTab, opts?: { metricsView?: MetricsView }) => {
      router.push(hubHref(next, opts), { scroll: false });
    },
    [router]
  );

  // ── Sprint em foco (um seletor só, no cabeçalho) ──
  const sprintChoices = useMemo(
    () =>
      buildSprintChoices({
        currentLabel: config?.activeSprintId ? `Sprint ativa (${config.activeSprintId})` : 'Sprint atual (ao vivo)',
        history: config?.sprintHistory ?? [],
        formatDate: formatShortDate,
        issueSprints: data.sprintOptions.slice(1),
      }),
    [config?.activeSprintId, config?.sprintHistory, data.sprintOptions]
  );
  const hasHistory = (config?.sprintHistory?.length ?? 0) > 0;
  const showSprintSelector = sprintChoices.length > 0 && sprintSelectorVisible(location) && (hasHistory || tab === 'resumo');
  const sprintValue = selectedSprintValue(sprintChoices, viewingSprintId, data.selectedSprint);

  const handleSelectSprint = async (value: string) => {
    const sprintId = value === CURRENT_SPRINT ? null : value;
    data.setSelectedSprint(sprintId ?? 'current');
    if (!hasHistory) return;
    try {
      await selectSprint(squadId, sprintId, { isLeadershipViewer, myClaimedAssigneeId: myClaim?.jiraAccountId });
    } catch (err: unknown) {
      toast({ title: 'Não foi possível abrir a sprint', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
      data.setSelectedSprint('current');
      await selectSprint(squadId, null, { isLeadershipViewer, myClaimedAssigneeId: myClaim?.jiraAccountId }).catch(() => {});
    }
  };

  // ── Ações do cabeçalho ──
  const handleSync = async (forceFull?: boolean) => {
    const userIdentifier = userProfile?.id || userProfile?.email;
    if (!userIdentifier || !squadId) return;

    const creds = await getJiraCredentials(userIdentifier);
    if (!creds || !creds.token) {
      toast({
        title: 'Token do Jira não encontrado',
        description: 'Informe seu token de acesso (PAT) em Configurar a squad antes de sincronizar.',
        variant: 'destructive',
      });
      setIsSettingsOpen(true);
      return;
    }

    try {
      await syncSquad(userIdentifier, squadId, forceFull);
      fetchSquadDetail(squadId);
      fetchMembers(squadId, userIdentifier, { email: userProfile?.email, jiraAccountId: userProfile?.jiraAccountId, name: userProfile?.name });
      fetchDailySnapshots(squadId);
      void data.refresh();
      toast({ title: 'Sincronizado', description: 'Métricas da squad atualizadas a partir do Jira.' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao sincronizar', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleResyncSprint = async () => {
    const userIdentifier = userProfile?.id || userProfile?.email;
    if (!userIdentifier || !squadId || !viewingSprintId) return;
    try {
      await forceResyncSprint(userIdentifier, squadId, viewingSprintId);
      void data.refresh();
      toast({ title: 'Sprint ressincronizada', description: 'Os números desta sprint foram refeitos a partir do Jira.' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao ressincronizar', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  // Tipos de issue distintos já sincronizados — sugestão pronta na UI de fases em vez de digitar o nome exato.
  const availableIssueTypes = useMemo(() => {
    const set = new Set<string>();
    issuesSnapshot.forEach((i) => { if (i.type) set.add(i.type); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [issuesSnapshot]);

  // Referência estável: o diálogo de fases usa isto para saber quando resemear o formulário local.
  const squadWorkflowPhases = useMemo(() => config?.phases || [], [config?.phases]);

  const handleSavePhases = async (phases: SquadWorkflowPhase[]) => {
    if (!squadId) return;
    // Squad sem config salva ainda não tem projeto/JQL para reenviar, nem tipo de issue sincronizado para mapear.
    if (!config) {
      toast({ title: 'Configure a squad primeiro', description: 'Defina o projeto e o filtro do Jira em Configurar a squad antes de mapear fases.', variant: 'destructive' });
      return;
    }
    try {
      // Escrita parcial: só as fases. O servidor preserva o resto da configuração.
      await saveSquadConfig(squadId, { phases });
      setIsPhasesOpen(false);
      toast({ title: 'Fases salvas', description: 'O cronograma passa a usar essa ordem e cor.' });
    } catch (err: unknown) {
      toast({ title: 'Erro ao salvar fases', description: (err as Error)?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  // ── Cabeçalho da página ──
  const displayRollup = viewingSprintId ? viewedRollup : rollup;
  const dataSyncedAt = latestSyncAt(config?.lastSyncAt, rollup?.computedAt);
  const time = sprintTimeProgress(
    data.rollup?.extraMetrics?.activeSprintStart as string | undefined,
    data.rollup?.extraMetrics?.activeSprintEnd as string | undefined
  );
  const subtitle = hasSquad
    ? [
        data.rollup?.sprintName || (config?.activeSprintId ? `Sprint ${config.activeSprintId}` : ''),
        time && `faltam ${time.remaining} de ${time.total} dias úteis`,
        dataSyncedAt ? `sincronizado com o Jira ${timeAgo(dataSyncedAt) || 'agora'}` : 'ainda não sincronizado com o Jira',
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  const tabLabel = HUB_TABS.find((t) => t.id === tab)?.label ?? 'Resumo';

  const actions = hasSquad ? (
    <>
      <ModuleIntegrationButton moduleId="squad" variant="ghost" className="hidden lg:inline-flex" />
      {showSprintSelector && (
        <SelectField
          value={sprintValue}
          onChange={handleSelectSprint}
          options={sprintChoices}
          aria-label="Escolher a sprint"
          className="h-9 w-44 sm:w-56"
        />
      )}
      {viewingSprintId && isLeadership && (
        <ModalButton
          className={ACTION}
          onClick={handleResyncSprint}
          disabled={isForceResyncingSprint}
          title="Refazer os números desta sprint encerrada a partir do Jira"
          aria-label="Ressincronizar esta sprint"
        >
          <RotateCcw className={isForceResyncingSprint ? 'h-4 w-4 animate-spin motion-reduce:animate-none' : 'h-4 w-4'} strokeWidth={1.5} aria-hidden="true" />
          <span className={LABEL}>Ressincronizar sprint</span>
        </ModalButton>
      )}
      <ModalButton
        className={ACTION}
        onClick={() => handleSync()}
        disabled={isSyncing || viewingSprintId !== null}
        title={viewingSprintId ? 'Volte para a sprint atual para sincronizar' : 'Sincronizar os dados da squad agora com o Jira'}
        aria-label="Sincronizar com o Jira"
      >
        <RefreshCw className={isSyncing ? 'h-4 w-4 animate-spin motion-reduce:animate-none' : 'h-4 w-4'} strokeWidth={1.5} aria-hidden="true" />
        <span className={LABEL}>Sincronizar</span>
      </ModalButton>
      {isPeopleAdmin && (
        <ModalButton className={ACTION} onClick={() => router.push('/squad/roster')} title="Pessoas do time e horas por dia de cada uma" aria-label="Pessoas do time">
          <UserCog className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          <span className={LABEL}>Pessoas</span>
        </ModalButton>
      )}
      <ModalButton className={ACTION} onClick={() => setIsSettingsOpen(true)} title="Configurar a squad (projeto e conexão com o Jira)" aria-label="Configurar a squad">
        <Settings2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        <span className={LABEL}>Configurar</span>
      </ModalButton>
      {isLeadership && (
        <ModalButton className={ACTION} onClick={() => setIsPhasesOpen(true)} title="Fases e cores das barras do Cronograma" aria-label="Fases do Cronograma">
          <Workflow className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          <span className={LABEL}>Fases</span>
        </ModalButton>
      )}
    </>
  ) : undefined;

  return (
    <PageShell documentTitle="Squad" feedbackName="Squad">
      <PageHeader
        title="Squad"
        module="squad"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Squad', href: hasSquad ? hubHref('resumo') : undefined }, { label: tabLabel }]}
        subtitle={subtitle}
        actions={actions}
      />

      {isInitializing ? (
        <LoadingSkeleton variant="cards" rows={3} label="Carregando a squad" />
      ) : !hasSquad ? (
        <EmptyState
          title="Você ainda não está em uma squad"
          description="Entre em um time para ver sprint, quadro, cronograma e métricas aqui."
          actions={
            <ModalButton variant="primary" onClick={() => router.push('/onboarding')}>
              Escolher meu time
            </ModalButton>
          }
        />
      ) : (
        <>
          <TabBar
            tabs={HUB_TABS}
            value={tab}
            onChange={(next) => goTo(next)}
            label="Seções da squad"
            idPrefix="hub"
            className="overflow-y-hidden overflow-x-auto px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            tabClassName="shrink-0 px-1 max-sm:h-11"
          />

          <div role="tabpanel" id={`hub-panel-${tab}`} aria-labelledby={`hub-tab-${tab}`} className="flex flex-col gap-5 animate-in fade-in duration-300 motion-reduce:animate-none">
            {tab === 'resumo' && (
              <SummaryTab
                data={data}
                userKey={userProfile?.email || userProfile?.id || ''}
                userEmail={userProfile?.email}
                userName={userProfile?.name}
                userRole={role}
                sync={summarySync}
                canManageTeam={canManageTeam && isPeopleAdmin}
                canOpenPeople={isPeopleAdmin}
                canSyncNow={viewingSprintId === null && !isSyncing}
                onSyncNow={() => handleSync()}
              />
            )}

            {tab === 'quadro' && (
              <SquadScrumBoard
                squadId={squadId}
                jiraProjectKey={config?.jiraProjectKey || squadId}
                rapidViewId={config?.rapidViewId || ''}
                jiraDomain={config?.jiraDomain || jiraSettings?.domain || ''}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}

            {tab === 'cronograma' && (
              <SquadPlansTimeline jiraConnected={jiraConnected} onConnectJira={() => setIsSettingsOpen(true)} onSync={() => handleSync()} />
            )}

            {tab === 'metricas' && (
              <MetricsTab
                view={location.metricsView}
                onViewChange={(view) => goTo('metricas', { metricsView: view })}
                displayRollup={displayRollup}
                currentRollup={rollup}
                config={config}
                dailySnapshots={dailySnapshots}
                role={role}
                isLoading={isLoading}
                isSyncing={isSyncing}
                jiraConnected={jiraConnected}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onSync={() => handleSync(true)}
              />
            )}

            {tab === 'paineis' && <SquadPanelsTab />}
          </div>
        </>
      )}

      <SquadConfigDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        squadId={squadId}
        config={config}
        isLeadership={isLeadership}
        jiraSettings={jiraSettings}
        saveJiraSettings={saveJiraSettings}
        saveSquadConfig={saveSquadConfig}
      />

      <SquadWorkflowPhasesDialog
        open={isPhasesOpen}
        onOpenChange={setIsPhasesOpen}
        squadId={squadId}
        phases={squadWorkflowPhases}
        availableIssueTypes={availableIssueTypes}
        onSave={handleSavePhases}
      />
    </PageShell>
  );
}
