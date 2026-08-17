'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, RefreshCw, Settings2, Bug, ListChecks, TrendingUp, AlertTriangle,
  Users, Trophy, Gauge, ShieldAlert, CalendarRange, LayoutGrid, User, UserCog, ListTodo, LayoutDashboard, History
} from 'lucide-react';
import { ToolHubLayout } from '@/components/shared/ToolHubLayout';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useFirebase } from '@/firebase';
import { useUserContext } from '@/context/UserContext';
import { useSquadStore } from '@/store/useSquadStore';
import { SQUAD_ADMIN_ROLES, SQUAD_LEADERSHIP_VIEW_ROLES, SQUAD_PEOPLE_ADMIN_ROLES, type SquadMember } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Célula de prazo reutilizada nas duas tabelas (backlog nominal e minhas
// issues) — vermelho se já venceu, âmbar se vence em até 3 dias, neutro caso
// contrário. Sem prazo definido mostra travessão.
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

// Cada papel abre a tela com um foco diferente (matriz do plano do Squad
// Pulse) — isto só reordena/rotula o que já existe, não esconde nada além
// do que as rules já negam (isLeadership/isLeadershipViewer continuam sendo
// o gate de verdade).
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
          onClick={() => onSave(member.jiraAccountId, { displayName: member.displayName, capacityHoursPerDay: capacity })}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

export default function SquadPulsePage() {
  const { user, isUserLoading } = useFirebase();
  const { userProfile, isInitializing, requestIdentity } = useUserContext();
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
  const role = userProfile?.role as string | undefined;
  const isLeadership = !!role && (SQUAD_ADMIN_ROLES as string[]).includes(role);
  const isLeadershipViewer = !!role && (SQUAD_LEADERSHIP_VIEW_ROLES as string[]).includes(role);
  const isPeopleAdmin = !!role && (SQUAD_PEOPLE_ADMIN_ROLES as string[]).includes(role);
  const roleFocus = role ? ROLE_FOCUS[role] : undefined;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPeopleOpen, setIsPeopleOpen] = useState(false);
  const [projectKey, setProjectKey] = useState('');
  const [jql, setJql] = useState('');
  const [jiraDomain, setJiraDomain] = useState('');
  const [sprintFieldId, setSprintFieldId] = useState('');
  const [rankingEnabled, setRankingEnabled] = useState(false);
  const [capacityHours, setCapacityHours] = useState(6);

  useEffect(() => {
    document.title = `Squad Pulse | Espaço Ágil`;
  }, []);

  // Dado de squad é sensível (Jira do time inteiro) — ao contrário de outras
  // telas do app, essa não pode nem mostrar a casca pra quem não logou.
  // Mesmo padrão de gate usado no room/[id]/page.tsx: dispara o modal de
  // identidade global e mostra LoadingScreen enquanto isso.
  useEffect(() => {
    if (!isUserLoading && !user) {
      requestIdentity();
    }
  }, [isUserLoading, user, requestIdentity]);

  // Detecta troca de squad (ex: usuário muda squadId no perfil sem sair da
  // página) pra limpar dado do squad anterior antes de buscar o novo — senão
  // backlog/ranking de outro squad ficam visíveis sob o título do squad novo
  // até a resposta chegar.
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

  // Backlog nominal e ranking só existem pra quem tem role de liderança — a
  // regra do Firestore já nega pra quem não tem, isto só evita a chamada à
  // toa e o flash de "sem permissão" pra Dev/QA.
  useEffect(() => {
    if (squadId && squadId !== 'Sem Time' && isLeadershipViewer) {
      fetchSquadDetail(squadId);
    }
  }, [squadId, isLeadershipViewer, fetchSquadDetail]);

  // Roster é público a qualquer membro (não é dado sensível) — precisa pra
  // liberar o self-claim de "isso sou eu" na seção pessoal.
  useEffect(() => {
    if (user && squadId && squadId !== 'Sem Time') {
      fetchMembers(squadId, user.uid);
    }
  }, [user, squadId, fetchMembers]);

  useEffect(() => {
    if (squadId && myClaim?.jiraAccountId) {
      fetchMyIssues(squadId, myClaim.jiraAccountId);
    }
  }, [squadId, myClaim?.jiraAccountId, fetchMyIssues]);

  // "Produtividade diária" é agregado (mesma visibilidade do quadro da
  // sprint) — todo mundo busca, sem gate de papel.
  useEffect(() => {
    if (squadId && squadId !== 'Sem Time') {
      fetchDailySnapshots(squadId);
    }
  }, [squadId, fetchDailySnapshots]);

  useEffect(() => {
    if (config) {
      setProjectKey(config.jiraProjectKey || '');
      setJql(config.syncJql || `project = ${config.jiraProjectKey || ''} AND sprint in openSprints()`);
      setRankingEnabled(!!config.rankingEnabled);
      setCapacityHours(config.defaultDailyCapacityHours || 6);
      setJiraDomain(config.jiraDomain || '');
      setSprintFieldId(config.sprintFieldId || '');
    } else if (squadId) {
      setJql(`project = ${squadId} AND sprint in openSprints()`);
    }
  }, [config, squadId]);

  const handleSaveConfig = async () => {
    if (!squadId || !projectKey.trim() || !jql.trim()) return;
    try {
      await saveSquadConfig(squadId, {
        jiraProjectKey: projectKey,
        syncJql: jql,
        rankingEnabled,
        defaultDailyCapacityHours: capacityHours,
        jiraDomain: jiraDomain || undefined,
        sprintFieldId: sprintFieldId || undefined,
      });
      toast({ title: 'Configuração salva', description: 'Squad pronto para sincronizar com o Jira.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleSync = async (forceFull?: boolean) => {
    if (!user || !squadId) return;
    try {
      await syncSquad(user.uid, squadId, forceFull);
      if (isLeadershipViewer) fetchSquadDetail(squadId);
      fetchMembers(squadId, user.uid);
      fetchDailySnapshots(squadId);
      toast({ title: 'Sincronizado', description: 'Métricas do squad atualizadas a partir do Jira.' });
    } catch (err: any) {
      toast({ title: 'Erro ao sincronizar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleClaim = async (jiraAccountId: string) => {
    if (!user || !squadId) return;
    try {
      await claimMember(squadId, jiraAccountId, user.uid);
      toast({ title: 'Pronto', description: 'Agora suas issues aparecem aqui.' });
    } catch (err: any) {
      toast({ title: 'Erro ao vincular', description: err?.message || 'Tente novamente.', variant: 'destructive' });
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

  if (isUserLoading || !user) {
    return (
      <LoadingScreen
        message="Squad Pulse"
        submessage="Dashboard de produtividade de time integrado ao Jira — faça login pra continuar"
      />
    );
  }

  if (isInitializing) {
    return (
      <ToolHubLayout title="Squad Pulse" description="Dashboard de produtividade de time alimentado por Jira." icon={<Activity className="h-5 w-5" />} themeColor="indigo" tips={[]} onlyChildren={true}>
        <main className="flex-1 w-full p-4 md:p-5" />
      </ToolHubLayout>
    );
  }

  if (!squadId || squadId === 'Sem Time') {
    return (
      <ToolHubLayout title="Squad Pulse" description="Dashboard de produtividade de time alimentado por Jira." icon={<Activity className="h-5 w-5" />} themeColor="indigo" tips={[]} onlyChildren={true}>
        <main className="flex-1 w-full p-4 md:p-5 flex items-center justify-center">
          <div className="max-w-sm text-center bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Sem squad definido</p>
            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
              Defina seu squad no perfil para ver o Squad Pulse do seu time.
            </p>
          </div>
        </main>
      </ToolHubLayout>
    );
  }

  // Visualizando uma sprint passada (seletor no cabeçalho) troca a fonte de
  // rollup/backlog/minhas-issues por dado cacheado (sem chamada ao Jira).
  // Ranking/capacidade NÃO segue o seletor — reflete sempre a sprint ativa,
  // ver seção "Ranking & capacidade" mais abaixo.
  const displayRollup = viewingSprintId ? viewedRollup : rollup;
  const displayIssuesSnapshot = viewingSprintId ? viewedIssuesSnapshot : issuesSnapshot;
  const displayMyIssues = viewingSprintId ? viewedMyIssues : myIssues;

  const doneCount = displayRollup?.doneIssues ?? 0;
  const totalCount = displayRollup?.totalIssues ?? 0;
  const pctDone = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const openIssues = displayIssuesSnapshot.filter(i => i.statusCategory !== 'done');
  const topRanking = memberMetrics.filter(m => m.hoursLogged > 0 || m.issuesCompleted > 0).slice(0, 10);
  const maxHoursLogged = Math.max(1, ...topRanking.map(m => m.hoursLogged));
  // Fallback pra {} — rollups sincronizados antes desta versão não têm byStatus.
  const byStatusEntries = displayRollup ? Object.entries(displayRollup.byStatus || {}).sort((a, b) => b[1] - a[1]) : [];
  const maxStatusCount = Math.max(1, ...byStatusEntries.map(([, count]) => count));
  const unclaimedMembers = members.filter(m => !m.claimedByUid);
  const myOpenIssues = displayMyIssues.filter(i => i.statusCategory !== 'done');

  // Deltas dia-a-dia: dailySnapshots guarda valor CUMULATIVO por dia — a
  // "produtividade daquele dia" é a diferença pro dia anterior. Primeiro dia
  // da janela não tem "anterior" pra comparar, então não entra na lista.
  const dailyDeltas = dailySnapshots.slice(1).map((day, idx) => {
    const prev = dailySnapshots[idx];
    return {
      date: day.date,
      loggedDelta: Math.max(0, day.loggedHours - prev.loggedHours),
      doneDelta: Math.max(0, day.doneIssues - prev.doneIssues),
    };
  }).slice(-10);
  const maxLoggedDelta = Math.max(1, ...dailyDeltas.map(d => d.loggedDelta));

  const kpis = displayRollup ? [
    { key: 'done', label: 'Sprint concluída', value: `${pctDone}%`, sub: `${doneCount} de ${totalCount} issues`, icon: TrendingUp, tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
    { key: 'hours', label: 'Horas', value: `${Math.round(displayRollup.loggedHours)}h / ${Math.round(displayRollup.estimatedHours)}h`, sub: `${Math.round(displayRollup.remainingHours)}h restantes · logado/estimado`, icon: ListChecks, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { key: 'bugs', label: 'Proporção de bugs', value: `${Math.round(displayRollup.bugRatio * 100)}%`, sub: `${displayRollup.bugCount} bugs no escopo`, icon: Bug, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
    { key: 'stale', label: 'Itens parados', value: `${displayRollup.staleCount}`, sub: `> ${displayRollup.staleThresholdDays} dias sem mover · agregado`, icon: AlertTriangle, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    // Fallback 0 — rollups sincronizados antes desta versão não têm esses campos.
    { key: 'due', label: 'Prazos', value: `${displayRollup.overdueCount ?? 0}`, sub: `${displayRollup.dueSoonCount ?? 0} vencem em até ${displayRollup.dueSoonThresholdDays ?? 3}d · vencidos`, icon: CalendarRange, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  ] : [];
  // Reordena só o primeiro card — o resto mantém a ordem, é reordenação
  // leve (destaque), não uma tela reconstruída por papel.
  if (roleFocus && kpis.length > 0) {
    const idx = kpis.findIndex(k => k.key === roleFocus.firstKpi);
    if (idx > 0) kpis.unshift(kpis.splice(idx, 1)[0]);
  }

  return (
    <ToolHubLayout
      title="Squad Pulse"
      description={`Squad ${squadId}${role ? ` · visão de ${role}` : ''}`}
      icon={<Activity className="h-5 w-5" />}
      themeColor="indigo"
      tips={[]}
      onlyChildren={true}
      actions={
        <div className="flex items-center gap-2">
          {/* Seletor de sprint — só aparece quando há mais de uma sprint
              cacheada (a atual + pelo menos uma anterior). Trocar aqui é
              leitura de cache, sem chamada ao Jira. Gated assim pra squads
              que acabaram de ganhar esta versão não verem nada novo até a
              própria sprint rolar pela primeira vez. */}
          {(config?.sprintHistory?.length || 0) > 1 && (
            <Select
              value={viewingSprintId || '__live__'}
              onValueChange={v => selectSprint(squadId, v === '__live__' ? null : v, { isLeadershipViewer, myClaimedAssigneeId: myClaim?.jiraAccountId })}
            >
              <SelectTrigger className="h-8 w-auto text-[10px] font-bold gap-1.5">
                <History className="h-3 w-3 text-indigo-400 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__live__">Atual (ao vivo)</SelectItem>
                {[...(config?.sprintHistory || [])]
                  .filter(s => s.sprintId !== config?.activeSprintId)
                  .sort((a, b) => b.sprintStart.localeCompare(a.sprintStart))
                  .map(s => (
                    <SelectItem key={s.sprintId} value={s.sprintId}>
                      {s.sprintName || s.sprintId} · {s.state === 'closed' ? 'encerrada' : 'ativa'}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
          <span className="hidden md:inline text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
            Sync: {timeAgo(config?.lastSyncAt)}
            {config?.lastSyncStatus === 'error' && <span className="text-rose-500 ml-1">— falhou</span>}
          </span>
          {isLeadership && (
            <Button
              size="icon" variant="outline" className="h-8 w-8" onClick={() => handleSync()}
              disabled={!config || isSyncing || viewingSprintId !== null}
              title={viewingSprintId ? 'Volte para "Atual" pra sincronizar' : 'Sincronizar agora com o Jira'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {isPeopleAdmin && (
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setIsPeopleOpen(true)} title="Gestão de pessoas">
              <UserCog className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => router.push('/squad/panels')} title="Meus painéis">
            <LayoutDashboard className="h-3.5 w-3.5" />
          </Button>
          {isLeadership && (
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setIsSettingsOpen(true)} title="Configurações do squad">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      }
    >
      <main className="flex-1 w-full p-4 md:p-5 overflow-y-auto flex flex-col gap-4">

        {!isLoading && !rollup && (
          <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-8 shadow-sm text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
              Sem sincronização ainda
            </p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {isLeadership
                ? 'Abra as Configurações (ícone de engrenagem no topo) e clique em sincronizar.'
                : `Peça a um Tech Lead ou Scrum Master do squad ${squadId} para sincronizar com o Jira.`}
            </p>
          </Card>
        )}

        {displayRollup?.activeSprintName && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <CalendarRange className="h-3.5 w-3.5 text-indigo-400" />
            {displayRollup.activeSprintName}
            {displayRollup.activeSprintStart && displayRollup.activeSprintEnd && (
              <span>· {formatShortDate(displayRollup.activeSprintStart)} → {formatShortDate(displayRollup.activeSprintEnd)}</span>
            )}
            {!!displayRollup.sprintWorkdays && <span>· {displayRollup.sprintWorkdays} dias úteis</span>}
          </div>
        )}

        {/* Visualizando uma sprint encerrada — dado congelado no momento em
            que ela fechou. "Atualizar mesmo assim" cobre o caso de worklog
            lançado depois do fechamento (não mexe na sprint ativa). */}
        {viewingSprintId && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 rounded-xl px-3 py-2">
            <History className="h-3.5 w-3.5 shrink-0" />
            Visualizando sprint encerrada — dado congelado{displayRollup?.closedAt ? ` em ${formatShortDate(displayRollup.closedAt)}` : ''}, sem chamada ao Jira.
            {isLeadership && (
              <Button
                size="sm" variant="outline" className="h-6 text-[9px] ml-auto"
                disabled={isForceResyncingSprint}
                onClick={() => forceResyncSprint(firestore!, user!.uid, squadId, viewingSprintId)}
              >
                {isForceResyncingSprint ? 'Atualizando…' : 'Atualizar mesmo assim'}
              </Button>
            )}
          </div>
        )}

        {roleFocus && displayRollup && (
          <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400">
            <User className="h-3.5 w-3.5 shrink-0" />
            {roleFocus.tagline}
          </div>
        )}

        {displayRollup && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(k => (
              <Kpi key={k.key} label={k.label} value={k.value} sub={k.sub} icon={k.icon} tone={k.tone} />
            ))}
          </div>
        )}

        {/* Quadro da sprint por status — sem nome, visível a todo mundo (Dev/QA
            incluídos). issuesSnapshot tem assigneeName e é leadership-only nas
            rules; isto é o jeito seguro de dar a todo mundo uma visão de "onde
            as issues estão" sem tocar em dado nominal. */}
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

        {/* Produtividade diária — delta entre snapshots consecutivos (cada um
            cumulativo até aquele dia). Agregado, mesma visibilidade do quadro
            da sprint. Só aparece depois de pelo menos 2 dias de sync distintos
            — o primeiro dia não tem "anterior" pra calcular delta. */}
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
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${Math.round((d.loggedDelta / maxLoggedDelta) * 100)}%` }} />
                    </div>
                    <span className="text-[9.5px] font-black text-slate-400 tabular-nums w-16 text-right shrink-0">{d.loggedDelta.toFixed(1)}h</span>
                    <span className="text-[8.5px] font-bold text-slate-400 tabular-nums w-16 text-right shrink-0">{d.doneDelta} concl.</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Minhas issues — vem do Jira sincronizado, não do Daily Flow. Precisa
            de self-claim (roster) pra saber qual assignee do Jira é "eu". */}
        {displayRollup && (
          <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5 text-cyan-500" /> Minhas issues
              </span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                fonte: Jira
              </span>
            </div>

            {!myClaim ? (
              <div>
                <p className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 mb-2.5">
                  Qual dessas pessoas é você? Escolha pra ver suas próprias issues aqui, sem precisar lançar nada no Daily Flow.
                </p>
                {unclaimedMembers.length === 0 ? (
                  <p className="text-[10.5px] font-medium text-slate-400">
                    {members.length === 0 ? 'Sincronize o squad primeiro (peça a um Tech Lead/Scrum Master).' : 'Todo mundo do roster já foi vinculado — se for você, confira com um Tech Lead.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {unclaimedMembers.map(m => (
                      <button
                        key={m.jiraAccountId}
                        onClick={() => handleClaim(m.jiraAccountId)}
                        className="text-[10.5px] font-bold px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {m.displayName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : isLoadingMyIssues ? (
              <p className="text-[10.5px] font-medium text-slate-400">Carregando…</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <MiniStat label="Abertas" value={myOpenIssues.length} />
                  <MiniStat label="Em andamento" value={displayMyIssues.filter(i => i.statusCategory === 'indeterminate').length} />
                  <MiniStat label="Horas restantes" value={`${(myOpenIssues.reduce((s, i) => s + i.remainingSec, 0) / 3600).toFixed(1)}h`} />
                </div>
                {myOpenIssues.length === 0 ? (
                  <p className="text-[10.5px] font-medium text-slate-400">Nenhuma issue aberta atribuída a você no escopo sincronizado.</p>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-[8.5px] uppercase tracking-wider text-slate-400">
                          <th className="text-left font-black px-1 py-1">Issue</th>
                          <th className="text-left font-black px-1 py-1">Pai</th>
                          <th className="text-left font-black px-1 py-1">Status</th>
                          <th className="text-left font-black px-1 py-1">Prazo</th>
                          <th className="text-right font-black px-1 py-1">Restante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myOpenIssues.map(issue => (
                          <tr key={issue.key} className="border-t border-slate-100 dark:border-slate-800/40">
                            <td className="px-1 py-1.5 font-mono text-indigo-600 dark:text-indigo-400">{issue.key}</td>
                            <td className="px-1 py-1.5 text-slate-500 dark:text-slate-400 truncate max-w-[10rem]">
                              {issue.parentKey ? <span><span className="font-mono text-cyan-600 dark:text-cyan-400">{issue.parentKey}</span> {issue.parentTitle}</span> : '—'}
                            </td>
                            <td className="px-1 py-1.5 text-slate-500 dark:text-slate-400">{issue.status}</td>
                            <td className="px-1 py-1.5"><DueCell dueDate={issue.dueDate} /></td>
                            <td className="px-1 py-1.5 text-right font-bold tabular-nums">{(issue.remainingSec / 3600).toFixed(1)}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {isLeadershipViewer && rollup && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-500" /> Backlog da equipe
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800/80">
                  visível a liderança
                </span>
              </div>
              {isLoadingDetail ? (
                <p className="text-[10.5px] font-medium text-slate-400">Carregando…</p>
              ) : openIssues.length === 0 ? (
                <p className="text-[10.5px] font-medium text-slate-400">Nenhum item aberto no escopo sincronizado.</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-[8.5px] uppercase tracking-wider text-slate-400">
                        <th className="text-left font-black px-1 py-1">Issue</th>
                        <th className="text-left font-black px-1 py-1">Pai</th>
                        <th className="text-left font-black px-1 py-1">Responsável</th>
                        <th className="text-left font-black px-1 py-1">Status</th>
                        <th className="text-left font-black px-1 py-1">Prazo</th>
                        <th className="text-right font-black px-1 py-1">Restante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openIssues.map(issue => (
                        <tr key={issue.key} className="border-t border-slate-100 dark:border-slate-800/40">
                          <td className="px-1 py-1.5 font-mono text-indigo-600 dark:text-indigo-400">{issue.key}</td>
                          <td className="px-1 py-1.5 text-slate-500 dark:text-slate-400 truncate max-w-[10rem]">
                            {issue.parentKey ? <span><span className="font-mono text-cyan-600 dark:text-cyan-400">{issue.parentKey}</span> {issue.parentTitle}</span> : '—'}
                          </td>
                          <td className="px-1 py-1.5 text-slate-600 dark:text-slate-300">{issue.assigneeName || '—'}</td>
                          <td className="px-1 py-1.5 text-slate-500 dark:text-slate-400">{issue.status}</td>
                          <td className="px-1 py-1.5"><DueCell dueDate={issue.dueDate} /></td>
                          <td className="px-1 py-1.5 text-right font-bold tabular-nums">{(issue.remainingSec / 3600).toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" /> Ranking &amp; capacidade
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-800/80">
                  sinal, não avaliação
                </span>
              </div>
              {config?.rankingEnabled && (
                <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 mb-3">
                  Atualizado {timeAgo(config?.lastSyncAt || rollup?.computedAt)}
                  {viewingSprintId && ' · sempre mostra a sprint atual, mesmo visualizando outra sprint'}
                </p>
              )}
              {isLoadingDetail ? (
                <p className="text-[10.5px] font-medium text-slate-400 mt-3">Carregando…</p>
              ) : !config?.rankingEnabled ? (
                <div className="flex flex-col items-center justify-center py-6 text-center gap-1.5">
                  <ShieldAlert className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                  <p className="text-[10.5px] font-medium text-slate-400">
                    Desligado por padrão. {isLeadership ? 'Ative nas Configurações se o squad topar.' : 'Peça a um Tech Lead/Scrum Master pra ativar, se o squad topar.'}
                  </p>
                </div>
              ) : topRanking.length === 0 ? (
                <p className="text-[10.5px] font-medium text-slate-400">Sem dado ainda — sincronize com ranking ativo.</p>
              ) : (
                <div className="space-y-2.5">
                  {topRanking.map((m, idx) => (
                    <div key={m.assigneeId} className="flex items-center gap-2.5 text-[11px]">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9.5px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="w-24 truncate font-bold text-slate-700 dark:text-slate-300">{m.assigneeName}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${Math.round((m.hoursLogged / maxHoursLogged) * 100)}%` }} />
                      </div>
                      <span className="text-[9.5px] font-black text-slate-400 tabular-nums w-14 text-right shrink-0">
                        {m.hoursLogged.toFixed(1)}h
                      </span>
                      <span className="text-[9px] font-bold tabular-nums w-16 text-right shrink-0 flex items-center gap-1 justify-end" title="Utilização de capacidade">
                        <Gauge className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                        {Math.round(m.utilizationPct * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4 text-indigo-500" /> Configuração do squad
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">Projeto Jira</label>
              <Input value={projectKey} onChange={e => setProjectKey(e.target.value)} placeholder="Ex: MISSI" className="h-9 text-[12px]" />
            </div>
            <div>
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">JQL de sincronização</label>
              <Input value={jql} onChange={e => setJql(e.target.value)} placeholder="project = MISSI AND sprint in openSprints()" className="h-9 text-[12px] font-mono" />
            </div>
            <div>
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                Domínio Jira (opcional — só necessário pro sync agendado)
              </label>
              <Input value={jiraDomain} onChange={e => setJiraDomain(e.target.value)} placeholder="empresa.atlassian.net" className="h-9 text-[12px]" />
            </div>
            <div>
              <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                Campo Sprint (opcional — dias úteis reais na capacidade)
              </label>
              <Input value={sprintFieldId} onChange={e => setSprintFieldId(e.target.value)} placeholder="Ex: customfield_10005" className="h-9 text-[12px] font-mono" />
            </div>
          </div>

          <div className="mt-2 p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox checked={rankingEnabled} onCheckedChange={v => setRankingEnabled(!!v)} className="mt-0.5" />
              <span>
                <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" /> Ativar ranking de produtividade
                </span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1 block leading-relaxed">
                  Desligado por padrão. Quando ativo, o sync passa a buscar hora lançada por pessoa e calcular
                  horas por membro — visível só a Product Owner, Tech Lead, Scrum Master, People Lead e
                  Agile Master, nunca a Dev/QA nem como leaderboard público. Sinal de acompanhamento, não avaliação.
                </span>
              </span>
            </label>
            {rankingEnabled && (
              <div className="mt-3 flex items-center gap-2 pl-6">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Capacidade padrão do squad (h/dia)</label>
                <Input type="number" min={1} max={12} value={capacityHours} onChange={e => setCapacityHours(Number(e.target.value) || 6)} className="h-7 w-16 text-[11px]" />
              </div>
            )}
            <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-2 pl-6">
              Capacidade individual (quando diferente do padrão) fica em Gestão de pessoas — ícone ao lado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button size="sm" onClick={handleSaveConfig} className="h-9 text-[10px] font-black uppercase tracking-wider">
              Salvar configuração
            </Button>
            <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Última sync: {timeAgo(config?.lastSyncAt)}
            </span>
            <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Última reconciliação completa: {timeAgo(config?.lastFullReconcileAt)}
            </span>
            <Button
              size="sm" variant="outline" className="h-9 text-[10px] font-black uppercase tracking-wider"
              onClick={() => handleSync(true)} disabled={!config || isSyncing}
              title="Ignora o cache incremental e refaz a sync completa contra o Jira agora"
            >
              Forçar reconciliação completa
            </Button>
          </div>
          {syncError && (
            <p className="text-[10.5px] font-semibold text-rose-500 mt-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {syncError}
            </p>
          )}
          <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
            Sync manual usa seu Personal Access Token pessoal do Jira (Configurações) e traz só a sprint ativa.
            Sync agendado (sem depender de alguém clicar) é infraestrutura à parte — ver functions/src/squadSync.ts.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={isPeopleOpen} onOpenChange={setIsPeopleOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-indigo-500" /> Gestão de pessoas
            </DialogTitle>
          </DialogHeader>
          <p className="text-[10px] font-medium text-slate-400 mb-2">
            Capacidade individual (h/dia), usada no cálculo de utilização do ranking — cada pessoa tem um número
            diferente. Auto-preenchido com a capacidade padrão a cada sync; ajuste quem precisar.
          </p>
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-[10.5px] font-medium text-slate-400">Sincronize o squad primeiro — o roster nasce das issues encontradas.</p>
            ) : (
              members.map(m => (
                <MemberCapacityRow key={m.jiraAccountId} member={m} onSave={handleSaveCapacity} />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ToolHubLayout>
  );
}
