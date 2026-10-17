'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { showcaseApi } from '@/app/showcase/api';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useToast } from '@/hooks/use-toast';
import type { JiraIssue } from '@/services/jiraService';
import type { CardKind, ShowcaseSession, ShowcaseTask } from './types';
import { appendUnique, buildManualTask, newIssueKeys, nextManualKey, normalizeSession, syncsToWorkItems, workItemSquad, workItemStatusFor } from './session-model';
import { makeTask } from './utils';

/** Alteração local pendente: reaplicada sobre a versão mais recente do servidor antes de gravar. */
export type Mutator = (s: ShowcaseSession) => ShowcaseSession;
interface PendingChange {
  apply: Mutator;
  resolve: (ok: boolean) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Conexão em tempo real: ao vivo, tentando de novo ou sem conexão (várias tentativas seguidas falharam). */
export type RoomConnection = { state: 'connecting' | 'live' } | { state: 'reconnecting' | 'offline'; retryInSec: number };
/** Gravação: parado, salvando, salvo agora ou falhou (a tela já voltou ao que está gravado). */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Depois de quantas tentativas seguidas sem abrir o socket a sala se diz "sem conexão". */
const OFFLINE_AFTER_ATTEMPTS = 3;

/**
 * Estado e gravação da sala da Review: carrega a sessão, escuta o WebSocket (SESSION_UPDATED e
 * REFRESH_SESSION, com reconexão de 1 a 30 s e releitura ao voltar para a aba), grava em fila (aplica na
 * hora, relê o servidor, reaplica as alterações pendentes e grava) e expõe as operações da sala.
 */
export function useShowcaseRoom(id: string) {
  const { session: authSession } = useAuth();
  const { userProfile } = useUserContext();
  const { squadId: activeSquadId } = useActiveSquad();
  const { toast } = useToast();

  const [session, setSessionState] = useState<ShowcaseSession | null>(null);
  // Última versão conhecida, sempre em dia: callbacks lêem daqui em vez de uma closure velha.
  const sessionRef = useRef<ShowcaseSession | null>(null);
  const setSession = useCallback((next: ShowcaseSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<'notfound' | 'error' | null>(null);
  const [connection, setConnection] = useState<RoomConnection>({ state: 'connecting' });
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const isMounted = useRef(false);
  const reloadSeqRef = useRef(0);
  const pendingRef = useRef<PendingChange[]>([]);
  const flushingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
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

  const markSaved = useCallback(() => {
    setSaveState('saved');
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => { if (isMounted.current) setSaveState((s) => (s === 'saved' ? 'idle' : s)); }, 4000);
  }, []);

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
          batch.forEach((change) => change.resolve(true));
          if (isMounted.current && pendingRef.current.length === 0) {
            setSession(normalizeSession(saved));
            markSaved();
          }
        } catch (err) {
          console.error('Falha ao salvar a Review:', err);
          batch.forEach((change) => change.resolve(false));
          if (isMounted.current) {
            setSaveState('error');
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
  }, [id, setSession, toast, markSaved]);

  /** Aplica na tela na hora e enfileira o salvamento. Resolve `true` quando gravou, `false` se falhou. */
  const mutate = useCallback((apply: Mutator): Promise<boolean> => {
    const current = sessionRef.current;
    if (!id || !current) return Promise.resolve(false);
    setSession(apply(current));
    setSaveState('saving');
    return new Promise<boolean>((resolve) => {
      pendingRef.current.push({ apply, resolve });
      void flushPending();
    });
  }, [id, setSession, flushPending]);

  const waitForSaves = useCallback(async () => {
    for (let i = 0; i < 50 && (flushingRef.current || pendingRef.current.length > 0); i++) {
      await sleep(100);
    }
  }, []);

  // Carga inicial e tempo real.
  useEffect(() => {
    if (!id) return;
    setSession(null);
    setLoading(true);
    setLoadError(null);
    setConnection({ state: 'connecting' });
    setSaveState('idle');
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
          const current = sessionRef.current as (ShowcaseSession & { updatedAt?: string }) | null;
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
        if (!disposed) setConnection({ state: 'live' });
        void reloadSession();
      };
      ws.onmessage = handleMessage;
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        if (disposed) return;
        const delay = Math.min(30_000, 1_000 * 2 ** attempt++);
        setConnection({ state: attempt >= OFFLINE_AFTER_ATTEMPTS ? 'offline' : 'reconnecting', retryInSec: Math.round(delay / 1000) });
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

  const persist = useCallback(
    (updates: Partial<ShowcaseSession>) => mutate((s) => ({ ...s, ...updates })),
    [mutate]
  );

  const addTasks = useCallback(async (issues: JiraIssue[]) => {
    const current = sessionRef.current;
    if (!id || !current) return;
    const newTasks = newIssueKeys(issues, current.tasks || []).map(makeTask) as ShowcaseTask[];
    if (newTasks.length === 0) { toast({ title: 'Nenhuma tarefa nova' }); return; }
    const ok = await mutate((s) => ({ ...s, tasks: appendUnique(s.tasks || [], newTasks) }));
    if (ok) toast({ title: `${newTasks.length} tarefas importadas!` });
  }, [id, mutate, toast]);

  const addManualTask = useCallback(async (cardKind: CardKind = 'story') => {
    if (!id || !sessionRef.current) return;
    const taskId = `manual_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;
    const author = authSession?.name || userProfile?.name || '';
    const ok = await mutate((s) => ({
      ...s,
      tasks: [...(s.tasks || []), buildManualTask({ id: taskId, key: nextManualKey(s.tasks || []), cardKind, author })],
    }));
    if (ok) toast({ title: 'Tarefa manual adicionada!' });
  }, [id, mutate, toast, authSession?.name, userProfile?.name]);

  const removeTask = useCallback(async (taskId: string) => {
    const ok = await mutate((s) => ({ ...s, tasks: (s.tasks || []).filter((t) => t.id !== taskId) }));
    if (ok) toast({ title: 'Tarefa removida' });
  }, [mutate, toast]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)): Promise<boolean> => {
    let updatedTaskContent: ShowcaseTask | null = null;
    const ok = await mutate((s) => ({
      ...s,
      tasks: (s.tasks || []).map((t) => {
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
    if (task && decisionTouched && syncsToWorkItems(task)) {
      const squad = workItemSquad(task, sessionRef.current?.squadName, activeSquadId);
      if (squad) {
        try {
          const { workItemsApi } = await import('@/app/work-items-api');
          await workItemsApi.showcaseDecision(squad, task.key, workItemStatusFor(task.decision), task.feedback || '');
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
  }, [mutate, toast, activeSquadId]);

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

  /** Relê do servidor sem piscar a tela (e tira o aviso de "Não salvou"). */
  const reload = useCallback(() => {
    setSaveState('idle');
    void reloadSession();
  }, [reloadSession]);

  /** "Tentar de novo" da tela de erro: volta ao estado de carregando. */
  const retryLoad = useCallback(() => {
    setLoading(true);
    void reloadSession();
  }, [reloadSession]);

  return {
    session,
    sessionRef,
    loading,
    loadError,
    connection,
    saveState,
    reload,
    retryLoad,
    mutate,
    persist,
    addTasks,
    addManualTask,
    removeTask,
    updateTask,
    uploadTaskFile,
    deleteTaskFile,
  };
}
