import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutGrid, 
  Plus, 
  History, 
  ArrowRight, 
  CheckCircle2, 
  Rocket, 
  ExternalLink, 
  Trophy, 
  Pin,
  TrendingUp,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { KanbanCardData, StickyNote } from './types';
import { UserProfile } from '@/lib/types';

interface BentoDashboardProps {
  tasks: KanbanCardData[];
  history: any[] | null;
  notes: StickyNote[];
  userProfile: UserProfile | null;
  onNavigate: (tab: string) => void;
  onAddTask: () => void;
  onAddNote: () => void;
  onOpenFeedback?: () => void;
}

export function BentoDashboard({ 
  tasks, 
  history, 
  notes, 
  userProfile, 
  onNavigate, 
  onAddTask, 
  onAddNote, 
}: BentoDashboardProps) {
  
  const recentHistory = useMemo(() => {
    return (history || []).slice(0, 3);
  }, [history]);

  const pinnedNotes = useMemo(() => {
    return notes.filter(n => n.isPinned).slice(0, 3);
  }, [notes]);

  const todoTasks = useMemo(() => tasks.filter(t => t.status === 'todo'), [tasks]);
  const doingTasks = useMemo(() => tasks.filter(t => t.status === 'doing'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);

  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const item = {
    hidden: { y: 16, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="w-full space-y-6">
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6"
      >
        {/* ============================================================ */}
        {/* HERO COCKPIT: RITMO DO DIA & SPRINT MOMENTUM (SIGNATURE)     */}
        {/* ============================================================ */}
        <motion.div variants={item} className="col-span-1 md:col-span-12">
          <Card className="h-full border border-border/70 bg-card/90 dark:bg-slate-900/90 text-card-foreground rounded-3xl overflow-hidden relative group shadow-lg shadow-black/5 dark:shadow-black/40 backdrop-blur-xl transition-all">
            {/* Ambient Lighting Mesh */}
            <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-primary/10 dark:bg-primary/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3 group-hover:bg-primary/15 transition-colors duration-1000 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 dark:bg-blue-500/10 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
            
            <CardContent className="p-6 md:p-8 relative z-10 flex flex-col justify-between h-full space-y-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 dark:bg-white/10 backdrop-blur-xl border border-primary/20 dark:border-white/20 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                      <Rocket className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-primary/40 text-primary text-[9px] font-black tracking-widest uppercase bg-primary/5 px-2.5 py-0.5 rounded-full">
                          Cockpit Operacional
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Sistema Pronto</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-black font-headline tracking-tight uppercase italic text-foreground leading-tight">
                    Olá, <span className="text-primary not-italic">{userProfile?.name?.split(' ')[0] || 'Agilista'}</span>
                  </h2>

                  <p className="text-xs md:text-sm font-medium text-muted-foreground leading-relaxed">
                    Seu centro de comando está sincronizado. Você tem{' '}
                    <span className="text-foreground font-bold underline decoration-primary decoration-2 underline-offset-4">
                      {todoTasks.length} {todoTasks.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}
                    </span>{' '}
                    e{' '}
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {doingTasks.length} em andamento (WIP)
                    </span>.
                  </p>
                </div>

                {/* Quick Momentum Gauge Ring/Summary */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/40 border border-border/60 shrink-0 self-start">
                  <div className="flex flex-col text-right">
                    <span className="text-2xl font-black font-headline italic tracking-tighter text-foreground leading-none">
                      {completionRate}%
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mt-1">
                      Ritmo do Dia
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-background border border-border/80 flex items-center justify-center text-primary shadow-inner">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40">
                <Button 
                  onClick={() => onNavigate('kanban')} 
                  className="h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-primary/20 gap-2 border-none transition-all active:scale-95 group/btn"
                >
                  <LayoutGrid className="h-4 w-4 group-hover/btn:rotate-12 transition-transform" />
                  Ir para o Kanban
                </Button>
                <Button 
                  onClick={onAddTask} 
                  variant="outline" 
                  className="h-10 px-4 rounded-xl text-xs font-bold border-border/80 hover:bg-muted gap-2 transition-all active:scale-95"
                >
                  <Plus className="h-4 w-4 text-primary" /> Nova Tarefa
                </Button>
                <Button 
                  onClick={onAddNote} 
                  variant="ghost" 
                  className="h-10 px-4 rounded-xl text-xs font-bold hover:bg-muted gap-2 transition-all"
                >
                  <Pin className="h-4 w-4 text-amber-500" /> Nova Nota
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ============================================================ */}
        {/* CARD 2: DISTRIBUIÇÃO DO KANBAN & MÉTRICAS REAIS (NO FAKES)    */}
        {/* ============================================================ */}
        <motion.div variants={item} className="col-span-1 md:col-span-5 2xl:col-span-4 row-span-1">
          <Card className="h-full border border-border/80 bg-card/80 backdrop-blur-xl rounded-3xl p-6 flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Fluxo de Trabalho
                </h3>
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider border-border bg-muted/30">
                  {totalTasks} {totalTasks === 1 ? 'item' : 'itens'}
                </Badge>
              </div>

              {/* Progress Bar Segmentada */}
              <div className="space-y-2">
                <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex p-0.5 gap-1">
                  {totalTasks > 0 ? (
                    <>
                      <div 
                        style={{ width: `${(todoTasks.length / totalTasks) * 100}%` }} 
                        className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                        title={`A Fazer: ${todoTasks.length}`}
                      />
                      <div 
                        style={{ width: `${(doingTasks.length / totalTasks) * 100}%` }} 
                        className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                        title={`Em Andamento: ${doingTasks.length}`}
                      />
                      <div 
                        style={{ width: `${(doneTasks.length / totalTasks) * 100}%` }} 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                        title={`Concluído: ${doneTasks.length}`}
                      />
                    </>
                  ) : (
                    <div className="h-full w-full bg-muted-foreground/20 rounded-full" />
                  )}
                </div>

                {/* Legenda de Distribuição */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> A Fazer
                    </span>
                    <span className="text-lg font-black font-headline text-foreground mt-0.5">{todoTasks.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Andamento
                    </span>
                    <span className="text-lg font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">{doingTasks.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Concluído
                    </span>
                    <span className="text-lg font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{doneTasks.length}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-border/60 mt-4 flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-muted-foreground">
                {history?.length || 0} cerimônias registradas
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onNavigate('history')} 
                className="h-8 px-3 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 rounded-xl gap-1.5"
              >
                Histórico <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* ============================================================ */}
        {/* CARD 3: ATIVIDADE RECENTE COM LINKS DIRETOS PARA SALAS       */}
        {/* ============================================================ */}
        <motion.div variants={item} className="col-span-1 md:col-span-7 2xl:col-span-8 row-span-1">
          <Card className="h-full border border-border/80 bg-card/80 backdrop-blur-xl rounded-3xl overflow-hidden flex flex-col shadow-sm">
            <div className="p-5 border-b border-border/60 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Atividade Recente
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onNavigate('history')} 
                className="text-xs font-bold uppercase tracking-wider text-primary h-7 px-2.5 rounded-lg hover:bg-primary/10"
              >
                Ver Todas
              </Button>
            </div>
            <CardContent className="p-4 space-y-2.5 flex-1 flex flex-col justify-center">
              {(recentHistory || []).map(h => {
                const roomUrl = (h.type === 'poker' ? '/room/' : h.type === 'retro' ? '/retro/' : '/health-check/') + (h.roomId || h.id);
                const isPoker = h.type === 'poker';
                const isRetro = h.type === 'retro';
                
                return (
                  <Link
                    key={h.id}
                    href={roomUrl}
                    className="p-3 bg-muted/40 hover:bg-muted/70 border border-border/60 hover:border-primary/30 rounded-2xl flex items-center justify-between gap-3 group transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-colors",
                        isPoker ? "bg-indigo-500/10 text-indigo-500" : isRetro ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {isPoker ? <CheckCircle2 className="h-4 w-4" /> : isRetro ? <LayoutGrid className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors">
                          {h.title || h.sprintName || "Cerimônia sem Título"}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                          <span>{isPoker ? 'Scrum Poker' : isRetro ? 'Retrospectiva' : 'Radar de Saúde'}</span>
                          <span>•</span>
                          <span suppressHydrationWarning>
                            {(() => {
                              const date = typeof h.createdAt === 'string' ? new Date(h.createdAt) : (h.createdAt as { toDate: () => Date })?.toDate?.() || new Date();
                              return isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <Badge variant="outline" className="border-border/80 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 shrink-0 bg-background">
                      {h.status === 'completed' ? 'Finalizada' : 'Ao Vivo'}
                    </Badge>
                  </Link>
                );
              })}
              {(!recentHistory || recentHistory.length === 0) && (
                <div className="py-8 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider space-y-2">
                  <History className="h-6 w-6 mx-auto opacity-40" />
                  <p>Nenhuma sessão registrada recentemente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ============================================================ */}
        {/* CARD 4: NOTAS EM DESTAQUE (HARMONIZADAS DUAL-THEME)          */}
        {/* ============================================================ */}
        <motion.div variants={item} className="col-span-1 md:col-span-12">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Pin className="h-4 w-4 text-primary" /> Notas em Destaque
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Suas anotações rápidas mais importantes fixadas no cockpit
                </p>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => onNavigate('notes')} 
                className="text-xs font-bold uppercase tracking-wider text-primary h-7 px-2.5 rounded-lg hover:bg-primary/10"
              >
                Ver Todas ({notes.length})
              </Button>
            </div>
            
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {pinnedNotes.length > 0 ? (
                pinnedNotes.map(n => (
                  <Card 
                    key={n.id} 
                    onClick={() => onNavigate('notes')}
                    className="border border-border/80 bg-card/90 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 cursor-pointer shadow-xs"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="w-2 h-2 rounded-full bg-primary/80 shadow-xs" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary">Fixada</span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed text-foreground line-clamp-3">
                        {n.content || "Nota sem conteúdo..."}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/60 text-muted-foreground">
                      <span className="text-[9px] font-bold uppercase tracking-widest" suppressHydrationWarning>
                        {new Date(n.updatedAt).toLocaleDateString('pt-BR')}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-10 bg-muted/20 rounded-2xl border border-dashed border-border/80 flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                  <Pin className="h-6 w-6 opacity-50" />
                  <p className="text-xs font-bold uppercase tracking-wider">Nenhuma nota fixada no momento</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onAddNote}
                    className="text-xs font-bold rounded-xl mt-2"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Criar Primeira Nota
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
