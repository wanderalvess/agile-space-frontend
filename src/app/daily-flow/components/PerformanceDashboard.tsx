'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, Flame, PieChart as ChartIcon, ChevronDown, ChevronUp, Calendar, FileText, 
  CheckCircle2, TrendingUp, Layers, Sparkles, Filter, ShieldCheck
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useDailyStore } from '@/store/useDailyStore';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

export default function PerformanceDashboard() {
  const { weeklyWorklogs, dailyReports } = useDailyStore();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'semana' | 'quinzena' | 'mes'>('semana');
  const [typeFilter, setTypeFilter] = useState<'todas' | 'jira' | 'manual'>('todas');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  // Helper to get local date string (YYYY-MM-DD) avoiding UTC shifts
  const getLocalDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  // 1. Calculate dates and date strings
  const today = new Date();
  const todayStr = getLocalDateStr(today);

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

  // Helper to generate dates for past N days
  const getPastDates = (n: number) => {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(getLocalDateStr(d));
    }
    return dates;
  };

  // 2. Use only real worklogs. If Firestore has no data yet, the dashboard
  // shows an explicit empty state below instead of fabricating fake worklogs.
  const getBaseLogs = () => {
    return weeklyWorklogs && weeklyWorklogs.length > 0 ? weeklyWorklogs : [];
  };

  const allLogs = getBaseLogs();
  const hasRealData = isMounted && allLogs.length > 0;

  // 3. Apply Filters
  const filteredLogs = allLogs.filter(w => {
    // Period filter
    if (periodFilter === 'hoje') {
      if (w.date !== todayStr) return false;
    } else if (periodFilter === 'semana') {
      if (!weekDates.includes(w.date)) return false;
    } else if (periodFilter === 'quinzena') {
      const dates15 = getPastDates(15);
      if (!dates15.includes(w.date)) return false;
    } else if (periodFilter === 'mes') {
      const dates30 = getPastDates(30);
      if (!dates30.includes(w.date)) return false;
    }

    // Type filter
    if (typeFilter === 'jira' && !w.isJira) return false;
    if (typeFilter === 'manual' && w.isJira) return false;

    return true;
  });

  // 4. Bar Chart Data calculation (Hours by Day)
  // Determine date keys to show based on period filter
  let periodDates: { key: string; label: string }[] = [];
  if (periodFilter === 'hoje') {
    periodDates = [{ key: todayStr, label: 'Hoje' }];
  } else if (periodFilter === 'semana') {
    periodDates = weekDates.map((d, i) => ({ key: d, label: daysLabels[i] }));
  } else if (periodFilter === 'quinzena') {
    periodDates = getPastDates(15).map(d => {
      const p = d.split('-');
      return { key: d, label: `${p[2]}/${p[1]}` };
    });
  } else {
    periodDates = getPastDates(30).filter((_, idx) => idx % 3 === 0).map(d => {
      const p = d.split('-');
      return { key: d, label: `${p[2]}/${p[1]}` };
    });
  }

  const chartData = periodDates.map(pd => {
    const dayLogs = filteredLogs.filter(w => w.date === pd.key);
    const focadoMinutes = dayLogs.filter(w => !w.isJira).reduce((sum, w) => sum + w.durationMinutes, 0);
    const jiraMinutes = dayLogs.filter(w => w.isJira).reduce((sum, w) => sum + w.durationMinutes, 0);
    return {
      name: pd.label,
      focado: parseFloat((focadoMinutes / 60).toFixed(1)),
      jira: parseFloat((jiraMinutes / 60).toFixed(1))
    };
  });

  // 5. Category Donut Chart
  const getCategory = (title: string) => {
    const t = (title || '').toLowerCase();
    if (t.includes('bug') || t.includes('fix') || t.includes('hotfix') || t.includes('erro') || t.includes('correção')) {
      return 'Bugs';
    }
    if (t.includes('reunião') || t.includes('daily') || t.includes('meeting') || t.includes('alinhamento') || t.includes('planning') || t.includes('showcase') || t.includes('sprint')) {
      return 'Reuniões';
    }
    if (t.includes('infra') || t.includes('setup') || t.includes('config') || t.includes('deploy') || t.includes('ci/cd') || t.includes('build') || t.includes('apoio')) {
      return 'Infraestrutura';
    }
    return 'Desenvolvimento';
  };

  const totalMinutesFiltered = filteredLogs.reduce((sum, w) => sum + w.durationMinutes, 0);
  const categoriesMap: Record<string, number> = {
    'Bugs': 0,
    'Desenvolvimento': 0,
    'Reuniões': 0,
    'Infraestrutura': 0
  };

  filteredLogs.forEach(w => {
    const cat = getCategory(w.title);
    categoriesMap[cat] += w.durationMinutes;
  });

  const colorsMap: Record<string, string> = {
    'Bugs': '#6366f1', // Indigo
    'Desenvolvimento': '#06b6d4', // Cyan
    'Reuniões': '#10b981', // Emerald
    'Infraestrutura': '#64748b' // Slate
  };

  const categoryData = Object.keys(categoriesMap).map(name => {
    const min = categoriesMap[name];
    const pct = totalMinutesFiltered > 0 ? Math.round((min / totalMinutesFiltered) * 100) : 0;
    return {
      name,
      value: pct,
      color: colorsMap[name]
    };
  }).filter(c => c.value > 0);

  const finalCategoryData = categoryData.length > 0 ? categoryData : [
    { name: 'Nenhum dado', value: 100, color: '#e2e8f0' }
  ];

  // 6. Upgraded KPIs Calculations

  // KPI 1: Hoje
  const todayLogs = allLogs.filter(w => w.date === todayStr);
  const todayMinutes = todayLogs.reduce((sum, w) => sum + w.durationMinutes, 0);
  const todayHours = (todayMinutes / 60).toFixed(1);
  const todayMetaPercent = Math.min(100, Math.round((todayMinutes / 480) * 100)); // Meta de 8h (480m)

  // KPI 2: Período Filtrado / Horas Totais
  const totalFilteredHours = (totalMinutesFiltered / 60).toFixed(1);

  // KPI 3: Categoria mais trabalhada
  let topCategory = 'N/A';
  let topCategoryPct = 0;
  categoryData.forEach(c => {
    if (c.value > topCategoryPct) {
      topCategoryPct = c.value;
      topCategory = c.name;
    }
  });

  // KPI 4: Streak (Dias batendo a meta de 4 horas = 240 minutos)
  // Let's count streak for the last 15 working days
  let streak = 0;
  const streakDates = getPastDates(15);
  streakDates.forEach(dateStr => {
    const dayOfWeek = new Date(dateStr).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return;
    const dayLogs = allLogs.filter(w => w.date === dateStr);
    const dayMin = dayLogs.reduce((sum, w) => sum + w.durationMinutes, 0);
    if (dayMin >= 240) {
      streak++;
    }
  });

  // Report Date Formatter for lateral history feed
  const formatReportDay = (dateStr: string) => {
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Hoje';
    if (dateStr === yesterdayStr) return 'Ontem';

    try {
      const parts = dateStr.split('-');
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
      return dayName.charAt(0).toUpperCase() + dayName.slice(1);
    } catch (_) {
      return dateStr;
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 overflow-y-auto no-scrollbar pb-6 animate-in fade-in duration-300">
      
      {/* PASSO 1: Barra de Filtros (Topo) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/40 rounded-2xl p-3 shadow-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Parâmetros Analíticos</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mr-1">Período:</span>
            <Select 
              value={periodFilter} 
              onValueChange={(val: any) => setPeriodFilter(val)}
            >
              <SelectTrigger className="w-36 h-8 text-[9px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                <SelectItem value="hoje" className="text-[9px] font-black uppercase tracking-wider">Hoje</SelectItem>
                <SelectItem value="semana" className="text-[9px] font-black uppercase tracking-wider">Esta Semana</SelectItem>
                <SelectItem value="quinzena" className="text-[9px] font-black uppercase tracking-wider">Últimos 15 dias</SelectItem>
                <SelectItem value="mes" className="text-[9px] font-black uppercase tracking-wider">Este Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider mr-1">Origem:</span>
            <Select 
              value={typeFilter} 
              onValueChange={(val: any) => setTypeFilter(val)}
            >
              <SelectTrigger className="w-36 h-8 text-[9px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-indigo-500">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl">
                <SelectItem value="todas" className="text-[9px] font-black uppercase tracking-wider">Todas as Tarefas</SelectItem>
                <SelectItem value="jira" className="text-[9px] font-black uppercase tracking-wider">Apenas Jira</SelectItem>
                <SelectItem value="manual" className="text-[9px] font-black uppercase tracking-wider">Apenas Manuais</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!hasRealData ? (
        /* Empty state: no fabricated data — the user genuinely has no worklogs yet */
        <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-12 shadow-sm flex flex-col items-center justify-center text-center gap-3 shrink-0">
          <div className="p-3 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-2xl">
            <ChartIcon className="h-6 w-6 text-indigo-500" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Sem dados ainda</p>
          <p className="text-[9.5px] font-semibold text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
            Comece registrando seu tempo em Daily Flow para ver suas métricas de produtividade aqui.
          </p>
        </div>
      ) : (
      <>
      {/* PASSO 2: Upgrade nos KPIs (Grid-cols-4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        
        {/* KPI 1: Hoje */}
        <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Hoje</span>
            <div className="p-2 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300 shrink-0">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 mb-1.5">
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none font-headline">
              {isMounted ? todayHours : '0.0'}h
            </p>
          </div>
          <div className="mt-2">
            <div className="flex justify-between items-center text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1.5">
              <span>Meta Diária (8h)</span>
              <span>{isMounted ? todayMetaPercent : 0}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                style={{ width: `${isMounted ? todayMetaPercent : 0}%` }} 
                className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500" 
              />
            </div>
          </div>
        </div>

        {/* KPI 2: Tempo Total */}
        <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Tempo Total</span>
            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-400/10 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300 shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 mb-1.5">
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none font-headline">
              {isMounted ? totalFilteredHours : '0.0'}h
            </p>
          </div>
        </div>

        {/* KPI 3: Foco Principal */}
        <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Foco Principal</span>
            <div className="p-2 bg-cyan-500/10 dark:bg-cyan-400/10 rounded-xl text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform duration-300 shrink-0">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 mb-1.5 min-w-0">
            <p className="text-lg font-black text-slate-900 dark:text-white leading-none font-headline truncate pr-1">
              {isMounted && topCategoryPct > 0 ? topCategory : 'N/A'}
            </p>
          </div>
          <div className="mt-2">
            <span className="inline-block text-[8px] font-bold text-cyan-600 dark:text-cyan-400 uppercase bg-cyan-50 dark:bg-cyan-950/20 px-2 py-0.5 rounded-lg">
              {isMounted && topCategoryPct > 0 ? `${topCategoryPct}% do tempo alocado` : 'Sem registros no período'}
            </span>
          </div>
        </div>

        {/* KPI 4: Ofensiva (Streak) */}
        <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ofensiva (Streak)</span>
            <div className="p-2 bg-rose-500/10 dark:bg-rose-400/10 rounded-xl text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-300 shrink-0">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 mb-1.5">
            <p className="text-2xl font-black text-slate-900 dark:text-white leading-none font-headline">
              {isMounted ? streak : 0} Dias
            </p>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Batendo meta diária (4h)
            </span>
          </div>
        </div>
      </div>

      {/* PASSO 3: Multi-Dashboards (Grid de Gráficos) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
        
        {/* Coluna 1 e 2 (col-span-2): A Tendência */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-4.5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/50 pb-2">
            <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-indigo-500 animate-pulse" /> Tendência de Produtividade (h)
            </span>
            <span className="text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase">Horas por Período</span>
          </div>

          <div className="h-[210px] w-full text-[9px] font-bold">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800/30" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={8.5} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={8.5} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)', 
                      borderRadius: '12px',
                      fontSize: '9px',
                      color: '#f8fafc',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }} 
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={24} 
                    iconSize={6}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '8px', fontWeight: 'black', textTransform: 'uppercase' }} 
                  />
                  <Bar name="Foco Local" dataKey="focado" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={22} />
                  <Bar name="Lançado Jira" dataKey="jira" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>

        {/* Coluna 3 (col-span-1): A Distribuição (PieChart) */}
        <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-4.5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/50 pb-2">
            <span className="text-[9.5px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-cyan-500" /> Distribuição por Categoria
            </span>
            <span className="text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase">Tempo em %</span>
          </div>

          <div className="h-[140px] w-full flex items-center justify-center">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={finalCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={58}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {finalCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#e2e8f0'} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `${value}%`}
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)', 
                      borderRadius: '12px',
                      fontSize: '9px',
                      color: '#f8fafc',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 pt-2 border-t border-slate-50 dark:border-slate-800/40">
            {isMounted && categoryData.length > 0 ? (
              categoryData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase leading-none">
                    {entry.name}: {entry.value}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[8px] font-black text-slate-400 uppercase">Sem registros no período</div>
            )}
          </div>
        </div>

      </div>
      </>
      )}

      {/* PASSO 4: Histórico Lateral ou Compacto (Densidade Alta) */}
      <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-4.5 shadow-md shrink-0">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800/50">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-emerald-500" /> Registro Histórico de Dailies
          </span>
          <span className="text-[7.5px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
            Logs de Sincronização
          </span>
        </div>

        <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar pr-0.5">
          {!isMounted || dailyReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-slate-400 dark:text-slate-500 gap-1">
              <FileText className="h-6 w-6 opacity-30 animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Nenhum relatório de status registrado.</span>
            </div>
          ) : (
            dailyReports.map((item, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <div 
                  key={idx} 
                  className="border border-slate-100 dark:border-slate-800/30 rounded-xl overflow-hidden transition-all bg-white/50 dark:bg-slate-950/10"
                >
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[9px] font-black text-slate-800 dark:text-slate-200">{formatReportDay(item.date)}</span>
                        <span className="text-[7.5px] font-semibold text-slate-400 block tracking-wider mt-0.5">{item.date}</span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-2.5 pb-2 pt-1 border-t border-slate-50 dark:border-slate-800/10 space-y-1.5 text-[8.5px] text-slate-600 dark:text-slate-400 animate-in fade-in duration-200">
                      <div>
                        <h5 className="font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest text-[7.5px] mb-0.5">Realizado:</h5>
                        <p className="whitespace-pre-line leading-relaxed pl-1.5 border-l-2 border-slate-100 dark:border-slate-800">
                          {item.yesterday}
                        </p>
                      </div>

                      <div>
                        <h5 className="font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest text-[7.5px] mb-0.5">Planejado:</h5>
                        <p className="whitespace-pre-line leading-relaxed pl-1.5 border-l-2 border-slate-100 dark:border-slate-800">
                          {item.today}
                        </p>
                      </div>

                      {item.blockers && item.blockers !== 'Nenhum' && (
                        <div>
                          <h5 className="font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest text-[7.5px] mb-0.5 flex items-center gap-0.5">
                            ⚠️ Impedimento:
                          </h5>
                          <p className="leading-relaxed pl-1.5 border-l-2 border-rose-100 dark:border-rose-950/20 text-rose-600 dark:text-rose-400 font-semibold">
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
      </div>
      
    </div>
  );
}
