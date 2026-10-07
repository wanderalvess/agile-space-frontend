'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, RefreshCw, Settings2, Bug, ListChecks, TrendingUp, AlertTriangle,
  Users, Trophy, Gauge, ShieldAlert, CalendarRange, LayoutGrid, User, UserCog,
  ListTodo, LayoutDashboard, History, Flame, Sparkles, CheckCircle2,
  ArrowRight, ShieldCheck, HelpCircle, Layers, Code2, Compass, Play, FileText,
  Workflow, XCircle
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { ModuleIntegrationButton } from '@/components/shared/ModuleIntegrationDialog';
import { SquadWorkflowPhasesDialog } from '@/components/squad/SquadWorkflowPhasesDialog';
import { useUserContext } from '@/context/UserContext';
import { useSquadStore } from '@/store/useSquadStore';
import { SQUAD_ADMIN_ROLES, SQUAD_LEADERSHIP_VIEW_ROLES, SQUAD_PEOPLE_ADMIN_ROLES, type SquadMember, type SquadWorkflowPhase } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useJiraSettings, getJiraCredentials } from '@/hooks/useJiraSettings';
import Link from 'next/link';

// Dynamic imports for Daily Flow components
const SquadPerformanceView = dynamic(() => import('@/components/squad/SquadPerformanceView').then(mod => mod.SquadPerformanceView), { ssr: false });
const SquadDashboardView = dynamic(() => import('@/components/squad/dashboards/SquadDashboardView').then(mod => mod.SquadDashboardView), { ssr: false });
import { useTeamAvatars } from '@/hooks/useTeamAvatars';
import { SquadOverview } from '@/components/squad/SquadOverview';
const SquadPlansTimeline = dynamic(() => import('@/components/squad/SquadPlansTimeline').then(mod => mod.SquadPlansTimeline), { ssr: false });
const SquadScrumBoard = dynamic(() => import('@/components/squad/SquadScrumBoard').then(mod => mod.SquadScrumBoard), { ssr: false });

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function DueCell({ dueDate }: { dueDate: string }) {
  if (!dueDate) return <span className="text-slate-300 dark:text-slate-700">—</span>;
  const days = Math.floor((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  const tone = days < 0 ? 'text-rose-500 font-black' : days <= 3 ? 'text-amber-500 font-bold' : 'text-slate-500 dark:text-slate-400';
  return <span className={tone}>{formatShortDate(dueDate)}</span>;
}

function timeAgo(iso?: string): string {
  if (!iso) return 'nunca';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'nunca';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

const ROLE_FOCUS: Record<string, { tagline: string; firstKpi: 'stale' | 'bugs' | 'hours' | 'done' }> = {
  'Scrum Master': { tagline: 'Seu foco: itens parados e saúde do fluxo da sprint.', firstKpi: 'stale' },
  'Tech Lead': { tagline: 'Seu foco: backlog nominal e capacidade do time.', firstKpi: 'hours' },
  'Product Owner': { tagline: 'Seu foco: backlog nominal pra priorizar e status de entrega.', firstKpi: 'done' },
  'People Lead': { tagline: 'Seu foco: visão agregada e capacidade do squad.', firstKpi: 'hours' },
  'Agile Master': { tagline: 'Seu foco: visão agregada e capacidade do squad.', firstKpi: 'hours' },
  'QA': { tagline: 'Seu foco: bugs no escopo e seu próprio progresso.', firstKpi: 'bugs' },
  'Developer': { tagline: 'Seu foco: status da sprint e seu próprio progresso.', firstKpi: 'done' },
};

function Kpi({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: React.ComponentType<any>; tone: string }) {
  return (
    <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        <div className={`p-2 rounded-xl shrink-0 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-black text-slate-900 dark:text-white leading-none font-headline mt-2.5">{value}</p>
      {sub && <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/40 p-3 text-center">
      <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{value}</p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5">{label}</p>
    </div>
  );
}

function MemberCapacityRow({ member, onSave }: { member: SquadMember; onSave: (id: string, updates: { displayName: string; capacityHoursPerDay: number }) => void }) {
  const [capacity, setCapacity] = useState(member.capacityHoursPerDay);
  useEffect(() => setCapacity(member.capacityHoursPerDay), [member.capacityHoursPerDay]);
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/40">
      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
        {member.displayName}
        {member.claimedByUid && <span className="text-emerald-500 ml-1.5 text-[9px] font-black uppercase">· vinculado</span>}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Input
          type="number" min={1} max={16} value={capacity}
          onChange={e => setCapacity(Number(e.target.value) || 1)}
          className="h-7 w-16 text-[11px]"
        />
        <span className="text-[9px] text-slate-400">h/dia</span>
        <Button
          size="sm" variant="outline" className="h-7 text-[9px]"
          onClick={() => onSave(member.jiraAccountId, { displayName: member.displayName, capacityHoursPerDay: capacity || 1 })}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function SquadHubContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'overview';
  // Pulse e Performance viraram uma aba só (Métricas); links antigos continuam funcionando.
  const initialTab = requestedTab === 'pulse' || requestedTab === 'performance' ? 'metrics' : requestedTab;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [metricsView, setMetricsView] = useState<'sprint' | 'performance'>(requestedTab === 'performance' ? 'performance' : 'sprint');

  const { userProfile, isInitializing } = useUserContext();
  const { toast } = useToast();
  const router = useRouter();

  const {
    config, rollup, issuesSnapshot, memberMetrics, members, myClaim, myIssues, dailySnapshots,
    viewingSprintId, viewedRollup, viewedIssuesSnapshot, viewedMyIssues, isLoadingViewedSprint, isForceResyncingSprint,
    isLoading, isLoadingDetail, isLoadingMyIssues, isSyncing, syncError,
    fetchSquad, fetchSquadDetail, fetchMembers, claimMember, saveMemberCapacity, fetchMyIssues, fetchDailySnapshots,
    saveSquadConfig, syncSquad, selectSprint, forceResyncSprint, reset: resetSquadStore,
  } = useSquadStore();

  const squadId = userProfile?.squadId || '';
  // Pessoas cadastradas no projeto (mesma fonte do Painel): serve de reserva quando ninguém foi sincronizado do Jira.
  const { members: projectTeamMembers } = useTeamAvatars(squadId);
  const role = userProfile?.role as string | undefined;
  const isLeadership = !!role && (SQUAD_ADMIN_ROLES as string[]).includes(role);
  const isLeadershipViewer = !!role && (SQUAD_LEADERSHIP_VIEW_ROLES as string[]).includes(role);
  const isPeopleAdmin = !!role && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(role);
  const roleFocus = role ? ROLE_FOCUS[role] : undefined;

  const { settings: jiraSettings, saveSettings: saveJiraSettings } = useJiraSettings();
  // ?settings=1 abre direto a configuração (Jira) — usado pelo painel, pra quem
  // quer conectar sem procurar a engrenagem.
  const [isSettingsOpen, setIsSettingsOpen] = useState(searchParams.get('settings') === '1');
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [isPhasesOpen, setIsPhasesOpen] = useState(false);
  const [projectKey, setProjectKey] = useState('');
  const [jql, setJql] = useState('');
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [sprintFieldId, setSprintFieldId] = useState('');
  const [rapidViewId, setRapidViewId] = useState<number | string>('');
  const [rankingEnabled, setRankingEnabled] = useState(false);
  const [capacityHours, setCapacityHours] = useState(6);

  useEffect(() => {
    if (jiraSettings?.token) {
      setJiraToken(jiraSettings.token);
    }
  }, [jiraSettings]);

  useEffect(() => {
    document.title = `Squad Hub & Rituais | Portal Tech V&D`;
  }, []);

  const prevSquadIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (squadId && squadId !== 'Sem Time') {
      if (prevSquadIdRef.current && prevSquadIdRef.current !== squadId) {
        resetSquadStore();
      }
      prevSquadIdRef.current = squadId;
      fetchSquad(squadId);
    }
  }, [squadId, fetchSquad, resetSquadStore]);

  useEffect(() => {
    if (squadId && squadId !== 'Sem Time') {
      fetchSquadDetail(squadId);
    }
  }, [squadId, fetchSquadDetail]);

  useEffect(() => {
    const userIdentifier = userProfile?.id || userProfile?.email;
    if (userIdentifier && squadId && squadId !== 'Sem Time') {
      fetchMembers(squadId, userIdentifier, {
        email: userProfile?.email,
        jiraAccountId: userProfile?.jiraAccountId,
        name: userProfile?.name,
      });
    }
  }, [userProfile?.id, userProfile?.email, userProfile?.jiraAccountId, userProfile?.name, squadId, fetchMembers]);

  useEffect(() => {
    if (squadId && myClaim?.jiraAccountId) {
      fetchMyIssues(squadId, myClaim.jiraAccountId);
    }
  }, [squadId, myClaim?.jiraAccountId, fetchMyIssues]);

  useEffect(() => {
    if (squadId && squadId !== 'Sem Time') {
      fetchDailySnapshots(squadId);
    }
  }, [squadId, fetchDailySnapshots]);

  useEffect(() => {
    const defaultKey = squadId || '';
    if (config) {
      const activeKey = config.jiraProjectKey || defaultKey;
      setProjectKey(activeKey);
      const defaultSyncJql = `project = "${activeKey}" AND sprint in openSprints()`;
      setJql(config.syncJql && !config.syncJql.includes('project = "MISSI"') && !config.syncJql.includes('project = MISSI') ? config.syncJql : defaultSyncJql);
      setRankingEnabled(!!config.rankingEnabled);
      setCapacityHours(config.defaultDailyCapacityHours || 6);
      setJiraDomain(config.jiraDomain || jiraSettings?.domain || '');
      setSprintFieldId(config.sprintFieldId || '');
      setRapidViewId(config.rapidViewId || '');
    } else if (squadId) {
      setProjectKey(defaultKey);
      setJql(`project = "${defaultKey}" AND sprint in openSprints()`);
      setJiraDomain(jiraSettings?.domain || '');
    }
  }, [config, squadId, jiraSettings?.domain]);

  const handleSaveConfig = async () => {
    if (!squadId) return;
    try {
      if (jiraToken.trim()) {
        const dom = jiraDomain.trim() || jiraSettings?.domain || '';
        if (!dom) {
          toast({
            title: 'Domínio Jira obrigatório',
            description: 'Informe o domínio (ex: suaempresa.atlassian.net) antes de salvar o token — sem ele a sincronização não encontra suas credenciais.',
            variant: 'destructive',
          });
          return;
        }
        await saveJiraSettings({ domain: dom, token: jiraToken.trim() });
      }
      await saveSquadConfig(squadId, {
        jiraProjectKey: projectKey.trim().toUpperCase(),
        syncJql: jql.trim(),
        rankingEnabled,
        defaultDailyCapacityHours: Number(capacityHours) || 6,
        jiraDomain: jiraDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') || undefined,
        sprintFieldId: sprintFieldId.trim() || undefined,
        rapidViewId: rapidViewId ? Number(rapidViewId) || rapidViewId : undefined,
      });
      setIsSettingsOpen(false);
      toast({ title: 'Configuração salva', description: 'Squad e credenciais prontas para sincronizar com o Jira.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  // Tipos de issue distintos já sincronizados — sugestão pronta na UI de fases
  // em vez do admin ter que lembrar/digitar o nome exato de cada issuetype.
  const availableIssueTypes = useMemo(() => {
    const set = new Set<string>();
    issuesSnapshot.forEach(i => { if (i.type) set.add(i.type); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [issuesSnapshot]);

  // Referência estável — sem isso, `config?.phases || []` cria um array novo
  // a cada render do page (SquadWorkflowPhasesDialog depende disso pra saber
  // quando resemear o formulário local).
  const squadWorkflowPhases = useMemo(() => config?.phases || [], [config?.phases]);

  const handleSavePhases = async (phases: SquadWorkflowPhase[]) => {
    if (!squadId) return;
    // Squad sem config salva ainda (nunca passou pela aba Configurações —
    // GET /squads/{id} 404) não tem jiraProjectKey/syncJql pra reenviar, e
    // sem sync configurado não tem tipo de issue sincronizado pra mapear em
    // fase mesmo. Antes disso só retornava sem avisar nada — agora diz o
    // porquê em vez de o botão Salvar parecer travado.
    if (!config) {
      toast({ title: 'Configure o squad primeiro', description: 'Defina projeto e JQL do Jira nas Configurações do squad antes de mapear fases.', variant: 'destructive' });
      return;
    }
    try {
      // saveSquadConfig substitui o registro inteiro — reenvia os campos já
      // salvos do próprio config (não tem form próprio pra eles aqui) junto
      // com o phases novo, senão o merge no backend limparia o resto.
      await saveSquadConfig(squadId, {
        jiraProjectKey: config.jiraProjectKey,
        syncJql: config.syncJql,
        rankingEnabled: !!config.rankingEnabled,
        defaultDailyCapacityHours: config.defaultDailyCapacityHours || 6,
        jiraDomain: config.jiraDomain,
        sprintFieldId: config.sprintFieldId,
        rapidViewId: config.rapidViewId,
        phases,
      });
      setIsPhasesOpen(false);
      toast({ title: 'Fases salvas', description: 'O cronograma do Jira Plans passa a usar essa ordem e cor.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar fases', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleSync = async (forceFull?: boolean) => {
    const userIdentifier = userProfile?.id || userProfile?.email;
    if (!userIdentifier || !squadId) return;

    const creds = await getJiraCredentials(userIdentifier);
    if (!creds || !creds.token) {
      toast({
        title: 'Token Jira Não Encontrado',
        description: 'Por favor, informe seu Token de Acesso (PAT) no formulário de Configurações do Squad abaixo antes de sincronizar.',
        variant: 'destructive',
      });
      setIsSettingsOpen(true);
      return;
    }

    try {
      await syncSquad(userIdentifier, squadId, forceFull);
      fetchSquadDetail(squadId);
      fetchMembers(squadId, userIdentifier, {
        email: userProfile?.email,
        jiraAccountId: userProfile?.jiraAccountId,
        name: userProfile?.name,
      });
      fetchDailySnapshots(squadId);
      toast({ title: 'Sincronizado', description: 'Métricas do squad atualizadas a partir do Jira.' });
    } catch (err: any) {
      toast({ title: 'Erro ao sincronizar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleSaveCapacity = async (jiraAccountId: string, updates: { displayName: string; capacityHoursPerDay: number }) => {
    if (!squadId) return;
    try {
      await saveMemberCapacity(squadId, jiraAccountId, updates);
      toast({ title: 'Capacidade salva' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar capacidade', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const displayRollup = viewingSprintId ? viewedRollup : rollup;
  const displayIssuesSnapshot = viewingSprintId ? viewedIssuesSnapshot : issuesSnapshot;
  const displayMyIssues = viewingSprintId ? viewedMyIssues : myIssues;

  const hoursLoggedTotal = displayRollup?.loggedTotalSec ? (displayRollup.loggedTotalSec / 3600).toFixed(1) : '0';
  const hoursEstimateTotal = displayRollup?.estimateTotalSec ? (displayRollup.estimateTotalSec / 3600).toFixed(0) : '0';
  const hoursRemainingTotal = displayRollup?.remainingTotalSec ? (displayRollup.remainingTotalSec / 3600).toFixed(0) : '0';

  const kpis = [
    { key: 'done', label: 'Concluído', value: `${displayRollup?.doneIssues ?? 0} / ${displayRollup?.totalIssues ?? 0}`, sub: 'issues finalizadas', icon: ListChecks, tone: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' },
    { key: 'hours', label: 'Horas na Sprint', value: `${hoursLoggedTotal}h`, sub: `estimado ${hoursEstimateTotal}h · resta ${hoursRemainingTotal}h`, icon: Gauge, tone: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' },
    { key: 'bugs', label: 'Bugs no Escopo', value: `${displayRollup?.bugIssues ?? 0}`, sub: 'defeitos em resolução', icon: Bug, tone: (displayRollup?.bugIssues ?? 0) > 0 ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'text-slate-400 bg-slate-50 dark:bg-slate-900' },
    { key: 'stale', label: 'Itens Parados', value: `${displayRollup?.staleIssues ?? 0}`, sub: 'sem update há >3 dias', icon: AlertTriangle, tone: (displayRollup?.staleIssues ?? 0) > 0 ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' : 'text-slate-400 bg-slate-50 dark:bg-slate-900' },
  ];

  if (roleFocus) {
    const idx = kpis.findIndex(k => k.key === roleFocus.firstKpi);
    if (idx > 0) {
      const [focusKpi] = kpis.splice(idx, 1);
      kpis.unshift(focusKpi);
    }
  }

  const byStatusMap = (displayRollup?.extraMetrics as any)?.byStatus || {};
  const byStatusEntries = Object.entries(byStatusMap).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];
  const maxStatusCount = Math.max(1, ...byStatusEntries.map(e => e[1]));
  const totalCount = displayRollup?.totalIssues ?? 0;

  const dailyDeltas: { date: string; loggedDelta: number; doneDelta: number }[] = [];
  for (let i = 1; i < dailySnapshots.length; i++) {
    const prev = dailySnapshots[i - 1];
    const curr = dailySnapshots[i];
    const loggedDelta = Math.max(0, (curr.loggedSec - prev.loggedSec) / 3600);
    const doneDelta = Math.max(0, curr.doneIssues - prev.doneIssues);
    dailyDeltas.push({ date: curr.snapshotDate, loggedDelta, doneDelta });
  }

  const sprintHistory: any[] = config?.sprintHistory || [];

  if (isInitializing) return <LoadingScreen />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <ToolHubLayout
        title={`Squad Hub · ${squadId || 'Sem Time'}`}
        description="Hub unificado da squad: Visão geral da sprint, Daily Command Center, Quadro e Rituais contínuos."
        icon={<Compass className="h-5 w-5" />}
        themeColor="indigo"
        tips={[]}
        onlyChildren={true}
        badge={
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 leading-none ml-2 bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{squadId || 'SQUAD'}</span>
          </div>
        }
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ModuleIntegrationButton moduleId="squad" variant="ghost" className="hidden lg:inline-flex" />
            {sprintHistory.length > 0 && ((activeTab === 'metrics' && metricsView === 'sprint') || activeTab === 'plans') && (
              <Select
                value={viewingSprintId || 'CURRENT'}
                onValueChange={(val) => selectSprint(squadId, val === 'CURRENT' ? null : val, { isLeadershipViewer, myClaimedAssigneeId: myClaim?.jiraAccountId })}
              >
                <SelectTrigger className="h-9 w-40 sm:w-52 text-xs font-semibold rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder="Selecione a sprint" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="CURRENT" className="font-bold text-indigo-600 dark:text-indigo-400">
                    ● {config?.activeSprintId ? `Sprint ativa (${config.activeSprintId})` : 'Sprint atual (ao vivo)'}
                  </SelectItem>
                  {sprintHistory.map((s: any) => (
                    <SelectItem key={s.sprintId} value={s.sprintId}>
                      {s.sprintName || `Sprint ${s.sprintId}`} {s.closedAt ? `(${formatShortDate(s.closedAt)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              size="sm" variant="outline" className="h-9 px-2.5 xl:px-3 gap-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800" onClick={() => handleSync()}
              disabled={isSyncing || viewingSprintId !== null}
              title={viewingSprintId ? 'Volte para "Atual" pra sincronizar' : 'Sincronizar os dados da squad agora com o Jira'}
              aria-label="Sincronizar com o Jira"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xl:inline text-xs font-semibold">Sincronizar</span>
            </Button>
            {isPeopleAdmin && (
              <Button size="sm" variant="outline" className="h-9 px-2.5 xl:px-3 gap-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800" onClick={() => router.push('/squad/roster')} title="Pessoas do time e horas por dia de cada uma" aria-label="Pessoas do time">
                <UserCog className="h-3.5 w-3.5" />
                <span className="hidden xl:inline text-xs font-semibold">Pessoas</span>
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-9 px-2.5 xl:px-3 gap-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800" onClick={() => setIsSettingsOpen(true)} title="Configurar a squad (projeto e conexão com o Jira)" aria-label="Configurar a squad">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-xs font-semibold">Configurar</span>
            </Button>
            <Button size="sm" variant="outline" className="h-9 px-2.5 xl:px-3 gap-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800" onClick={() => setIsPhasesOpen(true)} title="Fases e cores das barras do Cronograma" aria-label="Fases do Cronograma">
              <Workflow className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-xs font-semibold">Fases</span>
            </Button>
          </div>
        }
      >
        {/* SUB-HEADER: BARRA DE NAVEGAÇÃO DE ABAS DO SQUAD HUB */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-6 py-0 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full py-0.5">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList className="h-auto bg-transparent p-0 gap-1 rounded-none inline-flex">
                <TabsTrigger value="overview" className="rounded-none h-11 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400 border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-slate-900 dark:data-[state=active]:text-white hover:text-slate-800 dark:hover:text-slate-200">Visão geral</TabsTrigger>
                <TabsTrigger value="board" className="rounded-none h-11 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400 border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-slate-900 dark:data-[state=active]:text-white hover:text-slate-800 dark:hover:text-slate-200">Quadro</TabsTrigger>
                <TabsTrigger value="plans" className="rounded-none h-11 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400 border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-slate-900 dark:data-[state=active]:text-white hover:text-slate-800 dark:hover:text-slate-200">Cronograma</TabsTrigger>
                <TabsTrigger value="metrics" className="rounded-none h-11 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400 border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-slate-900 dark:data-[state=active]:text-white hover:text-slate-800 dark:hover:text-slate-200">Métricas</TabsTrigger>
                <TabsTrigger value="dashboards" className="rounded-none h-11 px-4 text-sm font-semibold text-slate-500 dark:text-slate-400 border-b-2 border-transparent bg-transparent shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-slate-900 dark:data-[state=active]:text-white hover:text-slate-800 dark:hover:text-slate-200">Meu painel</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <main className="flex-1 w-full p-4 md:p-6 overflow-y-auto flex flex-col gap-6">

          {/* ═══════════════════════════════════════════════════════════════════
              ABA 1: VISÃO GERAL & FLUXOS DE USO (NOVO HUB 360º)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <SquadOverview
              squadId={squadId}
              config={config}
              rollup={displayRollup}
              members={members}
              peopleCount={Math.max(members.length, projectTeamMembers.length)}
              lastSyncLabel={config?.lastSyncAt ? `Sincronizado com o Jira ${timeAgo(config.lastSyncAt)}` : 'Ainda não sincronizado com o Jira'}
              isSyncing={isSyncing}
              canSync={viewingSprintId === null}
              onSync={() => handleSync()}
              onOpenTab={setActiveTab}
              onNavigate={(href) => router.push(href)}
            />
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ABA 1.5: QUADRO SCRUM (JIRA GREENHOPPER / RAPIDBOARD)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'board' && (
            <div className="animate-in fade-in duration-300">
              <SquadScrumBoard
                squadId={squadId}
                jiraProjectKey={config?.jiraProjectKey || projectKey || squadId}
                rapidViewId={config?.rapidViewId || rapidViewId || ''}
                jiraDomain={config?.jiraDomain || jiraDomain}
              />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ABA JIRA PLANS & CRONOGRAMA DA SPRINT
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'plans' && (
            <div className="animate-in fade-in duration-300">
              <SquadPlansTimeline />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ABA 2: Sprint DA SPRINT (VISÃO COMPLETA)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'metrics' && (
            <div role="group" aria-label="O que mostrar nas métricas" className="inline-flex self-start rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden">
              <button
                type="button" aria-pressed={metricsView === 'sprint'} onClick={() => setMetricsView('sprint')}
                className={`h-10 px-4 text-sm font-semibold transition-colors ${metricsView === 'sprint' ? 'bg-primary text-primary-foreground' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                Sprint atual
              </button>
              <button
                type="button" aria-pressed={metricsView === 'performance'} onClick={() => setMetricsView('performance')}
                className={`h-10 px-4 text-sm font-semibold border-l border-slate-300 dark:border-slate-700 transition-colors ${metricsView === 'performance' ? 'bg-primary text-primary-foreground' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                Desempenho do time
              </button>
            </div>
          )}

          {activeTab === 'metrics' && metricsView === 'sprint' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header Banner Squad Pulse */}
              <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-none font-semibold text-xs px-2.5 py-0.5">
                      Sprint
                    </Badge>
                    <span className="text-xs text-slate-400 font-code">
                      {displayRollup?.sprintName || config?.activeSprintId || squadId}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight font-headline text-slate-900 dark:text-white">
                    Métricas da sprint
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Quantos itens foram entregues, quantas horas foram registradas e o que está parado, a partir do que o Jira mostra.
                  </p>
                </div>

                {displayRollup?.extraMetrics?.activeSprintStart && displayRollup?.extraMetrics?.activeSprintEnd && (
                  <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 px-4 py-2.5 rounded-2xl shrink-0 text-xs">
                    <CalendarRange className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Período da sprint</p>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {formatShortDate(displayRollup.extraMetrics.activeSprintStart as string)} → {formatShortDate(displayRollup.extraMetrics.activeSprintEnd as string)}
                        {!!displayRollup.workdaysTotal && <span className="text-slate-400 font-normal ml-1">({displayRollup.workdaysTotal} dias úteis)</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {!isLoading && !rollup && (
                <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 shadow-sm text-center flex flex-col items-center justify-center">
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
                    Ainda não há métricas desta sprint
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-4">
                    As métricas da sprint ativa ainda não foram carregadas para o squad <strong>{squadId}</strong>. Clique no botão abaixo para puxar as métricas e o quadro da sprint diretamente do Jira utilizando sua conexão/token.
                  </p>
                  <Button
                    onClick={() => handleSync(true)}
                    disabled={isSyncing}
                    className="bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold px-5 h-11 shadow-md"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando…' : 'Sincronizar agora'}
                  </Button>
                </Card>
              )}

              {displayRollup && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {kpis.map(k => (
                    <Kpi key={k.key} label={k.label} value={k.value} sub={k.sub} icon={k.icon} tone={k.tone} />
                  ))}
                </div>
              )}

              {/* Quadro da Sprint por Status */}
              {displayRollup && byStatusEntries.length > 0 && (
                <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5 text-indigo-500" /> Quadro da sprint
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {totalCount} issues no escopo
                    </span>
                  </div>
                  <div className="space-y-2">
                    {byStatusEntries.map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2.5 text-sm">
                        <span className="w-36 truncate font-bold text-slate-600 dark:text-slate-300">{status}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${Math.round((count / maxStatusCount) * 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums w-8 text-right shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Produtividade Diária */}
              {rollup && (
                <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Produtividade diária
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      horas logadas por dia
                    </span>
                  </div>
                  {dailyDeltas.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Ainda sem histórico suficiente — aparece a partir do segundo dia com sincronização.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dailyDeltas.map(d => (
                        <div key={d.date} className="flex items-center gap-2.5 text-sm">
                          <span className="w-16 shrink-0 font-bold text-slate-500 dark:text-slate-400 tabular-nums">{formatShortDate(d.date)}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.round((d.loggedDelta / 10) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums w-16 text-right shrink-0">{d.loggedDelta.toFixed(1)}h</span>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums w-16 text-right shrink-0">{d.doneDelta} concl.</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Roster de Membros */}
              <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-500" /> Membros da Equipe ({members.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/squad/roster')}
                    className="h-7 text-[10px] font-bold rounded-xl gap-1 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                  >
                    <UserCog className="h-3 w-3" /> Gestão do Time & Horas
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {members.map(m => {
                    const isMe =
                      (myClaim && myClaim.jiraAccountId === m.jiraAccountId) ||
                      (m.claimedByUid && (m.claimedByUid === userProfile?.id || m.claimedByUid === userProfile?.email)) ||
                      (userProfile?.email && m.email && m.email.toLowerCase().trim() === userProfile.email.toLowerCase().trim()) ||
                      (userProfile?.jiraAccountId && m.jiraAccountId === userProfile.jiraAccountId) ||
                      (userProfile?.name && m.displayName && m.displayName.toLowerCase().trim() === userProfile.name.toLowerCase().trim());

                    return (
                      <div
                        key={m.jiraAccountId}
                        className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2.5 transition-all ${
                          isMe
                            ? 'bg-emerald-500/[0.04] dark:bg-emerald-950/20 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/20'
                            : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{m.displayName}</span>
                          <Badge
                            variant="outline"
                            className={`text-[8px] font-bold shrink-0 ${
                              isMe ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : ''
                            }`}
                          >
                            {m.role || 'Dev'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span>Capacidade: {m.capacityHoursPerDay || 8}h/dia</span>
                          {isMe && (
                            <span className="text-emerald-500 font-bold flex items-center gap-1">
                              ● Você
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ABA 4: PERFORMANCE & HÁBITOS DE FOCO
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'metrics' && metricsView === 'performance' && (
            <div className="animate-in fade-in duration-300">
              <SquadPerformanceView />
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ABA 5: DASHBOARD DO MEU CARGO & PAINÉIS JQL
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'dashboards' && (
            <div className="animate-in fade-in duration-300">
              <SquadDashboardView />
            </div>
          )}

        </main>

        {/* Modal de Configuração do Squad */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-lg rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-indigo-500" /> Configurações do Squad ({squadId})
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure os parâmetros de integração com o Jira, JQL e RapidBoard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-xs mt-2">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Chave do Projeto no Jira (Project Key)
                </label>
                <Input
                  value={projectKey}
                  onChange={e => setProjectKey(e.target.value)}
                  placeholder="Chave do projeto no Jira"
                  className="rounded-xl h-9 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">Chave exata do projeto no Jira (ex.: a sigla que aparece nas issues, como ABC-123 → ABC).</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  JQL de Sincronização
                </label>
                <Input
                  value={jql}
                  onChange={e => setJql(e.target.value)}
                  placeholder='Ex.: project = "CHAVE" AND sprint in openSprints()'
                  className="rounded-xl h-9 text-xs font-code"
                />
                <p className="text-[10px] text-slate-400 mt-1">Filtro JQL para buscar os itens da sprint ativa.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    Token de Acesso Jira (PAT / API Token)
                  </label>
                  {jiraToken.trim() ? (
                    <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold px-1.5 py-0 gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold px-1.5 py-0 gap-1">
                      <XCircle className="h-2.5 w-2.5" /> Não Informado
                    </Badge>
                  )}
                </div>
                <Input
                  type="password"
                  value={jiraToken}
                  onChange={e => setJiraToken(e.target.value)}
                  placeholder="Cole seu Personal Access Token (PAT) ou API Token do Jira..."
                  className="rounded-xl h-9 text-xs font-code"
                />
                <p className="text-[10px] text-slate-400 mt-1">Seu token pessoal do Jira utilizado para realizar as consultas e sincronizações.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Domínio Jira
                  </label>
                  <Input
                    value={jiraDomain}
                    onChange={e => setJiraDomain(e.target.value)}
                    placeholder="jira.suaempresa.com.br"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ID do Quadro Jira
                  </label>
                  <Input
                    value={rapidViewId}
                    onChange={e => setRapidViewId(e.target.value)}
                    placeholder="Ex.: 1234"
                    className="rounded-xl h-9 text-xs font-code"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    ID Campo Sprint
                  </label>
                  <Input
                    value={sprintFieldId}
                    onChange={e => setSprintFieldId(e.target.value)}
                    placeholder="customfield_10005"
                    className="rounded-xl h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Capacidade Padrão Diária (horas/dia por membro)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={16}
                  value={capacityHours}
                  onChange={e => setCapacityHours(Number(e.target.value) || 6)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="rankingEnabled"
                  checked={rankingEnabled}
                  onCheckedChange={v => setRankingEnabled(!!v)}
                />
                <label htmlFor="rankingEnabled" className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Habilitar cálculo detalhado de capacidade e horas por membro
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" onClick={() => setIsSettingsOpen(false)} className="rounded-xl text-xs">
                  Cancelar
                </Button>
                <Button onClick={handleSaveConfig} className="bg-primary text-white rounded-xl text-xs font-bold">
                  Salvar Configuração
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <SquadWorkflowPhasesDialog
          open={isPhasesOpen}
          onOpenChange={setIsPhasesOpen}
          squadId={squadId}
          phases={squadWorkflowPhases}
          availableIssueTypes={availableIssueTypes}
          onSave={handleSavePhases}
        />

        {/* Modal de Gestão de Pessoas & Roster */}
        <Dialog open={isPeopleOpen} onOpenChange={setIsPeopleOpen}>
          <DialogContent className="max-w-xl rounded-3xl p-6 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <UserCog className="h-5 w-5 text-indigo-500" /> Gestão de Roster & Capacidade ({members.length})
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ajuste a capacidade diária em horas e vincule membros da squad.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-3">
              {members.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum membro encontrado. Sincronize a squad para carregar o time.</p>
              ) : (
                members.map(m => (
                  <MemberCapacityRow key={m.jiraAccountId} member={m} onSave={handleSaveCapacity} />
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </ToolHubLayout>
    </div>
  );
}

export default function SquadPulsePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SquadHubContent />
    </Suspense>
  );
}
