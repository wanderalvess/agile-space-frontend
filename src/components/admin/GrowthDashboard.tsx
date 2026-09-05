'use client';

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
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
  Clock,
  FileDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  avgDurationMinutes: number | null;
  durationSampleSize: number;
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
    avgDurationMinutes: null,
    durationSampleSize: 0,
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
          avgDurationMinutes: data.avgSessionDurationMinutes,
          durationSampleSize: data.sessionDurationSampleSize,
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
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter italic font-headline text-slate-900">Crescimento & Métricas</h1>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Visão geral do uso da plataforma</p>
        </div>
        <Button
          onClick={() => exportMetricsPdf(stats, moduleMetrics, totalInteractions)}
          className="h-11 px-6 rounded-xl bg-slate-900 hover:bg-primary text-white font-black uppercase text-[10px] tracking-widest gap-2"
        >
          <FileDown className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>

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
          {stats.durationSampleSize > 0 && stats.avgDurationMinutes != null ? (
            <MetricHighlight
              title="Tempo de Uso Médio"
              value={formatDuration(stats.avgDurationMinutes)}
              subtitle={`Retro & Sprint Review · ${stats.durationSampleSize} sessão(ões)`}
              icon={<Clock className="h-6 w-6" />}
              color="from-violet-500 to-purple-600"
            />
          ) : (
            <div className="rounded-[3rem] bg-slate-50 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 flex items-center gap-8">
              <div className="w-16 h-16 rounded-[1.5rem] bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-black italic tracking-tighter text-slate-400 leading-none">Em breve</p>
                <div className="mt-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tempo de Uso</p>
                  <p className="text-[9px] font-bold text-slate-400/80 uppercase tracking-widest">Instrumentado agora — aparece após a próxima sessão finalizada</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">
          * Retrospectivas ainda não rastreiam participantes — não entram nesse total. Tempo de uso considera só Retro e Sprint Review por enquanto.
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest > 0 ? `${hours}h${rest}` : `${hours}h`;
}

// Cor de cada módulo no ranking, convertida do Tailwind (bg-*-500/400) pra RGB —
// jsPDF não lê classes CSS, precisa do valor direto.
const MODULE_COLOR_RGB: Record<string, [number, number, number]> = {
  'bg-blue-500': [59, 130, 246],
  'bg-orange-500': [249, 115, 22],
  'bg-indigo-500': [99, 102, 241],
  'bg-amber-500': [245, 158, 11],
  'bg-emerald-500': [16, 185, 129],
  'bg-indigo-400': [129, 140, 248],
};

/**
 * PDF de uma página (retrato, A4) com o resumo executivo — pensado pra imprimir
 * ou anexar num e-mail pra liderança, mesmo princípio de texto real (não
 * screenshot/html2canvas) já usado no relatório do Sprint Review, ver
 * SummaryDialog.tsx:164.
 */
function exportMetricsPdf(
  stats: {
    users: number; feedbacks: number; sessions: number; participations: number;
    avgDurationMinutes: number | null; durationSampleSize: number;
  },
  moduleMetrics: { label: string; count: number; color: string }[],
  totalInteractions: number
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const PW = doc.internal.pageSize.getWidth();
  const M = 16;
  const CW = PW - M * 2;
  let y = M;

  const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [30, 41, 59]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  // ------------------------------------------------------------------ Cabeçalho
  doc.setFillColor(255, 106, 0); // --primary do app (25 100% 50%)
  doc.rect(0, 0, PW, 38, 'F');
  setFont(9, 'bold', [255, 237, 213]);
  doc.text('ESPAÇO ÁGIL', M, 14);
  setFont(20, 'bold', [255, 255, 255]);
  doc.text('Relatório de Uso do Sistema', M, 26);
  setFont(9, 'normal', [255, 237, 213]);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, M, 33);
  y = 50;

  // ------------------------------------------------------------------ KPIs
  const kpis: Array<[string, string, string]> = [
    ['Total de Sessões', String(stats.sessions), 'Cerimônias em grupo realizadas'],
    ['Total de Participações', String(stats.participations), 'Somatório de participantes por sessão*'],
    [
      'Tempo de Uso Médio',
      stats.durationSampleSize > 0 && stats.avgDurationMinutes != null ? formatDuration(stats.avgDurationMinutes) : 'Em breve',
      stats.durationSampleSize > 0 ? `Retro & Sprint Review · ${stats.durationSampleSize} sessão(ões)` : 'Instrumentado, aguardando dado',
    ],
    ['Usuários Totais', String(stats.users), 'Perfis cadastrados na plataforma'],
    ['Total de Interações', String(totalInteractions), 'Ações registradas na plataforma'],
    ['Taxa de Feedback', (stats.users > 0 ? (stats.feedbacks / stats.users) * 100 : 0).toFixed(1) + '%', 'Conversão de engajamento'],
  ];
  const colW = CW / 2 - 4;
  kpis.forEach(([title, value, subtitle], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = M + col * (colW + 8);
    const boxY = y + row * 34;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, boxY, colW, 28, 3, 3, 'FD');
    setFont(18, 'bold', [15, 23, 42]);
    doc.text(value, x + 6, boxY + 13);
    setFont(8, 'bold', [255, 106, 0]);
    doc.text(title.toUpperCase(), x + 6, boxY + 19);
    setFont(7, 'normal', [148, 163, 184]);
    doc.text(subtitle, x + 6, boxY + 24, { maxWidth: colW - 12 });
  });
  y += Math.ceil(kpis.length / 2) * 34 + 10;

  // ------------------------------------------------------------------ Ranking de módulos
  setFont(13, 'bold', [15, 23, 42]);
  doc.text('Adoção por Módulo', M, y);
  y += 3;
  setFont(8, 'normal', [148, 163, 184]);
  doc.text('Ranking de utilização real', M, y + 4);
  y += 12;

  const maxCount = Math.max(...moduleMetrics.map(m => m.count), 1);
  moduleMetrics.forEach(m => {
    const [r, g, b] = MODULE_COLOR_RGB[m.color] || [100, 116, 139];
    setFont(9, 'bold', [51, 65, 85]);
    doc.text(m.label.toUpperCase(), M, y);
    setFont(9, 'bold', [148, 163, 184]);
    doc.text(`${m.count} SESSÕES`, M + CW, y, { align: 'right' });
    y += 3;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(M, y, CW, 4, 2, 2, 'F');
    const barW = Math.max((m.count / maxCount) * CW, m.count > 0 ? 4 : 0);
    if (barW > 0) {
      doc.setFillColor(r, g, b);
      doc.roundedRect(M, y, barW, 4, 2, 2, 'F');
    }
    y += 11;
  });

  // ------------------------------------------------------------------ Rodapé
  y += 4;
  setFont(7, 'normal', [148, 163, 184]);
  doc.text('* Retrospectivas ainda não rastreiam participantes — não entram nesse total.', M, y, { maxWidth: CW });
  y += 4;
  doc.text('Tempo de uso considera só Retro e Sprint Review por enquanto.', M, y, { maxWidth: CW });

  doc.save(`relatorio-uso-espaco-agil-${new Date().toISOString().slice(0, 10)}.pdf`);
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
