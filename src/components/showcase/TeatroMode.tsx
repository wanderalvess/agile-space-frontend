'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, ChevronDown, X, Camera, Ban, AlertTriangle, Maximize2, Minimize2, Check, FileText, ExternalLink, Lock, User, UserCheck, Clock3, TrendingUp, PanelLeftClose, PanelLeftOpen, ZoomIn
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ShowcaseSession, Decision, DECISION } from './types';
import { ChartRenderer } from './ChartRenderer';
import { getCategoryColor } from './chartPresets';
import { formatTime, getEmbedUrl, getDirectImageUrl, isPdfUrl, stripWikiMarkup, isLightBackground, getEvidenceUrls, isImageBackground, imageBackgroundCss } from './utils';
import { TeatroHeader } from './TeatroHeader';
import { TaskFileEvidence } from './TaskFileEvidence';
import { ShowcaseCover } from './ShowcaseCover';
import { useUserContext } from '@/context/UserContext';
import { useJiraSettings, type JiraSettings } from '@/hooks/useJiraSettings';
import { fetchJiraAttachmentBlobUrl } from '@/services/jiraService';
import type { GlobalRole } from '@/lib/types';

const cleanJiraDomain = (d: string) => d.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

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
  // Levantado aqui (não dentro de TaskSlide) porque TaskSlide remonta a cada
  // troca de card (key={task.id}) — buscar de novo a cada slide seria uma
  // chamada extra por card, sem necessidade.
  const { settings: jiraSettings } = useJiraSettings();
  const canDecide = !!userProfile && CAN_DECIDE_ROLES.includes(userProfile.role);
  const isCover = currentIndex === -1;
  const task = !isCover ? session.tasks[currentIndex] : null;
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [pendingDecision, setPendingDecision] = useState<Decision>('needs_adjustment');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  // Colapsar a sidebar dá mais espaço pra evidência (foto/vídeo) na tela —
  // pedido de quem apresenta, mantém o estado entre slides (não é por card).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isLight = isLightBackground(session.presentationBackground);


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
        "fixed inset-0 z-[100] flex flex-col selection:bg-violet-500/30",
        !session.presentationBackground && "bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-[#050510] to-[#020205]",
        isLight ? "text-slate-900 bg-white" : "text-white"
      )}
      style={session.presentationBackground ? {
        background: isImageBackground(session.presentationBackground)
          ? imageBackgroundCss(session.presentationBackground)
          : session.presentationBackground,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Modo Teatro - Apresentação de Sprint Review"
    >
      <TeatroHeader
        session={session}
        currentIndex={currentIndex}
        sortBy={sortBy}
        isCover={isCover}
        isLight={isLight}
        canDecide={canDecide}
        sessionTimeLabel={formatSessionTime(sessionTime)}
        isFullscreen={isFullscreen}
        sidebarCollapsed={sidebarCollapsed}
        onIndexChange={onIndexChange}
        onToggleFullscreen={toggleFullscreen}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        onClose={onClose}
        onFinish={onFinish}
        onApprove={(taskId) => onDecision(taskId, 'approved')}
        onRequestFeedback={(d) => { setPendingDecision(d); setFeedbackText(''); setShowFeedback(true); }}
      />

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
            <TaskSlide
              key={task.id}
              task={task}
              nextTask={session.tasks[currentIndex + 1]}
              session={session}
              isLight={isLight}
              jiraSettings={jiraSettings}
              sidebarCollapsed={sidebarCollapsed}
            />
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
                <h3 id="feedback-title" className={cn("text-3xl font-black tracking-tight leading-none", isLight ? "text-slate-900" : "text-white")}>
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
                <Button
                  variant="ghost"
                  onClick={() => setShowFeedback(false)}
                  className={cn(
                    "flex-1 h-14 rounded-2xl font-black uppercase text-[11px] tracking-widest border transition-colors",
                    isLight
                      ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
                      : "text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                  )}
                >
                  Descartar
                </Button>
                <Button onClick={() => { onDecision(task!.id, pendingDecision, feedbackText); setShowFeedback(false); }} className={cn("flex-1 h-14 rounded-2xl text-white font-black uppercase text-[11px] tracking-widest shadow-2xl", pendingDecision === 'rejected' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700')}>Confirmar Decisão</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TaskSlide({ task, nextTask, session, isLight, jiraSettings, sidebarCollapsed }: { task: import('./types').ShowcaseTask, nextTask?: import('./types').ShowcaseTask, session: ShowcaseSession, isLight?: boolean, jiraSettings: JiraSettings | null, sidebarCollapsed?: boolean }) {
  const [imgError, setImgError] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);
  // Screenshot e vídeo podem coexistir — cada um pode ser imagem ou vídeo, o
  // tipo é sempre detectado pelo conteúdo da URL logo abaixo, nunca pelo
  // campo de origem. evidencePreference só decide qual abre primeiro (padrão
  // 'video', igual ao comportamento de antes dessa flag existir) — quem
  // apresenta alterna pra outra logo abaixo, nenhuma fica escondida.
  const [evidenceIndex, setEvidenceIndex] = useState(0);
  const evidenceUrls = getEvidenceUrls(task?.evidence || { screenshot: '', video: '' });
  // Arquivos anexados ao card vêm depois dos links (print/vídeo do Jira) e entram na mesma navegação.
  const attachedFiles = task?.attachments || [];
  const evidenceCount = evidenceUrls.length + attachedFiles.length;
  const safeIndex = Math.min(evidenceIndex, Math.max(evidenceCount - 1, 0));
  const url = safeIndex < evidenceUrls.length ? evidenceUrls[safeIndex] : undefined;
  const currentFile = safeIndex >= evidenceUrls.length ? attachedFiles[safeIndex - evidenceUrls.length] : undefined;
  const goToEvidence = (i: number) => {
    if (i < 0 || i >= evidenceCount) return;
    setEvidenceIndex(i);
  };

  // Anexo/thumbnail do próprio Jira (ex.: /secure/attachment/..., /secure/
  // thumbnail/...) exige sessão — como <img> cross-origin não manda o cookie
  // do Jira (bloqueado por padrão em requisição de terceiro), a imagem nunca
  // carrega direto. Detectando que a URL é do mesmo domínio configurado,
  // busca via proxy autenticado (PAT) abaixo em vez de tentar direto.
  const isJiraAttachment = !!(jiraSettings?.domain && url && (() => {
    try { return new URL(url).hostname === cleanJiraDomain(jiraSettings.domain); } catch { return false; }
  })());
  const [jiraBlobUrl, setJiraBlobUrl] = useState<string | null>(null);
  const [jiraBlobFailed, setJiraBlobFailed] = useState(false);

  // Reset error when URL changes (jiraSettings?.domain na dependência cobre
  // o caso em que a config do Jira ainda não tinha carregado na primeira
  // tentativa — sem isso, o <img> falhava antes de saber que era pra usar
  // o proxy, e imgError ficava travado em true mesmo depois de isJiraAttachment
  // virar true).
  useEffect(() => {
    setImgError(false);
  }, [url, jiraSettings?.domain]);

  useEffect(() => {
    setJiraBlobUrl(null);
    setJiraBlobFailed(false);
    if (!isJiraAttachment || !jiraSettings || !url) return;
    let cancelled = false;
    fetchJiraAttachmentBlobUrl(jiraSettings.domain, jiraSettings.token, url).then(blobUrl => {
      if (cancelled) return;
      if (blobUrl) setJiraBlobUrl(blobUrl);
      else setJiraBlobFailed(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, isJiraAttachment, jiraSettings?.domain, jiraSettings?.token]);

  // Revoga o object URL só depois de trocado/desmontado — revogar no mesmo
  // effect que cria (cleanup roda antes do próximo set) invalidaria a src
  // que acabou de ser aplicada na tag <img>.
  useEffect(() => {
    return () => { if (jiraBlobUrl) URL.revokeObjectURL(jiraBlobUrl); };
  }, [jiraBlobUrl]);

  // Cada task entra com os detalhes recolhidos — reabrir a cada slide seria
  // voltar pra densidade que a gente tava tentando tirar.
  useEffect(() => {
    setShowDetails(false);
    setImageExpanded(false);
    setEvidenceIndex(0);
  }, [task?.id]);

  // Pré-carrega o vídeo/embed do próximo card num iframe invisível — é a
  // maior demora sentida ao apresentar (Loom/Drive/YouTube levam segundos
  // pra montar o player). Quando o apresentador avança, o iframe real troca
  // pra essa mesma URL e o navegador já tem boa parte em cache/conexão aberta.
  const nextUrl = nextTask ? getEvidenceUrls(nextTask.evidence)[0] : undefined;
  const nextEmbedUrl = nextUrl ? getEmbedUrl(nextUrl) : undefined;
  const nextIsPreloadableEmbed = !!nextUrl && !!nextEmbedUrl && (nextEmbedUrl !== nextUrl || isPdfUrl(nextUrl) || nextUrl.includes('loom.com'));

  const hasEffort = (task?.evidence.timeSpent || 0) > 0 || (task?.evidence.timeEstimate || 0) > 0;
  const hasVersions = !!(task?.project || task?.versionSuporte || task?.versionMaster || task?.versionRelease || task?.versionDevelop);
  const metrics = task?.metrics?.filter(m => m.field.trim()) || [];
  const isMetricsCard = task?.cardKind === 'metrics';
  // Card padrão pode pedir pra métrica virar o destaque da tela principal
  // (mesmo tratamento visual do card 'metrics' puro) em vez do resumo pequeno
  // de sempre — troca só a tela principal, sidebar (dev/qa/detalhes) continua.
  const isFeaturedChart = !isMetricsCard && task?.chartDisplay === 'featured' && metrics.length > 0;
  const showBigMetricsStage = isMetricsCard || isFeaturedChart;

  return (
    <motion.main
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="flex-1 flex overflow-hidden"
    >
      <div className={cn(
        "border-r flex flex-col shrink-0 z-20 transition-all duration-300 overflow-hidden",
        sidebarCollapsed ? "w-0 min-w-0 border-r-0" : "w-full md:w-[30%] lg:w-[26%] min-w-[380px] max-w-[560px]",
        isLight
          ? "bg-[#fff] border-slate-200 shadow-[40px_0_100px_rgba(0,0,0,0.05)]"
          : cn(
            session.presentationTheme === 'glass' ? "bg-white/[0.02] backdrop-blur-3xl" : "bg-[#080812]/95 backdrop-blur-3xl",
            "border-white/10 shadow-[40px_0_100px_rgba(0,0,0,0.8)]"
          ),
        session.presentationTheme === 'minimalist' && "border-r-0 shadow-none"
      )}>
        {/* O viewport do Radix embrulha o conteúdo em display:table, que cresce até o maior trecho
            sem quebra (ex.: caminho/URL longo) e estoura o painel; forçar block deixa o texto quebrar. */}
        <ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
          <article className="p-6 space-y-5 min-w-0 [overflow-wrap:anywhere]">
            <header className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                    <Badge className="bg-violet-600/90 text-white border-none font-bold text-[11px] px-2.5 py-1 rounded-full shadow-lg shadow-violet-600/20">{task?.key}</Badge>
                  </motion.div>
                  <span className={cn("text-[11px]", isLight ? "text-slate-400" : "text-white/40")}>{task?.type}</span>
                </div>
                {task && (
                  <Badge className={cn("border-none font-bold text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0", DECISION[task.decision].cls)}>
                    {DECISION[task.decision].icon}
                    {DECISION[task.decision].label}
                  </Badge>
                )}
              </div>
              <h2 className={cn("text-2xl font-semibold leading-tight tracking-tight", isLight ? "text-slate-900" : "text-white")}>{task?.title}</h2>
              <p className={cn("text-[13px] leading-relaxed", isLight ? "text-slate-500" : "text-white/60")}>
                {isMetricsCard
                  ? (stripWikiMarkup(task?.description) || "Sem contexto descrito.")
                  : (stripWikiMarkup(task?.evidence.problem) || "Sem problema/motivação descrita.")}
              </p>

              {/* Resumo de impacto sempre visível — é o número que a squad quer
                  destacar na hora de apresentar, não deveria ficar atrás de um clique. */}
              {metrics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {metrics.map((m, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border",
                        isLight ? "bg-violet-50 border-violet-100 text-violet-700" : "bg-violet-500/10 border-violet-500/20 text-violet-300"
                      )}
                    >
                      <TrendingUp className="h-3 w-3 opacity-70" />
                      {m.field}: {m.value.toLocaleString('pt-BR')}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {!isMetricsCard && (
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
              {([
                { url: task?.evidence.techDocUrl, label: 'Doc. técnico' },
                { url: task?.evidence.tdnUrl, label: 'TDN' },
              ]).filter(l => l.url).map(l => (
                <a
                  key={l.label}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline", isLight ? "text-violet-600" : "text-violet-300")}
                >
                  <FileText className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />{l.label}
                </a>
              ))}
            </div>
            )}

            {!isMetricsCard && (
            <button
              onClick={() => setShowDetails(v => !v)}
              className={cn("flex items-center gap-1.5 text-[11px] font-semibold transition-colors", isLight ? "text-slate-500 hover:text-slate-900" : "text-white/50 hover:text-white")}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")} />
              {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
            </button>
            )}

            {!isMetricsCard && showDetails && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                <section className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-400">A Solução</p>
                  <p className={cn("text-[12px] leading-relaxed break-words whitespace-pre-wrap", isLight ? "text-slate-600" : "text-white/80")}>
                    {stripWikiMarkup(task?.evidence.solution) || "Descrição da solução técnica não disponível."}
                  </p>
                </section>

                <section className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-violet-400">Critérios de Aceite</p>
                  <p className={cn("text-[12px] leading-relaxed break-words whitespace-pre-wrap", isLight ? "text-slate-600" : "text-white/80")}>
                    {stripWikiMarkup(task?.acceptanceCriteria) || "Nenhum critério detalhado para esta issue."}
                  </p>
                </section>

                {hasVersions && task && (
                  <section className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-400">Deploy / Versões</p>
                    <div className={cn("rounded-xl p-3 border space-y-2", isLight ? "bg-slate-50 border-slate-100" : "bg-black/20 border-white/[0.03]")}>
                      {task.project && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={cn("text-[11px] uppercase tracking-wider", isLight ? "text-slate-400" : "text-white/40")}>Projeto</span>
                          <span className={cn("font-medium truncate max-w-[200px]", isLight ? "text-slate-700" : "text-white")}>{task.project}</span>
                        </div>
                      )}
                      {(task.versionSuporte || task.versionMaster || task.versionRelease || task.versionDevelop) && (
                        <div className={cn("grid grid-cols-4 gap-2 border-t border-dashed pt-2", isLight ? "border-slate-200" : "border-white/5")}>
                          {task.versionSuporte && (
                            <div className="flex flex-col">
                              <span className={cn("text-[11px] uppercase tracking-wider mb-0.5", isLight ? "text-slate-400" : "text-white/40")}>Suporte</span>
                              <span className={cn("text-[11px] font-medium truncate", isLight ? "text-slate-700" : "text-rose-400")}>{task.versionSuporte}</span>
                            </div>
                          )}
                          {task.versionMaster && (
                            <div className="flex flex-col">
                              <span className={cn("text-[11px] uppercase tracking-wider mb-0.5", isLight ? "text-slate-400" : "text-white/40")}>Master</span>
                              <span className={cn("text-[11px] font-medium truncate", isLight ? "text-slate-700" : "text-emerald-400")}>{task.versionMaster}</span>
                            </div>
                          )}
                          {task.versionRelease && (
                            <div className="flex flex-col">
                              <span className={cn("text-[11px] uppercase tracking-wider mb-0.5", isLight ? "text-slate-400" : "text-white/40")}>Release</span>
                              <span className={cn("text-[11px] font-medium truncate", isLight ? "text-slate-700" : "text-cyan-400")}>{task.versionRelease}</span>
                            </div>
                          )}
                          {task.versionDevelop && (
                            <div className="flex flex-col">
                              <span className={cn("text-[11px] uppercase tracking-wider mb-0.5", isLight ? "text-slate-400" : "text-white/40")}>Develop</span>
                              <span className={cn("text-[11px] font-medium truncate", isLight ? "text-slate-700" : "text-amber-400")}>{task.versionDevelop}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Em destaque o gráfico já vai grande na tela principal —
                    repetir ele pequeno aqui embaixo seria duplicado. */}
                {metrics.length > 0 && !isFeaturedChart && (
                  <section className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-violet-400">{task?.chartTitle || 'Métricas de Impacto'}</p>
                    <ChartRenderer
                      type={task?.chartType}
                      title=""
                      data={metrics.map(m => ({ name: m.field, value: m.value, color: getCategoryColor(m.field) }))}
                      height={140}
                      defaultColor="hsl(262, 83%, 65%)"
                      isLight={isLight}
                    />
                  </section>
                )}
              </div>
            )}
            <div className="h-2" /> {/* Bottom Spacer */}
          </article>
        </ScrollArea>
      </div>

      <div className={cn(
        "flex-1 relative flex flex-col overflow-hidden transition-colors",
        isLight
          ? (session.presentationBackground ? "bg-white/40" : "bg-slate-50/90")
          : (session.presentationBackground ? "bg-transparent" : "bg-[#050510]")
      )}>
        <div className={cn(
          "absolute inset-0 pointer-events-none",
          isLight
            ? "bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.04),transparent_70%)]"
            : "bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.15),transparent_70%)]"
        )} aria-hidden="true" />

        <div className="flex-1 flex items-center justify-center p-12 relative z-10">
          <AnimatePresence mode="wait">
            {(() => {
              if (!task) return null;

              // Card de métricas (sempre) ou card padrão com gráfico em
              // destaque (opt-in): o gráfico É a evidência principal — mostra
              // ele grande aqui em vez de procurar screenshot/vídeo.
              if (showBigMetricsStage) return (
                <motion.div
                  key="metrics-chart"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                  className={cn(
                    "w-full h-full max-w-4xl rounded-[3.5rem] overflow-hidden border p-12 flex flex-col justify-center gap-8",
                    isLight ? "bg-white border-slate-200 shadow-[0_30px_90px_rgba(0,0,0,0.06)]" : "bg-[#0d0d1a] border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)]"
                  )}
                >
                  {metrics.length > 0 ? (
                    <>
                      {task.chartTitle && (
                        <p className={cn("text-center text-xs font-black uppercase tracking-[0.3em]", isLight ? "text-violet-600" : "text-violet-400")}>{task.chartTitle}</p>
                      )}
                      <div className="flex flex-wrap justify-center gap-4">
                        {metrics.map((m, i) => (
                          <div key={i} className="text-center px-6">
                            <p className={cn("text-4xl font-black tracking-tight", isLight ? "text-violet-700" : "text-violet-300")}>{m.value.toLocaleString('pt-BR')}</p>
                            <p className={cn("text-[11px] font-bold uppercase tracking-widest mt-1", isLight ? "text-slate-500" : "text-white/40")}>{m.field}</p>
                          </div>
                        ))}
                      </div>
                      <ChartRenderer type={task.chartType} title="" data={metrics.map(m => ({ name: m.field, value: m.value, color: getCategoryColor(m.field) }))} height={280} defaultColor="hsl(262, 83%, 65%)" isLight={isLight} bare />
                    </>
                  ) : (
                    <p className={cn("text-center text-sm font-bold uppercase tracking-widest", isLight ? "text-slate-400" : "text-white/20")}>Sem métricas preenchidas ainda</p>
                  )}
                </motion.div>
              );

              if (currentFile) return (
                <TaskFileEvidence key={`file-${currentFile.id}`} sessionId={session.id} file={currentFile} title={task.title} isLight={isLight} />
              );

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
                    isLight ? "bg-white border-slate-200 text-slate-300 shadow-slate-200/50" : "bg-white/5 border-white/10 text-white/5"
                  )}>
                    <Camera className="h-16 w-16" />
                  </div>
                  <div className="space-y-3">
                    <p className={cn("text-lg font-black tracking-wide", isLight ? "text-slate-400" : "text-white/20")}>Sem evidência vinculada</p>
                    <p className={cn("text-xs font-bold max-w-xs mx-auto", isLight ? "text-slate-500" : "text-white/40")}>Vincule um link de vídeo ou screenshot, ou anexe um arquivo no card, para demonstrar esta entrega.</p>
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
                      isLight ? "bg-white border-slate-200 shadow-[0_30px_90px_rgba(0,0,0,0.08)]" : "bg-black border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    {isPdf && !url.includes('drive.google.com') && (
                      <div className="absolute top-6 right-10 z-20 flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 pointer-events-none">
                        <FileText className="h-3.5 w-3.5 text-white/70" />
                        <span className="text-[11px] font-bold text-white/50 uppercase tracking-wide">PDF Mode</span>
                      </div>
                    )}
                    {/* Saída pra nova aba sempre visível — vários hosts (Drive
                        privado, sites com X-Frame-Options) recusam ser
                        embutidos e o iframe fica em branco sem dar nenhuma
                        saída pro apresentador. */}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir evidência em nova aba"
                      className={cn(
                        "absolute top-6 left-10 z-20 flex items-center gap-2 px-3 py-1.5 backdrop-blur-md rounded-full border transition-colors",
                        isLight
                          ? "bg-slate-900/80 hover:bg-slate-900 text-white border-slate-700 shadow-md"
                          : "bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 text-white/70 hover:text-white"
                      )}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-bold uppercase tracking-wide">Nova Aba</span>
                    </a>
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


              // Anexo do próprio Jira que ainda não terminou (ou falhou) de
              // buscar via proxy autenticado: `jiraBlobFailed` deixa cair pro
              // fallback final (Link Externo) em vez de tentar a URL crua,
              // que já se sabe que não carrega sem o proxy.
              if (isImage && !imgError && !(isJiraAttachment && jiraBlobFailed)) {
                if (isJiraAttachment && !jiraBlobUrl) {
                  return (
                    <motion.div
                      key={`jira-loading-${url}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center space-y-6"
                    >
                      <div className={cn(
                        "w-40 h-40 rounded-[4rem] border flex items-center justify-center mx-auto animate-pulse",
                        isLight ? "bg-slate-100 border-slate-200 text-slate-300" : "bg-white/5 border-white/10 text-white/20"
                      )}>
                        <Camera className="h-16 w-16" />
                      </div>
                      <p className={cn("text-xs font-black uppercase tracking-[0.3em]", isLight ? "text-slate-300" : "text-white/20")}>Carregando evidência do Jira...</p>
                    </motion.div>
                  );
                }
                return (
                  <motion.div
                    key={`image-${url}`}
                    initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                    className={cn(
                      "w-full h-full max-w-6xl rounded-[3.5rem] overflow-hidden border flex items-center justify-center group cursor-zoom-in",
                      isLight ? "bg-[#fff] border-slate-200 shadow-[0_50px_150px_rgba(0,0,0,0.1)]" : "bg-[#0d0d1a] border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.8)]"
                    )}
                    onClick={() => setImageExpanded(true)}
                    title="Clique para ampliar"
                  >
                    <img
                      src={isJiraAttachment ? jiraBlobUrl! : getDirectImageUrl(url)}
                      onError={() => setImgError(true)}
                      alt={`Evidência visual: ${task.title}`}
                      className="max-w-full max-h-full object-contain transition-all duration-1000 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <div className="absolute bottom-6 right-8 z-20 flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <ZoomIn className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-bold uppercase tracking-wide">Ampliar</span>
                    </div>
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
                      <p className={cn("text-lg font-black tracking-wide", isLight ? "text-slate-400" : "text-white/60")}>Abrir link externo</p>
                      <p className={cn("text-[11px] font-bold max-w-xs mx-auto truncate px-4 opacity-50 font-code", isLight ? "text-slate-500" : "text-white/60")}>{url}</p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className={cn(
                        "h-12 px-8 rounded-2xl font-bold uppercase text-[11px] tracking-wide border-2 transition-all active:scale-95",
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

        {evidenceCount > 1 && (
          <div className={cn(
            "absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1.5 rounded-2xl border backdrop-blur-xl shadow-xl",
            isLight ? "bg-white/90 border-slate-200" : "bg-white/5 border-white/10"
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToEvidence(safeIndex - 1)}
              disabled={safeIndex === 0}
              title="Evidência anterior"
              className={cn("h-9 w-9 rounded-xl disabled:opacity-30", isLight ? "text-slate-500 hover:bg-slate-100" : "text-white/70 hover:bg-white/10")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className={cn("px-2 text-[11px] font-bold uppercase tracking-wide tabular-nums", isLight ? "text-slate-500" : "text-white/60")}>
              Evidência {safeIndex + 1}/{evidenceCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToEvidence(safeIndex + 1)}
              disabled={safeIndex === evidenceCount - 1}
              title="Próxima evidência"
              className={cn("h-9 w-9 rounded-xl disabled:opacity-30", isLight ? "text-slate-500 hover:bg-slate-100" : "text-white/70 hover:bg-white/10")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Preload silencioso do próximo vídeo/embed — 1x1, fora da tela, sem
          som/foco. Só existe pra esquentar a conexão/cache antes do avançar. */}
      {nextIsPreloadableEmbed && (
        <iframe
          key={`preload-${nextEmbedUrl}`}
          src={nextEmbedUrl}
          title="Preload da próxima evidência"
          aria-hidden="true"
          tabIndex={-1}
          className="w-px h-px absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none border-none"
        />
      )}

      <AnimatePresence>
        {imageExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-8 cursor-zoom-out"
            onClick={() => setImageExpanded(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setImageExpanded(false)}
              className="absolute top-6 right-8 h-10 w-10 rounded-xl bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={isJiraAttachment ? jiraBlobUrl! : getDirectImageUrl(url || '')}
              alt={`Evidência visual ampliada: ${task.title}`}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  );
}
