'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, type Variants } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Trophy,
  Activity,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock,
  Sparkles,
  ArrowRight,
  ClipboardList,
  Eye,
  FileText,
  Plus,
  ArrowUpRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShowcaseSession, ShowcaseTask } from './types';
import { showcaseApi } from '@/app/showcase/api';

interface ShowcaseDashboardProps {
  sessions: ShowcaseSession[];
  isLoading: boolean;
  onNewSession: () => void;
  onJoinSession: (id: string) => void;
  isCreating: boolean;
}

const CHECKLIST_LENGTH = 4;

export function ShowcaseDashboard({
  sessions = [],
  isLoading,
  onNewSession,
  onJoinSession,
  isCreating
}: ShowcaseDashboardProps) {
  const router = useRouter();

  // Local state for join room ID
  const [joinId, setJoinId] = useState('');

  // Checklist de prontidão da review mais recente — gravado no doc da sessão
  // (não localStorage), pra refletir o preparo real do squad e não só de
  // quem tá com aquele navegador aberto.
  const lastSessionForChecklist = sessions.length > 0 ? sessions[0] : null;
  const checklist = lastSessionForChecklist?.readinessChecklist
    || Array(CHECKLIST_LENGTH).fill(false);

  const toggleChecklistItem = (index: number) => {
    if (!lastSessionForChecklist) return;
    const updated = [...checklist];
    updated[index] = !updated[index];
    showcaseApi.saveSession({ ...lastSessionForChecklist, readinessChecklist: updated }).catch(e => {
      console.error('Error saving checklist state', e);
    });
  };

  const handleJoinClick = () => {
    if (joinId.trim()) {
      onJoinSession(joinId.trim().toUpperCase());
    }
  };

  // Calculations
  const totalSessions = sessions.length;
  let totalTasks = 0;
  let approvedTasks = 0;
  let adjustmentTasks = 0;
  let rejectedTasks = 0;
  let pendingTasks = 0;
  let tasksWithEvidence = 0;

  sessions.forEach(session => {
    const tasks = session.tasks || [];
    totalTasks += tasks.length;
    tasks.forEach(task => {
      if (task.decision === 'approved') approvedTasks++;
      else if (task.decision === 'needs_adjustment') adjustmentTasks++;
      else if (task.decision === 'rejected') rejectedTasks++;
      else pendingTasks++;

      if (task.preparationStatus === 'done') {
        tasksWithEvidence++;
      }
    });
  });

  const totalReviewed = approvedTasks + adjustmentTasks + rejectedTasks;
  const acceptanceRate = totalReviewed > 0 ? Math.round((approvedTasks / totalReviewed) * 100) : 0;
  const evidenceReadinessRate = totalTasks > 0 ? Math.round((tasksWithEvidence / totalTasks) * 100) : 0;

  const lastSession = sessions.length > 0 ? sessions[0] : null;

  // Last session stats
  let lastSessionTotal = 0;
  let lastSessionApproved = 0;
  let lastSessionAdjustment = 0;
  let lastSessionRejected = 0;
  let lastSessionPending = 0;

  if (lastSession) {
    const tasks = lastSession.tasks || [];
    lastSessionTotal = tasks.length;
    tasks.forEach(t => {
      if (t.decision === 'approved') lastSessionApproved++;
      else if (t.decision === 'needs_adjustment') lastSessionAdjustment++;
      else if (t.decision === 'rejected') lastSessionRejected++;
      else lastSessionPending++;
    });
  }

  // Framer Motion Animation Variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100, damping: 15 } },
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 w-full text-left mt-4">
        <div className="lg:col-span-8 col-span-1 h-[290px] bg-slate-100 dark:bg-slate-900/60 rounded-[2.5rem] animate-pulse" />
        <div className="lg:col-span-4 col-span-1 h-[290px] bg-slate-100 dark:bg-slate-900/60 rounded-[2.5rem] animate-pulse" />
        <div className="lg:col-span-8 col-span-1 h-[340px] bg-slate-100 dark:bg-slate-900/60 rounded-[2.5rem] animate-pulse" />
        <div className="lg:col-span-4 col-span-1 h-[340px] bg-slate-100 dark:bg-slate-900/60 rounded-[2.5rem] animate-pulse" />
        <div className="lg:col-span-12 col-span-1 h-[200px] bg-slate-100 dark:bg-slate-900/60 rounded-[2.5rem] animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch w-full text-left"
    >
      {/* CARD 1: WELCOME & INTEGRATED ACTIONS (col-span-8, topo esquerdo) */}
      <motion.div variants={itemVariants} className="lg:col-span-8 col-span-1 flex">
        <Card className="group relative border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-xl flex flex-col justify-between w-full overflow-hidden min-h-[290px]">
          {/* Active Glow point */}
          <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-violet-500/10 dark:bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-violet-600/20">
                <Eye className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-[0.25em] leading-none bg-violet-50 dark:bg-violet-950/45 px-2.5 py-1 rounded-md border border-violet-100 dark:border-violet-900/30">
                Sprint Review
              </span>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight italic text-slate-900 dark:text-slate-50 leading-none">
                Sprint <span className="text-violet-600 dark:text-violet-400 not-italic font-black">Review</span>
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                Apresente entregas sem slides. Evidências de entrega integradas e aceites do PO registrados em tempo real durante a cerimônia.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/60 relative z-10">
            <Button
              size="lg"
              onClick={onNewSession}
              disabled={isCreating}
              className="h-14 px-8 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl shadow-violet-600/20 gap-2 transition-all active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Nova Review
            </Button>
            
            <div className="relative group flex-1">
              <Input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinClick()}
                placeholder="ENTRAR COM ID DA SALA"
                className="h-14 pl-6 pr-14 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800/80 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-bold text-xs text-slate-900 dark:text-slate-100 rounded-2xl focus-visible:ring-offset-0 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 transition-all uppercase tracking-wider"
              />
              <button
                onClick={handleJoinClick}
                disabled={!joinId.trim()}
                className="absolute right-2.5 top-2.5 w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* CARD 2: GLOBAL PERFORMANCE METRICS (col-span-4, topo direito) */}
      <motion.div variants={itemVariants} className="lg:col-span-4 col-span-1 flex">
        <Card className="group relative border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-xl flex flex-col justify-between w-full overflow-hidden min-h-[290px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20">
                <Trophy className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80">Squad Health</span>
            </div>
            
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-950 dark:text-slate-50">Métricas de Aceite</h3>
            
            <div className="flex items-center gap-6 py-1">
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <motion.path
                    className="text-violet-600 dark:text-violet-400"
                    strokeWidth="3.5"
                    strokeDasharray={`${acceptanceRate}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-black text-slate-900 dark:text-slate-50 leading-none">{acceptanceRate}%</span>
                  <span className="text-[7px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">Aceite</span>
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <div className="text-2xl font-black text-slate-900 dark:text-slate-50">
                  {totalSessions} <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sessões</span>
                </div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Total de <span className="font-bold text-slate-700 dark:text-slate-300">{totalTasks}</span> tarefas avaliadas pelo PO.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              <span>Evidências Configuradas</span>
              <span className="text-violet-600 dark:text-violet-400 font-extrabold">{evidenceReadinessRate}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-violet-600 dark:bg-violet-400 rounded-full" 
                initial={{ width: 0 }}
                animate={{ width: `${evidenceReadinessRate}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* CARD 3: LATEST REVIEW STATUS (col-span-8, meio esquerdo) */}
      <motion.div variants={itemVariants} className="lg:col-span-8 col-span-1 flex">
        <Card className="group relative border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-xl flex flex-col justify-between w-full overflow-hidden min-h-[310px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none" />

          {lastSession ? (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 text-emerald-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Última Review</span>
                  </div>
                  <Badge variant="outline" className="border-violet-100 dark:border-violet-900 bg-violet-50/50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md">
                    {lastSession.status === 'planning' ? 'Em Preparação' : lastSession.status === 'presenting' ? 'Apresentando' : 'Finalizada'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-slate-50 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {lastSession.name}
                  </h4>
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {lastSession.sprintName || 'Sem squad atribuído'}
                  </p>
                </div>

                {/* Multi-segmented stacked bar chart */}
                {lastSessionTotal > 0 ? (
                  <div className="space-y-3 pt-2">
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div 
                        style={{ width: `${(lastSessionApproved / lastSessionTotal) * 100}%` }}
                        className="h-full bg-emerald-500" 
                        title={`Aprovado: ${lastSessionApproved}`}
                      />
                      <div 
                        style={{ width: `${(lastSessionAdjustment / lastSessionTotal) * 100}%` }}
                        className="h-full bg-amber-500" 
                        title={`Ajuste: ${lastSessionAdjustment}`}
                      />
                      <div 
                        style={{ width: `${(lastSessionRejected / lastSessionTotal) * 100}%` }}
                        className="h-full bg-rose-500" 
                        title={`Rejeitado: ${lastSessionRejected}`}
                      />
                      <div 
                        style={{ width: `${(lastSessionPending / lastSessionTotal) * 100}%` }}
                        className="h-full bg-slate-300 dark:bg-slate-700" 
                        title={`Pendente: ${lastSessionPending}`}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-emerald-500/5 rounded-xl p-2 border border-emerald-500/10">
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">{lastSessionApproved}</div>
                        <div className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Aprovados</div>
                      </div>
                      <div className="bg-amber-500/5 rounded-xl p-2 border border-amber-500/10">
                        <div className="text-sm font-black text-amber-500">{lastSessionAdjustment}</div>
                        <div className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Ajustes</div>
                      </div>
                      <div className="bg-rose-500/5 rounded-xl p-2 border border-rose-500/10">
                        <div className="text-sm font-black text-rose-500">{lastSessionRejected}</div>
                        <div className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Rejeitados</div>
                      </div>
                      <div className="bg-slate-500/5 rounded-xl p-2 border border-slate-500/10">
                        <div className="text-sm font-black text-slate-500 dark:text-slate-400">{lastSessionPending}</div>
                        <div className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Pendentes</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest py-4">
                    Nenhuma tarefa importada nesta sessão.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
                <Button
                  onClick={() => router.push(`/showcase/${lastSession.id}`)}
                  className="h-10 px-5 bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl shadow-md shadow-violet-600/10 gap-2 transition-all active:scale-95"
                >
                  Retomar Sessão
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-300 dark:text-slate-600">
                <Eye className="h-6 w-6 text-slate-400" />
              </div>
              <h4 className="text-base font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight mb-1">Nenhuma Review Ativa</h4>
              <p className="text-[11px] font-medium text-slate-400 max-w-sm leading-relaxed mb-4">
                Inicie sua primeira Review para ter um resumo visual das aprovações nesta área.
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* CARD 4: ELITE REVIEW CHECKLIST (col-span-4, meio direito) */}
      <motion.div variants={itemVariants} className="lg:col-span-4 col-span-1 flex">
        <Card className="group relative border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-7 shadow-xl flex flex-col justify-between w-full overflow-hidden min-h-[310px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-4 w-full">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20 text-amber-500">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Guia de Elite</span>
            </div>

            <h3 className="text-lg font-black uppercase tracking-tight text-slate-950 dark:text-slate-50">Review Sem Slides</h3>
            
            <div className="space-y-3 pt-1">
              {[
                'Importar as tarefas do Jira (XML/API)',
                'Configurar vídeos/imagens de evidência',
                'Enviar o link da sala para o PO/Stakeholders',
                'Marcar aceites ao vivo durante a apresentação'
              ].map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => toggleChecklistItem(idx)}
                  className="flex items-start gap-3 cursor-pointer group/item select-none"
                >
                  <div className={`mt-0.5 w-4.5 h-4.5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${
                    checklist[idx] 
                      ? 'bg-violet-600 border-violet-600 text-white' 
                      : 'border-slate-300 dark:border-slate-700 hover:border-violet-400'
                  }`}>
                    {checklist[idx] && (
                      <motion.svg 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        className="w-3.5 h-3.5 stroke-current text-white" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        strokeWidth="4" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </motion.svg>
                    )}
                  </div>
                  <span className={`text-[12px] font-medium leading-tight transition-colors ${
                    checklist[idx] 
                      ? 'text-slate-400 dark:text-slate-500 line-through' 
                      : 'text-slate-600 dark:text-slate-300 group-item-hover:text-slate-900 dark:group-item-hover:text-slate-100'
                  }`}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-black uppercase tracking-widest text-slate-400/80 flex items-center gap-1.5 justify-center">
            <ClipboardList className="h-4 w-4 text-violet-500" />
            <span>Processo de Qualidade</span>
          </div>
        </Card>
      </motion.div>

      {/* CARD 5: RECENT SESSIONS GRID (col-span-12, inferior) */}
      <motion.div variants={itemVariants} className="lg:col-span-12 col-span-1 flex">
        <Card className="group relative border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-xl flex flex-col justify-between w-full overflow-hidden min-h-[200px]">
          <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-5 w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center border border-violet-500/20 text-violet-600">
                  <FileText className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-950 dark:text-slate-50">Histórico de Reviews</h3>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-none px-2.5 py-1">
                  {sessions.length} Registros
                </Badge>
              </div>
            </div>

            {sessions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sessions.slice(0, 3).map((session) => {
                  const sTasks = session.tasks || [];
                  const sTotal = sTasks.length;
                  const sApproved = sTasks.filter(t => t.decision === 'approved').length;
                  const sRate = sTotal > 0 ? Math.round((sApproved / sTotal) * 100) : 0;

                  return (
                    <div
                      key={session.id}
                      onClick={() => router.push(`/showcase/${session.id}`)}
                      className="group/item flex flex-col justify-between p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 hover:border-violet-500/25 dark:hover:border-violet-500/25 hover:shadow-lg transition-all duration-300 cursor-pointer h-[120px]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 group-item-hover:text-violet-600 dark:group-item-hover:text-violet-400 transition-colors leading-tight truncate">
                            {session.name}
                          </h5>
                          {sTotal > 0 && (
                            <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-[8px] uppercase tracking-wider">
                              {sRate}% OK
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                          {session.sprintName || 'Sprint Review'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2.5 mt-auto">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span>
                            {session.createdAt
                              ? formatDistanceToNow(new Date(session.createdAt), { addSuffix: true, locale: ptBR })
                              : 'Recentemente'
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 group-item-hover:text-violet-600 dark:group-item-hover:text-violet-400 transition-colors">
                          <span>{sTotal} {sTotal === 1 ? 'tarefa' : 'tarefas'}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-item-hover:text-violet-500 group-item-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Sem registros de histórico. Clique em "Nova Review" para iniciar.
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
