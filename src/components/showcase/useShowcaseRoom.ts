'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { showcaseApi } from '@/app/showcase/api';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useToast } from '@/hooks/use-toast';
import type { JiraIssue } from '@/services/jiraService';
import type { CardKind, ShowcasePresenter, ShowcaseSession, ShowcaseTask } from './types';
import { appendUnique, buildManualTask, newIssueKeys, nextManualKey, normalizeSession, syncsToWorkItems, workItemSquad, workItemStatusFor } from './session-model';
import {
  DECISION_RESTRICTED_HELP,
  DECISION_RESTRICTED_TITLE,
  STALE_CARDS_HELP,
  applyChanges,
  applyServerCard,
  diffCard,
  findCollisions,
  getPath,
  mergeChanges,
  parseCardConflict,
  parseDecisionRestricted,
  revertDecisions,
  staleCardsMessage,
  supportsPatch,
  toPatchBody,
  withoutDecisionChanges,
  type FieldChange,
} from './card-sync';
import { makeTask } from './utils';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { createPresenceSession, withPresenceParam } from '@/lib/room-presence';

/** Alteração local pendente: reaplicada sobre a versão mais recente do servidor antes de gravar. */
export type Mutator = (s: ShowcaseSession) => ShowcaseSession;
interface PendingChange {
  apply: Mutator;
  resolve: (ok: boolean) => void;
}
/** Alterações de UM card a gravar por `PATCH` (backend com a V81). Seguidas do mesmo card se juntam numa só. */
interface CardOp {
  taskId: string;
  changes: FieldChange[];
  resolvers: Array<(ok: boolean) => void>;
}
/** Alteração minha que não pôde ser gravada porque outra pessoa mudou o mesmo campo ao mesmo tempo. */
export interface CardConflict {
  id: string;
  taskId: string;
  taskKey: string;
  changes: FieldChange[];
}
/** Por que a última gravação de um card falhou (a sala já avisou; quem chamou não precisa repetir o aviso). */
export type SaveFailure = 'restricted' | 'conflict' | 'error';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** O POST da sessão não leva os campos só de leitura do servidor (apresentador e aviso de cards mantidos). */
function forSave(session: ShowcaseSession): ShowcaseSession {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { presenter, staleCardIds, ...rest } = session;
  return rest as ShowcaseSession;
}

/** Resposta do POST sem o aviso de cards mantidos (vale só para aquele salvamento, não fica no estado da tela). */
function withoutReadOnly(session: ShowcaseSession): ShowcaseSession {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { staleCardIds, ...rest } = session;
  return rest as ShowcaseSession;
}

/** Conexão em tempo real: ao vivo, tentando de novo ou sem conexão (várias tentativas seguidas falharam). */
export type RoomConnection = { state: 'connecting' | 'live' } | { state: 'reconnecting' | 'offline'; retryInSec: number };
/** Gravação: parado, salvando, salvo agora ou falhou (a tela já voltou ao que está gravado). */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Depois de quantas tentativas seguidas sem abrir o socket a sala se diz "sem conexão". */
const OFFLINE_AFTER_ATTEMPTS = 3;

/**
 * Estado e gravação da sala da Review: carrega a sessão, escuta o WebSocket (SESSION_UPDATED, CARD_UPDATED,
 * PRESENTER_UPDATED e REFRESH_SESSION, com reconexão de 1 a 30 s e releitura ao voltar para a aba), grava em fila
 * (aplica na hora, relê o servidor, reaplica as alterações pendentes e grava) e expõe as operações da sala.
 *
 * Backend com a V81 (cards com `version`): a edição de um card vai por `PATCH` só com os campos mudados, e o `POST`
 * da sessão inteira fica para criar/remover cards, ordem e configurações. Sem `version` (backend antigo), tudo
 * continua sendo a gravação da sessão inteira, como antes.
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
  // Quem está apresentando agora (null = ninguém ou backend antigo). Vem do GET da sessão e do PRESENTER_UPDATED.
  const [presenter, setPresenter] = useState<ShowcasePresenter | null>(null);
  // Alterações minhas que não foram gravadas por colidir com a de outra pessoa; a tela oferece reaplicar ou descartar.
  const [conflicts, setConflicts] = useState<CardConflict[]>([]);
  // Quem está com a Review aberta agora (null = o servidor não informa; a tela não mostra contagem).
  const presence = useRoomPresence({ module: 'showcase', roomId: id });
  const presenceBindings = presence.bindings;

  const isMounted = useRef(false);
  const reloadSeqRef = useRef(0);
  const pendingRef = useRef<PendingChange[]>([]);
  const cardOpsRef = useRef<CardOp[]>([]);
  const inflightRef = useRef<CardOp | null>(null);
  const lastFailureRef = useRef<SaveFailure | null>(null);
  const flushingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  /** Há gravação em andamento ou na fila (sessão inteira ou card). */
  const hasPending = useCallback(() => flushingRef.current || pendingRef.current.length > 0 || cardOpsRef.current.length > 0, []);

  /** O que ainda não foi gravado de um card (em andamento + na fila), para reaplicar por cima do que chega do servidor. */
  const pendingFor = useCallback((taskId: string, includeInflight = true): FieldChange[] => {
    let changes: FieldChange[] = includeInflight && inflightRef.current?.taskId === taskId ? inflightRef.current.changes : [];
    for (const op of cardOpsRef.current) if (op.taskId === taskId) changes = mergeChanges(changes, op.changes);
    return changes;
  }, []);

  const reloadSession = useCallback(async () => {
    if (!id) return;
    const seq = ++reloadSeqRef.current;
    try {
      const data = await showcaseApi.getSession(id);
      // Resposta velha, troca de sala ou salvamento local em andamento (o resultado do POST reconcilia).
      if (!isMounted.current || seq !== reloadSeqRef.current) return;
      if (data) setPresenter(data.presenter ?? null);
      if (flushingRef.current || pendingRef.current.length > 0 || cardOpsRef.current.length > 0) return;
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

  /** Troca um card da tela pelo que veio do servidor, mantendo por cima o que ainda não foi gravado dele. */
  const applyCardFromServer = useCallback((raw: unknown, opts: { includeInflight?: boolean; ignoreOlder?: boolean } = {}) => {
    const current = sessionRef.current;
    const taskId = (raw as { id?: string } | null)?.id;
    if (!current || !taskId) return;
    const next = applyServerCard(current, raw, pendingFor(taskId, opts.includeInflight ?? true), { ignoreOlder: opts.ignoreOlder });
    if (next === null) void reloadSession();
    else if (next !== current) setSession(next);
  }, [pendingFor, reloadSession, setSession]);

  const notifyRestricted = useCallback(() => {
    toast({ title: DECISION_RESTRICTED_TITLE, description: DECISION_RESTRICTED_HELP, variant: 'destructive' });
  }, [toast]);

  const addConflict = useCallback((taskId: string, changes: FieldChange[]) => {
    if (changes.length === 0) return;
    const taskKey = sessionRef.current?.tasks.find((t) => t.id === taskId)?.key ?? '';
    setConflicts((prev) => {
      const at = prev.findIndex((c) => c.taskId === taskId);
      if (at < 0) return [...prev, { id: `${taskId}:${Date.now()}`, taskId, taskKey, changes }];
      const next = prev.slice();
      next[at] = { ...next[at], changes: mergeChanges(next[at].changes, changes) };
      return next;
    });
  }, []);

  /**
   * Grava as alterações de um card por PATCH com a versão lida. 409: se os campos que a pessoa mexeu NÃO foram mexidos
   * por outra pessoa, reaplica sobre o card atual e repete (sem perguntar nada); os que colidem viram um aviso com
   * "reaplicar". 403 DECISION_RESTRICTED: tira veredito e feedback do pedido, grava o resto e avisa.
   */
  const sendCardOp = useCallback(async (op: CardOp): Promise<boolean> => {
    const local = sessionRef.current?.tasks.find((t) => t.id === op.taskId);
    if (!supportsPatch(local)) throw new Error('Card sem versão ou removido');
    let version = local.version;
    let restricted = false;
    const collided: FieldChange[] = [];
    let saved = false;
    for (let attempt = 0; attempt < 3 && op.changes.length > 0; attempt++) {
      try {
        const card = await showcaseApi.patchCard(id, op.taskId, toPatchBody(version, op.changes));
        inflightRef.current = null;
        applyCardFromServer(card, { includeInflight: false });
        saved = true;
        break;
      } catch (err) {
        const conflict = parseCardConflict(err);
        if (conflict) {
          const hits = findCollisions(conflict, op.changes);
          collided.push(...hits);
          const hitPaths = new Set(hits.map((c) => c.path));
          // O que ainda vai ser gravado parte do card atual do servidor; o que colidiu fica no aviso.
          op.changes = op.changes.filter((c) => !hitPaths.has(c.path)).map((c) => ({ ...c, base: getPath(conflict, c.path) }));
          version = conflict.version ?? version;
          applyCardFromServer(conflict);
          continue;
        }
        if (parseDecisionRestricted(err)) {
          restricted = true;
          op.changes = withoutDecisionChanges(op.changes);
          continue;
        }
        throw err;
      }
    }
    if (!saved && op.changes.length > 0) throw new Error('Conflito de versão persistente');
    inflightRef.current = null;
    if (collided.length > 0) {
      addConflict(op.taskId, collided);
      lastFailureRef.current = 'conflict';
    }
    if (restricted) {
      lastFailureRef.current = 'restricted';
      notifyRestricted();
      // Recarrega o card: o veredito e o feedback que a tela mostrava voltam ao que está gravado.
      const fresh = await showcaseApi.getSession(id).catch(() => null);
      const card = fresh?.tasks?.find((t) => t.id === op.taskId);
      const localVersion = sessionRef.current?.tasks.find((t) => t.id === op.taskId)?.version ?? 0;
      // Versão igual vale (nada foi gravado e a decisão da tela precisa voltar); uma leitura mais velha que a tela, não.
      if (card && isMounted.current && (card.version ?? localVersion) >= localVersion) applyCardFromServer(card, { includeInflight: false });
    }
    return !restricted && collided.length === 0;
  }, [id, applyCardFromServer, addConflict, notifyRestricted]);

  const runCardOp = useCallback(async (op: CardOp) => {
    const queueEmpty = () => pendingRef.current.length === 0 && cardOpsRef.current.length === 0;
    inflightRef.current = op;
    let ok = false;
    let failed = false;
    try {
      ok = await sendCardOp(op);
      if (ok && isMounted.current && queueEmpty()) markSaved();
    } catch (err) {
      console.error('Falha ao salvar o card da Review:', err);
      failed = true;
      lastFailureRef.current = 'error';
      if (isMounted.current) {
        setSaveState('error');
        toast({
          title: 'Não foi possível salvar a última alteração',
          description: 'Sua alteração foi desfeita para a tela voltar ao que está gravado. Tente de novo.',
          variant: 'destructive',
        });
      }
    } finally {
      inflightRef.current = null;
    }
    if (failed && isMounted.current && queueEmpty()) {
      const fresh = await showcaseApi.getSession(id).catch(() => null);
      if (fresh && isMounted.current) setSession(normalizeSession(fresh));
    }
    op.resolvers.forEach((resolve) => resolve(ok));
  }, [id, sendCardOp, markSaved, setSession, toast]);

  /**
   * Grava as alterações locais uma fila por vez. Os cards editados vão primeiro, por PATCH; depois a sessão: cada rodada
   * busca a versão atual do servidor e reaplica as alterações pendentes por cima, então edições de outras pessoas feitas
   * nesse meio tempo não são sobrescritas por uma cópia velha da sessão.
   */
  const flushPending = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (pendingRef.current.length > 0 || cardOpsRef.current.length > 0) {
        const cardOp = cardOpsRef.current.shift();
        if (cardOp) {
          await runCardOp(cardOp);
          continue;
        }
        const batch = pendingRef.current.splice(0);
        let restrictedHit = false;
        try {
          const latest = await showcaseApi.getSession(id);
          if (!latest) throw new Error('Review não encontrada');
          const latestSession = normalizeSession(latest);
          const next = batch.reduce((acc, change) => change.apply(acc), latestSession);
          let saved: ShowcaseSession;
          try {
            saved = await showcaseApi.saveSession(forSave(next));
          } catch (err) {
            // Trava de decisão: o servidor recusa a requisição inteira. Regrava sem a decisão que não podia mudar.
            const restricted = parseDecisionRestricted(err);
            if (!restricted) throw err;
            restrictedHit = true;
            const ids = restricted.cardIds.length > 0 ? restricted.cardIds : next.tasks.map((t) => t.id);
            saved = await showcaseApi.saveSession(forSave(revertDecisions(next, latestSession, ids)));
          }
          const staleIds = saved.staleCardIds ?? [];
          batch.forEach((change) => change.resolve(!restrictedHit));
          if (restrictedHit) {
            lastFailureRef.current = 'restricted';
            notifyRestricted();
          }
          const nothingElsePending = pendingRef.current.length === 0 && cardOpsRef.current.length === 0;
          if (isMounted.current && nothingElsePending) {
            setSession(normalizeSession(withoutReadOnly(saved)));
            if (!restrictedHit) markSaved();
          }
          if (staleIds.length > 0 && isMounted.current) {
            toast({ title: staleCardsMessage(staleIds.length), description: STALE_CARDS_HELP, variant: 'destructive' });
            // O POST devolve o que ficou no servidor; relê para a tela refletir também o que mudou depois.
            const fresh = await showcaseApi.getSession(id).catch(() => null);
            if (fresh && isMounted.current && pendingRef.current.length === 0 && cardOpsRef.current.length === 0) setSession(normalizeSession(fresh));
          }
        } catch (err) {
          console.error('Falha ao salvar a Review:', err);
          lastFailureRef.current = 'error';
          batch.forEach((change) => change.resolve(false));
          if (isMounted.current) {
            setSaveState('error');
            toast({
              title: 'Não foi possível salvar a última alteração',
              description: 'Sua alteração foi desfeita para a tela voltar ao que está gravado. Tente de novo.',
              variant: 'destructive',
            });
            if (pendingRef.current.length === 0 && cardOpsRef.current.length === 0) {
              const fresh = await showcaseApi.getSession(id).catch(() => null);
              if (fresh && isMounted.current) setSession(normalizeSession(fresh));
            }
          }
        }
      }
    } finally {
      flushingRef.current = false;
    }
  }, [id, setSession, toast, markSaved, runCardOp, notifyRestricted]);

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

  /** Enfileira a gravação de alterações de UM card (já aplicadas na tela). Resolve `true` quando gravou. */
  const enqueueCardChanges = useCallback((taskId: string, changes: FieldChange[]): Promise<boolean> => {
    setSaveState('saving');
    return new Promise<boolean>((resolve) => {
      const queued = cardOpsRef.current.find((o) => o.taskId === taskId);
      if (queued) {
        queued.changes = mergeChanges(queued.changes, changes);
        queued.resolvers.push(resolve);
      } else {
        cardOpsRef.current.push({ taskId, changes, resolvers: [resolve] });
      }
      void flushPending();
    });
  }, [flushPending]);

  const waitForSaves = useCallback(async () => {
    for (let i = 0; i < 50 && hasPending(); i++) {
      await sleep(100);
    }
  }, [hasPending]);

  // Carga inicial e tempo real.
  useEffect(() => {
    if (!id) return;
    setSession(null);
    setLoading(true);
    setLoadError(null);
    setConnection({ state: 'connecting' });
    setSaveState('idle');
    setPresenter(null);
    setConflicts([]);
    pendingRef.current = [];
    cardOpsRef.current = [];
    inflightRef.current = null;

    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    // `PRESENCE_UPDATED` é consumido aqui; o `else` abaixo recarregaria a Review inteira a cada entrada/saída.
    const presenceSession = createPresenceSession({
      onPresence: presenceBindings.onPresence,
      onMissing: presenceBindings.onPresenceMissing,
    });

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (presenceSession.handle(data)) return;
        if (data.type === 'PRESENTER_UPDATED') {
          // Estado completo: substitui o que havia. `presenter: null` = a apresentação acabou.
          setPresenter(data.payload?.presenter ?? null);
          return;
        }
        if (data.type === 'CARD_UPDATED' && data.payload?.card) {
          // Só aquele card muda; o que a pessoa ainda não gravou nele continua por cima. Versão igual ou menor é eco.
          const current = sessionRef.current;
          if (!current) { void reloadSession(); return; }
          const incoming = data.payload.card;
          const next = applyServerCard(current, incoming, pendingFor(incoming.id), { ignoreOlder: true });
          if (next === null) void reloadSession();
          else if (next !== current) {
            const sessionUpdatedAt = typeof data.payload.sessionUpdatedAt === 'string' ? data.payload.sessionUpdatedAt : null;
            setSession(sessionUpdatedAt ? { ...next, updatedAt: sessionUpdatedAt } : next);
          }
          return;
        }
        if (data.type === 'SESSION_UPDATED' && data.payload) {
          // Enquanto há salvamento local em andamento o resultado do POST é a verdade mais recente.
          if (flushingRef.current || pendingRef.current.length > 0 || cardOpsRef.current.length > 0) return;
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
      presenceSession.start(false);
      const ws = new WebSocket(withPresenceParam(showcaseApi.getWebSocketUrl(id)));
      socket = ws;
      // Ao (re)conectar, ressincroniza: o que mudou enquanto o socket estava fora não chega por evento.
      ws.onopen = () => {
        presenceSession.start(true);
        attempt = 0;
        if (!disposed) setConnection({ state: 'live' });
        void reloadSession();
      };
      ws.onmessage = handleMessage;
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        presenceSession.stop();
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
      presenceSession.stop();
      document.removeEventListener('visibilitychange', handleVisibility);
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [id, reloadSession, setSession, presenceBindings, pendingFor]);

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
    lastFailureRef.current = null;
    const current = sessionRef.current;
    const card = current?.tasks.find((t) => t.id === taskId);
    let ok: boolean;
    if (current && supportsPatch(card)) {
      // Backend com a V81: grava só o que mudou neste card, com a versão lida. Os outros cards não são tocados.
      const next = typeof updates === 'function' ? updates(card) : { ...card, ...updates };
      updatedTaskContent = next;
      const changes = diffCard(card, next);
      setSession({ ...current, tasks: current.tasks.map((t) => (t.id === taskId ? next : t)) });
      ok = changes.length === 0 ? true : await enqueueCardChanges(taskId, changes);
    } else {
      ok = await mutate((s) => ({
        ...s,
        tasks: (s.tasks || []).map((t) => {
          if (t.id !== taskId) return t;
          const result = typeof updates === 'function' ? updates(t) : { ...t, ...updates };
          updatedTaskContent = result;
          return result;
        }),
      }));
    }
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
  }, [mutate, enqueueCardChanges, setSession, toast, activeSquadId]);

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

  /**
   * Aviso de conflito: "reaplicar" grava de novo o que a pessoa digitou por cima do card atual (a versão do servidor
   * é a base); "descartar" fica com o que está gravado. Nos dois casos o aviso some.
   */
  const resolveConflict = useCallback(async (conflictId: string, action: 'reapply' | 'discard') => {
    const conflict = conflicts.find((c) => c.id === conflictId);
    setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
    if (!conflict || action === 'discard') return;
    const current = sessionRef.current;
    const card = current?.tasks.find((t) => t.id === conflict.taskId);
    if (!current || !supportsPatch(card)) return;
    const changes = conflict.changes.map((c) => ({ ...c, base: getPath(card, c.path) }));
    setSession({ ...current, tasks: current.tasks.map((t) => (t.id === conflict.taskId ? applyChanges(t, changes) : t)) });
    lastFailureRef.current = null;
    await enqueueCardChanges(conflict.taskId, changes);
  }, [conflicts, enqueueCardChanges, setSession]);

  /** Por que a última gravação de um card falhou, se a sala já avisou a pessoa (restrição de decisão ou conflito). */
  const lastFailure = useCallback(() => lastFailureRef.current, []);

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
    /** Contas com esta Review aberta agora; `null` = o servidor não informa. */
    onlineIds: presence.online,
    saveState,
    /** Quem apresenta agora; `null` = ninguém (ou backend sem o recurso). */
    presenter,
    setPresenter,
    /** Alterações minhas que colidiram com as de outra pessoa; ver `resolveConflict`. */
    conflicts,
    resolveConflict,
    lastFailure,
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
