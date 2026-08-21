import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutGrid, 
  Plus, 
  History, 
  Zap, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Rocket, 
  ShieldCheck, 
  Target, 
  Sparkles, 
  ExternalLink, 
  Trophy, 
  Users, 
  Pin 
} from 'lucide-react';
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
  onOpenFeedback 
}: BentoDashboardProps) {
  
  const recentHistory = useMemo(() => {
    return (history || []).slice(0, 3);
  }, [history]);

  const pinnedNotes = useMemo(() => {
    return notes.filter(n => n.isPinned).slice(0, 3);
  }, [notes]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="w-full space-y-6">
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-5 gap-5 lg:gap-6"
      >
        {/* Welcome Card (Hero) */}
        <motion.div variants={item} className="md:col-span-5 lg:col-span-5">
          <Card className="h-full border-none bg-slate-900 rounded-3xl overflow-hidden relative group shadow-xl shadow-slate-900/10">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/30 transition-colors duration-1000" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_50%)]" />
            
            <CardContent className="p-6 md:p-8 relative z-10 flex flex-col justify-between h-full space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500">
                    <Rocket className="h-5 w-5 text-primary animate-bounce-subtle" />
                  </div>
                  <div className="flex flex-col">
                    <Badge variant="outline" className="border-primary/50 text-primary text-[9px] font-black tracking-[0.2em] uppercase bg-primary/10 px-3 py-0.5 rounded-full w-fit">
                      Espaço Ágil
                    </Badge>
                    <div className="flex items-center gap-1.5 mt-1">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                       <span className="text-[8px] font-black uppercase text-white/50 tracking-[0.2em]">Status: Operacional</span>
                    </div>
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-black font-headline tracking-tight uppercase italic text-white leading-tight">
                  Olá, <span className="text-primary not-italic">{userProfile?.name?.split(' ')[0] || 'Agilista'}</span>
                </h2>
                <p className="text-xs md:text-sm font-medium text-white/70 max-w-xl leading-relaxed">
                   Seu centro de comando está pronto. Você tem <span className="text-white font-bold underline decoration-primary decoration-2 underline-offset-4">{tasks.filter(t => t.status === 'todo').length} tarefas</span> pendentes para hoje.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 relative z-10 pt-2">
                <Button onClick={() => onNavigate('kanban')} className="h-10 px-6 bg-primary hover:bg-primary/90 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-primary/20 gap-2 border-none transition-all active:scale-95 group/btn">
                  <LayoutGrid className="h-3.5 w-3.5 group-hover/btn:rotate-12 transition-transform" /> Ir para o Kanban
                </Button>
                <Button onClick={onAddNote} variant="outline" className="h-10 px-6 border-white/20 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl backdrop-blur-md gap-2 transition-all active:scale-95">
                  <Plus className="h-3.5 w-3.5" /> Nova Nota
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats (Small) */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-2 row-span-1">
          <Card className="h-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-primary/10 transition-colors" />
            
            <div className="space-y-4 relative z-10">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Eficiência da Squad</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                   <div className="text-3xl md:text-4xl font-black italic tracking-tighter text-slate-900 dark:text-slate-100 leading-none">
                     {tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%
                   </div>
                   <div className="text-[8px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Concluído
                   </div>
                </div>
                <div className="space-y-1">
                   <div className="text-3xl md:text-4xl font-black italic tracking-tighter text-slate-900 dark:text-slate-100 leading-none">
                     {history?.length || 0}
                   </div>
                   <div className="text-[8px] font-black uppercase tracking-widest text-primary">Sessões</div>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4 flex items-center justify-between relative z-10">
              <div className="flex -space-x-2">
                 {[1,2,3].map(i => (
                   <div key={i} className="w-7 h-7 rounded-xl border border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-400 shadow-sm">
                     S{i}
                   </div>
                 ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('history')} className="h-8 px-3 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-lg gap-1.5">
                Histórico <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Recent History (Medium) */}
        <motion.div variants={item} className="md:col-span-3 lg:col-span-3 row-span-1">
          <Card className="h-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl overflow-hidden flex flex-col shadow-lg">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                  <History className="h-3.5 w-3.5 text-primary" /> Atividade Recente
               </h3>
               <Button variant="ghost" size="sm" onClick={() => onNavigate('history')} className="text-[9px] font-black uppercase tracking-widest text-primary h-7 px-2.5">Explorar</Button>
            </div>
            <CardContent className="p-4 space-y-2.5">
               {(recentHistory || []).map(h => (
                 <div key={h.id} className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center gap-3 group hover:bg-white dark:hover:bg-slate-800 hover:border-primary/20 transition-all cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-primary/5 transition-colors">
                       {h.type === 'poker' ? <CheckCircle2 className="h-4 w-4 text-indigo-500" /> : h.type === 'retro' ? <LayoutGrid className="h-4 w-4 text-emerald-500" /> : <Trophy className="h-4 w-4 text-amber-500" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                       <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight truncate">{h.title || h.sprintName}</span>
                       <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest" suppressHydrationWarning>
                         {(() => {
                           const date = h.createdAt?.toDate ? h.createdAt.toDate() : new Date(h.createdAt);
                           return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                         })()}
                       </span>
                    </div>
                 </div>
               ))}
               {(!recentHistory || recentHistory.length === 0) && (
                 <div className="py-6 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                   Nenhuma atividade recente encontrada
                 </div>
               )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pinned Notes (Full Width) */}
        <motion.div variants={item} className="md:col-span-5 lg:col-span-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="space-y-0.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Pin className="h-3.5 w-3.5 text-primary" /> Notas em Destaque
                </h3>
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Suas notas mais importantes fixadas</div>
              </div>
              <Button variant="ghost" onClick={() => onNavigate('notes')} className="text-[9px] font-black uppercase tracking-widest text-primary h-7 px-2.5">Ver Tudo</Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {pinnedNotes.length > 0 ? (
                 pinnedNotes.map(n => (
                   <Card key={n.id} className={cn("border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer", n.color, "shadow-sm")}>
                      <div className="space-y-2">
                         <div className="w-2 h-2 rounded-full bg-slate-900/10 shadow-inner" />
                         <div className="text-xs font-semibold leading-relaxed text-slate-800 line-clamp-3">
                            {n.content || "Nota sem conteúdo..."}
                         </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-black/5">
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-40" suppressHydrationWarning>{new Date(n.updatedAt).toLocaleDateString('pt-BR')}</span>
                        <ArrowRight className="h-3 w-3 opacity-30" />
                      </div>
                   </Card>
                 ))
               ) : (
                 <div className="col-span-full py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center opacity-50 space-y-2">
                    <Pin className="h-6 w-6 text-slate-400" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nenhuma nota fixada</p>
                 </div>
               )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
