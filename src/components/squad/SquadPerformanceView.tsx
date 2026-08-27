'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Flame, PieChart as ChartIcon, ChevronDown, ChevronUp, Calendar, FileText, 
  CheckCircle2, TrendingUp, Layers, Sparkles, Filter, ShieldCheck, Gauge, Users,
  Target, AlertTriangle, Zap, Activity, ArrowUpRight, Award, UserCheck, CheckSquare,
  Bug, Code2, RefreshCw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts';
import { useSquadStore } from '@/store/useSquadStore';
import { useDailyStore } from '@/store/useDailyStore';
import { WidgetCard } from '@/components/ui/WidgetCard';
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
    config
  } = useSquadStore();

  const { weeklyWorklogs, dailyReports } = useDailyStore();

  const [expandedReportIdx, setExpandedReportIdx] = useState<number | null>(0);
  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'semana' | 'quinzena' | 'mes'>('semana');
  const [typeFilter, setTypeFilter] = useState<'todas' | 'jira' | 'manual'>('todas');
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

  // Worklogs combinados
  const baseWorklogs = useMemo(() => {
    return weeklyWorklogs && weeklyWorklogs.length > 0 ? weeklyWorklogs : [];
  }, [weeklyWorklogs]);

  // Filtragem de worklogs
  const filteredWorklogs = useMemo(() => {
    return baseWorklogs.filter(w => {
      if (periodFilter === 'hoje' && w.date !== todayStr) return false;
      if (periodFilter === 'semana' && !weekDates.includes(w.date)) return false;
      if (periodFilter === 'quinzena' && !getPastDates(15).includes(w.date)) return false;
      if (periodFilter === 'mes' && !getPastDates(30).includes(w.date)) return false;

      if (typeFilter === 'jira' && !w.isJira) return false;
      if (typeFilter === 'manual' && w.isJira) return false;

      return true;
    });
  }, [baseWorklogs, periodFilter, typeFilter, todayStr, weekDates]);

  // Dados para gráfico de tendência diária (Daily Snapshots ou Worklogs)
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

    return dateKeys.map(pd => {
      // Buscar do dailySnapshots da Squad se existir
      const snap = dailySnapshots.find(s => s.snapshotDate === pd.key);
      const dayLogs = filteredWorklogs.filter(w => w.date === pd.key);

      const focadoMinutes = dayLogs.filter(w => !w.isJira).reduce((sum, w) => sum + w.durationMinutes, 0);
      const jiraMinutes = dayLogs.filter(w => w.isJira).reduce((sum, w) => sum + w.durationMinutes, 0);
      
      const snapLoggedHours = snap ? parseFloat((snap.loggedSec / 3600).toFixed(1)) : 0;
      const totalLoggedHours = snapLoggedHours > 0 
        ? snapLoggedHours 
        : parseFloat(((focadoMinutes + jiraMinutes) / 60).toFixed(1));

      const doneItems = snap ? snap.doneIssues : (jiraMinutes > 0 ? 1 : 0);

      return {
        name: pd.label,
        focado: parseFloat((focadoMinutes / 60).toFixed(1)),
        jira: parseFloat((jiraMinutes / 60).toFixed(1)),
        totalHoras: totalLoggedHours,
        entregas: doneItems
      };
    });
  }, [periodFilter, dailySnapshots, filteredWorklogs, todayStr, weekDates]);

  // Donut de Categorias de Trabalho
  const getCategory = (title: string) => {
    const t = (title || '').toLowerCase();
    if (t.includes('bug') || t.includes('fix') || t.includes('hotfix') || t.includes('erro') || t.includes('correção')) {
      return 'Bugs';
    }
    if (t.includes('reunião') || t.includes('daily') || t.includes('meeting') || t.includes('alinhamento') || t.includes('planning') || t.includes('showcase') || t.includes('sprint')) {
      return 'Reuniões / Rituais';
    }
    if (t.includes('infra') || t.includes('setup') || t.includes('config') || t.includes('deploy') || t.includes('ci/cd') || t.includes('build') || t.includes('apoio')) {
      return 'Infra & Setup';
    }
    return 'Desenvolvimento';
  };

  const categoryData = useMemo(() => {
    const catMap: Record<string, number> = {
      'Desenvolvimento': 0,
      'Bugs': 0,
      'Reuniões / Rituais': 0,
      'Infra & Setup': 0
    };

    if (filteredWorklogs.length > 0) {
      filteredWorklogs.forEach(w => {
        const cat = getCategory(w.title);
        catMap[cat] = (catMap[cat] || 0) + w.durationMinutes;
      });
    } else if (activeIssues.length > 0) {
      activeIssues.forEach(iss => {
        const typeStr = (iss.type || '').toLowerCase();
        if (typeStr.includes('bug')) catMap['Bugs'] += 60;
        else if (typeStr.includes('subtask') || typeStr.includes('sub-tarefa')) catMap['Desenvolvimento'] += 30;
        else catMap['Desenvolvimento'] += 60;
      });
    }

    const colors: Record<string, string> = {
      'Desenvolvimento': '#6366f1', // Indigo
      'Bugs': '#f43f5e',            // Rose
      'Reuniões / Rituais': '#10b981',// Emerald
      'Infra & Setup': '#06b6d4'    // Cyan
    };

    const currentTotal = Object.values(catMap).reduce((a, b) => a + b, 0);
    const list = Object.keys(catMap).map(name => {
      const min = catMap[name];
      const pct = currentTotal > 0 ? Math.round((min / currentTotal) * 100) : 0;
      return {
        name,
        value: pct,
        color: colors[name] || '#94a3b8'
      };
    }).filter(c => c.value > 0);

    return list.length > 0 ? list : [{ name: 'Sem registros', value: 100, color: 'hsl(var(--muted))' }];
  }, [filteredWorklogs, activeIssues]);

  // Cálculos de KPI Principais
  const squadTotalCapacityHours = useMemo(() => {
    if (!members || members.length === 0) return 40; // Fallback 40h por pessoa/squad
    return members.reduce((sum, m) => sum + (m.capacityHoursPerDay || 8), 0);
  }, [members]);

  const loggedHoursTotal = useMemo(() => {
    if (activeRollup?.loggedTotalSec) {
      return (activeRollup.loggedTotalSec / 3600).toFixed(1);
    }
    const mins = filteredWorklogs.reduce((sum, w) => sum + w.durationMinutes, 0);
    return (mins / 60).toFixed(1);
  }, [activeRollup, filteredWorklogs]);

  const estimatedHoursTotal = useMemo(() => {
    return activeRollup?.estimateTotalSec ? (activeRollup.estimateTotalSec / 3600).toFixed(0) : '0';
  }, [activeRollup]);

  const remainingHoursTotal = useMemo(() => {
    return activeRollup?.remainingTotalSec ? (activeRollup.remainingTotalSec / 3600).toFixed(0) : '0';
  }, [activeRollup]);

  const throughputPercentage = useMemo(() => {
    if (!activeRollup || activeRollup.totalIssues === 0) return 0;
    return Math.round((activeRollup.doneIssues / activeRollup.totalIssues) * 100);
  }, [activeRollup]);

  // Streak de Dias Batendo Meta (4h+)
  const streakDays = useMemo(() => {
    let count = 0;
    const dates15 = getPastDates(15);
    dates15.forEach(dStr => {
      const dObj = new Date(dStr);
      if (dObj.getDay() === 0 || dObj.getDay() === 6) return;
      
      const snap = dailySnapshots.find(s => s.snapshotDate === dStr);
      if (snap && snap.loggedSec >= 14400) {
        count++;
      } else {
        const dayLogs = baseWorklogs.filter(w => w.date === dStr);
        const dayMin = dayLogs.reduce((sum, w) => sum + w.durationMinutes, 0);
        if (dayMin >= 240) count++;
      }
    });
    return count;
  }, [dailySnapshots, baseWorklogs]);

  // Lista formatada de Membros da Squad
  const squadMemberList = useMemo(() => {
    if (!members || members.length === 0) {
      // Se não houver roster populado, agrupa por assignee do issuesSnapshot
      const assigneesMap = new Map<string, { name: string; total: number; done: number; loggedSec: number }>();
      activeIssues.forEach(iss => {
        const name = iss.assigneeName || 'Não Atribuído';
        const curr = assigneesMap.get(name) || { name, total: 0, done: 0, loggedSec: 0 };
        curr.total += 1;
        if (iss.status?.toLowerCase().includes('done') || iss.status?.toLowerCase().includes('concluído')) {
          curr.done += 1;
        }
        curr.loggedSec += iss.loggedSec || 0;
        assigneesMap.set(name, curr);
      });

      return Array.from(assigneesMap.values()).map(item => ({
        jiraAccountId: item.name,
        displayName: item.name,
        role: 'Membro',
        capacityHoursPerDay: 8,
        doneIssues: item.done,
        totalIssues: item.total,
        loggedHours: (item.loggedSec / 3600).toFixed(1),
        progress: item.total > 0 ? Math.round((item.done / item.total) * 100) : 0
      }));
    }

    return members.map(m => {
      const metric = memberMetrics.find(mm => mm.assigneeId === m.jiraAccountId);
      const myItems = activeIssues.filter(iss => iss.assigneeId === m.jiraAccountId || iss.assigneeName === m.displayName);
      const doneCount = myItems.filter(iss => iss.status?.toLowerCase().includes('done') || iss.status?.toLowerCase().includes('concluído')).length;
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
        capacityHoursPerDay: m.capacityHoursPerDay || 8,
        doneIssues: doneCount || metric?.issuesCompleted || 0,
        totalIssues: totalCount || metricTotalCount || 0,
        loggedHours,
        progress
      };
    });
  }, [members, memberMetrics, activeIssues]);

  const filteredMemberList = useMemo(() => {
    if (selectedMember === 'all') return squadMemberList;
    return squadMemberList.filter(m => m.jiraAccountId === selectedMember || m.displayName === selectedMember);
  }, [squadMemberList, selectedMember]);

  const formatReportDay = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr === todayStr) return 'Hoje';
    try {
      const parts = dateStr.split('-');
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
      return dayName.charAt(0).toUpperCase() + dayName.slice(1);
    } catch (_) {
      return dateStr;
    }
  };

  if (!isMounted) return null;

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 pb-8">
      
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER BANNER DA PERFORMANCE DA SQUAD
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-5 md:p-6 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 font-extrabold text-[9px] px-2.5 py-0.5 uppercase tracking-wider">
              <Activity className="h-3 w-3 mr-1 inline" /> PERFORMANCE DA SQUAD
            </Badge>
            <span className="text-xs text-slate-400 font-mono font-medium">Métricas do Time</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase font-headline">
            Produtividade, Velocidade & Alocação
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium max-w-2xl leading-relaxed">
            Painel unificado de throughput, capacidade de integrantes, distribuição de demandas e histórico diário de entregas da squad.
          </p>
        </div>

        {/* Filtros em Linha */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Período */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Período:</span>
            <Select value={periodFilter} onValueChange={(val: any) => setPeriodFilter(val)}>
              <SelectTrigger className="w-36 h-8 text-[9.5px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                <SelectItem value="hoje" className="text-[9.5px] font-black uppercase">Hoje</SelectItem>
                <SelectItem value="semana" className="text-[9.5px] font-black uppercase">Esta Semana</SelectItem>
                <SelectItem value="quinzena" className="text-[9.5px] font-black uppercase">Últimos 15 dias</SelectItem>
                <SelectItem value="mes" className="text-[9.5px] font-black uppercase">Este Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Integrante */}
          {squadMemberList.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Membro:</span>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="w-40 h-8 text-[9.5px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500">
                  <SelectValue placeholder="Integrante" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                  <SelectItem value="all" className="text-[9.5px] font-black uppercase">Toda a Squad</SelectItem>
                  {squadMemberList.map(m => (
                    <SelectItem key={m.jiraAccountId} value={m.jiraAccountId} className="text-[9.5px] font-bold">
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Origem */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Origem:</span>
            <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
              <SelectTrigger className="w-36 h-8 text-[9.5px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                <SelectItem value="todas" className="text-[9.5px] font-black uppercase">Todas Demandas</SelectItem>
                <SelectItem value="jira" className="text-[9.5px] font-black uppercase">Apenas Jira</SelectItem>
                <SelectItem value="manual" className="text-[9.5px] font-black uppercase">Apenas Manuais</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CARDS DE KPI DA SQUAD (4 COLUNAS PADRONIZADAS)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Horas Logadas */}
        <WidgetCard className="hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tempo Investido</span>
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
            <div className="flex justify-between items-center text-[8.5px] font-bold text-slate-400 uppercase mb-1">
              <span>Capacidade Squad ({squadTotalCapacityHours}h/dia)</span>
              <span>{Math.min(100, Math.round((parseFloat(loggedHoursTotal) / (squadTotalCapacityHours * 5)) * 100))}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                style={{ width: `${Math.min(100, Math.round((parseFloat(loggedHoursTotal) / (squadTotalCapacityHours * 5)) * 100))}%` }} 
                className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500" 
              />
            </div>
          </div>
        </WidgetCard>

        {/* KPI 2: Taxa de Entrega / Throughput */}
        <WidgetCard className="hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entregas (Done)</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-2">
            <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-headline">
              {activeRollup?.doneIssues ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-bold">/ {activeRollup?.totalIssues ?? 0} issues</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-bold">
              {throughputPercentage}% Concluído
            </Badge>
            <span className="text-[8.5px] font-medium text-slate-400">em relação ao escopo</span>
          </div>
        </WidgetCard>

        {/* KPI 3: Estimativa vs Executado */}
        <WidgetCard className="hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimado vs Restante</span>
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
          <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400">
            <span>Resta: <strong className="text-slate-900 dark:text-white">{remainingHoursTotal}h</strong></span>
            <span className="text-cyan-600 dark:text-cyan-400">Logado: {loggedHoursTotal}h</span>
          </div>
        </WidgetCard>

        {/* KPI 4: Streak & Ritmo Diário */}
        <WidgetCard className="hover:border-rose-500/40 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ofensiva de Foco</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="my-1 flex items-baseline gap-1.5">
            <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-headline">
              {streakDays}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">Dias Úteis</span>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider">
              Acima da meta diária de foco
            </span>
          </div>
        </WidgetCard>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PAINÉIS DE GRÁFICOS DA SQUAD (TENDÊNCIA & CATEGORIAS)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Gráfico 1: Tendência Diária de Produtividade (2 colunas) */}
        <WidgetCard title="Tendência Diária de Produtividade & Entregas" className="lg:col-span-2">
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
                  wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} 
                />
                <Bar yAxisId="left" name="Horas Foco" dataKey="focado" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar yAxisId="left" name="Horas Jira" dataKey="jira" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={18} />
                <Line yAxisId="right" name="Entregas (Done)" type="monotone" dataKey="entregas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>

        {/* Gráfico 2: Distribuição por Tipo / Categoria (1 coluna) */}
        <WidgetCard title="Distribuição por Categoria de Trabalho" className="lg:col-span-1 flex flex-col justify-between">
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
                <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                  {entry.name}: <strong>{entry.value}%</strong>
                </span>
              </div>
            ))}
          </div>
        </WidgetCard>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DESEMPENHO E ALOCAÇÃO DOS INTEGRANTES DA SQUAD
         ═══════════════════════════════════════════════════════════════════ */}
      <WidgetCard 
        title="Alocação & Produtividade dos Integrantes" 
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
                        <span className="text-[9px] text-slate-400 font-medium block uppercase tracking-wider">
                          {m.role}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[8.5px] font-black uppercase px-2 py-0.5",
                      m.progress >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300" :
                      m.progress >= 40 ? "bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300" :
                      "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                    )}>
                      {m.progress}% Concluído
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 my-3 text-[10px]">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                      <span className="text-[8.5px] text-slate-400 font-bold uppercase block">Issues</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{m.doneIssues} / {m.totalIssues}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                      <span className="text-[8.5px] text-slate-400 font-bold uppercase block">Logado</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">{m.loggedHours}h</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase mb-1">
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

      {/* ═══════════════════════════════════════════════════════════════════
          HISTÓRICO DE DAILIES E SINCRONIZAÇÕES
         ═══════════════════════════════════════════════════════════════════ */}
      <WidgetCard 
        title="Histórico de Rituais Diários & Sincronizações" 
        headerIcon={<FileText className="h-4 w-4 text-emerald-500" />}
      >
        <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar pr-1 mt-1">
          {dailyReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-1.5">
              <FileText className="h-6 w-6 opacity-30 animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-wider">Nenhum relatório diário registrado nesta squad.</span>
            </div>
          ) : (
            dailyReports.map((item, idx) => {
              const isExpanded = expandedReportIdx === idx;
              return (
                <div 
                  key={idx} 
                  className="border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden transition-all bg-slate-50/50 dark:bg-slate-950/20"
                >
                  <button
                    onClick={() => setExpandedReportIdx(isExpanded ? null : idx)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{formatReportDay(item.date)}</span>
                        <span className="text-[9px] font-medium text-slate-400 block tracking-wider">{item.date}</span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/40 space-y-2 text-xs text-slate-600 dark:text-slate-400 animate-in fade-in duration-200">
                      <div>
                        <h5 className="font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest text-[8px] mb-0.5">Realizado:</h5>
                        <p className="whitespace-pre-line leading-relaxed pl-2 border-l-2 border-indigo-500/30 text-[10px]">
                          {item.yesterday}
                        </p>
                      </div>

                      <div>
                        <h5 className="font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest text-[8px] mb-0.5">Planejado:</h5>
                        <p className="whitespace-pre-line leading-relaxed pl-2 border-l-2 border-cyan-500/30 text-[10px]">
                          {item.today}
                        </p>
                      </div>

                      {item.blockers && item.blockers !== 'Nenhum' && (
                        <div>
                          <h5 className="font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest text-[8px] mb-0.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 inline" /> Impedimento:
                          </h5>
                          <p className="leading-relaxed pl-2 border-l-2 border-rose-500/40 text-rose-600 dark:text-rose-400 font-semibold text-[10px]">
                            {item.blockers}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </WidgetCard>

    </div>
  );
}

export default SquadPerformanceView;
