'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  CloudDownload, Play, ShieldCheck, Loader2, Plus, Settings, HelpCircle, Share2, Search, Filter, SortAsc, Users, Tag, UserCheck, TrendingUp, FileText, MessageSquareText,
  ChevronDown, AlertTriangle, RefreshCw, MoreHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { JiraIssue } from '@/services/jiraService';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { cn } from '@/lib/utils';

// New Refactored Components & Utils
import { ShowcaseSession, ShowcaseTask, Decision, CardKind, PREPARATION_STATUS } from '@/components/showcase/types';
import { formatTime, makeTask, isTaskContentComplete, compareText } from '@/components/showcase/utils';
import { TaskCard } from '@/components/showcase/TaskCard';
import { TeatroMode } from '@/components/showcase/TeatroMode';
import { JiraImportDialog } from '@/components/shared/JiraImportDialog';
import { SessionSettingsDialog } from '@/components/showcase/SessionSettingsDialog';
import { ShowcaseRoomHeaderActions } from '@/components/showcase/ShowcaseRoomHeaderActions';
import { ShowcaseRoomHeaderBadge } from '@/components/showcase/ShowcaseRoomHeaderBadge';
import { SummaryDialog } from '@/components/showcase/SummaryDialog';
import { PrintSlidesView } from '@/components/showcase/PrintSlidesView';
import { ShowcaseTour, TOUR_STORAGE_KEY } from '@/components/showcase/ShowcaseTour';
import { showcaseApi } from '../api';
import { squadApi } from '@/app/squad/api';
import { openOrCreateRetro } from '@/lib/sprintCycleNav';

// ─────────────────────────────────────────────
// Normalização e fila de salvamento
// ─────────────────────────────────────────────

/**
 * Traz a sessão do servidor para o formato que a UI espera. Campos de evidência só caem para o
 * valor legado quando vierem ausentes (null/undefined): um campo que a pessoa apagou continua
 * vazio em vez de voltar com o texto antigo da descrição.
 */
function normalizeSession(raw: any): ShowcaseSession {
  const tasks = (raw.tasks || []).map((t: any) => {
    const ev = t.evidence || {};
    return {
      ...t,
      key: t.key ?? '',
      title: t.title ?? '',
      type: t.type ?? '',
      description: t.description ?? '',
      acceptanceCriteria: t.acceptanceCriteria ?? '',
      evidence: {
        problem: ev.problem ?? t.description ?? '',
        solution: ev.solution ?? ev.execution ?? '',
        dev: ev.dev ?? t.assignee ?? '',
        qa: ev.qa ?? '',
        screenshot: ev.screenshot ?? ev.docLink ?? '',
        video: ev.video ?? ev.videoLink ?? '',
        evidencePreference: ev.evidencePreference,
        techDocUrl: ev.techDocUrl ?? '',
        tdnUrl: ev.tdnUrl ?? '',
        timeSpent: ev.timeSpent || 0,
        timeEstimate: ev.timeEstimate || 0,
        planned: ev.planned || null,
      },
      metrics: t.metrics ? t.metrics.map((m: any) => ({ ...m, field: m.field ?? '', value: m.value ?? 0 })) : t.metrics,
      attachments: t.attachments || [],
      project: t.project ?? '',
      versionSuporte: t.versionSuporte ?? '',
      versionMaster: t.versionMaster ?? '',
      versionRelease: t.versionRelease ?? '',
      versionDevelop: t.versionDevelop ?? '',
      preparationStatus: t.preparationStatus || 'todo',
      decision: t.decision || 'open',
      feedback: t.feedback || '',
    };
  });
  return {
    ...raw,
    tasks,
    coverImage: raw.coverImage || '',
    squadName: raw.squadName || '',
    period: raw.period || '',
    description: raw.description || '',
    members: raw.members || [],
  } as ShowcaseSession;
}

/** Alteração local pendente: reaplicada sobre a versão mais recente do servidor antes de gravar. */
type Mutator = (s: ShowcaseSession) => ShowcaseSession;
interface PendingChange {
  apply: Mutator;
  resolve: (ok: boolean) => void;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const MANUAL_KEY = /^MANUAL-(\d+)$/;
// Só chaves reais do Jira entram no work_items; cards manuais (MANUAL-001) não existem lá.
const JIRA_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

// ─────────────────────────────────────────────
// Main Room Component
// ─────────────────────────────────────────────
export default function ShowcaseRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session: authSession } = useAuth();
  const { userProfile } = useUserContext();
  const { toast } = useToast();

  const [session, setSessionState] = useState<ShowcaseSession | null>(null);
  // Última versão conhecida, sempre em dia: callbacks lêem daqui em vez de uma closure velha.
  const sessionRef = React.useRef<ShowcaseSession | null>(null);
  const setSession = useCallback((next: ShowcaseSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);
  // Buffer local do título: permite selecionar-tudo-e-apagar antes de retitular sem
  // disparar persist({ name: '' }) a cada tecla (backend rejeita name em branco).
  const [nameDraft, setNameDraft] = useState('');
  const nameFocusedRef = React.useRef(false);
  const nameTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'notfound' | 'error' | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [currentIndex, setCurrentIndexState] = useState(-1);
  const [isJiraOpen, setIsJiraOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Evita reabrir o aviso a cada clique em "Iniciar" nesta visita — a
  // primeira vez avisa, se a pessoa ignorar e clicar de novo, apresenta.
  const [presentWarningShown, setPresentWarningShown] = useState(false);
  const [settingsWarningActive, setSettingsWarningActive] = useState(false);

  const [search, setSearch] = useState('');
  const [filterDev, setFilterDev] = useState('all');
  const [filterQa, setFilterQa] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setBy] = useState<'key' | 'type' | 'dev' | 'qa'>('key');

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const isMounted = React.useRef(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const reloadSeqRef = React.useRef(0);
  const pendingRef = React.useRef<PendingChange[]>([]);
  const flushingRef = React.useRef(false);
  const orderedTasksRef = React.useRef<ShowcaseTask[]>([]);
  // O slide em foco é lembrado pelo id do card: a lista muda sob os pés (outra pessoa
  // adiciona, remove ou reordena) e o índice sozinho passaria a apontar para outro card.
  const currentTaskIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
    };
  }, []);

  const goToIndex = useCallback((i: number) => {
    setCurrentIndexState(i);
    currentTaskIdRef.current = i >= 0 ? orderedTasksRef.current[i]?.id ?? null : null;
  }, []);

  const reloadSession = useCallback(async () => {
    if (!id) return;
    const seq = ++reloadSeqRef.current;
    try {
      const data = await showcaseApi.getSession(id);
      // Resposta velha, troca de sala ou salvamento local em andamento (o resultado do POST reconcilia).
      if (!isMounted.current || seq !== reloadSeqRef.current) return;
      if (flushingRef.current || pendingRef.current.length > 0) return;
      if (!data) {
        if (!sessionRef.current) setLoadError('notfound');
        return;
      }
      setLoadError(null);
      setSession(normalizeSession(data));
    } catch (e) {
      console.error('Error loading session:', e);
      if (isMounted.current && !sessionRef.current) setLoadError('error');
    } finally {
      if (isMounted.current && seq === reloadSeqRef.current) setLoading(false);
    }
  }, [id, setSession]);

  /**
   * Grava as alterações locais uma fila por vez. Cada rodada busca a versão atual do servidor e
   * reaplica as alterações pendentes por cima, então edições de outras pessoas feitas nesse meio
   * tempo não são sobrescritas por uma cópia velha da sessão.
   */
  const flushPending = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (pendingRef.current.length > 0) {
        const batch = pendingRef.current.splice(0);
        try {
          const latest = await showcaseApi.getSession(id);
          if (!latest) throw new Error('Review não encontrada');
          const next = batch.reduce((acc, change) => change.apply(acc), normalizeSession(latest));
          const saved = await showcaseApi.saveSession(next);
          batch.forEach(change => change.resolve(true));
          if (isMounted.current && pendingRef.current.length === 0) setSession(normalizeSession(saved));
        } catch (err) {
          console.error('Falha ao salvar a Review:', err);
          batch.forEach(change => change.resolve(false));
          if (isMounted.current) {
            toast({
              title: 'Não foi possível salvar a última alteração',
              description: 'Sua alteração foi desfeita para a tela voltar ao que está gravado. Tente de novo.',
              variant: 'destructive',
            });
            if (pendingRef.current.length === 0) {
              const fresh = await showcaseApi.getSession(id).catch(() => null);
              if (fresh && isMounted.current) setSession(normalizeSession(fresh));
            }
          }
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [id, setSession, toast]);

  /** Aplica na tela na hora e enfileira o salvamento. Resolve `true` quando gravou, `false` se falhou. */
  const mutate = useCallback((apply: Mutator): Promise<boolean> => {
    const current = sessionRef.current;
    if (!id || !current) return Promise.resolve(false);
    setSession(apply(current));
    return new Promise<boolean>(resolve => {
      pendingRef.current.push({ apply, resolve });
      void flushPending();
    });
  }, [id, setSession, flushPending]);

  const waitForSaves = useCallback(async () => {
    for (let i = 0; i < 50 && (flushingRef.current || pendingRef.current.length > 0); i++) {
      await sleep(100);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    setSession(null);
    setLoading(true);
    setLoadError(null);
    pendingRef.current = [];

    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SESSION_UPDATED' && data.payload) {
          // Enquanto há salvamento local em andamento o resultado do POST é a verdade mais recente.
          if (flushingRef.current || pendingRef.current.length > 0) return;
          const current = sessionRef.current as any;
          const incoming = data.payload;
          if (current?.updatedAt && incoming.updatedAt && incoming.updatedAt < current.updatedAt) return;
          setLoadError(null);
          setSession(normalizeSession({ id: incoming.id, ...incoming }));
        } else {
          void reloadSession();
        }
      } catch (err) {
        console.error('Erro ao processar mensagem do WebSocket do Showcase:', err);
        void reloadSession();
      }
    };

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(showcaseApi.getWebSocketUrl(id));
      socket = ws;
      // Ao (re)conectar, ressincroniza: o que mudou enquanto o socket estava fora não chega por evento.
      ws.onopen = () => {
        attempt = 0;
        void reloadSession();
      };
      ws.onmessage = handleMessage;
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (disposed) return;
        const delay = Math.min(30_000, 1_000 * 2 ** attempt++);
        retryTimer = setTimeout(connect, delay);
      };
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void reloadSession();
    };

    void reloadSession();
    connect();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [id, reloadSession, setSession]);

  useEffect(() => {
    if (session?.defaultSort) {
      setBy(session.defaultSort);
    }
  }, [session?.defaultSort]);

  useEffect(() => {
    if (!nameFocusedRef.current) setNameDraft(session?.name || '');
  }, [session?.name]);

  useEffect(() => {
    const baseTitle = "Portal Tech V&D";
    const moduleName = "Sprint Showcase";
    const sessionName = session?.sprintName || session?.name;

    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [session?.sprintName, session?.name]);

  const persist = useCallback(
    (updates: Partial<ShowcaseSession>) => mutate(s => ({ ...s, ...updates })),
    [mutate]
  );

  const commitName = (value: string) => {
    if (value.trim() && value !== sessionRef.current?.name) void persist({ name: value });
  };

  const addTasks = async (issues: JiraIssue[]) => {
    if (!id || !sessionRef.current) return;
    const known = new Set((sessionRef.current.tasks || []).map(t => t.key));
    const newTasks = issues.filter(i => !known.has(i.key)).map(makeTask);
    const addedCount = newTasks.length;

    if (addedCount === 0) { toast({ title: 'Nenhuma tarefa nova' }); return; }

    const ok = await mutate(s => {
      const keys = new Set((s.tasks || []).map(t => t.key));
      return { ...s, tasks: [...(s.tasks || []), ...newTasks.filter(t => !keys.has(t.key))] };
    });
    if (ok) toast({ title: `${addedCount} tarefas importadas!` });
  };

  const addManualTask = async (cardKind: CardKind = 'story') => {
    if (!id || !sessionRef.current) return;
    const isMetrics = cardKind === 'metrics';
    const taskId = `manual_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;
    const buildTask = (key: string): ShowcaseTask => ({
      id: taskId,
      key,
      title: isMetrics ? 'Nova Métrica de Impacto' : 'Nova Tarefa Manual',
      description: '',
      acceptanceCriteria: '',
      type: 'Evolução',
      status: 'In Progress',
      priority: 'Medium',
      points: 0,
      cardKind,
      // Card de métricas nasce com uma linha campo/valor aberta — é o
      // conteúdo principal desse tipo, não uma seção opcional pra descobrir.
      metrics: isMetrics ? [{ field: '', value: 0 }] : undefined,
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
      versionSuporte: '',
      versionMaster: '',
      versionRelease: '',
      versionDevelop: '',
    });

    const ok = await mutate(s => {
      // Próximo número = maior já usado + 1 (contar cards repetia MANUAL-002 depois de remover o 001).
      const highest = (s.tasks || []).reduce((max, t) => {
        const match = MANUAL_KEY.exec(t.key || '');
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      const key = `MANUAL-${String(highest + 1).padStart(3, '0')}`;
      return { ...s, tasks: [...(s.tasks || []), buildTask(key)] };
    });
    if (ok) toast({ title: 'Tarefa manual adicionada!' });
  };

  const removeTask = useCallback(async (taskId: string) => {
    const ok = await mutate(s => ({ ...s, tasks: (s.tasks || []).filter(t => t.id !== taskId) }));
    if (ok) toast({ title: 'Tarefa removida' });
  }, [mutate, toast]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)): Promise<boolean> => {
    let updatedTaskContent: ShowcaseTask | null = null;
    const ok = await mutate(s => ({
      ...s,
      tasks: (s.tasks || []).map(t => {
        if (t.id !== taskId) return t;
        const result = typeof updates === 'function' ? updates(t) : { ...t, ...updates };
        updatedTaskContent = result;
        return result;
      }),
    }));
    if (!ok) return false;

    // Veredito do PO também vai para o work_items — só cards que existem no Jira.
    const task = updatedTaskContent as ShowcaseTask | null;
    const decisionTouched = typeof updates === 'object' && ('decision' in updates || 'feedback' in updates);
    if (task && decisionTouched && task.key && JIRA_KEY.test(task.key) && !MANUAL_KEY.test(task.key)) {
      let backendStatus = 'committed';
      if (task.decision === 'approved') backendStatus = 'delivered';
      else if (task.decision === 'rejected') backendStatus = 'rejected';
      else if (task.decision === 'needs_adjustment') backendStatus = 'carried_over';

      const issueProjectKey = task.key.split('-')[0].toUpperCase();
      const activeSquad = sessionRef.current?.squadName || issueProjectKey || userProfile?.squadId || authSession?.activeProjectId || '';
      if (activeSquad) {
        try {
          const { workItemsApi } = await import('@/app/work-items-api');
          await workItemsApi.showcaseDecision(activeSquad, task.key, backendStatus, task.feedback || '');
        } catch (err) {
          console.error('[Showcase] Falha ao registrar veredito em work_items:', err);
          toast({
            title: 'Decisão salva na Review, mas não chegou ao acompanhamento da squad',
            description: `${task.key} não foi atualizado no painel de work items.`,
            variant: 'destructive',
          });
        }
      }
    }
    return true;
  }, [mutate, toast, userProfile?.squadId, authSession?.activeProjectId]);

  // Anexos: o servidor avisa a sala toda por WebSocket; recarregar aqui garante que quem enviou veja na hora.
  const uploadTaskFile = useCallback(async (taskId: string, file: File) => {
    // Um card recém-criado só existe no servidor depois do save em andamento.
    await waitForSaves();
    await showcaseApi.uploadTaskFile(id, taskId, file);
    await reloadSession();
  }, [id, reloadSession, waitForSaves]);

  const deleteTaskFile = useCallback(async (fileId: string) => {
    await showcaseApi.deleteTaskFile(id, fileId);
    await reloadSession();
  }, [id, reloadSession]);

  const handleOpenRetro = async () => {
    const firstTaskKey = session?.tasks?.[0]?.key;
    const issueProjectKey = firstTaskKey?.includes('-') ? firstTaskKey.split('-')[0].toUpperCase() : '';
    const squadId = session?.squadName || issueProjectKey || userProfile?.squadId || authSession?.activeProjectId || '';
    if (!squadId) {
      toast({ title: "Squad não identificada", description: "Não foi possível resolver a squad desta review.", variant: "destructive" });
      return;
    }
    try {
      const squad = await squadApi.getSquad(squadId);
      const sprintId = squad?.activeSprintId;
      if (!sprintId) {
        toast({ title: "Sem sprint ativa", description: "Essa squad não tem sprint ativa configurada.", variant: "destructive" });
        return;
      }
      openOrCreateRetro(router, sprintId, squadId);
    } catch (err) {
      console.error('[Showcase] Falha ao resolver sprint ativa da squad:', err);
      toast({ title: "Erro", description: "Não foi possível abrir a retrospectiva.", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copiado!",
        description: "Compartilhe com sua squad para prepararem a sessão juntos.",
      });
    } catch {
      toast({
        title: "Não foi possível copiar o link",
        description: window.location.href,
        variant: "destructive",
      });
    }
  };

  const tasks = session?.tasks || [];

  // Primeira vez do usuário nesta sessão: dispara o tour guiado sozinho,
  // sem exigir que alguém vá procurar um botão de ajuda.
  useEffect(() => {
    if (loading || tasks.length === 0) return;
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
    } catch { return; }
    const t = setTimeout(() => setIsGuideOpen(true), 600);
    return () => clearTimeout(t);
     
  }, [loading, tasks.length]);

  // Sessão recém-criada (?setup=1, posto pela tela de criação): abre a
  // config de cara em vez de deixar enterrada atrás do ícone de engrenagem
  // — sem isso ninguém preenchia Objetivos/Capa/Squad antes de apresentar.
  useEffect(() => {
    if (searchParams.get('setup') === '1') {
      setIsSettingsOpen(true);
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Prontidão real (conteúdo preenchido) vs. status manual (dropdown por
  // card) — os dois podem discordar sem aviso nenhum hoje. `readyCount` vira
  // a verdade do conteúdo; `mismatch` sinaliza quando o manual não bate.
  // Calculada sobre filteredTasks (mais abaixo): segue o mesmo filtro da lista.

  // ── Filtering Logic ──────────────────────────────────────────────────────────
  const developers = Array.from(new Set(tasks.map(t => t.evidence.dev).filter(Boolean))).sort();
  const qas = Array.from(new Set(tasks.map(t => t.evidence.qa).filter(Boolean))).sort();
  const types = Array.from(new Set(tasks.map(t => t.type).filter(Boolean))).sort();

  // Ordem da lista e da apresentação (chave em ordem natural: PROJ-2 antes de PROJ-10).
  const orderedTasks = React.useMemo(() => {
    const byKey = (a: ShowcaseTask, b: ShowcaseTask) => compareText(a.key, b.key);
    return [...tasks].sort((a, b) => {
      if (sortBy === 'type') return compareText(a.type, b.type) || byKey(a, b);
      if (sortBy === 'dev') return compareText(a.evidence.dev, b.evidence.dev) || byKey(a, b);
      if (sortBy === 'qa') return compareText(a.evidence.qa, b.evidence.qa) || byKey(a, b);
      return byKey(a, b);
    });
  }, [tasks, sortBy]);
  orderedTasksRef.current = orderedTasks;

  const filteredTasks = React.useMemo(() => {
    let result = orderedTasks;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t =>
        t.key.toLowerCase().includes(s) ||
        t.title.toLowerCase().includes(s) ||
        t.evidence.dev.toLowerCase().includes(s) ||
        t.evidence.qa.toLowerCase().includes(s)
      );
    }
    if (filterDev !== 'all') result = result.filter(t => t.evidence.dev === filterDev);
    if (filterQa !== 'all') result = result.filter(t => t.evidence.qa === filterQa);
    if (filterType !== 'all') result = result.filter(t => t.type === filterType);

    return result;
  }, [orderedTasks, search, filterDev, filterQa, filterType]);

  // Se o card em foco mudou de posição (ou saiu da Review) enquanto se apresenta, o slide o acompanha.
  useEffect(() => {
    if (!isPresenting || currentIndex < 0) return;
    const wantedId = currentTaskIdRef.current;
    if (!wantedId || orderedTasks[currentIndex]?.id === wantedId) return;
    const movedTo = orderedTasks.findIndex(t => t.id === wantedId);
    if (movedTo >= 0) {
      setCurrentIndexState(movedTo);
      return;
    }
    const clamped = Math.min(currentIndex, orderedTasks.length - 1);
    setCurrentIndexState(clamped);
    currentTaskIdRef.current = clamped >= 0 ? orderedTasks[clamped].id : null;
    toast({ title: 'O card em foco saiu da Review', description: 'Mostrando o card que ocupa o lugar dele.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedTasks, isPresenting, currentIndex]);

  // Filtro/busca mudou o resultado — volta pra primeira página em vez de
  // manter um visibleCount alto que não corresponde mais ao que faz sentido
  // pro novo recorte.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filterDev, filterQa, filterType, sortBy]);

  const visibleTasks = filteredTasks.slice(0, visibleCount);

  const isFiltered = filteredTasks.length !== tasks.length;
  const readinessTasks = filteredTasks.map(t => {
    const contentComplete = isTaskContentComplete(t);
    const mismatch = (t.preparationStatus === 'done') !== contentComplete;
    return { task: t, contentComplete, mismatch };
  });
  const readyCount = readinessTasks.filter(r => r.contentComplete).length;
  const mismatchCount = readinessTasks.filter(r => r.mismatch).length;

  const handleDecision = async (taskId: string, decision: Decision, feedback = '') => {
    const now = new Date().toISOString();
    const ok = await updateTask(taskId, {
      decision,
      feedback,
      approvedAt: decision === 'approved' ? now : undefined,
      decidedAt: now,
      decidedBy: authSession?.id || '',
      decidedByName: userProfile?.name || authSession?.name || authSession?.email || '',
    });
    if (!ok) {
      // Não avança: quem apresenta precisa saber que a decisão não foi gravada.
      toast({ title: 'A decisão não foi gravada', description: 'Confira a conexão e decida de novo neste card.', variant: 'destructive' });
      return;
    }
    const decidedIndex = orderedTasksRef.current.findIndex(t => t.id === taskId);
    if (decidedIndex >= 0 && decidedIndex < orderedTasksRef.current.length - 1) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        // Só avança se a pessoa não navegou para outro card nesse meio-tempo.
        if (isMounted.current && currentTaskIdRef.current === taskId) goToIndex(decidedIndex + 1);
      }, 600);
    }
  };

  const handleFinish = () => {
    const open = orderedTasksRef.current.filter(t => t.decision === 'open').length;
    if (open > 0 && !window.confirm(`Ainda há ${open} card${open > 1 ? 's' : ''} sem decisão. Finalizar a Review mesmo assim?`)) return;
    setIsPresenting(false);
    void persist({ status: 'finished' });
    setIsSummaryOpen(true);
  };

  if (loading) return (
    <div className="flex-1 w-full flex items-center justify-center bg-[#fafafa] dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4 text-slate-400 dark:text-slate-400">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-[11px] font-black uppercase tracking-widest italic">Sincronizando Showcase...</p>
      </div>
    </div>
  );

  if (!session) return (
    <div className="flex-1 w-full flex items-center justify-center bg-[#fafafa] dark:bg-slate-950 p-6">
      <div className="max-w-md text-center space-y-4">
        <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" />
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
          {loadError === 'notfound' ? 'Review não encontrada' : 'Não foi possível carregar a Review'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {loadError === 'notfound'
            ? 'O link pode estar incompleto ou a Review foi removida. Confira o endereço ou volte para a lista.'
            : 'Houve um problema de conexão com o servidor. Tente de novo em instantes.'}
        </p>
        <div className="flex items-center justify-center gap-2">
          {loadError !== 'notfound' && (
            <Button onClick={() => { setLoading(true); void reloadSession(); }} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar de novo
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/showcase')}>Voltar para as Reviews</Button>
        </div>
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
                value={nameDraft}
                aria-label="Nome da Sprint Review"
                onFocus={() => { nameFocusedRef.current = true; }}
                onChange={(e) => {
                  const value = e.target.value;
                  setNameDraft(value);
                  if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
                  nameTimerRef.current = setTimeout(() => commitName(value), 700);
                }}
                onBlur={() => {
                  nameFocusedRef.current = false;
                  if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
                  if (nameDraft.trim()) commitName(nameDraft);
                  else setNameDraft(sessionRef.current?.name || '');
                }}
                placeholder="Nome da Sprint Review..."
                className="font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 text-xs bg-transparent border-none outline-none w-[11rem] sm:w-[16rem] truncate focus:text-violet-600 dark:focus:text-violet-400 transition-colors"
              />
            ) as unknown as string
          }
          toolIcon={<ShieldCheck className="h-4 w-4" />}
          toolColorClass="text-violet-600 bg-violet-50"
          badge={
            <ShowcaseRoomHeaderBadge
              hoursSpent={stats.hoursSpent}
              hoursOriginal={stats.hoursOriginal}
              total={filteredTasks.length}
              readyCount={readyCount}
              mismatchCount={mismatchCount}
              readinessTasks={readinessTasks}
              isFiltered={isFiltered}
              sessionTotal={tasks.length}
              onToggleTaskStatus={(taskId, markAsDone) => updateTask(taskId, { preparationStatus: markAsDone ? 'done' : 'todo' })}
            />
          }
          actions={
            <ShowcaseRoomHeaderActions
              onGuide={() => setIsGuideOpen(true)}
              onShare={handleShare}
              onSettings={() => { setSettingsWarningActive(false); setIsSettingsOpen(true); }}
              onAddManualTask={addManualTask}
              onOpenJira={() => setIsJiraOpen(true)}
              onOpenRetro={handleOpenRetro}
              onStartPresenting={() => {
                // A capa já nasce com a imagem padrão: o aviso cobra só os objetivos.
                const missingSetup = !session?.description?.trim();
                if (missingSetup && !presentWarningShown) {
                  setPresentWarningShown(true);
                  setSettingsWarningActive(true);
                  setIsSettingsOpen(true);
                  return;
                }
                setIsPresenting(true); goToIndex(-1);
              }}
            />
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-4xl px-4 py-10 md:py-16 flex flex-col items-center text-center"
          >
            <div className="h-16 w-16 rounded-3xl bg-violet-600 text-white flex items-center justify-center shadow-xl shadow-violet-600/30 mb-6">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50">Sua Review está pronta</h2>
            <p className="mt-2 max-w-xl text-sm md:text-base text-slate-500 dark:text-slate-400">
              Falta só trazer as tarefas da sprint. Depois é preparar as evidências e apresentar para o PO.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
              {session?.squadName && (
                <span className="rounded-full bg-violet-600/10 text-violet-600 dark:text-violet-300 px-3 py-1">{session.squadName}</span>
              )}
              {session?.sprintName && (
                <span className="rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1">{session.sprintName}</span>
              )}
            </div>

            <ol className="mt-10 grid w-full grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <li className="rounded-3xl border border-violet-500/40 bg-violet-600/5 p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-7 w-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-50">Importe as tarefas</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Traga as issues da sprint direto do Jira ou crie os cards à mão.</p>
                <div className="mt-auto flex flex-col gap-2">
                  <Button onClick={() => setIsJiraOpen(true)} className="h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-2">
                    <CloudDownload className="h-4 w-4" /> Importar do Jira
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-10 rounded-xl font-bold text-xs gap-2">
                        <Plus className="h-4 w-4" /> Criar card manual
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="dark:bg-slate-900 dark:border-slate-800">
                      <DropdownMenuItem onClick={() => addManualTask('story')} className="gap-2 text-xs font-semibold">
                        <FileText className="h-3.5 w-3.5 text-slate-400" /> Card padrão
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addManualTask('metrics')} className="gap-2 text-xs font-semibold">
                        <TrendingUp className="h-3.5 w-3.5 text-violet-500" /> Card de métricas
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
              <li className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 p-5 flex flex-col gap-3 opacity-90">
                <div className="flex items-center gap-2.5">
                  <span className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center">2</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-50">Prepare as evidências</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Em cada card, conte o problema e a solução e anexe vídeo ou print. Marque como pronto quando terminar.</p>
              </li>
              <li className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 p-5 flex flex-col gap-3 opacity-90">
                <div className="flex items-center gap-2.5">
                  <span className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center">3</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-50">Apresente e colete o aceite</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Em <strong className="font-semibold">Iniciar</strong>, o Modo Teatro mostra uma entrega por vez e registra a decisão do PO.</p>
              </li>
            </ol>
          </motion.div>
        ) : (
        <div className="w-full px-4 md:px-12 lg:px-20 py-6 space-y-8">
          {/* ── Filtros e Busca ───────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-[2rem] border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                data-tour="search"
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
                  sessionId={session?.id}
                  onUploadFile={uploadTaskFile}
                  onDeleteFile={deleteTaskFile}
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

      <PrintSlidesView session={session ? { ...session, tasks: orderedTasks } : null} />

      <AnimatePresence>
        {isPresenting && (
          <TeatroMode 
            session={{ ...session, tasks: orderedTasks }} 
            currentIndex={currentIndex} 
            sortBy={sortBy}
            onIndexChange={goToIndex}
            onDecision={handleDecision}
            onClose={() => setIsPresenting(false)}
            onFinish={handleFinish}
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
        onClose={() => { setSettingsWarningActive(false); setIsSettingsOpen(false); }}
        session={session}
        onUpdate={persist}
        presentWarning={settingsWarningActive}
        taskCount={tasks.length}
        onOpenJira={() => setIsJiraOpen(true)}
        onAddManualTask={addManualTask}
        onCopyLink={handleShare}
        onPresentAnyway={() => {
          setSettingsWarningActive(false);
          setIsSettingsOpen(false);
          setIsPresenting(true);
          goToIndex(-1);
        }}
      />

      <SummaryDialog 
        open={isSummaryOpen} 
        onClose={() => setIsSummaryOpen(false)} 
        tasks={tasks} 
        sessionName={session?.name || ''} 
        session={session} 
      />

      <ShowcaseTour
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
