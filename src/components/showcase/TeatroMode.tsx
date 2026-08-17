'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, ChevronDown, X, Camera, Ban, AlertTriangle, Maximize2, Minimize2, Check, FileText, ExternalLink, Lock, User, UserCheck, Clock3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ShowcaseSession, Decision, DECISION } from './types';
import { formatTime, getEmbedUrl, getDirectImageUrl, isPdfUrl } from './utils';
import { ShowcaseCover } from './ShowcaseCover';
import { useUserContext } from '@/context/UserContext';
import type { GlobalRole } from '@/lib/types';

// Quem pode registrar aceite/ajuste/rejeição — cargo global do perfil
// (mesmo campo que o Squad Pulse já usa em isSquadLeadershipViewer), não um
// papel por sessão. Inclui a variante em PT usada em modais de perfil antigos.
const CAN_DECIDE_ROLES: GlobalRole[] = ['Product Owner', 'Product Owner (PO)', 'SME'];

interface TeatroModeProps {
  session: ShowcaseSession;
  currentIndex: number;
  sortBy?: 'key' | 'type' | 'dev' | 'qa';
  onIndexChange: (i: number) => void;
  onDecision: (id: string, d: Decision, feedback?: string) => void;
  onClose: () => void;
  onFinish: () => void;
}

export function TeatroMode({ session, currentIndex, sortBy, onIndexChange, onDecision, onClose, onFinish }: TeatroModeProps) {
  const { userProfile } = useUserContext();
  const canDecide = !!userProfile && CAN_DECIDE_ROLES.includes(userProfile.role);
  const isCover = currentIndex === -1;
  const task = !isCover ? session.tasks[currentIndex] : null;
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [pendingDecision, setPendingDecision] = useState<Decision>('needs_adjustment');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const isLight = session.presentationBackground === '#ffffff';

  // Timer da Sessão
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSessionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Navegação por Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showFeedback) return;
      if (e.key === 'ArrowRight' && currentIndex < session.tasks.length - 1) {
        onIndexChange(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > -1) {
        onIndexChange(currentIndex - 1);
      } else if (e.key === 'Escape') {
        // Em fullscreen, o navegador já trata Escape saindo do fullscreen
        // sozinho (dispara fullscreenchange) — não fechamos o Modo Teatro
        // junto, senão um Escape só sai das duas coisas de uma vez.
        if (!document.fullscreenElement) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, session.tasks.length, onIndexChange, showFeedback, onClose]);

  // Mantém isFullscreen em sincronia mesmo quando o fullscreen é encerrado
  // fora do botão (Escape nativo do navegador, F11, menu de contexto etc.)
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    setShowFeedback(false);
    setFeedbackText('');
  }, [currentIndex]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col font-sans selection:bg-violet-500/30",
        !session.presentationBackground && "bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-[#050510] to-[#020205]",
        isLight && "text-slate-900"
      )}
      style={session.presentationBackground ? {
        background: session.presentationBackground.startsWith('http')
          ? `linear-gradient(rgba(5, 5, 16, 0.9), rgba(5, 5, 16, 0.95)), url(${session.presentationBackground})`
          : session.presentationBackground,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Modo Teatro - Apresentação de Sprint Review"
    >
      <AnimatePresence>
        {!isCover && (
          <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className={cn(
              "h-16 flex items-center justify-between px-8 border-b backdrop-blur-xl shrink-0 z-50",
              isLight ? "bg-white/80 border-slate-200" : "bg-[#0a0a18]/90 border-white/10"
            )}
          >
            <div className="flex items-center gap-5 xl:gap-8 min-w-0">
              {/* Progress Dots — scrolla internamente em vez de esticar o
                  header quando a sprint tem muita task (não empurra o resto
                  da barra pra fora da tela). */}
              <div className="flex items-center gap-2 overflow-x-auto max-w-[220px] xl:max-w-[340px] shrink py-1 scrollbar-hide" role="navigation" aria-label="Progresso da Apresentação">
                <button
                  onClick={() => onIndexChange(-1)}
                  className={cn("rounded-full transition-all duration-500 shrink-0", isCover ? 'w-10 h-2 bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.6)]' : cn('w-2 h-2', isLight ? 'bg-slate-200 hover:bg-slate-400' : 'bg-white/10 hover:bg-white/30'))}
                />
                {session.tasks.map((t, i) => {
                  const isReady = t.preparationStatus === 'done';
                  const isActive = !isCover && i === currentIndex;
                  return (
                    <button
                      key={i}
                      onClick={() => onIndexChange(i)}
                      className={cn(
                        "relative rounded-full transition-all duration-500 shrink-0",
                        isActive ? 'w-10 h-2 bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.6)]' : cn('w-2 h-2', isLight ? 'bg-slate-200 hover:bg-slate-400' : 'bg-white/10 hover:bg-white/30')
                      )}
                      title={`${t.key}: ${t.title} (${isReady ? 'Pronta' : 'Pendente'})`}
                    >
                      {!isReady && !isActive && (
                        <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sorting & Session Info */}
              <div className="hidden md:flex items-center gap-4 shrink-0">
                {!isCover && (
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Progresso</span>
                    <span className="text-[11px] font-black text-white font-mono tabular-nums">{currentIndex + 1} de {session.tasks.length}</span>
                  </div>
                )}
                {sortBy && (
                  <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-lg">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/60">Ordenação</span>
                    <span className="text-[9px] font-black uppercase text-violet-400">
                      {sortBy === 'key' ? 'Chave Jira' : sortBy === 'type' ? 'Tipo de Issue' : 'Desenvolvedor'}
                    </span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Tempo de Sessão</span>
                  <span className="text-[11px] font-black text-white font-mono">{formatSessionTime(sessionTime)}</span>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onIndexChange(isCover ? -1 : currentIndex - 1)}
                  disabled={isCover}
                  className={cn(
                    "h-9 px-4 rounded-lg font-bold uppercase text-[9px] tracking-widest gap-1.5 border transition-all",
                    isLight
                      ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900"
                      : "bg-white/8 text-white/70 border-white/10 hover:bg-white/15 hover:text-white",
                    "disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onIndexChange(isCover ? 0 : Math.min(session.tasks.length - 1, currentIndex + 1))}
                  disabled={!isCover && currentIndex === session.tasks.length - 1}
                  className="h-9 px-5 rounded-lg font-bold uppercase text-[9px] tracking-widest gap-1.5 bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-violet-900/50"
                >
                  {isCover ? 'Começar' : 'Próxima'} <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!isCover && task && (
                <div className="flex items-center gap-2" title={canDecide ? undefined : 'Somente PO ou SME pode registrar decisão.'}>
                  {!canDecide && (
                    <div className={cn("flex items-center gap-1.5 h-10 px-3 rounded-xl text-[8px] font-black uppercase tracking-widest", isLight ? "bg-slate-100 text-slate-400" : "bg-white/5 text-white/40")}>
                      <Lock className="h-3 w-3" /> Somente PO/SME
                    </div>
                  )}
                  {(['approved', 'needs_adjustment', 'rejected'] as const).map(d => {
                    const config = {
                      approved: { l: 'Aprovar', c: 'bg-emerald-600 shadow-emerald-500/20', icon: Check },
                      needs_adjustment: { l: 'Ajustar', c: 'bg-amber-600 shadow-amber-500/20', icon: AlertTriangle },
                      rejected: { l: 'Rejeitar', c: 'bg-rose-600 shadow-rose-500/20', icon: Ban }
                    };
                    const isSelected = task.decision === d;
                    const Icon = config[d].icon;
                    return (
                      <motion.button
                        key={d}
                        disabled={!canDecide}
                        whileHover={canDecide ? { y: -2, scale: 1.02 } : undefined}
                        whileTap={canDecide ? { scale: 0.98 } : undefined}
                        onClick={() => {
                          if (!canDecide) return;
                          if (d === 'approved') {
                            onDecision(task.id, d);
                          } else {
                            setPendingDecision(d);
                            setFeedbackText('');
                            setShowFeedback(true);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 h-10 px-4 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all border",
                          !canDecide && "opacity-30 cursor-not-allowed",
                          isSelected ? `${config[d].c} text-white border-transparent` : cn(isLight ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200' : 'bg-white/10 text-white border-white/10 hover:bg-white/20')
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {config[d].l}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              <div className="h-7 w-px bg-white/25 mx-1" aria-hidden="true" />

              {currentIndex === session.tasks.length - 1 && (
                <Button onClick={onFinish} size="sm" className="h-10 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-violet-600/20">Finalizar</Button>
              )}

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-10 w-10 rounded-xl bg-white/5 text-white hover:bg-white/10">
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {isCover ? (
            <motion.div
              key="cover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="flex-1"
            >
              <ShowcaseCover session={session} onStart={() => onIndexChange(0)} onClose={onClose} isLight={isLight} />
            </motion.div>
          ) : task ? (
            <TaskSlide key={task.id} task={task} session={session} isLight={isLight} />
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-[#050510]/90 backdrop-blur-2xl flex items-center justify-center p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, rotateX: 10 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.9, y: 20, rotateX: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                "rounded-[4rem] border shadow-[0_100px_200px_rgba(0,0,0,0.8)] w-full max-w-xl overflow-hidden p-16 space-y-10",
                isLight ? "bg-[#fff] border-slate-200" : "bg-[#0f0f1d] border-white/10"
              )}
            >
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className={cn("w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl", pendingDecision === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500')}
                >
                  {pendingDecision === 'rejected' ? <Ban className="h-10 w-10" /> : <AlertTriangle className="h-10 w-10" />}
                </motion.div>
                <h3 id="feedback-title" className={cn("text-3xl font-black uppercase tracking-tighter italic leading-none", isLight ? "text-slate-900" : "text-white")}>
                  {pendingDecision === 'rejected' ? 'Rejeitar Entrega' : 'Solicitar Ajuste'}
                </h3>
                <p className={cn("text-[11px] font-black uppercase tracking-[0.3em]", isLight ? "text-slate-400" : "text-white/60")}>
                  {task ? `${task.key} — ${task.title}` : 'Detalhamento da Revisão Técnica'}
                </p>
              </div>
              <div className="space-y-4">
                <Textarea
                  autoFocus
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Digite o feedback detalhado para a squad..."
                  className={cn(
                    "min-h-[180px] rounded-[2rem] text-base placeholder:text-white/20 transition-all outline-none p-10 leading-relaxed font-medium border",
                    isLight ? "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-300 focus:bg-white" : "bg-white/[0.03] border-white/5 text-white placeholder:text-white/20 focus:bg-white/[0.05] focus:border-white/10"
                  )}
                />
              </div>
              <div className="flex gap-6 pt-4">
                <Button variant="ghost" onClick={() => setShowFeedback(false)} className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest text-white/70 hover:text-white hover:bg-white/10 border border-white/10">Descartar</Button>
                <Button onClick={() => { onDecision(task!.id, pendingDecision, feedbackText); setShowFeedback(false); }} className={cn("flex-1 h-14 rounded-2xl text-white font-black uppercase text-[11px] tracking-widest shadow-2xl", pendingDecision === 'rejected' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700')}>Confirmar Decisão</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TaskSlide({ task, session, isLight }: { task: import('./types').ShowcaseTask, session: ShowcaseSession, isLight?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const url = task?.evidence.video || task?.evidence.screenshot;

  // Reset error when URL changes
  useEffect(() => {
    setImgError(false);
  }, [url]);

  // Cada task entra com os detalhes recolhidos — reabrir a cada slide seria
  // voltar pra densidade que a gente tava tentando tirar.
  useEffect(() => {
    setShowDetails(false);
  }, [task?.id]);

  const hasEffort = (task?.evidence.timeSpent || 0) > 0 || (task?.evidence.timeEstimate || 0) > 0;
  const hasVersions = !!(task?.project || task?.versionMaster || task?.versionDevelop || task?.versionRelease);

  return (
    <motion.main
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="flex-1 flex overflow-hidden"
    >
      <div className={cn(
        "w-full md:w-[30%] lg:w-[26%] min-w-[380px] max-w-[560px] border-r flex flex-col shrink-0 z-20 transition-all duration-700",
        isLight
          ? "bg-[#fff] border-slate-200 shadow-[40px_0_100px_rgba(0,0,0,0.05)]"
          : cn(
            session.presentationTheme === 'glass' ? "bg-white/[0.02] backdrop-blur-3xl" : "bg-[#080812]/95 backdrop-blur-3xl",
            "border-white/10 shadow-[40px_0_100px_rgba(0,0,0,0.8)]"
          ),
        session.presentationTheme === 'minimalist' && "border-r-0 shadow-none"
      )}>
        <ScrollArea className="flex-1">
          <article className="p-6 space-y-5">
            <header className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                    <Badge className="bg-violet-600/90 text-white border-none font-bold text-[10px] px-2.5 py-1 rounded-full shadow-lg shadow-violet-600/20">{task?.key}</Badge>
                  </motion.div>
                  <span className={cn("text-[11px]", isLight ? "text-slate-400" : "text-white/40")}>{task?.type}</span>
                </div>
                {task && (
                  <Badge className={cn("border-none font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0", DECISION[task.decision].cls)}>
                    {DECISION[task.decision].icon}
                    {DECISION[task.decision].label}
                  </Badge>
                )}
              </div>
              <h2 className={cn("text-2xl font-semibold leading-tight tracking-tight", isLight ? "text-slate-900" : "text-white")}>{task?.title}</h2>
              <p className={cn("text-[13px] leading-relaxed", isLight ? "text-slate-500" : "text-white/60")}>
                {task?.evidence.problem || "Sem problema/motivação descrita."}
              </p>
            </header>

            <div className={cn("flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[12px] pb-5 border-b", isLight ? "border-slate-100 text-slate-500" : "border-white/5 text-white/50")}>
              <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />{task?.evidence.dev || '—'}</span>
              <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />{task?.evidence.qa || '—'}</span>
              {hasEffort && (
                <span className="flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                  {formatTime(task?.evidence.timeSpent) || '—'}
                  <span className="opacity-50">/ {formatTime(task?.evidence.timeEstimate) || '—'}</span>
                </span>
              )}
            </div>

            <button
              onClick={() => setShowDetails(v => !v)}
              className={cn("flex items-center gap-1.5 text-[11px] font-semibold transition-colors", isLight ? "text-slate-500 hover:text-slate-900" : "text-white/50 hover:text-white")}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")} />
              {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
            </button>

            {showDetails && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                <section className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400">A Solução</p>
                  <p className={cn("text-[12px] leading-relaxed break-words whitespace-pre-wrap", isLight ? "text-slate-600" : "text-white/80")}>
                    {task?.evidence.solution || "Descrição da solução técnica não disponível."}
                  </p>
                </section>

                <section className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-violet-400">Critérios de Aceite</p>
                  <p className={cn("text-[12px] leading-relaxed break-words whitespace-pre-wrap", isLight ? "text-slate-600" : "text-white/80")}>
                    {task?.acceptanceCriteria || "Nenhum critério detalhado para esta issue."}
                  </p>
                </section>

                {hasVersions && task && (
                  <section className="space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-400">Deploy / Versões</p>
                    <div className={cn("rounded-xl p-3 border space-y-2", isLight ? "bg-slate-50 border-slate-100" : "bg-black/20 border-white/[0.03]")}>
                      {task.project && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={cn("text-[9px] uppercase tracking-wider", isLight ? "text-slate-400" : "text-white/40")}>Projeto</span>
                          <span className={cn("font-medium truncate max-w-[200px]", isLight ? "text-slate-700" : "text-white")}>{task.project}</span>
                        </div>
                      )}
                      {(task.versionMaster || task.versionDevelop || task.versionRelease) && (
                        <div className={cn("grid grid-cols-3 gap-2 border-t border-dashed pt-2", isLight ? "border-slate-200" : "border-white/5")}>
                          {task.versionMaster && (
                            <div className="flex flex-col">
                              <span className={cn("text-[7px] uppercase tracking-wider mb-0.5", isLight ? "text-slate-400" : "text-white/40")}>Master</span>
                              <span className={cn("text-[10px] font-medium truncate", isLight ? "text-slate-700" : "text-emerald-400")}>{task.versionMaster}</span>
                            </div>
                          )}
                          {task.versionDevelop && (
                            <div className="flex flex-col">
                              <span className={cn("text-[7px] uppercase tracking-wider mb-0.5", isLight ? "text-slate-400" : "text-white/40")}>Develop</span>
                              <span className={cn("text-[10px] font-medium truncate", isLight ? "text-slate-700" : "text-amber-400")}>{task.versionDevelop}</span>
                            </div>
                          )}
                          {task.versionRelease && (
                            <div className="flex flex-col">
                              <span className={cn("text-[7px] uppercase tracking-wider mb-0.5", isLight ? "text-slate-400" : "text-white/40")}>Release</span>
                              <span className={cn("text-[10px] font-medium truncate", isLight ? "text-slate-700" : "text-cyan-400")}>{task.versionRelease}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
            <div className="h-2" /> {/* Bottom Spacer */}
          </article>
        </ScrollArea>
      </div>

      <div className={cn("flex-1 relative flex flex-col overflow-hidden", isLight ? "bg-slate-50" : "bg-[#050510]")}>
        <div className={cn(
          "absolute inset-0 pointer-events-none",
          isLight
            ? "bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.05),transparent_70%)]"
            : "bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.15),transparent_70%)]"
        )} aria-hidden="true" />

        <div className="flex-1 flex items-center justify-center p-12 relative z-10">
          <AnimatePresence mode="wait">
            {(() => {
              if (!task) return null;
              const url = task.evidence.video || task.evidence.screenshot;
              if (!url) return (
                <motion.div
                  key="no-evidence"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center space-y-8"
                >
                  <div className={cn(
                    "w-40 h-40 rounded-[4rem] border flex items-center justify-center mx-auto shadow-2xl animate-pulse",
                    isLight ? "bg-slate-100 border-slate-200 text-slate-200" : "bg-white/5 border-white/10 text-white/5"
                  )}>
                    <Camera className="h-16 w-16" />
                  </div>
                  <div className="space-y-3">
                    <p className={cn("text-lg font-black uppercase tracking-[0.4em] italic", isLight ? "text-slate-200" : "text-white/20")}>No Evidence Detected</p>
                    <p className={cn("text-xs font-bold max-w-xs mx-auto", isLight ? "text-slate-300" : "text-white/10")}>Vincule um link de vídeo ou screenshot para demonstrar esta entrega.</p>
                  </div>
                </motion.div>
              );

              const isImage = url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || url.includes('images.unsplash.com');
              const isPdf = isPdfUrl(url);
              const embedUrl = getEmbedUrl(url);
              const isEmbed = (embedUrl !== url || isPdf || url.includes('loom.com'));

              if (isEmbed) {
                return (
                  <motion.div
                    key={`embed-${url}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                    className={cn(
                      "w-full h-full max-w-6xl rounded-[3.5rem] overflow-hidden border shadow-[0_50px_150px_rgba(0,0,0,0.8)] relative group",
                      isLight ? "bg-[#fff] border-slate-200 shadow-[0_50px_150px_rgba(0,0,0,0.1)]" : "bg-black border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    {isPdf && !url.includes('drive.google.com') && (
                      <div className="absolute top-6 right-10 z-20 flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 pointer-events-none">
                        <FileText className="h-3.5 w-3.5 text-white/70" />
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">PDF Mode</span>
                      </div>
                    )}
                    <iframe
                      src={embedUrl}
                      title={`Evidência da Tarefa: ${task.title}`}
                      className="w-full h-full border-none z-0 bg-[#0d0d1a]"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </motion.div>
                );
              }

              if (isImage && !imgError) {
                return (
                  <motion.div
                    key={`image-${url}`}
                    initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                    className={cn(
                      "w-full h-full max-w-6xl rounded-[3.5rem] overflow-hidden border flex items-center justify-center group",
                      isLight ? "bg-[#fff] border-slate-200 shadow-[0_50px_150px_rgba(0,0,0,0.1)]" : "bg-[#0d0d1a] border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)]"
                    )}
                  >
                    <img
                      src={getDirectImageUrl(url)}
                      onError={() => setImgError(true)}
                      alt={`Evidência visual: ${task.title}`}
                      className="max-w-full max-h-full object-contain transition-all duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={`fallback-${url}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center space-y-8"
                >
                  <div className={cn(
                    "w-40 h-40 rounded-[4rem] border flex items-center justify-center mx-auto shadow-2xl",
                    isLight ? "bg-slate-100 border-slate-200 text-slate-400" : "bg-white/5 border-white/10 text-white/80"
                  )}>
                    <ExternalLink className="h-16 w-16" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className={cn("text-lg font-black uppercase tracking-[0.4em] italic", isLight ? "text-slate-400" : "text-white/60")}>Link Externo</p>
                      <p className={cn("text-[10px] font-bold max-w-xs mx-auto truncate px-4 opacity-50 font-mono", isLight ? "text-slate-500" : "text-white/60")}>{url}</p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className={cn(
                        "h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 transition-all active:scale-95",
                        isLight
                          ? "border-slate-200 bg-[#fff] text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                          : "border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center">
                        Abrir em nova aba <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </div>
    </motion.main>
  );
}
