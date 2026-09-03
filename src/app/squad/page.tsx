'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, RefreshCw, Settings2, Bug, ListChecks, TrendingUp, AlertTriangle,
  Users, Trophy, Gauge, ShieldAlert, CalendarRange, LayoutGrid, User, UserCog,
  ListTodo, LayoutDashboard, History, Timer, Flame, Sparkles, CheckCircle2,
  ArrowRight, ShieldCheck, HelpCircle, Layers, Code2, Compass, Play, FileText
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { useUserContext } from '@/context/UserContext';
import { useSquadStore } from '@/store/useSquadStore';
import { useDailyStore } from '@/store/useDailyStore';
import { SQUAD_ADMIN_ROLES, SQUAD_LEADERSHIP_VIEW_ROLES, SQUAD_PEOPLE_ADMIN_ROLES, type SquadMember } from '@/lib/types';
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
import { authFetch } from '@/lib/auth-client';

// Dynamic imports for Daily Flow components
const FocusPlayer = dynamic(() => import('@/app/daily-flow/components/FocusPlayer'), { ssr: false });
const DailyTimesheet = dynamic(() => import('@/app/daily-flow/components/DailyTimesheet'), { ssr: false });
const DailyReport = dynamic(() => import('@/app/daily-flow/components/DailyReport'), { ssr: false });
const SquadPerformanceView = dynamic(() => import('@/components/squad/SquadPerformanceView').then(mod => mod.SquadPerformanceView), { ssr: false });
const SquadDashboardView = dynamic(() => import('@/components/squad/dashboards/SquadDashboardView').then(mod => mod.SquadDashboardView), { ssr: false });
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
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
        <div className={`p-2 rounded-xl shrink-0 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-black text-slate-900 dark:text-white leading-none font-headline mt-2.5">{value}</p>
      {sub && <p className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-2">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/40 p-3 text-center">
      <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{value}</p>
      <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">{label}</p>
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
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

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

  const { selectedDate, fetchWorklogs, fetchWeeklyWorklogs, fetchDailyReports } = useDailyStore();
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);

  const squadId = userProfile?.squadId || '';
  const role = userProfile?.role as string | undefined;
  const isLeadership = !!role && (SQUAD_ADMIN_ROLES as string[]).includes(role);
  const isLeadershipViewer = !!role && (SQUAD_LEADERSHIP_VIEW_ROLES as string[]).includes(role);
  const isPeopleAdmin = !!role && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(role);
  const roleFocus = role ? ROLE_FOCUS[role] : undefined;

  const { settings: jiraSettings, saveSettings: saveJiraSettings } = useJiraSettings();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [projectKey, setProjectKey] = useState('');
  const [jql, setJql] = useState('');
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [sprintFieldId, setSprintFieldId] = useState('');
  const [rapidViewId, setRapidViewId] = useState<number | string>('11360');
  const [rankingEnabled, setRankingEnabled] = useState(false);
  const [capacityHours, setCapacityHours] = useState(6);

  useEffect(() => {
    if (jiraSettings?.token) {
      setJiraToken(jiraSettings.token);
    }
  }, [jiraSettings]);

  useEffect(() => {
    document.title = `Squad Hub & Rituais | Espaço Ágil`;
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
    const defaultKey = (squadId === 'MISSI' ? 'DDWMISSI' : squadId) || '';
    if (config) {
      const activeKey = config.jiraProjectKey && config.jiraProjectKey !== 'MISSI' ? config.jiraProjectKey : defaultKey;
      setProjectKey(activeKey);
      const defaultSyncJql = `project = "${activeKey}" AND sprint in openSprints()`;
      setJql(config.syncJql && !config.syncJql.includes('project = "MISSI"') && !config.syncJql.includes('project = MISSI') ? config.syncJql : defaultSyncJql);
      setRankingEnabled(!!config.rankingEnabled);
      setCapacityHours(config.defaultDailyCapacityHours || 6);
      setJiraDomain(config.jiraDomain || '');
      setSprintFieldId(config.sprintFieldId || '');
      setRapidViewId(config.rapidViewId || (activeKey === 'DDWMISSI' ? '11360' : ''));
    } else if (squadId) {
      setProjectKey(defaultKey);
      setJql(`project = "${defaultKey}" AND sprint in openSprints()`);
      if (defaultKey === 'DDWMISSI') setRapidViewId('11360');
    }
  }, [config, squadId]);

  // Carrega tarefas atribuídas para o Daily Command Center
  useEffect(() => {
    const userIdentifier = userProfile?.jiraAccountId || userProfile?.id || userProfile?.email;
    if (userProfile?.squadId && userIdentifier) {
      const fetchTasks = async () => {
        try {
          const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api'}/work-items/${encodeURIComponent(userProfile.squadId)}/assignee/${encodeURIComponent(userIdentifier)}`);
          if (res.ok) {
            const data = await res.json();
            setAssignedTasks(data);
          }
        } catch(e) {}
      };
      fetchTasks();
    }
  }, [userProfile?.squadId, userProfile?.jiraAccountId, userProfile?.id, userProfile?.email]);

  const effectiveUserId = userProfile?.id || userProfile?.email;
  useEffect(() => {
    if (effectiveUserId) {
      fetchWorklogs(effectiveUserId, selectedDate);
      fetchWeeklyWorklogs(effectiveUserId);
      fetchDailyReports(effectiveUserId);
    }
  }, [effectiveUserId, selectedDate]);

  const handleSaveConfig = async () => {
    if (!squadId) return;
    try {
      if (jiraToken.trim()) {
        const dom = jiraDomain.trim() || jiraSettings?.domain || '';
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
          <div className="flex items-center gap-1.5 text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none ml-2 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{squadId || 'SQUAD'}</span>
          </div>
        }
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            {sprintHistory.length > 0 && (activeTab === 'pulse' || activeTab === 'plans') && (
              <Select
                value={viewingSprintId || 'CURRENT'}
                onValueChange={(val) => selectSprint(squadId, val === 'CURRENT' ? null : val, { isLeadershipViewer, myClaimedAssigneeId: myClaim?.jiraAccountId })}
              >
                <SelectTrigger className="h-8 w-36 sm:w-44 text-[10px] font-bold rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder="Selecione a sprint" />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-[10px]">
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
              size="icon" variant="outline" className="h-8 w-8 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800" onClick={() => handleSync()}
              disabled={isSyncing || viewingSprintId !== null}
              title={viewingSprintId ? 'Volte para "Atual" pra sincronizar' : 'Sincronizar métricas agora com o Jira'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
            {isPeopleAdmin && (
              <Button size="icon" variant="outline" className="h-8 w-8 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800" onClick={() => router.push('/squad/roster')} title="Gestão de Roster & Calibração de Capacidade">
                <UserCog className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="icon" variant="outline" className="h-8 w-8 rounded-xl bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800" onClick={() => setIsSettingsOpen(true)} title="Configurações do squad">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        }
      >
        {/* SUB-HEADER: BARRA DE NAVEGAÇÃO DE ABAS DO SQUAD HUB */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-6 py-2 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full py-0.5">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl h-9 gap-1 inline-flex border border-slate-200/60 dark:border-slate-700/60">
                <TabsTrigger value="overview" className="text-[11px] font-black uppercase tracking-wider rounded-lg h-7 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs">
                  Visão Geral & Fluxos
                </TabsTrigger>
                <TabsTrigger value="board" className="text-[11px] font-black uppercase tracking-wider rounded-lg h-7 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs text-indigo-600 dark:text-indigo-400 font-bold">
                  Quadro Scrum
                </TabsTrigger>
                <TabsTrigger value="plans" className="text-[11px] font-black uppercase tracking-wider rounded-lg h-7 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs text-blue-600 dark:text-blue-400">
                  Plans / Cronograma
                </TabsTrigger>
                <TabsTrigger value="pulse" className="text-[11px] font-black uppercase tracking-wider rounded-lg h-7 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs">
                  Squad Pulse & Métricas
                </TabsTrigger>
                <TabsTrigger value="daily" className="text-[11px] font-black uppercase tracking-wider rounded-lg h-7 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs">
                  Daily & Timesheet
                </TabsTrigger>
                <TabsTrigger value="performance" className="text-[11px] font-black uppercase tracking-wider rounded-lg h-7 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs">
                  Performance
                </TabsTrigger>
                <TabsTrigger value="dashboards" className="text-[11px] font-black uppercase tracking-wider rounded-lg h-7 px-3.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-xs">
                  Meu Dashboard
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <main className="flex-1 w-full p-4 md:p-6 overflow-y-auto flex flex-col gap-6">

          {/* ═══════════════════════════════════════════════════════════════════
              ABA 1: VISÃO GERAL & FLUXOS DE USO (NOVO HUB 360º)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Hero Banner Squad */}
              <div className="bg-gradient-to-br from-indigo-50/90 via-white to-slate-50/90 dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-slate-950 border border-slate-200/80 dark:border-indigo-500/20 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-none font-bold uppercase tracking-wider text-[9px] px-2.5 py-0.5">
                        CENTRAL DA SQUAD
                      </Badge>
                      <span className="text-xs text-slate-400 font-mono">Projeto: {squadId}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase font-headline text-slate-900 dark:text-white">
                      {config?.name || squadId} · Painel de Governança & Rituais
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
                      Ciclo ágil contínuo conectado diretamente ao Jira. Acompanhe a esteira de entregas, registre worklogs diários e meça a maturidade do time.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <Button
                      onClick={() => setActiveTab('daily')}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl h-11 px-5 text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 gap-2"
                    >
                      <Timer className="h-4 w-4" /> Acessar Daily & Timesheet
                    </Button>
                    <Button
                      onClick={() => setActiveTab('board')}
                      variant="outline"
                      className="rounded-2xl h-11 px-5 text-xs font-bold uppercase tracking-wider bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 gap-2 shadow-xs"
                    >
                      <LayoutGrid className="h-4 w-4 text-indigo-500" /> Ver Quadro Scrum
                    </Button>
                  </div>
                </div>
              </div>

              {/* Trilha do Ciclo Ágil Contínuo */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Compass className="h-4 w-4 text-primary" /> Trilha de Rituais Ágeis da Squad
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">Do Refinamento ao Radar de Clima</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { step: '1', name: 'Scrum Poker', desc: 'Refinamento técnico e estimativas de Story Points em tempo real.', href: '/room', icon: Trophy, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
                    { step: '2', name: 'Sprint Planner', desc: 'Planejamento de capacidade do time e alocação do escopo.', href: '/sprint-planner', icon: CalendarRange, color: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
                    { step: '3', name: 'Daily & Timesheet', desc: 'Mural de foco diário, impedimentos e lançamento de worklog no Jira.', action: () => setActiveTab('daily'), icon: Timer, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
                    { step: '4', name: 'Sprint Showcase', desc: 'Demonstração de entregas e veredito final com PO e stakeholders.', href: '/showcase', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
                    { step: '5', name: 'Retrospectiva', desc: 'Lições aprendidas com painel analítico da sprint automático.', href: '/retro', icon: History, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
                    { step: '6', name: 'Plano de Ação 5W2H', desc: 'Ações corretivas estruturadas e cobradas na sprint seguinte.', href: '/action-plan', icon: ListTodo, color: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20' },
                    { step: '7', name: 'Radar Health Check', desc: 'Termômetro de clima, segurança psicológica e bem-estar.', href: '/health-check', icon: Activity, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
                    { step: '8', name: 'Dashboards por Cargo', desc: 'Métricas especializadas para PO, AM, PL, Tech Lead e Tribo.', action: () => setActiveTab('dashboards'), icon: Gauge, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
                  ].map((ritual) => (
                    <Card
                      key={ritual.name}
                      onClick={() => ritual.action ? ritual.action() : router.push(ritual.href!)}
                      className="p-5 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 hover:border-primary/50 transition-all hover:shadow-lg cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2.5 rounded-2xl border ${ritual.color}`}>
                            <ritual.icon className="h-4 w-4" />
                          </div>
                          <span className="text-[10px] font-black text-slate-400 font-mono">FASE {ritual.step}</span>
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                          {ritual.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {ritual.desc}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                        <span>Acessar Ritual</span>
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Atalho Rápido para Painéis de Liderança & Roster */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-500" /> Membros Conectados ({members.length})
                    </h4>
                    <Button size="sm" variant="ghost" onClick={() => setActiveTab('pulse')} className="text-xs text-primary font-bold">
                      Ver Quadro Completo →
                    </Button>
                  </div>
                  {members.length === 0 ? (
                    <p className="text-xs text-slate-400">Nenhum membro sincronizado ainda. Utilize o Hub Admin para sincronizar a Squad.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {members.slice(0, 6).map(m => (
                        <div key={m.jiraAccountId} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50">
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                              {m.displayName.charAt(0)}
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">{m.displayName}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{m.role || 'Developer'}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[8px] font-bold shrink-0">{m.capacityHoursPerDay || 8}h/dia</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-amber-500" /> Meu Papel & Ações
                    </h4>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {userProfile?.name}
                    </p>
                    <p className="text-xs font-black text-primary uppercase tracking-wider mt-0.5">
                      {userProfile?.role || 'Membro'}
                    </p>
                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      Seu papel tem acesso direto aos dashboards analíticos e às cerimônias da squad.
                    </p>
                  </div>

                  <Button
                    onClick={() => router.push(role === 'Product Owner' ? '/squad/dashboards/product-owner' : role === 'Agile Master' ? '/squad/dashboards/agile-master' : role === 'People Lead' ? '/squad/dashboards/people-lead' : role === 'Tech Lead' ? '/squad/dashboards/tech-lead' : '/squad/dashboards/member')}
                    className="w-full mt-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-2xl h-10 text-xs font-black uppercase tracking-wider"
                  >
                    Abrir Meu Dashboard ({role || 'Dev'})
                  </Button>
                </Card>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ABA 1.5: QUADRO SCRUM (JIRA GREENHOPPER / RAPIDBOARD)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'board' && (
            <div className="animate-in fade-in duration-300">
              <SquadScrumBoard
                squadId={squadId}
                jiraProjectKey={config?.jiraProjectKey || projectKey || 'DDWMISSI'}
                rapidViewId={config?.rapidViewId || rapidViewId || 11360}
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
              ABA 2: SQUAD PULSE & QUADRO DA SPRINT (VISÃO COMPLETA)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'pulse' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header Banner Squad Pulse */}
              <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-none font-bold uppercase tracking-wider text-[9px] px-2.5 py-0.5">
                      SQUAD PULSE & QUADRO
                    </Badge>
                    <span className="text-xs text-slate-400 font-mono">
                      {displayRollup?.sprintName || config?.activeSprintId || squadId}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black italic tracking-tight uppercase font-headline text-slate-900 dark:text-white">
                    Métricas da Sprint Ativa & Quadro
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
                    Visão em tempo real de vazão, horas trabalhadas, itens parados e composição do escopo da sprint sincronizados com o Jira.
                  </p>
                </div>

                {displayRollup?.extraMetrics?.activeSprintStart && displayRollup?.extraMetrics?.activeSprintEnd && (
                  <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 px-4 py-2.5 rounded-2xl shrink-0 text-xs">
                    <CalendarRange className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Período da Sprint</p>
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
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                    Sincronização de Métricas Pendente
                  </p>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 max-w-md mb-4">
                    As métricas da sprint ativa ainda não foram carregadas para o squad <strong>{squadId}</strong>. Clique no botão abaixo para puxar as métricas e o quadro da sprint diretamente do Jira utilizando sua conexão/token.
                  </p>
                  <Button
                    onClick={() => handleSync(true)}
                    disabled={isSyncing}
                    className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black uppercase tracking-wider px-5 h-9 shadow-md"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Métricas Agora'}
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5 text-indigo-500" /> Quadro da sprint
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      {totalCount} issues no escopo
                    </span>
                  </div>
                  <div className="space-y-2">
                    {byStatusEntries.map(([status, count]) => (
                      <div key={status} className="flex items-center gap-2.5 text-[11px]">
                        <span className="w-36 truncate font-bold text-slate-600 dark:text-slate-300">{status}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${Math.round((count / maxStatusCount) * 100)}%` }} />
                        </div>
                        <span className="text-[9.5px] font-black text-slate-400 tabular-nums w-8 text-right shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Produtividade Diária */}
              {rollup && (
                <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Produtividade diária
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                      horas logadas por dia
                    </span>
                  </div>
                  {dailyDeltas.length === 0 ? (
                    <p className="text-[10.5px] font-medium text-slate-400">
                      Ainda sem histórico suficiente — aparece a partir do segundo dia com sincronização.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {dailyDeltas.map(d => (
                        <div key={d.date} className="flex items-center gap-2.5 text-[11px]">
                          <span className="w-16 shrink-0 font-bold text-slate-500 dark:text-slate-400 tabular-nums">{formatShortDate(d.date)}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.round((d.loggedDelta / 10) * 100)}%` }} />
                          </div>
                          <span className="text-[9.5px] font-black text-slate-400 tabular-nums w-16 text-right shrink-0">{d.loggedDelta.toFixed(1)}h</span>
                          <span className="text-[8.5px] font-bold text-slate-400 tabular-nums w-16 text-right shrink-0">{d.doneDelta} concl.</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* Roster de Membros */}
              <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
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
              ABA 3: DAILY COMMAND CENTER & TIMESHEET
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'daily' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Header Banner Daily Command Center */}
              <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-none font-bold uppercase tracking-wider text-[9px] px-2.5 py-0.5">
                      DAILY COMMAND CENTER
                    </Badge>
                    <span className="text-xs text-slate-400 font-mono">Foco & Produtividade</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black italic tracking-tight uppercase font-headline text-slate-900 dark:text-white">
                    Foco Diário, Timesheet & Relatório da Daily
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
                    Mural de produtividade individual: execute blocos de foco, sincronize lançamentos no Jira e monte seu status diário de forma automática.
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/50 px-4 py-2.5 rounded-2xl shrink-0 text-xs">
                  <Timer className="h-4 w-4 text-orange-500 shrink-0" />
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Data Selecionada</p>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {selectedDate.split('-').reverse().join('/')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-3 h-[540px]">
                  <FocusPlayer />
                </div>
                <div className="col-span-12 md:col-span-5 h-[540px]">
                  <DailyTimesheet />
                </div>
                <div className="col-span-12 md:col-span-4 h-[540px]">
                  <DailyReport />
                </div>
              </div>

              {/* Minhas Tarefas Ativas no Jira */}
              <Card className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-indigo-500" /> Minhas Tarefas Ativas ({assignedTasks.length})
                </h4>
                {assignedTasks.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma tarefa atribuída no momento nesta sprint.</p>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {assignedTasks.map(t => (
                      <div key={t.id || t.jiraKey} className="p-3.5 border rounded-2xl min-w-[240px] bg-slate-50 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-primary">{t.jiraKey}</span>
                            <Badge variant="outline" className="text-[8px] font-bold uppercase">{t.status || 'Ativa'}</Badge>
                          </div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">{t.title}</p>
                        </div>
                        {t.pointsEstimated && (
                          <span className="text-[9px] font-black text-slate-400 mt-3">{t.pointsEstimated} Story Points</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ABA 4: PERFORMANCE & HÁBITOS DE FOCO
             ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'performance' && (
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
                  placeholder="Ex: DDWMISSI"
                  className="rounded-xl h-9 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">Chave exata do projeto no Jira (ex: DDWMISSI).</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  JQL de Sincronização
                </label>
                <Input
                  value={jql}
                  onChange={e => setJql(e.target.value)}
                  placeholder='Ex: project = "DDWMISSI" AND sprint in openSprints()'
                  className="rounded-xl h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Filtro JQL para buscar os itens da sprint ativa.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block">
                    Token de Acesso Jira (PAT / API Token)
                  </label>
                  {jiraToken.trim() ? (
                    <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold px-1.5 py-0">
                      🟢 Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold px-1.5 py-0">
                      🔴 Não Informado
                    </Badge>
                  )}
                </div>
                <Input
                  type="password"
                  value={jiraToken}
                  onChange={e => setJiraToken(e.target.value)}
                  placeholder="Cole seu Personal Access Token (PAT) ou API Token do Jira..."
                  className="rounded-xl h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Seu token pessoal do Jira utilizado para realizar as consultas e sincronizações.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Domínio Jira (Opcional)
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
                    placeholder="11360"
                    className="rounded-xl h-9 text-xs font-mono"
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
