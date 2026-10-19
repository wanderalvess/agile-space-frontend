'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useEffect, useCallback, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { RetroBoard as RetroBoardType, RetroCard as RetroCardType, RetroColumnKey, RetroParticipant, RetroReactionType, HealthCheckAnswer } from '@/lib/types';
import { RetroRoom } from '@/components/retro/RetroRoom';
import { RetroHealthCheckGate } from '@/components/retro/RetroHealthCheckGate';
import type { RetroImportEntry } from '@/components/retro/RetroActionImportDialog';
import type { DragEndEvent } from '@dnd-kit/core';
import { NotFound } from '@/components/NotFound';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { ModalButton } from '@/components/room-kit';
import type { ChatMessage, ChatMessageKind } from '@/components/poker/team-chat/chatChannels';
import { participantCategory } from '@/components/poker/team-chat/chatChannels';
import { chatChannelsFor, mergeChatHistory, toChatParticipant, upsertChatMessage } from '@/components/retro/retro-chat';
import {
  checkVote,
  importCards,
  mapGlobalToTeamRole,
  overlayPending,
  pausedTimer,
  planCardMove,
  removeById,
  resetTimer,
  resolveColumns,
  resumedTimer,
  startedTimer,
  stoppedTimer,
  timerFromBoard,
  uniqueById,
  upsertById,
  voteLimitMessage,
} from '@/components/retro/retro-room-logic';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { FeedbackWidget } from '@/components/feedback-widget';
import { retroApi, RetroApiError } from '../api';
import { removeLocalRoomMeta } from '@/lib/health-check-lobby';
import { getAuthToken } from '@/lib/auth-client';
import { connectRoomSocket } from '@/lib/room-socket';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { SprintStatsDialog } from '@/components/retro/SprintStatsDialog';
import { isRetroFinished, isRetroReadOnly, readOnlyToast, supportsRetroLifecycle } from '@/lib/retro-lifecycle';
import { useRetroTyping } from '@/hooks/useRetroTyping';

/** Tela cheia centralizada para os estados em que a sala não abre (sem sessão, falha ao carregar). */
function RoomMessage({ title, children, action }: { title: string; children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
      <h1 className="m-0 text-xl font-bold">{title}</h1>
      <p className="m-0 max-w-sm text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

export default function RetroRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const boardId = resolvedParams.id;

  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { userProfile, requestIdentity, isInitializing } = useUserContext();
  const { squadId: activeSquadId } = useActiveSquad();

  const [boardData, setBoardData] = useState<RetroBoardType | null>(null);
  const [cards, setCards] = useState<RetroCardType[]>([]);
  const [participants, setParticipants] = useState<RetroParticipant[]>([]);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [areCardsLoading, setAreCardsLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);
  // 'notfound' = o servidor disse que o quadro não existe; 'failed' = não deu pra carregar (rede, sessão, 5xx).
  const [loadError, setLoadError] = useState<null | 'notfound' | 'failed'>(null);
  // A retro foi apagada por outra pessoa enquanto esta tela estava aberta.
  const [boardDeleted, setBoardDeleted] = useState(false);
  const loadSeqRef = useRef(0);
  const cardsRef = useRef<RetroCardType[]>([]);
  const optimisticRef = useRef<RetroCardType[]>([]);
  const boardRef = useRef<RetroBoardType | null>(null);
  const leavingRef = useRef(false);
  /** Marca a retro como apagada: o aviso do servidor depois do DELETE não pode recarregar uma sala que já não existe. */
  const deletedRef = useRef(false);
  // Mudanças otimistas ainda em voo: sobrevivem a ecos de outros eventos do WebSocket até o servidor responder.
  const pendingRef = useRef<Map<string, RetroCardType>>(new Map());

  const [hasJoined, setHasJoined] = useState(false);
  const [optimisticCards, setOptimisticCards] = useState<RetroCardType[]>([]);
  const [activeStage, setActiveStage] = useState<RetroColumnKey>('');
  const [mergingSourceId, setMergingSourceId] = useState<string | null>(null);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  const [chatByChannel, setChatByChannel] = useState<Record<string, ChatMessage[]>>({});
  const chatChannelsRef = useRef<Set<string>>(new Set());
  const loadedChatChannelsRef = useRef<Set<string>>(new Set());

  const currentUser = useMemo(() => participants?.find((p) => p.id === userProfile?.id) || null, [participants, userProfile]);
  const isCurrentUserCreator = useMemo(() => !!(userProfile && boardData && userProfile.id === boardData.creatorId), [userProfile, boardData]);

  const [showStats, setShowStats] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  // Conexão atual da sala: o "escrevendo…" envia por ela.
  const socketRef = useRef<{ send: (message: unknown) => boolean } | null>(null);
  const readOnlyRef = useRef(false);

  // Encerrar/reabrir é do facilitador (criador) ou ADMIN; quem não é, numa retro encerrada, só lê.
  const canManageLifecycle = isCurrentUserCreator || userProfile?.role === 'admin';
  const isFinished = isRetroFinished(boardData);
  const readOnly = isRetroReadOnly(boardData, canManageLifecycle);
  // Backend novo (V79): quem informa o ciclo de vida também entende o "escrevendo…", o encerrar/reabrir e a nota do check-in. No antigo nada disso aparece e nada é enviado.
  const newBackend = supportsRetroLifecycle(boardData);
  const typing = useRetroTyping({ enabled: newBackend, selfId: userProfile?.id, socketRef });
  // Quem está com a sala aberta agora (null = o servidor não informa; a sala mostra só o total, como antes).
  const presence = useRoomPresence({ module: 'retro', roomId: boardId });
  const presenceBindings = presence.bindings;

  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { optimisticRef.current = optimisticCards; }, [optimisticCards]);
  useEffect(() => { boardRef.current = boardData; }, [boardData]);
  useEffect(() => { readOnlyRef.current = readOnly; }, [readOnly]);
  // O socket é criado uma vez por sala: o tratador do evento lê sempre a versão mais recente.
  const onTypingEventRef = useRef(typing.onTypingEvent);
  useEffect(() => { onTypingEventRef.current = typing.onTypingEvent; }, [typing.onTypingEvent]);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  const markDeletedByOthers = useCallback(() => {
    if (leavingRef.current) return;
    deletedRef.current = true;
    removeLocalRoomMeta(boardId, typeof window === 'undefined' ? undefined : window.localStorage);
    setBoardDeleted(true);
  }, [boardId]);

  // Centralized data loading
  const reloadBoardData = useCallback(async () => {
    if (!isAuthenticated || deletedRef.current) return;
    // Só a resposta mais recente vale: um reload lento que chega depois de eventos novos do WebSocket
    // não pode sobrescrever o estado mais novo com dados velhos.
    const seq = ++loadSeqRef.current;
    try {
      const [board, cardsList, participantsList] = await Promise.all([
        retroApi.getBoard(boardId),
        retroApi.getCards(boardId),
        retroApi.getParticipants(boardId),
      ]);
      if (seq !== loadSeqRef.current) return;
      setBoardData(board);
      setCards(cardsList);
      setParticipants(participantsList);
      setLoadError(null);
    } catch (e) {
      console.error('Erro ao carregar dados do quadro de retrospectiva:', e);
      if (seq !== loadSeqRef.current) return;
      // Já com o quadro na tela, uma falha de rede passageira não derruba nada: o próximo evento ou reconexão ressincroniza.
      if (!boardRef.current) {
        setLoadError(e instanceof RetroApiError && e.status === 404 ? 'notfound' : 'failed');
      } else if (e instanceof RetroApiError && e.status === 404) {
        // Quadro já aberto que passou a dar 404: foi apagado (o aviso do WebSocket pode ter se perdido).
        markDeletedByOthers();
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setIsBoardLoading(false);
        setAreCardsLoading(false);
        setAreParticipantsLoading(false);
      }
    }
  }, [boardId, isAuthenticated, markDeletedByOthers]);

  // Trocar de quadro (mesma página reaproveitada) não pode carregar estado do anterior.
  useEffect(() => {
    loadSeqRef.current++;
    setBoardData(null);
    setCards([]);
    setOptimisticCards([]);
    setParticipants([]);
    setActiveStage('');
    setMergingSourceId(null);
    setLoadError(null);
    setIsBoardLoading(true);
    setAreCardsLoading(true);
    setAreParticipantsLoading(true);
    leavingRef.current = false;
    deletedRef.current = false;
    setBoardDeleted(false);
  }, [boardId]);

  /** Aplica no estado um card devolvido pelo servidor (a resposta do POST vale mesmo se o eco do WebSocket se perder). */
  const applyServerCard = useCallback((card: RetroCardType) => {
    if (!card?.id) return;
    setCards((prev) => upsertById(prev, card));
  }, []);

  const trackOptimistic = useCallback((card: RetroCardType) => {
    pendingRef.current.set(card.id, card);
    setOptimisticCards((prev) => upsertById(prev, card));
  }, []);

  const settleCard = useCallback((cardId: string) => {
    pendingRef.current.delete(cardId);
  }, []);

  /** Desfaz só a mudança otimista deste card, sem apagar as outras que ainda estão em voo. */
  const revertCard = useCallback((cardId: string) => {
    const server = cardsRef.current.find((c) => c.id === cardId);
    setOptimisticCards((prev) => (server ? prev.map((c) => (c.id === cardId ? server : c)) : prev.filter((c) => c.id !== cardId)));
  }, []);

  /** Escrita parcial do quadro com a resposta aplicada na hora; erro vira aviso, não silêncio. */
  const patchBoard = useCallback((patch: Partial<RetroBoardType>, errorTitle = 'Não foi possível salvar a alteração') => {
    return retroApi.patchBoard(boardId, patch)
      .then((updated) => {
        if (updated?.id) setBoardData(updated);
        return updated;
      })
      .catch((err) => {
        console.error(err);
        toast({ title: errorTitle, description: err?.message, variant: 'destructive' });
        return null;
      });
  }, [boardId, toast]);

  // Carga inicial e tempo real (WebSocket com reconexão e ressincronização).
  useEffect(() => {
    if (!isAuthenticated) return;

    reloadBoardData();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/retro/') + boardId;
    // O token é relido a cada tentativa: numa sessão longa o antigo expira e a reconexão nunca voltaria sem recarregar.
    const buildUrl = () => wsBase + '?token=' + encodeURIComponent(getAuthToken() || '');

    const handle = connectRoomSocket({
      buildUrl,
      ...presenceBindings,
      // "Escrevendo…" (backend antigo ignora o parâmetro e nunca envia o evento).
      typing: true,
      // Toda abertura (a primeira inclusive) recarrega: o handshake pode ter sido recusado (403) antes de a
      // pessoa virar participante, e eventos entre a carga inicial e o aceite se perderiam. O mesmo vale para
      // eventos perdidos durante uma queda.
      onOpen: () => { void reloadBoardData(); },
      onReconnect: () => undefined,
      onError: (err) => {
        console.error('Erro ao processar mensagem do WebSocket do Retro:', err);
        void reloadBoardData();
      },
      onMessage: (data) => {
        const payload = data.payload as any;
        switch (data.type) {
          case 'BOARD_UPDATED':
            if (payload) setBoardData(payload);
            break;
          case 'PARTICIPANT_JOINED':
            if (payload) setParticipants((prev) => upsertById(prev, payload));
            break;
          case 'PARTICIPANT_LEFT':
            if (payload?.userId) setParticipants((prev) => removeById(prev, payload.userId));
            break;
          case 'CARD_SAVED':
            if (payload) setCards((prev) => upsertById(prev, payload));
            break;
          case 'CARD_DELETED':
            if (payload?.cardId) setCards((prev) => removeById(prev, payload.cardId));
            break;
          case 'CARDS_IMPORTED':
            if (Array.isArray(payload)) setCards((prev) => importCards(prev, payload));
            break;
          case 'CHAT_MESSAGE_SAVED':
            // Só canais que este usuário enxerga (geral, o da sua função e as suas DMs)
            if (payload?.channelId && chatChannelsRef.current.has(payload.channelId)) {
              const msg: ChatMessage = payload;
              setChatByChannel((prev) => upsertChatMessage(prev, msg));
            }
            break;
          case 'CHAT_MESSAGE_DELETED':
            if (payload?.messageId && payload?.channelId) {
              const { messageId, channelId } = payload;
              setChatByChannel((prev) => ({ ...prev, [channelId]: (prev[channelId] || []).filter((m) => m.id !== messageId) }));
            }
            break;
          case 'BOARD_DELETED':
            // Quem apagou já saiu da página (deletedRef); as demais pessoas veem o aviso em vez de uma sala morta.
            if (!deletedRef.current) markDeletedByOthers();
            break;
          case 'TYPING':
            // Efêmero: nunca recarrega a sala (o tipo desconhecido recarregaria).
            onTypingEventRef.current(payload);
            break;
          case 'REFRESH_BOARD':
          default:
            void reloadBoardData();
            break;
        }
      },
    });
    socketRef.current = handle;
    return () => {
      if (socketRef.current === handle) socketRef.current = null;
      handle();
    };
  }, [boardId, isAuthenticated, reloadBoardData, presenceBindings, markDeletedByOthers]);

  // Esc cancela a fusão em andamento.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMergingSourceId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStageChange = useCallback((stage: RetroColumnKey) => {
    setActiveStage(stage);
    if (isCurrentUserCreator && boardData?.syncStageEnabled) {
      patchBoard({ activeColumnKey: stage });
    }
  }, [isCurrentUserCreator, boardData?.syncStageEnabled, patchBoard]);

  // Com a sincronização ligada, quem não é facilitador acompanha a coluna dele.
  useEffect(() => {
    if (boardData?.syncStageEnabled && !isCurrentUserCreator && boardData.activeColumnKey) {
      setActiveStage(boardData.activeColumnKey);
    }
  }, [boardData?.syncStageEnabled, boardData?.activeColumnKey, isCurrentUserCreator]);

  // Coluna inicial: a do facilitador (sincronização) ou a primeira.
  useEffect(() => {
    if (!activeStage && boardData) {
      if (boardData.syncStageEnabled && !isCurrentUserCreator && boardData.activeColumnKey) {
        setActiveStage(boardData.activeColumnKey);
        return;
      }
      const first = resolveColumns(boardData)[0];
      if (first) setActiveStage(first.id);
    }
  }, [boardData, activeStage, isCurrentUserCreator]);

  useEffect(() => {
    setOptimisticCards(overlayPending(cards, pendingRef.current));
  }, [cards]);

  useEffect(() => {
    setHasJoined(false);
    joinAttemptedRef.current = false;
  }, [boardId]);

  useEffect(() => {
    // isInitializing (do UserContext) precisa estar false também: isLoading (useAuth, só sessão/token) resolve
    // antes de o UserContext montar o userProfile, e nesse intervalo userProfile ainda é null — sem esperar,
    // requestIdentity() dispara à toa e o modal de perfil fica aberto mesmo com a pessoa já logada.
    if (!isLoading && !isInitializing && !userProfile) {
      requestIdentity();
    }
  }, [isLoading, isInitializing, userProfile, requestIdentity]);

  // Trava a tentativa de entrada assim que ela dispara — sem isso, o Strict Mode do React roda este efeito duas
  // vezes de forma síncrona antes de `currentUser`/`hasJoined` refletirem a entrada, disparando dois POSTs de
  // participante e dois re-saves do board para o mesmo id.
  const joinAttemptedRef = useRef(false);

  // Carga inicial do chat: canal geral, o da função e uma DM por colega. Chaveia pelos ids (não pelo array) para
  // não refazer a carga a cada refetch de participantes.
  const chatChannelsKey = currentUser ? chatChannelsFor(currentUser, participants).join('|') : '';
  // Trocar de board zera o que foi carregado do anterior.
  useEffect(() => {
    loadedChatChannelsRef.current = new Set();
    setChatByChannel({});
  }, [boardId]);

  useEffect(() => {
    if (!chatChannelsKey) return;
    const channels = chatChannelsKey.split('|');
    chatChannelsRef.current = new Set(channels);
    // Quando alguém entra/sai, só o canal novo precisa ser carregado.
    channels.filter((c) => !loadedChatChannelsRef.current.has(c)).forEach((channelId) => {
      loadedChatChannelsRef.current.add(channelId);
      retroApi.getChatMessages(boardId, channelId)
        .then((msgs) => setChatByChannel((prev) => ({ ...prev, [channelId]: mergeChatHistory(prev[channelId], msgs || []) })))
        .catch((err) => {
          loadedChatChannelsRef.current.delete(channelId); // tenta de novo na próxima mudança
          console.error(`Erro ao carregar o canal ${channelId}:`, err);
        });
    });
  }, [boardId, chatChannelsKey]);

  const handleSendChatMessage = useCallback((text: string, kind: ChatMessageKind, channelId: string) => {
    if (!currentUser) return;
    retroApi.sendChatMessage(boardId, {
      id: crypto.randomUUID(),
      channelId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderCategory: participantCategory(toChatParticipant(currentUser)),
      text,
      kind,
      ts: new Date().toISOString(),
    })
      .then((saved) => saved?.channelId && setChatByChannel((prev) => upsertChatMessage(prev, saved)))
      .catch((err) => {
        console.error('Erro ao enviar mensagem:', err);
        toast({ title: 'Não foi possível enviar a mensagem', variant: 'destructive' });
      });
  }, [boardId, currentUser, toast]);

  const handleDeleteChatMessage = useCallback((messageId: string, channelId: string) => {
    retroApi.deleteChatMessage(boardId, messageId)
      .then(() => setChatByChannel((prev) => ({ ...prev, [channelId]: (prev[channelId] || []).filter((m) => m.id !== messageId) })))
      .catch((err) => console.error('Erro ao apagar mensagem:', err));
  }, [boardId]);

  // Entrada automática: a identidade global vira participante da retro.
  useEffect(() => {
    if (isAuthenticated && boardData && userProfile && !currentUser && !areParticipantsLoading && !hasJoined && !joinAttemptedRef.current) {
      joinAttemptedRef.current = true;
      const newParticipant: RetroParticipant = {
        id: userProfile.id,
        boardId,
        nickname: userProfile.name,
        role: mapGlobalToTeamRole(userProfile.role),
        globalRole: userProfile.role,
        isCreator: userProfile.id === boardData.creatorId,
      };

      retroApi.addOrUpdateParticipant(boardId, newParticipant).then(() => {
        // Não depende do WS entregar PARTICIPANT_JOINED: logo após criar o quadro o socket ainda está
        // conectando/reconectando e o evento se perde, deixando currentUser nulo (tela presa em "Entrando").
        setParticipants((prev) => (prev.some((p) => p.id === newParticipant.id) ? prev : [...prev, newParticipant]));
        // Só participantIds: gravar o quadro inteiro com a cópia de quem entra desfazia fase, timer e votação do facilitador.
        const currentParticipantIds = boardRef.current?.participantIds || boardData.participantIds || [];
        if (!currentParticipantIds.includes(userProfile.id)) {
          retroApi.patchBoard(boardId, { participantIds: [...currentParticipantIds, userProfile.id] })
            .then((updated) => { if (updated?.id) setBoardData(updated); })
            .catch((err) => console.error('Erro ao registrar participante no quadro:', err));
        }
      }).catch((err) => {
        console.error('Erro ao registrar participante:', err);
        joinAttemptedRef.current = false;
      });
    }
  }, [isAuthenticated, boardData, userProfile, currentUser, areParticipantsLoading, boardId, hasJoined]);

  // Sincronização de perfil: nome e cargo do perfil global valem na lista da retro.
  const lastSyncedProfileRef = useRef<{ name: string; role: string } | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !userProfile || !boardId || !currentUser) return;

    if (lastSyncedProfileRef.current && lastSyncedProfileRef.current.name === userProfile.name && lastSyncedProfileRef.current.role === userProfile.role) return;

    const needsNameUpdate = currentUser.nickname !== userProfile.name;
    const needsRoleUpdate = currentUser.globalRole !== userProfile.role;

    if (needsNameUpdate || needsRoleUpdate) {
      const updates = { ...currentUser };
      if (needsNameUpdate) updates.nickname = userProfile.name;
      if (needsRoleUpdate) {
        updates.globalRole = userProfile.role;
        updates.role = mapGlobalToTeamRole(userProfile.role);
      }
      retroApi.addOrUpdateParticipant(boardId, updates)
        .then(() => { lastSyncedProfileRef.current = { name: userProfile.name, role: userProfile.role }; })
        .catch((err) => console.error(err));
    } else {
      lastSyncedProfileRef.current = { name: userProfile.name, role: userProfile.role };
    }
  }, [isAuthenticated, userProfile, boardId, currentUser]);

  useEffect(() => {
    setHasJoined(!!currentUser);
  }, [currentUser]);

  // Título dinâmico da aba
  useEffect(() => {
    const baseTitle = 'Portal Tech V&D';
    const moduleName = 'Retrospectiva';
    const sessionName = boardData?.title || boardData?.team;
    document.title = sessionName ? `${sessionName} | ${moduleName} | ${baseTitle}` : `${moduleName} | ${baseTitle}`;
  }, [boardData]);

  useEffect(() => {
    if (hasJoined && !currentUser && participants.length > 0 && !leavingRef.current) {
      toast({
        title: 'Você saiu do quadro',
        description: 'Você está sendo redirecionado para a página inicial.',
      });
      router.push('/');
    }
  }, [hasJoined, currentUser, participants, router, toast]);

  const handleAddCard = useCallback(async (content: string, columnKey: RetroColumnKey, assignee?: string, dueDate?: string): Promise<boolean> => {
    if (!isAuthenticated || !userProfile || !boardId) return false;
    if (readOnlyRef.current) { toast(readOnlyToast()); return false; }
    const text = content.trim();
    if (!text) return false;

    const card: RetroCardType = {
      id: crypto.randomUUID(),
      boardId,
      columnKey,
      content: text,
      authorId: userProfile.id,
      votes: [],
      order: Date.now(),
      assignee: assignee || undefined,
      dueDate: dueDate || undefined,
    };

    trackOptimistic(card);
    try {
      const saved = await retroApi.saveOrUpdateCard(boardId, card);
      settleCard(card.id);
      applyServerCard(saved);
      return true;
    } catch (err: any) {
      console.error(err);
      settleCard(card.id);
      revertCard(card.id);
      toast({ title: 'Não foi possível adicionar o cartão', description: err?.message || 'Seu texto continua no campo. Tente de novo.', variant: 'destructive' });
      return false;
    }
  }, [isAuthenticated, userProfile, boardId, trackOptimistic, settleCard, applyServerCard, revertCard, toast]);

  const handleDeleteCard = useCallback((cardId: string) => {
    if (!boardId) return;
    if (readOnlyRef.current) { toast(readOnlyToast()); return; }
    retroApi.deleteCard(boardId, cardId)
      .then(() => {
        setCards((prev) => removeById(prev, cardId));
        setOptimisticCards((prev) => removeById(prev, cardId));
      })
      .catch((err) => {
        console.error(err);
        toast({ title: 'Não foi possível apagar o cartão', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, toast]);

  const handleUpdateCard = useCallback((cardId: string, newContent: string, assignee?: string, dueDate?: string) => {
    if (!boardId) return;
    if (readOnlyRef.current) { toast(readOnlyToast()); return; }
    const current = optimisticRef.current.find((c) => c.id === cardId) || cardsRef.current.find((c) => c.id === cardId);
    if (!current) return;
    const text = newContent.trim();
    if (!text) return;
    if (text === current.content && (assignee || undefined) === (current.assignee || undefined) && (dueDate || undefined) === (current.dueDate || undefined)) return;

    const updated: RetroCardType = { ...current, content: text, assignee: assignee || undefined, dueDate: dueDate || undefined };
    trackOptimistic(updated);
    retroApi.saveOrUpdateCard(boardId, updated)
      .then((saved) => { settleCard(cardId); applyServerCard(saved); })
      .catch((err) => {
        console.error(err);
        settleCard(cardId);
        revertCard(cardId);
        toast({ title: 'Não foi possível salvar a edição', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, trackOptimistic, settleCard, applyServerCard, revertCard, toast]);

  const handleToggleCardsRevealed = useCallback(() => {
    if (!boardRef.current) return;
    patchBoard({ isCardsRevealed: !boardRef.current.isCardsRevealed });
  }, [patchBoard]);

  const handleSetVotingStatus = useCallback((status: 'disabled' | 'active' | 'finished') => {
    if (!boardData) return;
    if (status === 'disabled') {
      // "Zerar votos" apaga os votos de verdade: votos velhos continuavam valendo no limite da rodada seguinte.
      retroApi.resetVotes(boardId)
        .then((updated) => {
          if (updated?.id) setBoardData(updated);
          setCards((prev) => prev.map((c) => ({ ...c, votes: [] })));
        })
        .catch((err) => {
          console.error(err);
          toast({ title: 'Não foi possível zerar a votação', description: err?.message, variant: 'destructive' });
        });
      return;
    }
    const patch: Partial<RetroBoardType> = { votingStatus: status };
    if (status === 'finished' && boardData.autoSortOnVoteEnd) {
      const feedbackIds = resolveColumns(boardData).filter((c) => c.theme !== 'action').map((c) => c.id);
      patch.columnSorts = {
        ...(boardData.columnSorts || {}),
        ...Object.fromEntries(feedbackIds.map((id) => [id, true])),
      };
    }
    patchBoard(patch);
  }, [boardData, boardId, patchBoard, toast]);

  const handleSetMaxVotesPerParticipant = useCallback((max: number) => {
    if (!boardRef.current) return;
    patchBoard({ maxVotesPerParticipant: max });
  }, [patchBoard]);

  const handleToggleVote = useCallback((cardId: string) => {
    if (!boardId || !isAuthenticated || !userProfile || !boardData) return;
    if (readOnlyRef.current) { toast(readOnlyToast()); return; }
    const check = checkVote({ board: boardData, cards: optimisticRef.current, cardId, userId: userProfile.id });
    if (!check.ok) {
      if (check.reason === 'closed') {
        toast({ title: 'A votação não está aberta', description: 'Peça ao facilitador para iniciar a votação.', variant: 'destructive' });
      } else if (check.reason === 'limit') {
        toast({ title: 'Limite de votos atingido', description: voteLimitMessage(check.max ?? 0), variant: 'destructive' });
      }
      return;
    }
    const current = optimisticRef.current.find((c) => c.id === cardId)!;
    const newVotes = check.removing ? current.votes.filter((v) => v !== userProfile.id) : [...current.votes, userProfile.id];
    trackOptimistic({ ...current, votes: newVotes });
    // O servidor alterna só o voto desta pessoa e aplica o limite: dois votos ao mesmo tempo não se perdem.
    retroApi.toggleVote(boardId, cardId)
      .then((saved) => { settleCard(cardId); applyServerCard(saved); })
      .catch((err) => {
        console.error(err);
        settleCard(cardId);
        revertCard(cardId);
        toast({ title: 'Não foi possível registrar o voto', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, isAuthenticated, userProfile, boardData, toast, trackOptimistic, settleCard, applyServerCard, revertCard]);

  const handleToggleReaction = useCallback((cardId: string, type: RetroReactionType, currentUserIds: string[]) => {
    if (!boardId || !isAuthenticated || !userProfile) return;
    if (readOnlyRef.current) { toast(readOnlyToast()); return; }
    // Base em optimisticRef: duas reações em sequência rápida no mesmo card não perdem uma delas.
    const current = optimisticRef.current.find((c) => c.id === cardId) || cardsRef.current.find((c) => c.id === cardId);
    if (!current) return;

    // Reações são mutuamente exclusivas por pessoa: tira a pessoa de todos os tipos antes de (re)aplicar no
    // clicado, senão dá para marcar os 4 ao mesmo tempo no mesmo card.
    const wasActiveOnThisType = currentUserIds.includes(userProfile.id);
    const allReactions = current.reactions || {};
    const newReactions: typeof allReactions = {};
    for (const key of Object.keys(allReactions) as RetroReactionType[]) {
      newReactions[key] = (allReactions[key] || []).filter((uid) => uid !== userProfile.id);
    }
    if (!wasActiveOnThisType) {
      newReactions[type] = [...(newReactions[type] || []), userProfile.id];
    }

    const updated = { ...current, reactions: newReactions };
    trackOptimistic(updated);
    retroApi.saveOrUpdateCard(boardId, updated)
      .then((saved) => { settleCard(cardId); applyServerCard(saved); })
      .catch((err) => {
        console.error(err);
        settleCard(cardId);
        revertCard(cardId);
        toast({ title: 'Não foi possível registrar a reação', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, isAuthenticated, userProfile, trackOptimistic, settleCard, applyServerCard, revertCard, toast]);

  const handleToggleActionDone = useCallback((cardId: string, isDone: boolean) => {
    if (!boardId) return;
    if (readOnlyRef.current) { toast(readOnlyToast()); return; }
    const current = optimisticRef.current.find((c) => c.id === cardId) || cardsRef.current.find((c) => c.id === cardId);
    if (!current) return;

    const updated = { ...current, isDone };
    trackOptimistic(updated);
    retroApi.saveOrUpdateCard(boardId, updated)
      .then((saved) => { settleCard(cardId); applyServerCard(saved); })
      .catch((err) => {
        console.error(err);
        settleCard(cardId);
        revertCard(cardId);
        toast({ title: 'Não foi possível atualizar a ação', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, trackOptimistic, settleCard, applyServerCard, revertCard, toast]);

  const handleImportActions = useCallback(async (entries: RetroImportEntry[]) => {
    const total = entries.reduce((n, e) => n + e.cards.length, 0);
    if (!boardId || !isAuthenticated || !userProfile || !boardData || total === 0) return;
    if (readOnlyRef.current) { toast(readOnlyToast()); return; }

    const destActionColumn = resolveColumns(boardData).find((c) => c.theme === 'action');
    if (!destActionColumn) {
      toast({
        title: 'Sem coluna de ação',
        description: 'Este formato não tem uma coluna de plano de ação para receber os itens.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const baseOrder = Date.now();
      let index = 0;
      const newCards = entries.flatMap(({ board: sourceBoard, cards: sourceCards }) =>
        sourceCards.map((sourceCard) => ({
          id: crypto.randomUUID(),
          boardId,
          columnKey: destActionColumn.id,
          content: sourceCard.content,
          authorId: userProfile.id,
          votes: [],
          order: baseOrder + index++,
          assignee: sourceCard.assignee || undefined,
          dueDate: sourceCard.dueDate || undefined,
          isDone: false,
          // Preserva a raiz da cadeia: se a ação já veio carregada de uma retro anterior, não sobrescreve com o
          // quadro imediato — senão uma reimportação em série perde a proveniência original a cada salto.
          carriedFromBoardId: sourceCard.carriedFromBoardId || sourceBoard.id,
          carriedFromBoardTitle: sourceCard.carriedFromBoardTitle || sourceBoard.title || 'Retro anterior',
          carryCount: (sourceCard.carryCount || 0) + 1,
        } as RetroCardType))
      );

      setOptimisticCards((prev) => uniqueById([...prev, ...newCards]));
      await retroApi.importActions(boardId, newCards);

      const origem = entries.length === 1 ? `"${entries[0].board.title || 'retro anterior'}"` : `${entries.length} retros anteriores`;
      toast({
        title: 'Ações importadas',
        description: `${total} ${total === 1 ? 'ação trazida' : 'ações trazidas'} de ${origem}.`,
      });
    } catch (error) {
      console.error('Erro ao importar ações pendentes:', error);
      setOptimisticCards(overlayPending(cardsRef.current, pendingRef.current));
      toast({
        title: 'Erro ao importar',
        description: 'Não foi possível trazer as ações pendentes para este quadro.',
        variant: 'destructive',
      });
    }
  }, [boardId, isAuthenticated, userProfile, boardData, toast]);

  const handleMergeCards = useCallback(async (sourceId: string, targetId: string) => {
    if (!boardId || !boardData) return;
    if (readOnlyRef.current) { toast(readOnlyToast()); return; }

    if (!boardData.isCardsRevealed) {
      toast({ title: 'Ação bloqueada', description: 'Não é possível juntar cartões durante a fase anônima.', variant: 'destructive' });
      return;
    }

    const sourceCard = cardsRef.current.find((c) => c.id === sourceId);
    const targetCard = cardsRef.current.find((c) => c.id === targetId);
    if (!sourceCard || !targetCard) return;

    if (sourceCard.columnKey !== targetCard.columnKey) {
      toast({ title: 'Fusão não permitida', description: 'Só é possível juntar cartões do mesmo painel: cada painel tem a sua votação.', variant: 'destructive' });
      return;
    }

    try {
      // Atômico no servidor: junta os textos como histórico, une os votos sem repetir quem votou nos dois e apaga o original.
      const merged = await retroApi.mergeCards(boardId, targetId, sourceId);
      setCards((prev) => removeById(prev, sourceId));
      applyServerCard(merged);
      toast({ title: 'Ideias juntadas', description: 'Os textos e os votos foram combinados.' });
    } catch (error: any) {
      console.error('Erro ao juntar cartões:', error);
      void reloadBoardData();
      toast({ title: 'Não foi possível juntar os cartões', description: error?.message || 'Tente de novo.', variant: 'destructive' });
    }
  }, [boardId, boardData, toast, applyServerCard, reloadBoardData]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !boardId || !userProfile) return;
    if (readOnlyRef.current) return;

    const plan = planCardMove({
      allCards: cardsRef.current,
      activeId: String(active.id),
      overId: String(over.id),
      overIsColumn: over.data.current?.type === 'column',
      board: boardData,
      userId: userProfile.id,
      isCreator: isCurrentUserCreator,
    });

    if (plan.kind === 'ignore') return;
    if (plan.kind === 'blocked') {
      if (plan.reason === 'anonymous') {
        toast({ title: 'Cartão de outra pessoa', description: 'Durante a fase anônima só o autor ou o facilitador move o cartão.', variant: 'destructive' });
      } else {
        toast({
          title: 'Limite de votos do painel de destino',
          description: 'Você já usou todos os votos do painel de destino. Remova o seu voto deste cartão ou de outro de lá antes de mover.',
          variant: 'destructive',
        });
      }
      return;
    }

    const { moves } = plan;
    moves.forEach(trackOptimistic);
    try {
      const saved = await Promise.all(moves.map((m) => retroApi.saveOrUpdateCard(boardId, m)));
      moves.forEach((m) => settleCard(m.id));
      saved.forEach(applyServerCard);
    } catch (error: any) {
      console.error('Erro ao mover cartão:', error);
      moves.forEach((m) => { settleCard(m.id); revertCard(m.id); });
      toast({ title: 'Não foi possível mover o cartão', description: error?.message || 'Tente novamente.', variant: 'destructive' });
    }
  }, [boardId, userProfile, boardData, isCurrentUserCreator, toast, trackOptimistic, settleCard, applyServerCard, revertCard]);

  const handleRemoveParticipant = useCallback(async (participantId: string): Promise<boolean> => {
    if (!boardId) return false;
    try {
      await retroApi.removeParticipant(boardId, participantId);
    } catch (error: any) {
      console.error('Erro ao remover participante:', error);
      toast({ title: 'Não foi possível remover a pessoa', description: error?.message || 'Tente novamente.', variant: 'destructive' });
      return false;
    }
    setParticipants((prev) => removeById(prev, participantId));
    const ids = (boardRef.current?.participantIds || []).filter((id) => id !== participantId);
    retroApi.patchBoard(boardId, { participantIds: ids })
      .then((updated) => { if (updated?.id) setBoardData(updated); })
      .catch((err) => console.error('Erro ao atualizar a lista de participantes do quadro:', err));
    return true;
  }, [boardId, toast]);

  const handleClaimCreator = useCallback(() => {
    if (!boardData || !isAuthenticated || !userProfile) return;

    // O servidor troca o criador e limpa a flag de facilitador do anterior: nunca ficam dois.
    retroApi.transferControl(boardId).then((updated) => {
      if (updated?.id) setBoardData(updated);
      setParticipants((prev) => prev.map((p) => ({ ...p, isCreator: p.id === userProfile.id })));
      toast({ title: 'Controle assumido', description: `${userProfile.name} agora é o facilitador da retro.` });
    }).catch((error) => {
      console.error('Erro ao assumir controle:', error);
      toast({ title: 'Erro ao assumir o controle', description: error?.message || 'Não foi possível completar a operação.', variant: 'destructive' });
    });
  }, [boardData, boardId, isAuthenticated, userProfile, toast]);

  const handleLeaveRoom = useCallback(async () => {
    if (!currentUser) return;
    // Só sai da página depois que o servidor confirmou; senão a pessoa "sai" mas continua na lista.
    leavingRef.current = true;
    const ok = await handleRemoveParticipant(currentUser.id);
    if (ok) {
      router.push('/');
    } else {
      leavingRef.current = false;
    }
  }, [currentUser, handleRemoveParticipant, router]);

  const handleDeleteBoard = useCallback(async () => {
    // Antes do pedido: o aviso do servidor pode chegar antes da resposta e não deve recarregar a sala.
    deletedRef.current = true;
    try {
      await retroApi.deleteBoard(boardId);
      leavingRef.current = true;
      removeLocalRoomMeta(boardId, typeof window === 'undefined' ? undefined : window.localStorage);
      toast({ title: 'Retro apagada' });
      router.push('/retro');
    } catch (error) {
      deletedRef.current = false;
      const message = error instanceof Error ? error.message : 'Não foi possível apagar a retro.';
      toast({ title: 'Não foi possível apagar a retro', description: message, variant: 'destructive' });
    }
  }, [boardId, router, toast]);

  // ---- Timer (mudanças gravadas no quadro; o relógio de cada tela é derivado de `timer`) ----
  const handleSetTimerDuration = useCallback((duration: number) => {
    patchBoard({ timer: stoppedTimer(duration) });
  }, [patchBoard]);

  const handleStartTimer = useCallback((duration: number) => {
    patchBoard({ timer: startedTimer(duration, Date.now()) });
  }, [patchBoard]);

  const handlePauseTimer = useCallback(() => {
    const next = pausedTimer(boardRef.current?.timer, Date.now());
    if (next) patchBoard({ timer: next });
  }, [patchBoard]);

  const handleResumeTimer = useCallback(() => {
    const next = resumedTimer(boardRef.current?.timer, Date.now());
    if (next) patchBoard({ timer: next });
  }, [patchBoard]);

  const handleResetTimer = useCallback(() => {
    const next = resetTimer(boardRef.current?.timer);
    if (next) patchBoard({ timer: next });
  }, [patchBoard]);

  /**
   * O tempo zerou com a tela aberta. Só o facilitador age: encerra o timer no servidor (sem isso ele ficava
   * "running" para sempre e o alarme repetia) e, se a opção estiver ligada, revela os cartões. Um fim que já
   * passou há mais de 3 s ("late": tela aberta depois) só encerra o timer, sem revelar.
   */
  const handleTimerExpire = useCallback(({ late }: { late: boolean }) => {
    const board = boardRef.current;
    if (!board || board.creatorId !== userProfile?.id) return;
    if (board.timer?.status !== 'running') return;
    if (!late && board.autoRevealOnTimerEnd && !board.isCardsRevealed) patchBoard({ isCardsRevealed: true });
    const next = resetTimer(board.timer);
    if (next) patchBoard({ timer: next });
  }, [patchBoard, userProfile?.id]);

  // ---- Configurações do facilitador ----
  const handleToggleAuthorsRevealed = useCallback((show: boolean) => { patchBoard({ isAuthorsRevealed: show }); }, [patchBoard]);

  const handleToggleSyncStage = useCallback((enabled: boolean) => {
    patchBoard({ syncStageEnabled: enabled, activeColumnKey: enabled ? activeStage : undefined });
  }, [patchBoard, activeStage]);

  const handleToggleAutoRevealOnTimerEnd = useCallback((enabled: boolean) => { patchBoard({ autoRevealOnTimerEnd: enabled }); }, [patchBoard]);
  const handleToggleAutoSortOnVoteEnd = useCallback((enabled: boolean) => { patchBoard({ autoSortOnVoteEnd: enabled }); }, [patchBoard]);
  const handleToggleHealthCheck = useCallback((enabled: boolean) => { patchBoard({ healthCheckEnabled: enabled }); }, [patchBoard]);
  const handleHealthCheckQuestionChange = useCallback((question: string) => { patchBoard({ healthCheckQuestion: question }); }, [patchBoard]);

  const handleSubmitHealthCheckAnswer = useCallback(async (answer: HealthCheckAnswer, note?: string) => {
    if (!boardId || !currentUser) return;
    // Aplica na hora: a trava some sem depender do eco do WebSocket (que pode se perder).
    const previous = currentUser;
    // A nota só vai quando foi escrita (campo ausente não apaga no servidor).
    const checkinNote = note?.trim() ? note.trim().slice(0, 500) : undefined;
    setParticipants((prev) => prev.map((p) => (p.id === currentUser.id ? { ...p, healthCheckAnswer: answer, ...(checkinNote ? { checkinNote } : {}) } : p)));
    try {
      await retroApi.addOrUpdateParticipant(boardId, { ...currentUser, healthCheckAnswer: answer, ...(checkinNote ? { checkinNote } : {}) });
    } catch (err: any) {
      console.error('Erro ao registrar check-in inicial:', err);
      setParticipants((prev) => prev.map((p) => (p.id === previous.id ? previous : p)));
      toast({ title: 'Não foi possível registrar sua resposta', description: err?.message || 'Tente de novo.', variant: 'destructive' });
    }
  }, [boardId, currentUser, toast]);

  /** Encerrar e reabrir: o servidor devolve o quadro (e avisa as outras telas por BOARD_UPDATED). 403/409 vêm com a mensagem dele. */
  const runLifecycle = useCallback(async (action: 'finish' | 'reopen') => {
    setLifecycleBusy(true);
    try {
      const updated = action === 'finish' ? await retroApi.finishBoard(boardId) : await retroApi.reopenBoard(boardId);
      if (updated?.id) setBoardData(updated);
      toast(action === 'finish'
        ? { title: 'Retro encerrada', description: 'As outras pessoas agora só leem o quadro. Você pode reabrir quando quiser.' }
        : { title: 'Retro reaberta', description: 'Todas as pessoas voltam a poder escrever, votar e mover cartões.' });
    } catch (err: any) {
      console.error(err);
      toast({ title: action === 'finish' ? 'Não foi possível encerrar a retro' : 'Não foi possível reabrir a retro', description: err?.message, variant: 'destructive' });
    } finally {
      setLifecycleBusy(false);
    }
  }, [boardId, toast]);
  const handleFinishRetro = useCallback(() => runLifecycle('finish'), [runLifecycle]);
  const handleReopenRetro = useCallback(() => runLifecycle('reopen'), [runLifecycle]);

  // "Fulana está escrevendo…" por coluna e por canal do chat (com a autoria oculta, só "Alguém").
  const nicknameOf = useCallback((userId: string) => participants.find((p) => p.id === userId)?.nickname, [participants]);
  const authorsRevealed = boardData?.isAuthorsRevealed === true;
  const { labelFor: typingLabelFor } = typing;
  const typingLabelForColumn = useCallback((columnKey: string) => typingLabelFor('card', columnKey, nicknameOf, { authorsRevealed }), [typingLabelFor, nicknameOf, authorsRevealed]);
  const typingLabelForChannel = useCallback((channelId: string) => typingLabelFor('chat', channelId, nicknameOf), [typingLabelFor, nicknameOf]);

  const handleToggleColumnSort = useCallback((columnKey: string, isSorted: boolean) => {
    const currentSorts = boardRef.current?.columnSorts || {};
    patchBoard({ columnSorts: { ...currentSorts, [columnKey]: isSorted } });
  }, [patchBoard]);

  /** Só a lista de colunas vai ao servidor: gravar o quadro inteiro desfazia o que o facilitador mudou no meio tempo. */
  const handleRenameColumn = useCallback((columnId: string, title: string) => {
    const board = boardRef.current;
    if (!board) return;
    const updatedColumns = resolveColumns(board).map((col) => (col.id === columnId ? { ...col, title } : col));
    patchBoard({ columns: updatedColumns }, 'Não foi possível renomear a coluna').then((updated) => {
      if (updated) toast({ title: 'Coluna renomeada', description: `Agora se chama "${title}".` });
    });
  }, [patchBoard, toast]);

  /** Grava no quadro o resumo da cerimônia (quantos cartões e quais ações) para o histórico da squad. */
  const handleSyncSummary = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const actionIds = new Set(resolveColumns(board).filter((c) => c.theme === 'action').map((c) => c.id));
    const all = cardsRef.current;
    const actionItems = all.filter((c) => actionIds.has(c.columnKey)).map((c) => c.content);
    if (actionItems.length === 0) {
      toast({ title: 'Nenhuma ação para salvar', variant: 'destructive' });
      return;
    }
    const feedbackCount = all.filter((c) => !actionIds.has(c.columnKey)).length;
    patchBoard({ summary: { feedbackCount, actionItems } }, 'Não foi possível salvar o resumo').then((updated) => {
      if (updated) toast({ title: 'Resumo salvo', description: 'O histórico da cerimônia ficou disponível para todos os participantes.' });
    });
  }, [patchBoard, toast]);

  // Timer: objeto estável. Recriá-lo a cada render reiniciava o intervalo do contador a cada cartão ou voto recebido.
  const timerStatus = boardData?.timer?.status;
  const timerInitial = boardData?.timer?.initialDuration;
  const timerPaused = boardData?.timer?.remainingOnPause;
  const timerEnd = boardData?.timer?.endTime;
  const mappedTimer = useMemo(
    () => timerFromBoard({ status: timerStatus, initialDuration: timerInitial, remainingOnPause: timerPaused, endTime: timerEnd }),
    [timerStatus, timerInitial, timerPaused, timerEnd]
  );

  // Sem sessão não há o que carregar: antes ficava num "Sincronizando..." eterno.
  if (!isLoading && !isInitializing && !isAuthenticated) {
    return (
      <RoomMessage
        title="Entre para abrir este quadro"
        action={<ModalButton variant="primary" onClick={() => router.push('/login')}>Ir para o login</ModalButton>}
      >
        Sua sessão expirou ou você ainda não entrou. Faça login e volte para este link.
      </RoomMessage>
    );
  }

  if (boardDeleted) {
    return (
      <RoomMessage
        title="Esta retro foi apagada"
        action={<ModalButton variant="primary" onClick={() => router.push('/retro')}>Voltar para as retros</ModalButton>}
      >
        Quem criou a retro removeu o quadro, com os cards e o chat. Não há mais o que fazer aqui.
      </RoomMessage>
    );
  }

  if (loadError === 'failed' && !boardData) {
    return (
      <RoomMessage
        title="Não foi possível carregar o quadro"
        action={
          <ModalButton
            variant="primary"
            onClick={() => {
              setLoadError(null);
              setIsBoardLoading(true);
              setAreCardsLoading(true);
              setAreParticipantsLoading(true);
              void reloadBoardData();
            }}
          >
            Tentar de novo
          </ModalButton>
        }
      >
        Pode ser uma falha de conexão ou da sua sessão. O quadro não foi perdido.
      </RoomMessage>
    );
  }

  if (isLoading || isInitializing || isBoardLoading || areCardsLoading || areParticipantsLoading || !userProfile) {
    if (!userProfile) {
      return <LoadingScreen message="Configurando identidade..." submessage="Preencha sua identidade para entrar no quadro" />;
    }
    return <LoadingScreen message="Retrospectiva" submessage="Sincronizando o quadro com o time..." />;
  }

  if (!boardData) return <NotFound resourceName="quadro retrospectivo" />;
  if (!currentUser) return <LoadingScreen message="Entrando" submessage="Validando seu acesso ao quadro..." />;

  const needsHealthCheck = !!boardData.healthCheckEnabled && !currentUser.healthCheckAnswer;

  return (
    <>
      {needsHealthCheck && (
        <RetroHealthCheckGate question={boardData.healthCheckQuestion} onAnswer={handleSubmitHealthCheckAnswer} allowNote={newBackend} />
      )}
      <RetroRoom
        boardId={boardId}
        boardData={boardData}
        cards={optimisticCards}
        participants={participants || []}
        onlineIds={presence.online}
        currentUserId={userProfile.id}
        currentParticipant={currentUser}
        isCurrentUserCreator={isCurrentUserCreator}
        timer={mappedTimer}
        activeStage={activeStage}
        mergingSourceId={mergingSourceId}
        needsHealthCheck={needsHealthCheck}
        chatMessagesByChannel={chatByChannel}
        onAddCard={handleAddCard}
        onDeleteCard={handleDeleteCard}
        onUpdateCard={handleUpdateCard}
        onToggleVote={handleToggleVote}
        onToggleReaction={handleToggleReaction}
        onToggleDone={handleToggleActionDone}
        onImportActions={handleImportActions}
        onToggleCardsRevealed={handleToggleCardsRevealed}
        onSetVotingStatus={handleSetVotingStatus}
        onSetMaxVotesPerParticipant={handleSetMaxVotesPerParticipant}
        onStartTimer={handleStartTimer}
        onPauseTimer={handlePauseTimer}
        onResumeTimer={handleResumeTimer}
        onResetTimer={handleResetTimer}
        onSetTimerDuration={handleSetTimerDuration}
        onTimerExpire={handleTimerExpire}
        onToggleShowAuthors={handleToggleAuthorsRevealed}
        onToggleSyncStage={handleToggleSyncStage}
        onToggleAutoRevealOnTimerEnd={handleToggleAutoRevealOnTimerEnd}
        onToggleAutoSortOnVoteEnd={handleToggleAutoSortOnVoteEnd}
        onToggleHealthCheck={handleToggleHealthCheck}
        onHealthCheckQuestionChange={handleHealthCheckQuestionChange}
        onToggleColumnSort={handleToggleColumnSort}
        onRenameColumn={handleRenameColumn}
        onSyncSummary={handleSyncSummary}
        onDragEnd={handleDragEnd}
        onRemoveParticipant={handleRemoveParticipant}
        onClaimCreator={handleClaimCreator}
        onLeaveBoard={handleLeaveRoom}
        onDeleteBoard={handleDeleteBoard}
        onStageChange={handleStageChange}
        onStartMerge={setMergingSourceId}
        onExecuteMerge={(targetId) => {
          if (mergingSourceId && mergingSourceId !== targetId) {
            void handleMergeCards(mergingSourceId, targetId);
          }
          setMergingSourceId(null);
        }}
        onOpenFeedback={handleOpenFeedback}
        onOpenStats={() => setShowStats(true)}
        onSendChatMessage={handleSendChatMessage}
        onDeleteChatMessage={handleDeleteChatMessage}
        isFinished={isFinished}
        readOnly={readOnly}
        onFinishRetro={newBackend && canManageLifecycle ? handleFinishRetro : undefined}
        onReopenRetro={newBackend && canManageLifecycle ? handleReopenRetro : undefined}
        lifecycleBusy={lifecycleBusy}
        typingLabelForColumn={newBackend ? typingLabelForColumn : undefined}
        typingLabelForChannel={newBackend ? typingLabelForChannel : undefined}
        onTypingCard={newBackend ? typing.notifyCard : undefined}
        onTypingChat={newBackend ? typing.notifyChat : undefined}
      />
      <FeedbackWidget
        toolName={`Retrospectiva: ${boardData?.title || 'Agile'}`}
        triggerVariant="none"
        externalTriggerSignal={feedbackSignal}
      />
      <SprintStatsDialog
        open={showStats && !needsHealthCheck}
        onClose={() => setShowStats(false)}
        squadId={boardData?.squadId || activeSquadId}
        sprintId={boardData?.sprintId || undefined}
      />
    </>
  );
}
