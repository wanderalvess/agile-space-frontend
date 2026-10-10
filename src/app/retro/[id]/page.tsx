'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useEffect, useCallback, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { RetroBoard as RetroBoardType, RetroCard as RetroCardType, RetroColumnKey, TimerState, RetroParticipant, TeamRole, GlobalRole, RetroReactionType, HealthCheckAnswer } from '@/lib/types';
import { RETRO_TEMPLATES } from '@/lib/types';
import { RetroBoard } from '@/components/retro/RetroBoard';
import { RetroHealthCheckGate } from '@/components/retro/RetroHealthCheckGate';
import type { DragEndEvent } from '@dnd-kit/core';
import { NotFound } from '@/components/NotFound';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { Button } from '@/components/ui/button';
import type { ChatMessage, ChatMessageKind } from '@/components/poker/team-chat/chatChannels';
import { participantCategory } from '@/components/poker/team-chat/chatChannels';
import { chatChannelsFor, mergeChatHistory, toChatParticipant, upsertChatMessage } from '@/components/retro/retro-chat';
import { useUserContext } from '@/context/UserContext';
import { FeedbackWidget } from '@/components/feedback-widget';
import { retroApi, RetroApiError } from '../api';
import { getAuthToken } from '@/lib/auth-client';
import { SprintStatsDialog } from '@/components/retro/SprintStatsDialog';

export default function RetroRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const boardId = resolvedParams.id;
  
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { userProfile, requestIdentity, isInitializing } = useUserContext();

  const [boardData, setBoardData] = useState<RetroBoardType | null>(null);
  const [cards, setCards] = useState<RetroCardType[]>([]);
  const [participants, setParticipants] = useState<RetroParticipant[]>([]);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [areCardsLoading, setAreCardsLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);
  // 'notfound' = o servidor disse que o quadro não existe; 'failed' = não deu pra carregar (rede, sessão, 5xx).
  const [loadError, setLoadError] = useState<null | 'notfound' | 'failed'>(null);
  const loadSeqRef = useRef(0);
  const cardsRef = useRef<RetroCardType[]>([]);
  const optimisticRef = useRef<RetroCardType[]>([]);
  const boardRef = useRef<RetroBoardType | null>(null);
  const leavingRef = useRef(false);
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

  const currentUser = useMemo(() => participants?.find(p => p.id === userProfile?.id) || null, [participants, userProfile]);
  const isCurrentUserCreator = useMemo(() => !!(userProfile && boardData && userProfile.id === boardData.creatorId), [userProfile, boardData]);

  const [showStats, setShowStats] = useState(false);

  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { optimisticRef.current = optimisticCards; }, [optimisticCards]);
  useEffect(() => { boardRef.current = boardData; }, [boardData]);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  // Centralized data loading
  const reloadBoardData = useCallback(async () => {
    if (!isAuthenticated) return;
    // Só a resposta mais recente vale: um reload lento que chega depois de eventos novos do WebSocket
    // não pode sobrescrever o estado mais novo com dados velhos.
    const seq = ++loadSeqRef.current;
    try {
      const [board, cardsList, participantsList] = await Promise.all([
        retroApi.getBoard(boardId),
        retroApi.getCards(boardId),
        retroApi.getParticipants(boardId)
      ]);
      if (seq !== loadSeqRef.current) return;
      setBoardData(board);
      setCards(cardsList);
      setParticipants(participantsList);
      setLoadError(null);
    } catch (e) {
      console.error("Erro ao carregar dados do quadro de retrospectiva:", e);
      if (seq !== loadSeqRef.current) return;
      // Já com o quadro na tela, uma falha de rede passageira não derruba nada: o próximo evento ou reconexão ressincroniza.
      if (!boardRef.current) {
        setLoadError(e instanceof RetroApiError && e.status === 404 ? 'notfound' : 'failed');
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setIsBoardLoading(false);
        setAreCardsLoading(false);
        setAreParticipantsLoading(false);
      }
    }
  }, [boardId, isAuthenticated]);

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
  }, [boardId]);

  /** Aplica no estado um card devolvido pelo servidor (a resposta do POST vale mesmo se o eco do WebSocket se perder). */
  const applyServerCard = useCallback((card: RetroCardType) => {
    if (!card?.id) return;
    setCards(prev => {
      const idx = prev.findIndex(c => c.id === card.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = card;
        return copy;
      }
      return [...prev, card];
    });
  }, []);

  const trackOptimistic = useCallback((card: RetroCardType) => {
    pendingRef.current.set(card.id, card);
    setOptimisticCards(prev => (prev.some(c => c.id === card.id)
      ? prev.map(c => (c.id === card.id ? card : c))
      : [...prev, card]));
  }, []);

  const settleCard = useCallback((cardId: string) => {
    pendingRef.current.delete(cardId);
  }, []);

  /** Desfaz só a mudança otimista deste card, sem apagar as outras que ainda estão em voo. */
  const revertCard = useCallback((cardId: string) => {
    const server = cardsRef.current.find(c => c.id === cardId);
    setOptimisticCards(prev => server
      ? prev.map(c => (c.id === cardId ? server : c))
      : prev.filter(c => c.id !== cardId));
  }, []);

  /** Escrita parcial do quadro com a resposta aplicada na hora; erro vira aviso, não silêncio. */
  const patchBoard = useCallback((patch: Partial<RetroBoardType>, errorTitle = 'Não foi possível salvar a alteração') => {
    return retroApi.patchBoard(boardId, patch)
      .then(updated => {
        if (updated?.id) setBoardData(updated);
        return updated;
      })
      .catch(err => {
        console.error(err);
        toast({ title: errorTitle, description: err?.message, variant: 'destructive' });
        return null;
      });
  }, [boardId, toast]);

  // Initial load and WebSocket connection
  useEffect(() => {
    if (!isAuthenticated) return;

    reloadBoardData();

    // WebSocket Nativo para refresh em tempo real
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/retro/') + boardId;
    // Recalcula o token a cada tentativa (não só uma vez no mount): numa sessão
    // longa o suficiente pra ele expirar, reconexões subsequentes reusariam um
    // token vencido pra sempre e o WS nunca voltaria sem reload manual.
    const buildWsUrl = () => wsBase + '?token=' + encodeURIComponent(getAuthToken() || '');

    // `stopped` distingue um close deliberado (cleanup/unmount, inclusive o
    // duplo-mount do Strict Mode em dev) de um close real do servidor — só
    // reagenda reconexão no segundo caso, senão cada cleanup viraria um
    // reconnect fantasma brigando com o efeito que já tomou o lugar dele.
    let stopped = false;
    let socket: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let hadConnection = false;

    const connect = () => {
      const wsUrl = buildWsUrl();
      console.log("Conectando ao WebSocket do Board Retro:", boardId);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        // Eventos perdidos durante a queda não voltam sozinhos: reconectou, ressincroniza.
        if (hadConnection) reloadBoardData();
        hadConnection = true;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'BOARD_UPDATED':
              if (data.payload) {
                setBoardData(data.payload);
              }
              break;

            case 'PARTICIPANT_JOINED':
              if (data.payload) {
                setParticipants(prev => {
                  const idx = prev.findIndex(p => p.id === data.payload.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = data.payload;
                    return copy;
                  }
                  return [...prev, data.payload];
                });
              }
              break;

            case 'PARTICIPANT_LEFT':
              if (data.payload?.userId) {
                setParticipants(prev => prev.filter(p => p.id !== data.payload.userId));
              }
              break;

            case 'CARD_SAVED':
              if (data.payload) {
                setCards(prev => {
                  const idx = prev.findIndex(c => c.id === data.payload.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = data.payload;
                    return copy;
                  }
                  return [...prev, data.payload];
                });
              }
              break;

            case 'CARD_DELETED':
              if (data.payload?.cardId) {
                setCards(prev => prev.filter(c => c.id !== data.payload.cardId));
              }
              break;

            case 'CARDS_IMPORTED':
              if (Array.isArray(data.payload)) {
                setCards(prev => {
                  const importedIds = new Set(data.payload.map((c: any) => c.id));
                  const filtered = prev.filter(c => !importedIds.has(c.id));
                  return [...filtered, ...data.payload];
                });
              }
              break;

            case 'CHAT_MESSAGE_SAVED':
              // Só canais que este usuário enxerga (geral, o da sua função e as suas DMs)
              if (data.payload?.channelId && chatChannelsRef.current.has(data.payload.channelId)) {
                const msg: ChatMessage = data.payload;
                setChatByChannel(prev => upsertChatMessage(prev, msg));
              }
              break;

            case 'CHAT_MESSAGE_DELETED':
              if (data.payload?.messageId && data.payload?.channelId) {
                const { messageId, channelId } = data.payload;
                setChatByChannel(prev => ({
                  ...prev,
                  [channelId]: (prev[channelId] || []).filter(m => m.id !== messageId),
                }));
              }
              break;

            case 'REFRESH_BOARD':
            default:
              reloadBoardData();
              break;
          }
        } catch (err) {
          console.error("Erro ao processar mensagem do WebSocket do Retro:", err);
          reloadBoardData();
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        console.warn("Conexão WebSocket fechada. Tentando reconectar...");
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimeout);
      socket.close();
    };
  }, [boardId, isAuthenticated, reloadBoardData]);

  // Listener para cancelar merge com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMergingSourceId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStageChange = useCallback((stage: RetroColumnKey) => {
    setActiveStage(stage);
    if (isCurrentUserCreator && boardData?.syncStageEnabled && boardData) {
      patchBoard({ activeColumnKey: stage });
    }
  }, [isCurrentUserCreator, boardData, patchBoard]);

  useEffect(() => {
    if (boardData?.syncStageEnabled && !isCurrentUserCreator && boardData.activeColumnKey) {
      setActiveStage(boardData.activeColumnKey);
    }
  }, [boardData?.syncStageEnabled, boardData?.activeColumnKey, isCurrentUserCreator]);

  // Initialize activeStage from board columns (dynamic or fallback)
  useEffect(() => {
    if (!activeStage && boardData) {
      // Com a sincronização ligada, quem entra no meio da retro começa na coluna do facilitador, não na primeira.
      if (boardData.syncStageEnabled && !isCurrentUserCreator && boardData.activeColumnKey) {
        setActiveStage(boardData.activeColumnKey);
        return;
      }
      const cols = boardData.columns && boardData.columns.length > 0
        ? boardData.columns
        : RETRO_TEMPLATES.classic;
      const sorted = [...cols].sort((a, b) => a.order - b.order);
      if (sorted.length > 0) {
        setActiveStage(sorted[0].id);
      }
    }
  }, [boardData, activeStage, isCurrentUserCreator]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (pending.size === 0) {
      setOptimisticCards(cards);
      return;
    }
    const byId = new Map(cards.map(c => [c.id, c]));
    pending.forEach((card, id) => byId.set(id, card));
    setOptimisticCards(Array.from(byId.values()));
  }, [cards]);

  useEffect(() => {
    setHasJoined(false);
    joinAttemptedRef.current = false;
  }, [boardId]);

  useEffect(() => {
    // isInitializing (do UserContext) precisa estar false também: isLoading
    // (useAuth, só sessão/token) resolve antes do UserContext terminar de
    // montar o userProfile, e nesse intervalo userProfile ainda é null —
    // sem esperar isInitializing, requestIdentity() dispara à toa e o modal
    // de perfil fica aberto mesmo com o usuário já logado.
    if (!isLoading && !isInitializing && !userProfile) {
      requestIdentity();
    }
  }, [isLoading, isInitializing, userProfile, requestIdentity]);

  // Mapeamento de Papel Global para Papel de Retro/Health
  const mapGlobalToTeamRole = (role: GlobalRole): TeamRole => {
    switch (role) {
      case 'Agile Master':
      case 'Scrum Master':
      case 'Scrum Master / Agile Coach':
      case 'Agile Coach':
        return 'AM';
      case 'Product Owner':
      case 'Product Owner (PO)':
        return 'PO';
      case 'Tech Lead':
      case 'Arquiteto(a) / Tech Lead':
      case 'People Lead':
      case 'Tribe Lead':
        return 'PL';
      case 'QA':
      case 'Analista de QA':
        return 'QA';
      case 'Designer':
      case 'UX':
      case 'Designer / UI-UX':
        return 'UX';
      case 'Developer':
      case 'Desenvolvedor(a)':
        return 'DEV';
      case 'SME':
        return 'SME';
      case 'Stakeholder / Observador':
      default:
        return 'OUTRO';
    }
  };

  // Trava a tentativa de entrada assim que ela dispara — sem isso, o
  // Strict Mode do React (ligado por padrão no app router) roda este efeito
  // duas vezes de forma síncrona antes de `currentUser`/`hasJoined`
  // refletirem a entrada, disparando dois POSTs de participante e dois
  // re-saves do board (columns incluso) pro mesmo board id.
  const joinAttemptedRef = useRef(false);

  // Carga inicial do chat: canal geral, o da função e uma DM por colega. Chaveia
  // pelos ids (não pelo array) para não refazer a carga a cada refetch de participantes.
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
    channels.filter(c => !loadedChatChannelsRef.current.has(c)).forEach(channelId => {
      loadedChatChannelsRef.current.add(channelId);
      retroApi.getChatMessages(boardId, channelId)
        .then(msgs => setChatByChannel(prev => ({ ...prev, [channelId]: mergeChatHistory(prev[channelId], msgs || []) })))
        .catch(err => {
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
      .then(saved => saved?.channelId && setChatByChannel(prev => upsertChatMessage(prev, saved)))
      .catch(err => {
        console.error('Erro ao enviar mensagem:', err);
        toast({ title: 'Não foi possível enviar a mensagem', variant: 'destructive' });
      });
  }, [boardId, currentUser, toast]);

  const handleDeleteChatMessage = useCallback((messageId: string, channelId: string) => {
    retroApi.deleteChatMessage(boardId, messageId)
      .then(() => setChatByChannel(prev => ({ ...prev, [channelId]: (prev[channelId] || []).filter(m => m.id !== messageId) })))
      .catch(err => console.error('Erro ao apagar mensagem:', err));
  }, [boardId]);

  useEffect(() => {
    // Sincronização automática com a identidade global
    if (isAuthenticated && boardData && userProfile && !currentUser && !areParticipantsLoading && !hasJoined && !joinAttemptedRef.current) {
      joinAttemptedRef.current = true;
      const newParticipant: RetroParticipant = {
        id: userProfile.id,
        boardId: boardId,
        nickname: userProfile.name,
        role: mapGlobalToTeamRole(userProfile.role),
        globalRole: userProfile.role,
        isCreator: userProfile.id === boardData.creatorId,
      };

      retroApi.addOrUpdateParticipant(boardId, newParticipant).then(() => {
        // Não depende do WS entregar PARTICIPANT_JOINED: logo após criar o quadro
        // o socket ainda está conectando/reconectando e o evento se perde, deixando
        // currentUser nulo (tela presa em "Entrando") até um reload manual.
        setParticipants(prev => prev.some(p => p.id === newParticipant.id)
          ? prev
          : [...prev, newParticipant]);
        // Registrar ID no boardData localmente e no servidor se for novo
        // Só participantIds: gravar o quadro inteiro com a cópia de quem entra desfazia fase, timer e votação do facilitador.
        const currentParticipantIds = boardRef.current?.participantIds || boardData.participantIds || [];
        if (!currentParticipantIds.includes(userProfile.id)) {
          retroApi.patchBoard(boardId, { participantIds: [...currentParticipantIds, userProfile.id] })
            .then(updated => { if (updated?.id) setBoardData(updated); })
            .catch(err => console.error("Erro ao registrar participante no quadro:", err));
        }
      }).catch(err => {
        console.error("Erro ao registrar participante:", err);
        joinAttemptedRef.current = false;
      });
    }
  }, [isAuthenticated, boardData, userProfile, currentUser, areParticipantsLoading, boardId, hasJoined]);

  // 3.1 SINCRONIZAÇÃO DE PERFIL
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
        .catch(err => console.error(err));
    } else {
      lastSyncedProfileRef.current = { name: userProfile.name, role: userProfile.role };
    }
  }, [isAuthenticated, userProfile, boardId, currentUser]);

  useEffect(() => {
    setHasJoined(!!currentUser);
  }, [currentUser]);

  // Título Dinâmico da Aba
  useEffect(() => {
    const baseTitle = "Portal Tech V&D";
    const moduleName = "Retrospectiva";
    const sessionName = boardData?.title || boardData?.team;
    
    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [boardData]);

  useEffect(() => {
    if (hasJoined && !currentUser && participants.length > 0 && !leavingRef.current) {
      toast({
        title: "Você saiu do quadro",
        description: "Você está sendo redirecionado para a página inicial.",
      });
      router.push('/');
    }
  }, [hasJoined, currentUser, participants, router, toast]);

  const ensureUniqueCards = (cardsArray: RetroCardType[]) => {
    return Array.from(new Map(cardsArray.map(c => [c.id, c])).values());
  };

  const handleAddCard = useCallback(async (content: string, columnKey: RetroColumnKey, assignee?: string, dueDate?: string): Promise<boolean> => {
    if (!isAuthenticated || !userProfile || !boardId) return false;
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
      toast({ title: 'Não foi possível adicionar o card', description: err?.message || 'Seu texto continua no campo. Tente de novo.', variant: 'destructive' });
      return false;
    }
  }, [isAuthenticated, userProfile, boardId, trackOptimistic, settleCard, applyServerCard, revertCard, toast]);

  const handleDeleteCard = useCallback((cardId: string) => {
    if (!boardId) return;
    retroApi.deleteCard(boardId, cardId)
      .then(() => {
        setCards(prev => prev.filter(c => c.id !== cardId));
        setOptimisticCards(prev => prev.filter(c => c.id !== cardId));
      })
      .catch(err => {
        console.error(err);
        toast({ title: 'Não foi possível apagar o card', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, toast]);

  const handleUpdateCard = useCallback((cardId: string, newContent: string, assignee?: string, dueDate?: string) => {
    if (!boardId) return;
    const current = optimisticRef.current.find(c => c.id === cardId) || cardsRef.current.find(c => c.id === cardId);
    if (!current) return;
    const text = newContent.trim();
    if (!text) return;
    if (text === current.content && (assignee || undefined) === (current.assignee || undefined) && (dueDate || undefined) === (current.dueDate || undefined)) return;

    const updated: RetroCardType = { ...current, content: text, assignee: assignee || undefined, dueDate: dueDate || undefined };
    trackOptimistic(updated);
    retroApi.saveOrUpdateCard(boardId, updated)
      .then(saved => { settleCard(cardId); applyServerCard(saved); })
      .catch(err => {
        console.error(err);
        settleCard(cardId);
        revertCard(cardId);
        toast({ title: 'Não foi possível salvar a edição', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, trackOptimistic, settleCard, applyServerCard, revertCard, toast]);

  const handleToggleCardsRevealed = useCallback(() => {
    if (!boardData) return;
    patchBoard({ isCardsRevealed: !boardData.isCardsRevealed });
  }, [boardData, patchBoard]);

  const handleSetVotingStatus = useCallback((status: 'disabled' | 'active' | 'finished') => {
    if (!boardData) return;
    if (status === 'disabled') {
      // "Resetar votação" zera os votos de verdade: votos velhos continuavam valendo no limite da rodada seguinte.
      retroApi.resetVotes(boardId)
        .then(updated => {
          if (updated?.id) setBoardData(updated);
          setCards(prev => prev.map(c => ({ ...c, votes: [] })));
        })
        .catch(err => {
          console.error(err);
          toast({ title: 'Não foi possível resetar a votação', description: err?.message, variant: 'destructive' });
        });
      return;
    }
    const patch: Partial<RetroBoardType> = { votingStatus: status };
    if (status === 'finished' && boardData.autoSortOnVoteEnd) {
      const cols = boardData.columns && boardData.columns.length > 0 ? boardData.columns : RETRO_TEMPLATES.classic;
      const feedbackIds = cols.filter(c => c.theme !== 'action').map(c => c.id);
      patch.columnSorts = {
        ...(boardData.columnSorts || {}),
        ...Object.fromEntries(feedbackIds.map(id => [id, true])),
      };
    }
    patchBoard(patch);
  }, [boardData, boardId, patchBoard, toast]);

  const handleSetMaxVotesPerParticipant = useCallback((max: number) => {
    if (!boardData) return;
    patchBoard({ maxVotesPerParticipant: max });
  }, [boardData, patchBoard]);

  const handleToggleVote = useCallback((cardId: string) => {
    if (!boardId || !isAuthenticated || !userProfile || !boardData) return;
    if (boardData.votingStatus !== 'active') {
      toast({ title: 'A votação não está aberta', description: 'Peça ao facilitador para iniciar a votação.', variant: 'destructive' });
      return;
    }
    const current = optimisticRef.current.find(c => c.id === cardId);
    if (!current) return;

    const isRemoving = current.votes.includes(userProfile.id);
    const max = boardData.maxVotesPerParticipant || 0;
    if (!isRemoving && max > 0) {
      // Cada painel é uma votação separada: o limite vale por coluna.
      const votesUsed = optimisticRef.current.filter(c => c.columnKey === current.columnKey && c.votes.includes(userProfile.id)).length;
      if (votesUsed >= max) {
        toast({
          title: 'Limite de votos atingido',
          description: `Você já usou ${max === 1 ? 'seu único voto' : `seus ${max} votos`} neste painel. Remova um voto dele antes de votar em outro card do mesmo painel.`,
          variant: 'destructive'
        });
        return;
      }
    }

    const newVotes = isRemoving ? current.votes.filter(v => v !== userProfile.id) : [...current.votes, userProfile.id];
    trackOptimistic({ ...current, votes: newVotes });
    // O servidor alterna só o voto desta pessoa e aplica o limite: dois votos ao mesmo tempo não se perdem.
    retroApi.toggleVote(boardId, cardId)
      .then(saved => { settleCard(cardId); applyServerCard(saved); })
      .catch(err => {
        console.error(err);
        settleCard(cardId);
        revertCard(cardId);
        toast({ title: 'Não foi possível registrar o voto', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, isAuthenticated, userProfile, boardData, toast, trackOptimistic, settleCard, applyServerCard, revertCard]);

  const handleToggleReaction = useCallback((cardId: string, type: RetroReactionType, currentUserIds: string[]) => {
    if (!boardId || !isAuthenticated || !userProfile) return;
    // Base em optimisticRef: duas reações em sequência rápida no mesmo card não perdem uma delas.
    const current = optimisticRef.current.find(c => c.id === cardId) || cardsRef.current.find(c => c.id === cardId);
    if (!current) return;

    // Reações são mutuamente exclusivas por pessoa: tirar o usuário de todos
    // os tipos antes de (re)aplicar no clicado, senão dá pra marcar os 4 ao
    // mesmo tempo no mesmo card.
    const wasActiveOnThisType = currentUserIds.includes(userProfile.id);
    const allReactions = current.reactions || {};
    const newReactions: typeof allReactions = {};
    for (const key of Object.keys(allReactions) as RetroReactionType[]) {
      newReactions[key] = (allReactions[key] || []).filter(uid => uid !== userProfile.id);
    }
    if (!wasActiveOnThisType) {
      newReactions[type] = [...(newReactions[type] || []), userProfile.id];
    }

    const updated = { ...current, reactions: newReactions };
    trackOptimistic(updated);
    retroApi.saveOrUpdateCard(boardId, updated)
      .then(saved => { settleCard(cardId); applyServerCard(saved); })
      .catch(err => {
        console.error(err);
        settleCard(cardId);
        revertCard(cardId);
        toast({ title: 'Não foi possível registrar a reação', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, isAuthenticated, userProfile, trackOptimistic, settleCard, applyServerCard, revertCard, toast]);

  const handleToggleActionDone = useCallback((cardId: string, isDone: boolean) => {
    if (!boardId) return;
    const current = optimisticRef.current.find(c => c.id === cardId) || cardsRef.current.find(c => c.id === cardId);
    if (!current) return;

    const updated = { ...current, isDone };
    trackOptimistic(updated);
    retroApi.saveOrUpdateCard(boardId, updated)
      .then(saved => { settleCard(cardId); applyServerCard(saved); })
      .catch(err => {
        console.error(err);
        settleCard(cardId);
        revertCard(cardId);
        toast({ title: 'Não foi possível atualizar a ação', description: err?.message, variant: 'destructive' });
      });
  }, [boardId, trackOptimistic, settleCard, applyServerCard, revertCard, toast]);

  const handleImportActions = useCallback(async (sourceBoard: RetroBoardType, pendingCards: RetroCardType[]) => {
    if (!boardId || !isAuthenticated || !userProfile || !boardData || pendingCards.length === 0) return;

    const destColumns = boardData.columns && boardData.columns.length > 0 ? boardData.columns : RETRO_TEMPLATES.classic;
    const destActionColumn = destColumns.find(c => c.theme === 'action');
    if (!destActionColumn) {
      toast({
        title: "Sem coluna de Ação",
        description: "Este template não possui uma coluna de Plano de Ação para receber os itens.",
        variant: "destructive"
      });
      return;
    }

    try {
      const baseOrder = Date.now();
      const newCards = pendingCards.map((sourceCard, index) => {
        const order = baseOrder + index;
        return {
          id: crypto.randomUUID(),
          boardId,
          columnKey: destActionColumn.id,
          content: sourceCard.content,
          authorId: userProfile.id,
          votes: [],
          order,
          assignee: sourceCard.assignee || undefined,
          dueDate: sourceCard.dueDate || undefined,
          isDone: false,
          // Preserva a raiz da cadeia: se o card já veio carregado de uma
          // retro anterior, não sobrescreve com o board imediato — senão
          // uma reimportação em série perde a proveniência original a cada hop.
          carriedFromBoardId: sourceCard.carriedFromBoardId || sourceBoard.id,
          carriedFromBoardTitle: sourceCard.carriedFromBoardTitle || sourceBoard.title || 'Retro anterior',
          carryCount: (sourceCard.carryCount || 0) + 1,
        } as RetroCardType;
      });

      setOptimisticCards(prev => ensureUniqueCards([...prev, ...newCards]));
      await retroApi.importActions(boardId, newCards);

      toast({
        title: "Pendências importadas!",
        description: `${pendingCards.length} ação(ões) trazida(s) de "${sourceBoard.title || 'retro anterior'}".`,
      });
    } catch (error) {
      console.error("Erro ao importar ações pendentes:", error);
      if (cards) setOptimisticCards(cards);
      toast({
        title: "Erro ao Importar",
        description: "Não foi possível trazer as ações pendentes para este quadro.",
        variant: "destructive"
      });
    }
  }, [boardId, isAuthenticated, userProfile, boardData, cards, toast]);

  const handleMergeCards = useCallback(async (sourceId: string, targetId: string) => {
    if (!boardId || !boardData) return;

    if (!boardData.isCardsRevealed) {
      toast({
        title: "Ação bloqueada",
        description: "Não é possível fundir cards durante a fase anônima.",
        variant: "destructive"
      });
      return;
    }

    const sourceCard = cardsRef.current.find(c => c.id === sourceId);
    const targetCard = cardsRef.current.find(c => c.id === targetId);
    if (!sourceCard || !targetCard) return;

    if (sourceCard.columnKey !== targetCard.columnKey) {
      toast({
        title: "Fusão não permitida",
        description: "Só é possível fundir cards do mesmo painel: cada painel tem a sua votação.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Atômico no servidor: junta os textos como histórico, une os votos sem repetir quem votou nos dois e apaga o original.
      const merged = await retroApi.mergeCards(boardId, targetId, sourceId);
      setCards(prev => prev.filter(c => c.id !== sourceId));
      applyServerCard(merged);
      toast({
        title: "Ideias fundidas!",
        description: "Os textos e votos foram combinados.",
      });
    } catch (error: any) {
      console.error("Erro ao fundir cards:", error);
      reloadBoardData();
      toast({
        title: "Não foi possível fundir os cards",
        description: error?.message || "Tente de novo.",
        variant: "destructive"
      });
    }
  }, [boardId, boardData, toast, applyServerCard, reloadBoardData]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    const allCards = cardsRef.current;
    if (!over || !boardId || !userProfile) return;

    const activeCard = allCards.find(c => c.id === active.id);
    if (!activeCard) return;

    // Na fase anônima só o autor (ou o facilitador) move o próprio card: mexer no card alheio revelaria/atrapalharia a escrita.
    if (!boardData?.isCardsRevealed && activeCard.authorId !== userProfile.id && !isCurrentUserCreator) {
      toast({ title: 'Card de outra pessoa', description: 'Durante a fase anônima só o autor ou o facilitador move o card.', variant: 'destructive' });
      return;
    }

    const overId = over.id as string;
    const isOverAColumn = over.data.current?.type === 'column';
    const sortedCards = [...allCards].sort((a, b) => a.order - b.order);

    let targetColumn: RetroColumnKey;
    if (isOverAColumn) {
      targetColumn = overId as RetroColumnKey;
    } else {
      const overCard = allCards.find(c => c.id === overId);
      if (!overCard || overCard.id === activeCard.id) return;
      targetColumn = overCard.columnKey;
    }

    // Coluna ordenada por votos: a ordem é pelo placar, soltar numa posição não faz sentido dentro dela.
    if (targetColumn === activeCard.columnKey && boardData?.columnSorts?.[targetColumn]) return;
    if (isOverAColumn && targetColumn === activeCard.columnKey) return;

    // Mudar de painel leva os votos junto: não pode estourar o limite do painel de destino.
    const max = boardData?.maxVotesPerParticipant || 0;
    if (targetColumn !== activeCard.columnKey && max > 0 && activeCard.votes.includes(userProfile.id)) {
      const usedThere = allCards.filter(c => c.columnKey === targetColumn && c.id !== activeCard.id && c.votes.includes(userProfile.id)).length;
      if (usedThere >= max) {
        toast({
          title: 'Limite de votos do painel de destino',
          description: 'Você já usou todos os votos do painel de destino. Remova o seu voto deste card ou de outro card de lá antes de mover.',
          variant: 'destructive'
        });
        return;
      }
    }

    // Calcula as novas posições (a coluna do card pode mudar), aplica na tela e grava.
    const moves: RetroCardType[] = [];
    const cardsInTargetColumn = sortedCards.filter(c => c.columnKey === targetColumn && c.id !== activeCard.id);

    if (isOverAColumn) {
      const lastCard = cardsInTargetColumn[cardsInTargetColumn.length - 1];
      moves.push({ ...activeCard, columnKey: targetColumn, order: lastCard ? lastCard.order + 1000 : Date.now() });
    } else {
      const overCard = allCards.find(c => c.id === overId)!;
      const columnWithActive = sortedCards.filter(c => c.columnKey === targetColumn);
      const activeIndex = columnWithActive.findIndex(c => c.id === activeCard.id);
      const overIndex = columnWithActive.findIndex(c => c.id === overCard.id);
      const isDroppingBefore = activeIndex === -1 || activeIndex > overIndex;

      const newOverIndex = cardsInTargetColumn.findIndex(c => c.id === overCard.id);
      const cardBefore = isDroppingBefore ? cardsInTargetColumn[newOverIndex - 1] : overCard;
      const cardAfter = isDroppingBefore ? overCard : cardsInTargetColumn[newOverIndex + 1];
      const orderBefore = cardBefore?.order;
      const orderAfter = cardAfter?.order;

      if (orderBefore !== undefined && orderAfter !== undefined && (orderAfter - orderBefore) < 1) {
        // Sem espaço entre os dois vizinhos: renumera a coluna inteira.
        const finalColumnCards = [...cardsInTargetColumn];
        const insertAt = isDroppingBefore ? newOverIndex : newOverIndex + 1;
        finalColumnCards.splice(insertAt, 0, activeCard);
        finalColumnCards.forEach((c, idx) => moves.push({ ...c, columnKey: targetColumn, order: (idx + 1) * 1000 }));
      } else {
        let newOrder: number;
        if (orderBefore !== undefined && orderAfter !== undefined) newOrder = (orderBefore + orderAfter) / 2;
        else if (orderBefore !== undefined) newOrder = orderBefore + 1000;
        else if (orderAfter !== undefined) newOrder = orderAfter / 2;
        else newOrder = Date.now();
        moves.push({ ...activeCard, columnKey: targetColumn, order: newOrder });
      }
    }

    moves.forEach(trackOptimistic);
    try {
      const saved = await Promise.all(moves.map(m => retroApi.saveOrUpdateCard(boardId, m)));
      moves.forEach(m => settleCard(m.id));
      saved.forEach(applyServerCard);
    } catch (error: any) {
      console.error("Erro ao mover card:", error);
      moves.forEach(m => { settleCard(m.id); revertCard(m.id); });
      toast({
        title: "Não foi possível mover o card",
        description: error?.message || "Tente novamente.",
        variant: "destructive"
      });
    }
  }, [boardId, userProfile, boardData, isCurrentUserCreator, toast, trackOptimistic, settleCard, applyServerCard, revertCard]);

  const handleRemoveParticipant = useCallback(async (participantId: string): Promise<boolean> => {
    if (!boardId) return false;
    try {
      await retroApi.removeParticipant(boardId, participantId);
    } catch (error: any) {
      console.error("Erro ao remover participante:", error);
      toast({
        title: "Não foi possível remover o participante",
        description: error?.message || "Tente novamente.",
        variant: "destructive"
      });
      return false;
    }
    setParticipants(prev => prev.filter(p => p.id !== participantId));
    const ids = (boardRef.current?.participantIds || []).filter(id => id !== participantId);
    retroApi.patchBoard(boardId, { participantIds: ids })
      .then(updated => { if (updated?.id) setBoardData(updated); })
      .catch(err => console.error("Erro ao atualizar a lista de participantes do quadro:", err));
    return true;
  }, [boardId, toast]);

  const handleClaimCreator = useCallback(() => {
    if (!boardData || !isAuthenticated || !userProfile) return;

    // O servidor troca o criador e limpa a flag de facilitador do anterior: nunca ficam dois.
    retroApi.transferControl(boardId).then(updated => {
      if (updated?.id) setBoardData(updated);
      setParticipants(prev => prev.map(p => ({ ...p, isCreator: p.id === userProfile.id })));
      toast({
        title: "👑 Controle assumido",
        description: `${userProfile.name} agora é o organizador do quadro.`,
      });
    }).catch(error => {
      console.error("Erro ao assumir controle:", error);
      toast({
        title: "Erro ao assumir controle",
        description: error?.message || "Não foi possível completar a operação.",
        variant: "destructive"
      });
    });
  }, [boardData, boardId, isAuthenticated, userProfile, toast]);

  const handleLeaveRoom = async () => {
    if (!currentUser) return;
    // Só sai da página depois que o servidor confirmou; senão a pessoa "sai" mas continua na lista.
    leavingRef.current = true;
    const ok = await handleRemoveParticipant(currentUser.id);
    if (ok) {
      router.push('/');
    } else {
      leavingRef.current = false;
    }
  };

  const handleSetTimerDuration = useCallback((duration: number) => {
    patchBoard({
      timer: { status: 'stopped', initialDuration: duration, remainingOnPause: duration, endTime: null }
    });
  }, [patchBoard]);

  const handleStartTimer = useCallback((duration: number) => {
    patchBoard({
      timer: { status: 'running', endTime: Date.now() + duration * 1000, initialDuration: duration, remainingOnPause: duration }
    });
  }, [patchBoard]);

  const handlePauseTimer = useCallback(() => {
    const timer = boardRef.current?.timer;
    if (!timer?.endTime) return;
    const remaining = Math.max(0, Math.round((Number(timer.endTime) - Date.now()) / 1000));
    patchBoard({ timer: { ...timer, status: 'paused', remainingOnPause: remaining } });
  }, [patchBoard]);

  const handleResumeTimer = useCallback(() => {
    const timer = boardRef.current?.timer;
    if (!timer) return;
    patchBoard({
      timer: { ...timer, status: 'running', endTime: Date.now() + (timer.remainingOnPause ?? timer.initialDuration) * 1000 }
    });
  }, [patchBoard]);

  const handleResetTimer = useCallback(() => {
    const timer = boardRef.current?.timer;
    if (!timer) return;
    patchBoard({ timer: { ...timer, status: 'stopped', endTime: null, remainingOnPause: timer.initialDuration } });
  }, [patchBoard]);

  /** O facilitador encerra o timer que chegou a zero; sem isso ele ficava "running" para sempre e o alarme repetia. */
  const handleTimerExpired = useCallback(() => {
    const timer = boardRef.current?.timer;
    if (!timer || timer.status !== 'running') return;
    patchBoard({ timer: { ...timer, status: 'stopped', endTime: null, remainingOnPause: timer.initialDuration } });
  }, [patchBoard]);

  const handleToggleAuthorsRevealed = useCallback((show: boolean) => {
    patchBoard({ isAuthorsRevealed: show });
  }, [patchBoard]);

  const handleToggleSyncStage = useCallback((enabled: boolean) => {
    patchBoard({ syncStageEnabled: enabled, activeColumnKey: enabled ? activeStage : undefined });
  }, [patchBoard, activeStage]);

  const handleToggleAutoRevealOnTimerEnd = useCallback((enabled: boolean) => {
    patchBoard({ autoRevealOnTimerEnd: enabled });
  }, [patchBoard]);

  const handleToggleAutoSortOnVoteEnd = useCallback((enabled: boolean) => {
    patchBoard({ autoSortOnVoteEnd: enabled });
  }, [patchBoard]);

  const handleToggleHealthCheck = useCallback((enabled: boolean) => {
    patchBoard({ healthCheckEnabled: enabled });
  }, [patchBoard]);

  const handleHealthCheckQuestionChange = useCallback((question: string) => {
    patchBoard({ healthCheckQuestion: question });
  }, [patchBoard]);

  const handleSubmitHealthCheckAnswer = useCallback(async (answer: HealthCheckAnswer) => {
    if (!boardId || !currentUser) return;
    // Aplica na hora: a trava some sem depender do eco do WebSocket (que pode se perder).
    const previous = currentUser;
    setParticipants(prev => prev.map(p => (p.id === currentUser.id ? { ...p, healthCheckAnswer: answer } : p)));
    try {
      await retroApi.addOrUpdateParticipant(boardId, { ...currentUser, healthCheckAnswer: answer });
    } catch (err: any) {
      console.error("Erro ao registrar check-in inicial:", err);
      setParticipants(prev => prev.map(p => (p.id === previous.id ? previous : p)));
      toast({ title: 'Não foi possível registrar sua resposta', description: err?.message || 'Tente de novo.', variant: 'destructive' });
    }
  }, [boardId, currentUser, toast]);

  const handleToggleColumnSort = useCallback((columnKey: string, isSorted: boolean) => {
    const currentSorts = boardRef.current?.columnSorts || {};
    patchBoard({ columnSorts: { ...currentSorts, [columnKey]: isSorted } });
  }, [patchBoard]);

  // Timer: objeto estável. Recriá-lo a cada render reiniciava o intervalo do contador a cada card ou voto recebido.
  const timerStatus = boardData?.timer?.status;
  const timerInitial = boardData?.timer?.initialDuration;
  const timerPaused = boardData?.timer?.remainingOnPause;
  const timerEnd = boardData?.timer?.endTime;
  const mappedTimer = useMemo<TimerState>(() => ({
    status: (timerStatus || 'stopped') as any,
    initialDuration: timerInitial || 300,
    remainingOnPause: timerPaused ?? 300,
    endTime: timerEnd ? Number(timerEnd) : null,
  }), [timerStatus, timerInitial, timerPaused, timerEnd]);

  const currentUserCompat = useMemo(() => ({ uid: userProfile?.id ?? '' }), [userProfile?.id]);

  // Sem sessão não há o que carregar: antes ficava num "Sincronizando..." eterno.
  if (!isLoading && !isInitializing && !isAuthenticated) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-black">Entre para abrir este quadro</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Sua sessão expirou ou você ainda não entrou. Faça login e volte para este link.</p>
        <Button onClick={() => router.push('/login')} className="rounded-xl font-bold">Ir para o login</Button>
      </div>
    );
  }

  if (loadError === 'failed' && !boardData) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-black">Não foi possível carregar o quadro</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Pode ser uma falha de conexão ou da sua sessão. O quadro não foi perdido.</p>
        <Button
          onClick={() => {
            setLoadError(null);
            setIsBoardLoading(true);
            setAreCardsLoading(true);
            setAreParticipantsLoading(true);
            reloadBoardData();
          }}
          className="rounded-xl font-bold"
        >
          Tentar de novo
        </Button>
      </div>
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
        <RetroHealthCheckGate
          question={boardData.healthCheckQuestion}
          onAnswer={handleSubmitHealthCheckAnswer}
        />
      )}
      <RetroBoard
        boardId={boardId}
        boardData={boardData}
        cards={optimisticCards}
        participants={participants || []}
        currentUserId={userProfile.id}
        currentUser={currentUserCompat}
        currentParticipant={currentUser}
        isCurrentUserCreator={isCurrentUserCreator}
        isAuthorsRevealed={boardData.isAuthorsRevealed === true}
        onToggleShowAuthors={handleToggleAuthorsRevealed}
        onToggleSyncStage={handleToggleSyncStage}
        onToggleAutoRevealOnTimerEnd={handleToggleAutoRevealOnTimerEnd}
        onToggleAutoSortOnVoteEnd={handleToggleAutoSortOnVoteEnd}
        onToggleHealthCheck={handleToggleHealthCheck}
        onHealthCheckQuestionChange={handleHealthCheckQuestionChange}
        onToggleColumnSort={handleToggleColumnSort}
        onAddCard={handleAddCard}
        onDeleteCard={handleDeleteCard}
        onUpdateCard={handleUpdateCard}
        onToggleCardsRevealed={handleToggleCardsRevealed}
        onSetVotingStatus={handleSetVotingStatus}
        onSetMaxVotesPerParticipant={handleSetMaxVotesPerParticipant}
        onToggleVote={handleToggleVote}
        onToggleReaction={handleToggleReaction}
        onToggleDone={handleToggleActionDone}
        onImportActions={handleImportActions}
        onDragEnd={handleDragEnd}
        onRemoveParticipant={handleRemoveParticipant}
        onLeaveBoard={handleLeaveRoom}
        timer={mappedTimer}
        onSetTimerDuration={handleSetTimerDuration}
        onStartTimer={handleStartTimer}
        onPauseTimer={handlePauseTimer}
        onResumeTimer={handleResumeTimer}
        onResetTimer={handleResetTimer}
        onTimerExpired={handleTimerExpired}
        onClaimCreator={handleClaimCreator}
        activeStage={activeStage}
        onStageChange={handleStageChange}
        mergingSourceId={mergingSourceId}
        onStartMerge={setMergingSourceId}
        onExecuteMerge={(targetId) => {
          if (mergingSourceId && mergingSourceId !== targetId) {
            handleMergeCards(mergingSourceId, targetId);
          }
          setMergingSourceId(null);
        }}
        onOpenFeedback={handleOpenFeedback}
        onOpenStats={() => setShowStats(true)}
        chatMessagesByChannel={chatByChannel}
        onSendChatMessage={handleSendChatMessage}
        onDeleteChatMessage={handleDeleteChatMessage}
      />
      <FeedbackWidget 
        toolName={`Retrospectiva: ${boardData?.title || 'Agile'}`} 
        triggerVariant="icon"
        showFloatingButton={true} 
        externalTriggerSignal={feedbackSignal} 
      />
      <SprintStatsDialog
        open={showStats && !needsHealthCheck}
        onClose={() => setShowStats(false)}
        squadId={boardData?.squadId || userProfile?.squadId || ''}
        sprintId={boardData?.sprintId || undefined}
      />
    </>
  );
}
