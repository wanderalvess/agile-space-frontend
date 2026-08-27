'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  CloudDownload, Play, ShieldCheck, Loader2, Plus, Settings, HelpCircle, Share2, Search, Filter, SortAsc, Users, Tag, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JiraIssue } from '@/services/jiraService';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { getAuthToken } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

// New Refactored Components & Utils
import { ShowcaseSession, ShowcaseTask, Decision } from '@/components/showcase/types';
import { formatTime, makeTask } from '@/components/showcase/utils';
import { TaskCard } from '@/components/showcase/TaskCard';
import { TeatroMode } from '@/components/showcase/TeatroMode';
import { JiraImportDialog } from '@/components/shared/JiraImportDialog';
import { SessionSettingsDialog } from '@/components/showcase/SessionSettingsDialog';
import { SummaryDialog } from '@/components/showcase/SummaryDialog';
import { PrintSlidesView } from '@/components/showcase/PrintSlidesView';
import { HelpSheet } from '@/components/showcase/HelpSheet';
import { decryptSecret } from '@/lib/vault-crypto';
import { showcaseApi } from '../api';

// ─────────────────────────────────────────────
// Main Room Component
// ─────────────────────────────────────────────
export default function ShowcaseRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { session: authSession } = useAuth();
  const { userProfile } = useUserContext();
  const { toast } = useToast();

  const [session, setSession] = useState<ShowcaseSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isJiraOpen, setIsJiraOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [search, setSearch] = useState('');
  const [filterDev, setFilterDev] = useState('all');
  const [filterQa, setFilterQa] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setBy] = useState<'key' | 'type' | 'dev' | 'qa'>('key');

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const isMounted = React.useRef(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const reloadSession = useCallback(async () => {
    if (!id) return;
    try {
      const data = await showcaseApi.getSession(id);
      if (data) {
        const tasks = (data.tasks || []).map((t: any) => ({
          ...t,
          evidence: {
            problem: t.evidence?.problem || t.description || '',
            solution: t.evidence?.solution || t.evidence?.execution || '',
            dev: t.evidence?.dev || t.assignee || '',
            qa: t.evidence?.qa || '',
            screenshot: t.evidence?.screenshot || t.evidence?.docLink || '',
            video: t.evidence?.video || t.evidence?.videoLink || '',
            timeSpent: t.evidence?.timeSpent || 0,
            timeEstimate: t.evidence?.timeEstimate || 0,
            planned: t.evidence?.planned || null
          },
          preparationStatus: t.preparationStatus || 'todo',
          decision: t.decision || 'open',
          feedback: t.feedback || '',
        }));
        setSession({ 
          ...data, tasks, 
          coverImage: data.coverImage || '', 
          squadName: data.squadName || '', 
          period: data.period || '',
          description: data.description || '',
          members: data.members || []
        } as ShowcaseSession);
      }
    } catch (e) {
      console.error("Error loading session:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    reloadSession();

    // WebSocket Nativo para tempo real
    const wsUrl = showcaseApi.getWebSocketUrl(id);
    console.log("Conectando ao WebSocket do Showcase:", wsUrl);
    let socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SESSION_UPDATED' && data.payload) {
          const raw = data.payload;
          const tasks = (raw.tasks || []).map((t: any) => ({
            ...t,
            evidence: {
              problem: t.evidence?.problem || t.description || '',
              solution: t.evidence?.solution || t.evidence?.execution || '',
              dev: t.evidence?.dev || t.assignee || '',
              qa: t.evidence?.qa || '',
              screenshot: t.evidence?.screenshot || t.evidence?.docLink || '',
              video: t.evidence?.video || t.evidence?.videoLink || '',
              timeSpent: t.evidence?.timeSpent || 0,
              timeEstimate: t.evidence?.timeEstimate || 0,
              planned: t.evidence?.planned || null
            },
            preparationStatus: t.preparationStatus || 'todo',
            decision: t.decision || 'open',
            feedback: t.feedback || '',
          }));
          setSession({ 
            id: raw.id, ...raw, tasks, 
            coverImage: raw.coverImage || '', 
            squadName: raw.squadName || '', 
            period: raw.period || '',
            description: raw.description || '',
            members: raw.members || []
          } as ShowcaseSession);
        } else {
          reloadSession();
        }
      } catch (err) {
        console.error("Erro ao processar mensagem do WebSocket do Showcase:", err);
        reloadSession();
      }
    };

    socket.onclose = () => {
      console.warn("WebSocket desconectado. Tentando reconectar...");
      setTimeout(() => {
        reloadSession();
      }, 5000);
    };

    return () => {
      socket.close();
    };
  }, [id, reloadSession]);

  useEffect(() => {
    if (session?.defaultSort) {
      setBy(session.defaultSort);
    }
  }, [session?.defaultSort]);

  useEffect(() => {
    const baseTitle = "Espaço Ágil";
    const moduleName = "Sprint Showcase";
    const sessionName = session?.sprintName || session?.name;
    
    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [session]);

  const persist = useCallback(async (updates: Partial<ShowcaseSession>) => {
    if (!id || !session) return;
    try {
      const updatedSession = { ...session, ...updates };
      await showcaseApi.saveSession(updatedSession);
      // O backend dispara o REFRESH_SESSION para atualizar o state local via WS
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao salvar alterações', variant: 'destructive' });
    }
  }, [id, session, toast]);

  const addTasks = async (issues: JiraIssue[]) => {
    if (!id || !session) return;
    const currentTasks = session.tasks || [];
    const existing = new Set(currentTasks.map((t: any) => t.key));
    const newTasks = issues.filter(i => !existing.has(i.key)).map(makeTask);
    const addedCount = newTasks.length;

    if (addedCount === 0) { toast({ title: 'Nenhuma tarefa nova' }); return; }
    
    try {
      await showcaseApi.saveSession({
        ...session,
        tasks: [...currentTasks, ...newTasks]
      });
      toast({ title: `${addedCount} tarefas importadas!` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao importar tarefas', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  const addManualTask = async () => {
    if (!id || !session) return;
    const currentTasks = session.tasks || [];
    const manualCount = currentTasks.filter((t: any) => t.key.startsWith('MANUAL-')).length + 1;
    const newTask: ShowcaseTask = {
      id: `manual_${Date.now()}`,
      key: `MANUAL-${String(manualCount).padStart(3, '0')}`,
      title: 'Nova Tarefa Manual',
      description: '',
      acceptanceCriteria: '',
      type: 'Evolução',
      status: 'In Progress',
      priority: 'Medium',
      points: 0,
      assignee: authSession?.name || userProfile?.name || '',
      url: '',
      evidence: {
        problem: '',
        solution: '',
        dev: authSession?.name || userProfile?.name || '',
        qa: '',
        screenshot: '',
        video: '',
        timeSpent: 0,
        timeEstimate: 0,
        planned: null
      },
      decision: 'open',
      preparationStatus: 'todo',
      feedback: '',
      project: '',
      versionMaster: '',
      versionDevelop: '',
      versionRelease: '',
    };

    try {
      await showcaseApi.saveSession({
        ...session,
        tasks: [...currentTasks, newTask]
      });
      toast({ title: 'Tarefa manual adicionada!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao adicionar tarefa', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  const removeTask = useCallback(async (taskId: string) => {
    if (!id || !session) return;
    const currentTasks = session.tasks || [];
    try {
      await showcaseApi.saveSession({
        ...session,
        tasks: currentTasks.filter((t: any) => t.id !== taskId)
      });
      toast({ title: 'Tarefa removida' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao remover tarefa', description: 'Tente novamente.', variant: 'destructive' });
    }
  }, [id, session, toast]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => {
    if (!id || !session) return;
    const currentTasks = session.tasks || [];
    let updatedTaskContent: any = null;
    const newTasks = currentTasks.map((t: any) => {
      if (t.id === taskId) {
        const result = typeof updates === 'function' ? updates(t) : { ...t, ...updates };
        updatedTaskContent = result;
        return result;
      }
      return t;
    });

    try {
      await showcaseApi.saveSession({
        ...session,
        tasks: newTasks
      });

      // Phase 3: Backend decision push
      if (updatedTaskContent && updatedTaskContent.key && updatedTaskContent.key.includes('-')) {
        const hasDecisionChanged = typeof updates === 'object' && ('decision' in updates || 'feedback' in updates);
        if (hasDecisionChanged) {
          let backendStatus = 'committed';
          if (updatedTaskContent.decision === 'approved') backendStatus = 'delivered';
          else if (updatedTaskContent.decision === 'rejected') backendStatus = 'rejected';
          else if (updatedTaskContent.decision === 'needs_adjustment') backendStatus = 'carried_over';

          const activeSquad = session?.squadName || userProfile?.squadId || '';
          const { workItemsApi } = await import('@/app/work-items-api');
          workItemsApi.showcaseDecision(activeSquad, updatedTaskContent.key, backendStatus, updatedTaskContent.feedback || '').catch(() => {});
        }
      }

    } catch (err) {
      console.error(err);
    }
  }, [id, session]);



  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copiado!",
      description: "Compartilhe com sua squad para prepararem a sessão juntos.",
    });
  };

  const tasks = session?.tasks || [];
  const totalSecondsSpent = tasks.reduce((acc, t) => acc + (t.evidence.timeSpent || 0), 0);
  const totalSecondsOriginal = tasks.reduce((acc, t) => acc + (t.evidence.timeEstimate || 0), 0);

  const stats = {
    total: tasks.length,
    approved: tasks.filter(t => t.decision === 'approved').length,
    open: tasks.filter(t => t.decision === 'open').length,
    ready: tasks.filter(t => t.preparationStatus === 'done').length,
    hoursSpent: formatTime(totalSecondsSpent),
    hoursOriginal: formatTime(totalSecondsOriginal)
  };

  // ── Filtering Logic ──────────────────────────────────────────────────────────
  const developers = Array.from(new Set(tasks.map(t => t.evidence.dev).filter(Boolean))).sort();
  const qas = Array.from(new Set(tasks.map(t => t.evidence.qa).filter(Boolean))).sort();
  const types = Array.from(new Set(tasks.map(t => t.type).filter(Boolean))).sort();

  const filteredTasks = React.useMemo(() => {
    let result = [...tasks];

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => 
        t.key.toLowerCase().includes(s) || 
        t.title.toLowerCase().includes(s) || 
        t.evidence.dev.toLowerCase().includes(s) ||
        t.evidence.qa.toLowerCase().includes(s)
      );
    }

    // Filter Dev
    if (filterDev !== 'all') {
      result = result.filter(t => t.evidence.dev === filterDev);
    }

    // Filter QA
    if (filterQa !== 'all') {
      result = result.filter(t => t.evidence.qa === filterQa);
    }

    // Filter Type
    if (filterType !== 'all') {
      result = result.filter(t => t.type === filterType);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'key') return a.key.localeCompare(b.key);
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      if (sortBy === 'dev') return a.evidence.dev.localeCompare(b.evidence.dev);
      if (sortBy === 'qa') return a.evidence.qa.localeCompare(b.evidence.qa);
      return 0;
    });

    return result;
  }, [tasks, search, filterDev, filterQa, filterType, sortBy]);

  // Filtro/busca mudou o resultado — volta pra primeira página em vez de
  // manter um visibleCount alto que não corresponde mais ao que faz sentido
  // pro novo recorte.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filterDev, filterQa, filterType, sortBy]);

  const visibleTasks = filteredTasks.slice(0, visibleCount);

  const handleDecision = async (taskId: string, decision: Decision, feedback = '') => {
    const now = new Date().toISOString();
    await updateTask(taskId, {
      decision,
      feedback,
      approvedAt: decision === 'approved' ? now : undefined,
      decidedAt: now,
      decidedBy: authSession?.id || '',
      decidedByName: userProfile?.name || authSession?.name || authSession?.email || '',
    });
    if (currentIndex < filteredTasks.length - 1) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (isMounted.current) setCurrentIndex(currentIndex + 1);
      }, 600);
    }
  };

  if (loading) return (
    <div className="flex-1 w-full flex items-center justify-center bg-[#fafafa] dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4 text-slate-400 dark:text-slate-400">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-[11px] font-black uppercase tracking-widest italic">Sincronizando Showcase...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-1 w-full flex flex-col bg-[#fafafa] dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {!isPresenting && (
        <RoomHeader
          title={
            // RoomHeader.title é tipado como `string`, mas o componente renderiza
            // {title} como ReactNode. Mantemos o input editável inline (mesmo
            // comportamento de runtime: persistência a cada tecla) via cast, pois
            // RoomHeader está fora do escopo de edição aqui. Correção ideal: tipar
            // RoomHeader.title como React.ReactNode, ou migrar para isEditable/onTitleChange.
            (
              <input
                value={session?.name || ''}
                onChange={(e) => persist({ name: e.target.value })}
                placeholder="Nome da Sprint Review..."
                className="font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 italic text-sm md:text-base bg-transparent border-none outline-none min-w-[200px] focus:text-violet-600 dark:focus:text-violet-400 transition-colors"
              />
            ) as unknown as string
          }
          toolIcon={<ShieldCheck className="h-4 w-4" />}
          toolColorClass="text-violet-600"
          badge={
            <div className="hidden md:flex items-center gap-8 px-2">
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black text-slate-400 dark:text-slate-400 uppercase leading-none mb-1.5 tracking-tighter">Esforço Total</span>
                <div className="flex items-center gap-1 text-[11px] font-black text-violet-600 italic whitespace-nowrap">
                  {stats.hoursSpent || '0h'}
                  <span className="text-slate-300 dark:text-slate-800 mx-0.5 not-italic">/</span>
                  {stats.hoursOriginal || '0h'}
                </div>
              </div>
              
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black text-slate-400 dark:text-slate-550 uppercase leading-none mb-1.5 tracking-tighter">Tasks Prontas</span>
                <div className="flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400 italic whitespace-nowrap">
                  {stats.ready}
                  <span className="text-slate-300 dark:text-slate-800 mx-0.5 not-italic">/</span>
                  {stats.total}
                </div>
              </div>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsGuideOpen(true)} className="h-8 w-8 rounded-xl text-slate-400 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-all">
                <HelpCircle className="h-4 w-4" />
              </Button>

              <Button 
                onClick={handleShare}
                variant="ghost"
                className="h-8 px-3 rounded-xl text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 font-black text-[9px] uppercase tracking-widest gap-2 transition-all border border-violet-100 dark:border-violet-800"
              >
                <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Compartilhar</span>
              </Button>
              
              <Button 
                onClick={() => setIsSettingsOpen(true)} 
                variant="ghost"
                className="h-8 px-3 rounded-xl text-slate-500 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 font-black text-[9px] uppercase tracking-widest gap-2 transition-all"
              >
                <Settings className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Config</span>
              </Button>
              
              <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

              <div className="flex items-center bg-slate-100/50 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 gap-1 backdrop-blur-sm">
                <Button variant="ghost" onClick={addManualTask} className="hidden lg:flex h-7 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm text-slate-600 dark:text-slate-300 dark:hover:text-white transition-all">
                  <Plus className="h-3 w-3" /> Manual
                </Button>
                <Button variant="ghost" onClick={() => setIsJiraOpen(true)} className="h-7 px-3 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm text-slate-600 dark:text-slate-300 dark:hover:text-white transition-all">
                  <CloudDownload className="h-3 w-3" /> Jira
                </Button>
                <Button
                  onClick={() => { setIsPresenting(true); setCurrentIndex(-1); }}
                  className="h-7 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black uppercase text-[9px] tracking-[0.1em] gap-2 shadow-lg shadow-violet-600/20 transition-all active:scale-95 ml-1"
                >
                  <Play className="h-3 w-3 fill-current" /> Iniciar
                </Button>
              </div>
            </div>
          }
        />
      )}

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        {tasks.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[70%] text-center px-4"
          >
             <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-slate-300 dark:text-slate-700 mb-8 shadow-inner">
                <CloudDownload className="h-12 w-12" />
             </div>
             <h3 className="text-3xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-slate-100 mb-2">Pronto para a Show?</h3>
             <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mb-10 leading-relaxed font-medium">Importe as issues da sprint do Jira para começar a preparar sua apresentação imersiva.</p>
             <div className="flex gap-4">
               <Button onClick={() => setIsJiraOpen(true)} className="h-14 px-10 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-black uppercase text-[11px] tracking-widest gap-3 shadow-2xl shadow-black/10 dark:shadow-none hover:scale-105 active:scale-95 transition-all">
                  <CloudDownload className="h-5 w-5" /> Importar Jira
               </Button>
               <Button onClick={addManualTask} variant="outline" className="h-14 px-10 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 border-2 border-slate-100 dark:border-slate-800 font-black uppercase text-[11px] tracking-widest gap-3 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-200 dark:hover:border-slate-750 transition-all">
                  <Plus className="h-5 w-5" /> Criar Manual
               </Button>
             </div>
          </motion.div>
        ) : (
        <div className="w-full px-4 md:px-12 lg:px-20 py-6 space-y-8">
          {/* ── Filtros e Busca ───────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-[2rem] border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por chave, título ou dev..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 h-11 bg-slate-50 dark:bg-slate-950 border-none rounded-xl text-sm font-medium text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-violet-200/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              {/* Filtro Dev */}
              <div className="flex items-center gap-2 shrink-0">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <Select value={filterDev} onValueChange={setFilterDev}>
                  <SelectTrigger className="h-11 w-[160px] bg-slate-50 dark:bg-slate-950 border-none rounded-xl text-[11px] font-black uppercase tracking-tight dark:text-slate-300 dark:focus:bg-slate-950 focus:ring-0">
                    <SelectValue placeholder="Dev: Todos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-xl">
                    <SelectItem value="all" className="text-[11px] font-black uppercase">Todos os Devs</SelectItem>
                    {developers.map(dev => (
                      <SelectItem key={dev} value={dev} className="text-[11px] font-black uppercase">{dev}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro QA */}
              <div className="flex items-center gap-2 shrink-0">
                <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                <Select value={filterQa} onValueChange={setFilterQa}>
                  <SelectTrigger className="h-11 w-[160px] bg-slate-50 dark:bg-slate-950 border-none rounded-xl text-[11px] font-black uppercase tracking-tight dark:text-slate-300 dark:focus:bg-slate-950 focus:ring-0">
                    <SelectValue placeholder="QA: Todos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-xl">
                    <SelectItem value="all" className="text-[11px] font-black uppercase">Todos os QAs</SelectItem>
                    {qas.map(qa => (
                      <SelectItem key={qa} value={qa} className="text-[11px] font-black uppercase">{qa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro Tipo */}
              <div className="flex items-center gap-2 shrink-0">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-11 w-[140px] bg-slate-50 dark:bg-slate-950 border-none rounded-xl text-[11px] font-black uppercase tracking-tight dark:text-slate-300 dark:focus:bg-slate-950 focus:ring-0">
                    <SelectValue placeholder="Tipo: Todos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-xl">
                    <SelectItem value="all" className="text-[11px] font-black uppercase">Todos os Tipos</SelectItem>
                    {types.map(type => (
                      <SelectItem key={type} value={type} className="text-[11px] font-black uppercase">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="h-8 w-px bg-slate-100 dark:bg-slate-800 hidden md:block" />

              {/* Ordenação */}
              <div className="flex items-center gap-2 shrink-0">
                <SortAsc className="h-3.5 w-3.5 text-slate-400" />
                <Select value={sortBy} onValueChange={(v: any) => setBy(v)}>
                  <SelectTrigger className="h-11 w-[140px] bg-slate-50 dark:bg-slate-950 border-none rounded-xl text-[11px] font-black uppercase tracking-tight dark:text-slate-300 dark:focus:bg-slate-950 focus:ring-0">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-xl">
                    <SelectItem value="key" className="text-[11px] font-black uppercase">Chave Jira</SelectItem>
                    <SelectItem value="type" className="text-[11px] font-black uppercase">Tipo de Issue</SelectItem>
                    <SelectItem value="dev" className="text-[11px] font-black uppercase">Desenvolvedor</SelectItem>
                    <SelectItem value="qa" className="text-[11px] font-black uppercase">Validador / QA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Indicators of active filters */}
          {(search || filterDev !== 'all' || filterType !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 px-2">
              <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mr-2 tracking-widest">Filtros Ativos:</span>
              {search && (
                <Badge variant="secondary" className="h-6 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 border-violet-100 dark:border-violet-800 text-[10px] font-bold px-3">
                  Busca: {search}
                  <button onClick={() => setSearch('')} className="ml-2 hover:text-rose-500">×</button>
                </Badge>
              )}
              {filterDev !== 'all' && (
                <Badge variant="secondary" className="h-6 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-800 text-[10px] font-bold px-3">
                  Dev: {filterDev}
                  <button onClick={() => setFilterDev('all')} className="ml-2 hover:text-rose-500">×</button>
                </Badge>
              )}
              {filterType !== 'all' && (
                <Badge variant="secondary" className="h-6 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border-amber-100 dark:border-amber-800 text-[10px] font-bold px-3">
                  Tipo: {filterType}
                  <button onClick={() => setFilterType('all')} className="ml-2 hover:text-rose-500">×</button>
                </Badge>
              )}
              {sortBy !== 'key' && (
                <Badge variant="secondary" className="h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 text-[10px] font-bold px-3">
                  Ordem: {sortBy === 'dev' ? 'Desenvolvedor' : 'Tipo'}
                  <button onClick={() => setBy('key')} className="ml-2 hover:text-rose-500">×</button>
                </Badge>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setSearch(''); setFilterDev('all'); setFilterType('all'); }}
                className="h-6 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors"
              >
                Limpar Tudo
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {filteredTasks.length > 0 ? (
              visibleTasks.map((task, idx) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={idx}
                  members={session?.members || []}
                  onUpdateTask={updateTask}
                  onRemoveTask={removeTask}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <Filter className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-black uppercase tracking-widest italic">Nenhuma tarefa encontrada com esses filtros</p>
                <Button variant="link" onClick={() => { setSearch(''); setFilterDev('all'); setFilterType('all'); }} className="text-violet-500 text-[10px] font-black uppercase mt-2">Limpar Filtros</Button>
              </div>
            )}
          </div>

          {visibleCount < filteredTasks.length && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="h-11 px-8 rounded-2xl border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
              >
                Carregar mais {Math.min(PAGE_SIZE, filteredTasks.length - visibleCount)} tarefas
              </Button>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {visibleCount} de {filteredTasks.length}
              </span>
            </div>
          )}
          <div className="h-20" />
        </div>
        )}
      </motion.div>

      <PrintSlidesView session={session ? { ...session, tasks: filteredTasks } : null} />

      <AnimatePresence>
        {isPresenting && (
          <TeatroMode 
            session={{ ...session!, tasks: filteredTasks }} 
            currentIndex={currentIndex} 
            sortBy={sortBy}
            onIndexChange={(i) => setCurrentIndex(i)}
            onDecision={handleDecision}
            onClose={() => setIsPresenting(false)}
            onFinish={() => { setIsPresenting(false); persist({ status: 'finished' }); setIsSummaryOpen(true); }}
          />
        )}
      </AnimatePresence>

      <JiraImportDialog 
        open={isJiraOpen} 
        onClose={() => setIsJiraOpen(false)} 
        onImport={addTasks} 
      />

      <SessionSettingsDialog 
        open={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        session={session} 
        onUpdate={persist} 
      />

      <SummaryDialog 
        open={isSummaryOpen} 
        onClose={() => setIsSummaryOpen(false)} 
        tasks={tasks} 
        sessionName={session?.name || ''} 
        session={session} 
      />

      <HelpSheet 
        open={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
      />
    </div>
  );
}
