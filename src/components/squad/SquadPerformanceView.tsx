'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock, Flame, PieChart as ChartIcon, Calendar,
  CheckCircle2, TrendingUp, Layers, Sparkles, Filter, ShieldCheck, Gauge, Users,
  Target, Zap, Activity, ArrowUpRight, Award, UserCheck, CheckSquare,
  Bug, Code2, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import { useSquadStore } from '@/store/useSquadStore';
import { WidgetCard } from '@/components/ui/WidgetCard';
import { RetroHistoryPanel } from '@/components/retro/RetroHistoryPanel';
import { KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { isWeekend } from '@/lib/date-utils';
import { useUserContext } from '@/context/UserContext';
import { SQUAD_LEADERSHIP_VIEW_ROLES } from '@/lib/types';
import { dailyDeltas, isDoneIssue, percentOf, workTypeBreakdown } from '@/lib/squad-metrics';

// Mínimo de horas registradas pelo time em um dia útil para o dia contar na "meta de ritmo".
const DAILY_HOURS_TARGET = 4;

export function SquadPerformanceView() {
  const {
    rollup,
    dailySnapshots,
    members,
    memberMetrics,
    issuesSnapshot,
    viewingSprintId,
    viewedRollup,
    viewedIssuesSnapshot,
    config,
    activeSquadId
  } = useSquadStore();

  // Horas e carga por pessoa são dado nominal: só a liderança vê (o servidor também recusa as horas por pessoa).
  const { userProfile } = useUserContext();
  const role = userProfile?.role as string | undefined;
  const canSeePeople = !!role && (SQUAD_LEADERSHIP_VIEW_ROLES as string[]).includes(role);

  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'semana' | 'quinzena' | 'mes'>('semana');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeRollup = viewingSprintId ? viewedRollup : rollup;
  const activeIssues = viewingSprintId ? viewedIssuesSnapshot : issuesSnapshot;

  // Helper local date YYYY-MM-DD
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  const today = new Date();
  const todayStr = getLocalDateStr(today);

  // Períodos de data
  const currentDay = today.getDay();
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + distanceToMonday);

  const daysLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const weekDates = daysLabels.map((_, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    return getLocalDateStr(d);
  });

  const getPastDates = (n: number) => {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(getLocalDateStr(d));
    }
    return dates;
  };

  // Dados para gráfico de tendência diária (Daily Snapshots da Squad, via Jira sync)
  const chartData = useMemo(() => {
    let dateKeys: { key: string; label: string }[] = [];
    if (periodFilter === 'hoje') {
      dateKeys = [{ key: todayStr, label: 'Hoje' }];
    } else if (periodFilter === 'semana') {
      dateKeys = weekDates.map((d, i) => ({ key: d, label: daysLabels[i] }));
    } else if (periodFilter === 'quinzena') {
      dateKeys = getPastDates(15).map(d => {
        const p = d.split('-');
        return { key: d, label: `${p[2]}/${p[1]}` };
      });
    } else {
      dateKeys = getPastDates(30).filter((_, idx) => idx % 3 === 0).map(d => {
        const p = d.split('-');
        return { key: d, label: `${p[2]}/${p[1]}` };
      });
    }

    // loggedSec e doneIssues do snapshot são acumulados da sprint; o do dia é a diferença para o snapshot anterior.
    // Dia sem snapshot fica sem valor (não vira "0 horas").
    const deltas = dailyDeltas(dailySnapshots);
    return dateKeys.map(pd => {
      const d = deltas.get(pd.key);
      return {
        name: pd.label,
        totalHoras: d ? parseFloat(d.loggedHours.toFixed(1)) : null,
        entregas: d ? d.done : null
      };
    });
  }, [periodFilter, dailySnapshots, todayStr, weekDates]);

  // Composição do escopo por tipo de issue (contagem real). Antes eram "minutos" inventados por tipo (60/30) e as
  // categorias "Reuniões / Rituais" e "Infra & Setup" nunca tinham dado.
  const categoryData = useMemo(() => {
    const colors: Record<string, string> = {
      'Histórias e demais': '#6366f1',
      'Subtarefas': '#06b6d4',
      'Bugs': '#f43f5e',
    };
    const breakdown = workTypeBreakdown(activeIssues);
    const total = breakdown.reduce((sum, b) => sum + b.count, 0);
    return breakdown.map(b => ({ name: b.name, value: percentOf(b.count, total) ?? 0, count: b.count, color: colors[b.name] || '#94a3b8' }));
  }, [activeIssues]);

  // Cálculos de KPI Principais
  // Capacidade do time por dia: só soma quem tem horas por dia cadastradas. null = não dá para calcular.
  const squadTotalCapacityHours = useMemo(() => {
    const withHours = (members || []).filter(m => (m.capacityHoursPerDay ?? 0) > 0);
    if (withHours.length === 0) return null;
    return withHours.reduce((sum, m) => sum + (m.capacityHoursPerDay as number), 0);
  }, [members]);

  // Capacidade da sprint = horas/dia do time × dias úteis da sprint (e não × 5, que era a semana).
  const sprintWorkdays = activeRollup?.workdaysTotal || 0;
  const sprintCapacityHours = squadTotalCapacityHours !== null && sprintWorkdays > 0 ? squadTotalCapacityHours * sprintWorkdays : null;

  const loggedHoursTotal = useMemo(() => {
    return activeRollup ? ((activeRollup.loggedTotalSec ?? 0) / 3600).toFixed(1) : '—';
  }, [activeRollup]);

  const estimatedHoursTotal = useMemo(() => {
    return activeRollup ? ((activeRollup.estimateTotalSec ?? 0) / 3600).toFixed(0) : '—';
  }, [activeRollup]);

  const remainingHoursTotal = useMemo(() => {
    return activeRollup ? ((activeRollup.remainingTotalSec ?? 0) / 3600).toFixed(0) : '—';
  }, [activeRollup]);

  const throughputPercentage = useMemo(() => {
    if (!activeRollup) return null;
    return percentOf(activeRollup.doneIssues, activeRollup.totalIssues);
  }, [activeRollup]);

  // Dias úteis dos últimos 15 em que o time registrou DAILY_HOURS_TARGET h ou mais. Usa as horas do DIA (diferença entre
  // snapshots); antes comparava o acumulado da sprint e quase todo dia contava. new Date('YYYY-MM-DD') é UTC e
  // escorregava o dia da semana no Brasil, então o fim de semana é checado em data local.
  const streakDays = useMemo(() => {
    const deltas = dailyDeltas(dailySnapshots);
    let count = 0;
    getPastDates(15).forEach(dStr => {
      const [y, mo, da] = dStr.split('-').map(Number);
      if (isWeekend(new Date(y, mo - 1, da))) return;
      const d = deltas.get(dStr);
      if (d && d.loggedHours >= DAILY_HOURS_TARGET) count++;
    });
    return count;
  }, [dailySnapshots]);

  // Lista formatada de Membros da Squad
  const squadMemberList = useMemo(() => {
    if (!members || members.length === 0) {
      // Se não houver roster populado, agrupa por assignee do issuesSnapshot
      const assigneesMap = new Map<string, { name: string; total: number; done: number; loggedSec: number }>();
      activeIssues.forEach(iss => {
        const name = iss.assigneeName || 'Não Atribuído';
        const curr = assigneesMap.get(name) || { name, total: 0, done: 0, loggedSec: 0 };
        curr.total += 1;
        if (isDoneIssue(iss)) {
          curr.done += 1;
        }
        curr.loggedSec += iss.loggedSec || 0;
        assigneesMap.set(name, curr);
      });

      return Array.from(assigneesMap.values()).map(item => ({
        jiraAccountId: item.name,
        displayName: item.name,
        role: 'Membro',
        capacityHoursPerDay: 0,
        doneIssues: item.done,
        totalIssues: item.total,
        loggedHours: (item.loggedSec / 3600).toFixed(1),
        progress: item.total > 0 ? Math.round((item.done / item.total) * 100) : 0
      }));
    }

    return members.map(m => {
      const metric = memberMetrics.find(mm => mm.assigneeId === m.jiraAccountId);
      const myItems = activeIssues.filter(iss => iss.assigneeId === m.jiraAccountId || iss.assigneeName === m.displayName);
      const doneCount = myItems.filter(isDoneIssue).length;
      const totalCount = myItems.length;
      const loggedHours = metric?.hoursLogged != null
        ? metric.hoursLogged.toFixed(1)
        : (myItems.reduce((sum, i) => sum + (i.loggedSec || 0), 0) / 3600).toFixed(1);
      const metricTotalCount = (metric?.issuesCompleted || 0) + (metric?.issuesInProgress || 0);
      const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : (metric?.issuesCompleted ? 100 : 0);

      return {
        jiraAccountId: m.jiraAccountId,
        displayName: m.displayName || 'Membro',
        role: m.role || 'Desenvolvedor',
        capacityHoursPerDay: m.capacityHoursPerDay || 0,
        doneIssues: doneCount || metric?.issuesCompleted || 0,
        totalIssues: totalCount || metricTotalCount || 0,
        loggedHours,
        progress
      };
    });
  }, [members, memberMetrics, activeIssues]);

  const filteredMemberList = useMemo(() => {
    if (!canSeePeople) return [];
    if (selectedMember === 'all') return squadMemberList;
    return squadMemberList.filter(m => m.jiraAccountId === selectedMember || m.displayName === selectedMember);
  }, [squadMemberList, selectedMember, canSeePeople]);

  if (!isMounted) return null;

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 pb-8">

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER BANNER DA Desempenho
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 md:p-6 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 font-semibold text-xs px-2.5 py-0.5">
              <Activity className="h-3 w-3 mr-1 inline" /> Desempenho
            </Badge>
            <span className="text-xs text-slate-400 font-code font-medium">Métricas do Time</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-headline">
            Desempenho do time
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium max-w-2xl leading-relaxed">
            Horas registradas, itens concluídos e a carga de cada pessoa no período escolhido.
          </p>
        </div>

        {/* Filtros em Linha */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Período */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-400">Período:</span>
            <Select value={periodFilter} onValueChange={(val: any) => setPeriodFilter(val)}>
              <SelectTrigger className="w-36 h-8 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                <SelectItem value="hoje" className="text-xs font-semibold">Hoje</SelectItem>
                <SelectItem value="semana" className="text-xs font-semibold">Esta semana</SelectItem>
                <SelectItem value="quinzena" className="text-xs font-semibold">Últimos 15 dias</SelectItem>
                <SelectItem value="mes" className="text-xs font-semibold">Este mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Integrante */}
          {canSeePeople && squadMemberList.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Pessoa:</span>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="w-40 h-8 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500">
                  <SelectValue placeholder="Integrante" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                  <SelectItem value="all" className="text-xs font-semibold">Todo o time</SelectItem>
                  {squadMemberList.map(m => (
                    <SelectItem key={m.jiraAccountId} value={m.jiraAccountId} className="text-xs font-bold">
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CARDS DE KPI DA SQUAD (4 COLUNAS PADRONIZADAS)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* KPI 1: Horas Logadas */}
        <WidgetCard className="hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Horas registradas</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="my-1">
            <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-headline">
              {loggedHoursTotal}h
            </span>
          </div>
          <div className="mt-3">
            {sprintCapacityHours === null ? (
              <p className="text-xs font-medium text-slate-400">
                Para comparar com a capacidade, cadastre as horas por dia de cada pessoa em Pessoas do time e sincronize a sprint.
              </p>
            ) : (
              <>
                <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
                  <span>Capacidade da sprint ({squadTotalCapacityHours}h/dia × {sprintWorkdays} dias úteis)</span>
                  <span>{percentOf(parseFloat(loggedHoursTotal), sprintCapacityHours) ?? 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${percentOf(parseFloat(loggedHoursTotal), sprintCapacityHours) ?? 0}%` }}
                    className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                  />
                </div>
              </>
            )}
          </div>
        </WidgetCard>

        {/* KPI 2: Taxa de Entrega / Throughput */}
        <WidgetCard className="hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Itens concluídos</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-2">
            <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-headline">
              {activeRollup ? activeRollup.doneIssues ?? 0 : '—'}
            </span>
            <span className="text-xs text-slate-400 font-bold">{activeRollup ? `/ ${activeRollup.totalIssues ?? 0} issues` : 'sem dados desta squad ainda'}</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold">
              {throughputPercentage === null ? 'Sem escopo ainda' : `${throughputPercentage}% Concluído`}
            </Badge>
            <span className="text-xs font-medium text-slate-400">em relação ao escopo</span>
          </div>
        </WidgetCard>

        {/* KPI 3: Estimativa vs Executado */}
        <WidgetCard className="hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Estimado e restante</span>
            <div className="p-2 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 rounded-xl">
              <Gauge className="h-4 w-4" />
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-headline">
              {estimatedHoursTotal}h
            </span>
            <span className="text-xs text-slate-400 font-bold">estimadas</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Resta: <strong className="text-slate-900 dark:text-white">{remainingHoursTotal}h</strong></span>
            <span className="text-cyan-600 dark:text-cyan-400">Logado: {loggedHoursTotal}h</span>
          </div>
        </WidgetCard>

        {/* KPI 4: Streak & Ritmo Diário */}
        <WidgetCard className="hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Dias úteis com {DAILY_HOURS_TARGET} h ou mais registradas</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-headline">
              {streakDays}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">de 15 dias</span>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs font-bold text-slate-400">
              Soma de horas do time no dia, últimos 15 dias
            </span>
          </div>
        </WidgetCard>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PAINÉIS DE GRÁFICOS DA SQUAD (TENDÊNCIA & CATEGORIAS)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Gráfico 1: Tendência Diária de Produtividade (2 colunas) */}
        <WidgetCard title="Horas e entregas por dia" className="lg:col-span-2">
          {dailySnapshots.length < 2 && (
            <p className="text-xs text-slate-400 font-medium">O gráfico aparece a partir do segundo dia com sincronização: ele mostra o que foi registrado em cada dia.</p>
          )}
          <div className="h-[230px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '14px',
                    fontSize: '10px',
                    color: 'hsl(var(--card-foreground))',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconSize={7}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
                />
                <Bar yAxisId="left" name="Horas registradas no dia" dataKey="totalHoras" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={18} />
                <Line yAxisId="right" name="Itens concluídos no dia" type="monotone" dataKey="entregas" connectNulls={false} stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>

        {/* Gráfico 2: Distribuição por Tipo / Categoria (1 coluna) */}
        <WidgetCard title="Composição do escopo (por tipo de issue)" className="lg:col-span-1 flex flex-col justify-between">
          {categoryData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sem dados desta squad ainda.</p>
          ) : (
          <>
          <div className="h-[160px] w-full flex items-center justify-center my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || 'hsl(var(--muted))'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${value}%`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '10px',
                    color: 'hsl(var(--card-foreground))'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legenda com Badges */}
          <div className="flex flex-wrap justify-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/60">
            {categoryData.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {entry.name}: <strong>{entry.count}</strong> ({entry.value}%)
                </span>
              </div>
            ))}
          </div>
          </>
          )}
        </WidgetCard>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DESEMPENHO E ALOCAÇÃO DOS INTEGRANTES DA SQUAD
         ═══════════════════════════════════════════════════════════════════ */}
      {canSeePeople ? (
      <WidgetCard
        title="Carga de cada pessoa"
        headerIcon={<Users className="h-4 w-4 text-indigo-500" />}
      >
        {filteredMemberList.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs font-medium">
            Nenhum integrante encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-1">
            {filteredMemberList.map(m => (
              <div
                key={m.jiraAccountId}
                className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col justify-between hover:border-indigo-500/30 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs border border-indigo-200 dark:border-indigo-800/60">
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                          {m.displayName}
                        </h4>
                        <span className="text-xs text-slate-400 font-medium block">
                          {m.role}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-xs font-semibold px-2 py-0.5",
                      m.progress >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300" :
                      m.progress >= 40 ? "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300" :
                      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                    )}>
                      {m.progress}% Concluído
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                      <span className="text-xs text-slate-400 font-bold block">Issues</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{m.doneIssues} / {m.totalIssues}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                      <span className="text-xs text-slate-400 font-bold block">Horas</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{m.loggedHours}h</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
                    <span>Progresso de Entregas</span>
                    <span>{m.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${m.progress}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        m.progress >= 70 ? "bg-emerald-500" : m.progress >= 40 ? "bg-indigo-500" : "bg-amber-500"
                      )}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </WidgetCard>
      ) : (
        <WidgetCard title="Carga de cada pessoa" headerIcon={<Users className="h-4 w-4 text-indigo-500" />}>
          <p className="py-6 text-center text-sm text-slate-400">A carga e as horas por pessoa são vistas só pela liderança da squad.</p>
        </WidgetCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          HISTÓRICO DE RETROSPECTIVAS — tendência de check-in e follow-through
          de ações entre sprints da squad
         ═══════════════════════════════════════════════════════════════════ */}
      <RetroHistoryPanel squadId={activeSquadId} />

    </div>
  );
}

export default SquadPerformanceView;
