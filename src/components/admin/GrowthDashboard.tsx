'use client';

import React, { useState, useEffect } from 'react';
import { adminApi } from '@/app/admin/api';
import {
  TrendingUp,
  Users,
  Rocket,
  Target,
  BarChart3,
  Zap,
  Globe,
  LayoutDashboard,
  WalletCards,
  CalendarRange,
  HeartPulse,
  Lightbulb,
  UsersRound,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AgileSpinner } from '../ui/AgileSpinner';

interface Stats {
  users: number;
  rooms: number;
  retros: number;
  plannings: number;
  health: number;
  brainstorming: number;
  checkins: number;
  feedbacks: number;
  sessions: number;
  participations: number;
  loading: boolean;
}

export function GrowthDashboard() {
  const [stats, setStats] = useState<Stats>({
    users: 0,
    rooms: 0,
    retros: 0,
    plannings: 0,
    health: 0,
    brainstorming: 0,
    checkins: 0,
    feedbacks: 0,
    sessions: 0,
    participations: 0,
    loading: true
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const data = await adminApi.getStats();
        if (cancelled) return;

        setStats({
          users: data.totalUsers,
          rooms: data.totalPokerRooms,
          retros: data.totalRetroBoards,
          plannings: data.totalSprintPlannings,
          health: data.totalHealthCheckBoards,
          brainstorming: data.totalBrainstormingBoards,
          checkins: data.totalDailyCheckins,
          feedbacks: data.totalFeedbacks,
          sessions: data.totalSessions,
          participations: data.totalParticipations,
          loading: false
        });
      } catch (e: any) {
        console.warn("GrowthDashboard: Error loading stats:", e);
        if (!cancelled) {
          setError(e.message || 'Erro ao carregar estatísticas');
          setStats(prev => ({ ...prev, loading: false }));
        }
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  if (stats.loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <AgileSpinner size="lg" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Compilando Métricas de Crescimento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-2xl text-center space-y-2">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">Não foi possível carregar as estatísticas de administração.</p>
        <p className="text-xs text-red-500/80">{error}</p>
      </div>
    );
  }

  const moduleMetrics = [
    { label: 'Scrum Poker', count: stats.rooms, icon: WalletCards, color: 'bg-blue-500' },
    { label: 'Retrospectivas', count: stats.retros, icon: LayoutDashboard, color: 'bg-orange-500' },
    { label: 'Sprint Planner', count: stats.plannings, icon: CalendarRange, color: 'bg-indigo-500' },
    { label: 'Brainstorming', count: stats.brainstorming, icon: Lightbulb, color: 'bg-amber-500' },
    { label: 'Health Check', count: stats.health, icon: HeartPulse, color: 'bg-emerald-500' },
    { label: 'Daily Flow', count: stats.checkins, icon: Zap, color: 'bg-indigo-400' },
  ].sort((a, b) => b.count - a.count);

  const totalInteractions = stats.rooms + stats.retros + stats.plannings + stats.brainstorming + stats.health + stats.checkins;

  return (
    <div className="space-y-10">
      {/* Resumo de Tração */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <MetricHighlight 
          title="Total de Interações" 
          value={totalInteractions} 
          subtitle="Ações registradas na plataforma" 
          icon={<Rocket className="h-6 w-6" />}
          color="from-primary to-indigo-600"
        />
        <MetricHighlight
          title="Taxa de Feedback"
          value={(stats.users > 0 ? (stats.feedbacks / stats.users) * 100 : 0).toFixed(1) + '%'}
          subtitle="Conversão de engajamento"
          icon={<Target className="h-6 w-6" />}
          color="from-emerald-500 to-teal-600"
        />
        <MetricHighlight
          title="Média por Usuário"
          value={(stats.users > 0 ? totalInteractions / stats.users : 0).toFixed(1)}
          subtitle="Sessões por perfil ativo"
          icon={<BarChart3 className="h-6 w-6" />}
          color="from-amber-500 to-orange-600"
        />
      </div>

      {/* Uso do Sistema — visão executiva (sessões, participantes, tempo de uso) */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <h2 className="text-xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Uso do Sistema</h2>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Visão executiva</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <MetricHighlight
            title="Total de Sessões"
            value={stats.sessions}
            subtitle="Cerimônias em grupo realizadas"
            icon={<CalendarRange className="h-6 w-6" />}
            color="from-blue-500 to-indigo-600"
          />
          <MetricHighlight
            title="Total de Participações"
            value={stats.participations}
            subtitle="Somatório de participantes por sessão*"
            icon={<UsersRound className="h-6 w-6" />}
            color="from-emerald-500 to-teal-600"
          />
          <div className="rounded-[3rem] bg-slate-50 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 flex items-center gap-8">
            <div className="w-16 h-16 rounded-[1.5rem] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black italic tracking-tighter text-slate-400 leading-none">Em breve</p>
              <div className="mt-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tempo de Uso</p>
                <p className="text-[9px] font-bold text-slate-400/80 uppercase tracking-widest">Duração de sessão ainda não instrumentada</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">
          * Retrospectivas ainda não rastreiam participantes — não entram nesse total.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
         {/* Ranking de Módulos */}
         <Card className="border-slate-200/60 rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <CardHeader className="p-10 border-b border-slate-50 flex items-center gap-4">
               <div className="p-3 bg-blue-50 rounded-2xl"><TrendingUp className="h-6 w-6 text-blue-600" /></div>
               <div>
                  <CardTitle className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Adoção por Módulo</CardTitle>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Ranking de utilização real</p>
               </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
               {moduleMetrics.map((m, idx) => (
                  <div key={m.label} className="space-y-4">
                     <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-3">
                           <span className="text-slate-300">#0{idx + 1}</span>
                           <m.icon className={cn("h-4 w-4", m.color.replace('bg-', 'text-'))} />
                           <span className="text-slate-700">{m.label}</span>
                        </div>
                        <span className="text-slate-400">{m.count} SESSÕES</span>
                     </div>
                     <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-[2px]">
                        <motion.div 
                          initial={{ width: 0 }} 
                          animate={{ width: `${(m.count / Math.max(...moduleMetrics.map(x => x.count))) * 100}%` }}
                          className={cn("h-full rounded-full shadow-lg", m.color)} 
                        />
                     </div>
                  </div>
               ))}
            </CardContent>
         </Card>

         {/* Insights de Governança */}
         <div className="space-y-10">
            <Card className="border-slate-200/60 rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
               <CardHeader className="p-10 border-b border-slate-50 flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl"><Globe className="h-6 w-6 text-emerald-600" /></div>
                  <div>
                     <CardTitle className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Densidade de Dados</CardTitle>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Status global do ecossistema</p>
                  </div>
               </CardHeader>
               <CardContent className="p-10 grid grid-cols-2 gap-8">
                  <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center gap-4">
                     <Users className="h-8 w-8 text-primary" />
                     <div>
                        <p className="text-4xl font-black italic tracking-tighter text-slate-900 leading-none">{stats.users}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2">Usuários Totais</p>
                     </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center gap-4">
                     <TrendingUp className="h-8 w-8 text-emerald-500" />
                     <div>
                        <p className="text-4xl font-black italic tracking-tighter text-slate-900 leading-none">{stats.feedbacks}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2">Feedbacks Coletados</p>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <div className="bg-primary/5 border-2 border-dashed border-primary/20 rounded-[3rem] p-10 flex flex-col items-center text-center gap-6">
               <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center text-white shadow-xl shadow-primary/20">
                  <Zap className="h-8 w-8" />
               </div>
               <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tighter italic font-headline text-slate-900 leading-none">Próximo Marco: Escalabilidade</h3>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-xs">
                     O sistema está operando com latência otimizada. Os dashboards agora refletem o crescimento orgânico das squads.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function MetricHighlight({ title, value, subtitle, icon, color }: any) {
  return (
    <Card className="border-none rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 overflow-hidden relative group">
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700", color)} />
      <CardContent className="p-10 relative z-10 flex items-center gap-8">
        <div className={cn("w-16 h-16 rounded-[1.5rem] bg-gradient-to-br flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 duration-500", color)}>
          {icon}
        </div>
        <div>
          <p className="text-5xl font-black italic tracking-tighter text-slate-900 leading-none">{value}</p>
          <div className="mt-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-primary">{title}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
