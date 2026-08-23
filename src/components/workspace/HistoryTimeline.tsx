'use client';

import React from 'react';
import { 
  History, 
  CheckCircle2, 
  Trophy, 
  LayoutGrid, 
  ChevronRight, 
  ExternalLink, 
  MessageSquare,
  Target,
  AlertTriangle,
  Zap,
  Users
} from 'lucide-react';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { HistoryItem } from './types';
import Link from 'next/link';

interface HistoryTimelineProps {
  items: HistoryItem[] | null;
  isLoading: boolean;
  userId: string;
}

export function HistoryTimeline({ items, isLoading, userId }: HistoryTimelineProps) {
  return (
    <div className="w-full space-y-6">
      <Card className="border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl shadow-lg rounded-3xl overflow-hidden">
        <CardHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0 py-5 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg font-black font-headline uppercase tracking-tight italic flex items-center gap-3 text-slate-900 dark:text-slate-100">
              <div className="w-9 h-9 bg-slate-900 dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
                <History className="h-4.5 w-4.5 text-primary" />
              </div>
              Linha do Tempo de Cerimônias
            </CardTitle>
            {!isLoading && items && (
              <Badge variant="outline" className="h-6 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                {items.length} SESSÕES
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
            {isLoading ? (
              <div className="p-20 flex flex-col items-center justify-center space-y-6">
                <AgileSpinner size="lg" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Carregando histórico de cerimônias...</p>
              </div>
            ) : !items || items.length === 0 ? (
              <div className="p-20 text-center space-y-4 opacity-30">
                <History className="h-16 w-16 mx-auto text-slate-300" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">Nenhum registro encontrado</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {items.map((room) => (
                  <HistoryEntry key={room.id} room={room} userId={userId} />
                ))}
              </Accordion>
            )}
          </CardContent>
      </Card>
    </div>
  );
}

function HistoryEntry({ room, userId }: { room: HistoryItem, userId: string }) {
  const isOrganizer = room.creatorId === userId;
  const roomUrl = (room.type === 'poker' ? '/room/' : room.type === 'retro' ? '/retro/' : '/health-check/') + room.roomId;

  const typeConfig = {
    poker: {
      icon: CheckCircle2,
      color: "text-indigo-500 bg-indigo-50 border-indigo-100",
      label: "Scrum Poker"
    },
    retro: {
      icon: LayoutGrid,
      color: "text-emerald-500 bg-emerald-50 border-emerald-100",
      label: "Retrospectiva"
    },
    health: {
      icon: Trophy,
      color: "text-amber-500 bg-amber-50 border-amber-100",
      label: "Radar de Saúde"
    }
  };

  const config = typeConfig[room.type] || typeConfig.poker;
  const Icon = config.icon;

  return (
    <AccordionItem key={room.id} value={room.id} className="border-b border-slate-100 px-8 hover:bg-slate-50/30 transition-colors">
      <AccordionTrigger className="hover:no-underline py-6">
        <div className="flex items-center gap-5 w-full text-left">
          <div className={cn("p-3 rounded-2xl border shadow-sm transition-transform duration-500 group-hover:scale-110", config.color)}>
            <Icon className="h-6 w-6" />
          </div>
          
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-black uppercase tracking-tight text-slate-900 truncate">
                {room.title || "Sessão sem Título"}
              </span>
              {isOrganizer ? (
                <Badge className="h-5 text-[8px] font-black uppercase bg-primary text-white border-none shadow-sm px-2">Organizador</Badge>
              ) : (
                <Badge variant="secondary" className="h-5 text-[8px] font-black uppercase bg-slate-100 text-slate-500 border-none px-2">Participante</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span suppressHydrationWarning>
                {(() => {
                  const date = typeof room.createdAt === 'string' ? new Date(room.createdAt) : (room.createdAt as { toDate: () => Date }).toDate();
                  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                })()}
              </span>
              <span className="opacity-30">•</span>
              <span className="text-primary/70">{config.label}</span>
            </div>
          </div>
          
          <Badge variant="outline" className="hidden md:flex items-center gap-2 h-7 px-3 text-[9px] font-black uppercase border-slate-200 bg-white text-slate-600 rounded-xl">
            <Users className="h-3 w-3 opacity-40" />
            {room.team || "Squad Geral"}
          </Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="pb-8">
        <div className="space-y-6 pt-2">
          {!room.summary ? (
            <div className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center gap-4 text-slate-400 italic">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                 <MessageSquare className="h-4 w-4" />
              </div>
              <p className="text-[11px] font-bold">Resumo indisponível. Esta cerimônia pode ainda estar ativa ou sem relatórios gerados.</p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-2 duration-500">
              {room.type === 'poker' && <PokerSummary summary={room.summary} />}
              {room.type === 'retro' && <RetroSummary summary={room.summary} />}
              {room.type === 'health' && <HealthSummary summary={room.summary} />}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dashed border-slate-200">
            <Button asChild variant="ghost" size="sm" className="h-10 px-5 text-slate-500 hover:text-primary hover:bg-primary/5 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all">
              <Link href={roomUrl} target="_blank" rel="noopener noreferrer">
                Acessar Sala Original
                <ChevronRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button asChild className="h-10 px-5 bg-slate-900 hover:bg-black text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95">
              <Link href={roomUrl} target="_blank" rel="noopener noreferrer">
                Ver Relatório Completo
                <ExternalLink className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function PokerSummary({ summary }: { summary: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Duração', val: summary.stats?.durationStr || '-', icon: History },
          { label: 'Tópicos', val: summary.stats?.totalTopics || '-', icon: LayoutGrid },
          { label: 'Esforço', val: summary.stats?.totalPoints || '-', icon: Zap, color: 'text-primary' },
          { label: 'Média', val: summary.stats?.avgTimePerTopic || '-', icon: Target },
        ].map(s => (
          <div key={s.label} className="p-3 md:p-4 bg-slate-50/50 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-colors">
            <div className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-1.5 flex items-center gap-1.5 md:gap-2">
               <s.icon className="h-3 w-3 opacity-40" /> {s.label}
            </div>
            <div className={cn("text-xs md:text-sm font-black tracking-tight", s.color || "text-slate-900")}>{s.val}</div>
          </div>
        ))}
      </div>
      
      {summary.estimatedTasks && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Estimativas
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {summary.estimatedTasks.slice(0, 4).map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2.5 md:p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <span className="text-[10px] md:text-[11px] font-black text-slate-700 truncate pr-4">{t.title}</span>
                <Badge className="h-6 px-2 text-[10px] font-black bg-primary/10 text-primary border-none rounded-lg shrink-0">
                  {t.points} SP
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RetroSummary({ summary }: { summary: any }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 rounded-2xl border border-emerald-100 w-full sm:w-auto">
           <CheckCircle2 className="h-5 w-5 text-emerald-500" />
           <span className="text-xs font-black text-emerald-700 uppercase tracking-tight">{summary.goodCount} Positivos</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-rose-50 rounded-2xl border border-rose-100 w-full sm:w-auto">
           <AlertTriangle className="h-5 w-5 text-rose-500" />
           <span className="text-xs font-black text-rose-700 uppercase tracking-tight">{summary.badCount} Pontos Críticos</span>
        </div>
      </div>
      
      <div className="p-6 md:p-8 bg-slate-900 rounded-[2rem] md:rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] rounded-full" />
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4 flex items-center gap-2 relative z-10">
          <Zap className="h-4 w-4" /> Plano de Ação Estratégico
        </h4>
        <div className="space-y-3 relative z-10">
          {summary.actionItems?.map((a: string, i: number) => (
            <div key={i} className="flex items-start gap-4 p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-black">
                {i + 1}
              </div>
              <span className="text-[12px] font-bold leading-tight opacity-90">{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthSummary({ summary }: { summary: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em] flex items-center gap-2">
           <Trophy className="h-4 w-4" /> Fortalezas do Time
        </h4>
        <div className="flex flex-wrap gap-2">
          {summary.topMetrics?.map((m: string, i: number) => (
            <Badge key={i} variant="outline" className="text-[10px] font-black bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 rounded-xl shadow-sm uppercase tracking-tight">
               {m}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-[0.2em] flex items-center gap-2">
           <AlertTriangle className="h-4 w-4" /> Pontos de Atenção
        </h4>
        <div className="flex flex-wrap gap-2">
          {summary.lowMetrics?.map((m: string, i: number) => (
            <Badge key={i} variant="outline" className="text-[10px] font-black bg-amber-50 text-amber-700 border-amber-200 px-3 py-1 rounded-xl shadow-sm uppercase tracking-tight">
               {m}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
