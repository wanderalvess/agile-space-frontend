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
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { cn } from '@/lib/utils';
import { HistoryItem } from './types';
import Link from 'next/link';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';

interface HistoryTimelineProps {
  items: HistoryItem[] | null;
  isLoading: boolean;
  userId: string;
}

export function HistoryTimeline({ items, isLoading, userId }: HistoryTimelineProps) {
  return (
    <div className="w-full space-y-6 animate-in fade-in duration-700">
      <WorkspaceSectionHeader
        kicker="Histórico"
        accent="orange"
        title="Linha do Tempo de"
        titleAccent="Cerimônias"
        subtitle="Registro de sessões e eventos da squad"
        action={
          !isLoading && items ? (
            <Badge variant="outline" className="h-6 px-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              {items.length} SESSÕES
            </Badge>
          ) : undefined
        }
      />

      <Card className="rounded-3xl border border-border/80 bg-card text-card-foreground shadow-xs overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-14 text-center space-y-4 text-muted-foreground/60">
              <AgileSpinner size="md" className="mx-auto" />
              <p className="text-xs font-bold uppercase tracking-wider">Carregando histórico...</p>
            </div>
          ) : !items || items.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-3 text-muted-foreground/60">
              <History className="h-16 w-16 mx-auto opacity-40" />
              <p className="text-sm font-bold uppercase tracking-wider">Nenhum registro encontrado</p>
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
      color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
      label: "Scrum Poker"
    },
    retro: {
      icon: LayoutGrid,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      label: "Retrospectiva"
    },
    health: {
      icon: Trophy,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      label: "Radar de Saúde"
    }
  };

  const config = typeConfig[room.type] || typeConfig.poker;
  const Icon = config.icon;

  return (
    <AccordionItem key={room.id} value={room.id} className="border-b border-border/60 px-6 md:px-8 hover:bg-muted/30 transition-colors">
      <AccordionTrigger className="hover:no-underline py-5">
        <div className="flex items-center gap-4 md:gap-5 w-full text-left">
          <div className={cn("p-3 rounded-2xl border shadow-xs transition-transform duration-500 group-hover:scale-105", config.color)}>
            <Icon className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-sm font-bold uppercase tracking-tight text-foreground truncate">
                {room.title || "Sessão sem Título"}
              </span>
              {isOrganizer ? (
                <Badge className="h-5 text-[9px] font-bold uppercase bg-primary text-primary-foreground border-none px-2">Organizador</Badge>
              ) : (
                <Badge variant="secondary" className="h-5 text-[9px] font-bold uppercase bg-muted text-muted-foreground border-none px-2">Participante</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              <span suppressHydrationWarning>
                {(() => {
                  const date = typeof room.createdAt === 'string' ? new Date(room.createdAt) : (room.createdAt as { toDate: () => Date }).toDate();
                  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                })()}
              </span>
              <span className="opacity-40">•</span>
              <span className="text-primary font-semibold">{config.label}</span>
            </div>
          </div>
          
          <Badge variant="outline" className="hidden md:flex items-center gap-2 h-7 px-3 text-[10px] font-bold uppercase border-border/80 bg-muted/30 text-muted-foreground rounded-xl">
            <Users className="h-3 w-3 opacity-60" />
            {room.team || "Squad Geral"}
          </Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="pb-8">
        <div className="space-y-6 pt-2">
          {!room.summary ? (
            <div className="p-5 bg-muted/30 rounded-2xl border border-border/60 flex items-center gap-4 text-muted-foreground italic">
              <div className="p-2 bg-background rounded-xl shadow-xs border border-border/60">
                 <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-medium">Resumo indisponível. Esta cerimônia pode ainda estar ativa ou sem relatórios gerados.</p>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-2 duration-500">
              {room.type === 'poker' && <PokerSummary summary={room.summary} />}
              {room.type === 'retro' && <RetroSummary summary={room.summary} />}
              {room.type === 'health' && <HealthSummary summary={room.summary} />}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dashed border-border/80">
            <Button asChild variant="ghost" size="sm" className="h-9 px-4 text-muted-foreground hover:text-primary hover:bg-primary/10 font-bold text-xs uppercase tracking-wider rounded-xl transition-all">
              <Link href={roomUrl} target="_blank" rel="noopener noreferrer">
                Acessar Sala
                <ChevronRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
            <Button asChild className="h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all active:scale-95">
              <Link href={roomUrl} target="_blank" rel="noopener noreferrer">
                Ver Relatório
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
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
          <div key={s.label} className="p-3 md:p-4 bg-muted/40 rounded-2xl border border-border/60 group hover:border-primary/30 transition-colors">
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
               <s.icon className="h-3 w-3 opacity-60" /> {s.label}
            </div>
            <div className={cn("text-sm md:text-base font-bold tracking-tight", s.color || "text-foreground")}>{s.val}</div>
          </div>
        ))}
      </div>
      
      {summary.estimatedTasks && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Estimativas
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {summary.estimatedTasks.slice(0, 4).map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2.5 md:p-3 bg-card border border-border/60 rounded-xl shadow-xs">
                <span className="text-xs font-bold text-foreground truncate pr-4">{t.title}</span>
                <Badge className="h-6 px-2 text-xs font-bold bg-primary/10 text-primary border-none rounded-lg shrink-0">
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 w-full sm:w-auto">
           <CheckCircle2 className="h-5 w-5 text-emerald-500" />
           <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">{summary.goodCount} Positivos</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-rose-500/10 rounded-2xl border border-rose-500/20 w-full sm:w-auto">
           <AlertTriangle className="h-5 w-5 text-rose-500" />
           <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{summary.badCount} Pontos Críticos</span>
        </div>
      </div>
      
      <div className="p-6 md:p-8 bg-card rounded-3xl border border-border/80 shadow-md text-card-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-4 flex items-center gap-2 relative z-10">
          <Zap className="h-4 w-4" /> Plano de Ação Estratégico
        </h4>
        <div className="space-y-2.5 relative z-10">
          {summary.actionItems?.map((a: string, i: number) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl border border-border/60 hover:bg-muted/60 transition-colors">
              <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
                {i + 1}
              </div>
              <span className="text-xs font-medium leading-relaxed text-foreground">{a}</span>
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
        <h4 className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-2">
           <Trophy className="h-4 w-4" /> Fortalezas da Squad
        </h4>
        <div className="flex flex-wrap gap-2">
          {summary.topMetrics?.map((m: string, i: number) => (
            <Badge key={i} variant="outline" className="text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 px-3 py-1 rounded-xl shadow-xs uppercase tracking-tight">
               {m}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-2">
           <AlertTriangle className="h-4 w-4" /> Pontos de Atenção
        </h4>
        <div className="flex flex-wrap gap-2">
          {summary.lowMetrics?.map((m: string, i: number) => (
            <Badge key={i} variant="outline" className="text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 px-3 py-1 rounded-xl shadow-xs uppercase tracking-tight">
               {m}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
