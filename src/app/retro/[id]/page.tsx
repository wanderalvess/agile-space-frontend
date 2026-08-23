'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useEffect, useCallback, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { RetroBoard as RetroBoardType, RetroCard as RetroCardType, RetroColumnKey, TimerState, RetroParticipant, TeamRole, GlobalRole } from '@/lib/types';
import { RETRO_TEMPLATES } from '@/lib/types';
import { RetroBoard } from '@/components/retro/RetroBoard';
import type { DragEndEvent } from '@dnd-kit/core';
import { NotFound } from '@/components/NotFound';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useUserContext } from '@/context/UserContext';
import { FeedbackWidget } from '@/components/feedback-widget';
import { retroApi } from '../api';
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

  const [hasJoined, setHasJoined] = useState(false);
  const [optimisticCards, setOptimisticCards] = useState<RetroCardType[]>([]);
  const [activeStage, setActiveStage] = useState<RetroColumnKey>('');
  const [mergingSourceId, setMergingSourceId] = useState<string | null>(null);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  const currentUser = useMemo(() => participants?.find(p => p.id === userProfile?.id) || null, [participants, userProfile]);
  const isCurrentUserCreator = useMemo(() => !!(userProfile && boardData && userProfile.id === boardData.creatorId), [userProfile, boardData]);

  const [showStats, setShowStats] = useState(true);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  // Centralized data loading
  const reloadBoardData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [board, cardsList, participantsList] = await Promise.all([
        retroApi.getBoard(boardId),
        retroApi.getCards(boardId),
        retroApi.getParticipants(boardId)
      ]);
      setBoardData(board);
      setCards(cardsList);
      setParticipants(participantsList);
    } catch (e) {
      console.error("Erro ao carregar dados do quadro de retrospectiva:", e);
    } finally {
      setIsBoardLoading(false);
      setAreCardsLoading(false);
      setAreParticipantsLoading(false);
    }
  }, [boardId, isAuthenticated]);

  // Initial load and WebSocket connection
  useEffect(() => {
    if (!isAuthenticated) return;

    reloadBoardData();

    // WebSocket Nativo para refresh em tempo real
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/retro/') + boardId
      + '?token=' + encodeURIComponent(getAuthToken() || '');

    console.log("Conectando ao WebSocket do Board Retro:", wsUrl);
    let socket = new WebSocket(wsUrl);

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
      console.warn("Conexão WebSocket fechada. Tentando reconectar...");
      // Reconnect logic
      setTimeout(() => {
        reloadBoardData();
      }, 5000);
    };

    return () => {
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
      retroApi.saveOrUpdateBoard({ ...boardData, activeColumnKey: stage });
    }
  }, [isCurrentUserCreator, boardData]);

  useEffect(() => {
    if (boardData?.syncStageEnabled && !isCurrentUserCreator && boardData.activeColumnKey) {
      setActiveStage(boardData.activeColumnKey);
    }
  }, [boardData?.syncStageEnabled, boardData?.activeColumnKey, isCurrentUserCreator]);

  // Initialize activeStage from board columns (dynamic or fallback)
  useEffect(() => {
    if (!activeStage && boardData) {
      const cols = boardData.columns && boardData.columns.length > 0
        ? boardData.columns
        : RETRO_TEMPLATES.classic;
      const sorted = [...cols].sort((a, b) => a.order - b.order);
      if (sorted.length > 0) {
        setActiveStage(sorted[0].id);
      }
    }
  }, [boardData, activeStage]);

  useEffect(() => {
    if (cards) {
      setOptimisticCards(cards);
    }
  }, [cards]);

  useEffect(() => {
    setHasJoined(false);
  }, [boardId]);

  useEffect(() => {
    if (!isLoading && !userProfile) {
      requestIdentity();
    }
  }, [isLoading, userProfile, requestIdentity]);

  // Mapeamento de Papel Global para Papel de Retro/Health
  const mapGlobalToTeamRole = (role: GlobalRole): TeamRole => {
    switch (role) {
      case 'Agile Master':
      case 'Scrum Master':
      case 'Scrum Master / Agile Coach':
        return 'AM';
      case 'Product Owner':
      case 'Product Owner (PO)':
        return 'PO';
      case 'Tech Lead':
      case 'Arquiteto(a) / Tech Lead':
      case 'People Lead':
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
      case 'Stakeholder / Observador':
      default:
        return 'OUTRO';
    }
  };

  useEffect(() => {
    // Sincronização automática com a identidade global
    if (isAuthenticated && boardData && userProfile && !currentUser && !areParticipantsLoading && !hasJoined) {
      const newParticipant: RetroParticipant = {
        id: userProfile.id,
        boardId: boardId,
        nickname: userProfile.name,
        role: mapGlobalToTeamRole(userProfile.role),
        globalRole: userProfile.role,
        isCreator: userProfile.id === boardData.creatorId,
      };

      retroApi.addOrUpdateParticipant(boardId, newParticipant).then(() => {
        // Registrar ID no boardData localmente e no servidor se for novo
        const currentParticipantIds = boardData.participantIds || [];
        if (!currentParticipantIds.includes(userProfile.id)) {
          retroApi.saveOrUpdateBoard({
            ...boardData,
            participantIds: [...currentParticipantIds, userProfile.id]
          });
        }
      }).catch(err => {
        console.error("Erro ao registrar participante:", err);
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
      lastSyncedProfileRef.current = { name: userProfile.name, role: userProfile.role };
      retroApi.addOrUpdateParticipant(boardId, updates).catch(err => console.error(err));
    } else {
      lastSyncedProfileRef.current = { name: userProfile.name, role: userProfile.role };
    }
  }, [isAuthenticated, userProfile, boardId, currentUser]);

  useEffect(() => {
    setHasJoined(!!currentUser);
  }, [currentUser]);

  // Título Dinâmico da Aba
  useEffect(() => {
    const baseTitle = "Espaço Ágil";
    const moduleName = "Retrospectiva";
    const sessionName = boardData?.title || boardData?.team;
    
    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [boardData]);

  useEffect(() => {
    if (hasJoined && !currentUser && participants.length > 0) {
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

  const handleAddCard = useCallback((content: string, columnKey: RetroColumnKey, assignee?: string, dueDate?: string) => {
    if (!isAuthenticated || !userProfile || !boardId) return;

    const tempId = `temp-${Date.now()}`;
    const newCard: RetroCardType = {
      id: tempId,
      boardId,
      columnKey,
      content,
      authorId: userProfile.id,
      votes: [],
      order: Date.now(),
      assignee,
      dueDate
    };

    setOptimisticCards(prev => ensureUniqueCards([...prev, newCard]));

    retroApi.saveOrUpdateCard(boardId, {
      id: crypto.randomUUID(),
      boardId,
      columnKey,
      content,
      authorId: userProfile.id,
      votes: [],
      order: newCard.order,
      assignee: assignee || undefined,
      dueDate: dueDate || undefined
    }).catch(err => {
      console.error(err);
      if (cards) setOptimisticCards(cards);
    });
  }, [isAuthenticated, userProfile, boardId, cards]);
  
  const handleDeleteCard = useCallback((cardId: string) => {
    if (!boardId) return;
    retroApi.deleteCard(boardId, cardId).catch(err => console.error(err));
  }, [boardId]);
  
  const handleUpdateCard = useCallback((cardId: string, newContent: string, assignee?: string, dueDate?: string) => {
    if (!boardId || !cards) return;
    const current = cards.find(c => c.id === cardId);
    if (!current) return;
    
    // Atualização otimista
    setOptimisticCards(prev => prev.map(c => c.id === cardId ? { ...c, content: newContent, assignee, dueDate } : c));
    retroApi.saveOrUpdateCard(boardId, {
      ...current,
      content: newContent,
      assignee: assignee || undefined,
      dueDate: dueDate || undefined
    }).catch(err => {
      console.error(err);
      setOptimisticCards(cards);
    });
  }, [boardId, cards]);
  
  const handleToggleCardsRevealed = useCallback(() => {
    if (!boardData) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      isCardsRevealed: !boardData.isCardsRevealed
    }).catch(err => console.error(err));
  }, [boardData]);

  const handleSetVotingStatus = useCallback((status: 'open' | 'closed') => {
    if (!boardData) return;
    const updates: any = { ...boardData, votingStatus: status };
    if ((status as any) === 'finished' && boardData?.autoSortOnVoteEnd) {
      const cols = boardData.columns && boardData.columns.length > 0 ? boardData.columns : RETRO_TEMPLATES.classic;
      const feedbackIds = cols.filter(c => c.theme !== 'action').map(c => c.id);
      updates.columnSorts = {
        ...(boardData.columnSorts || {}),
        ...Object.fromEntries(feedbackIds.map(id => [id, true])),
      };
    }
    retroApi.saveOrUpdateBoard(updates).catch(err => console.error(err));
  }, [boardData]);
  
  const handleToggleVote = useCallback((cardId: string, currentVotes: string[]) => {
    if (!boardId || !isAuthenticated || !userProfile || !cards) return;
    const current = cards.find(c => c.id === cardId);
    if (!current) return;

    const newVotes = currentVotes.includes(userProfile.id)
      ? currentVotes.filter(uid => uid !== userProfile.id)
      : [...currentVotes, userProfile.id];

    retroApi.saveOrUpdateCard(boardId, {
      ...current,
      votes: newVotes
    }).catch(err => console.error(err));
  }, [boardId, isAuthenticated, userProfile, cards]);

  const handleToggleActionDone = useCallback((cardId: string, isDone: boolean) => {
    if (!boardId || !cards) return;
    const current = cards.find(c => c.id === cardId);
    if (!current) return;

    setOptimisticCards(prev => prev.map(c => c.id === cardId ? { ...c, isDone } : c));
    retroApi.saveOrUpdateCard(boardId, {
      ...current,
      isDone
    }).catch(err => {
      console.error(err);
      setOptimisticCards(cards);
    });
  }, [boardId, cards]);

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
          carriedFromBoardId: sourceBoard.id,
          carriedFromBoardTitle: sourceBoard.title || 'Retro anterior',
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
    if (!boardId || !cards || !boardData) return;

    if (!boardData?.isCardsRevealed) {
      toast({
        title: "Ação bloqueada",
        description: "Não é possível fundir cards durante a fase anônima.",
        variant: "destructive"
      });
      return;
    }
    
    const sourceCard = cards.find(c => c.id === sourceId);
    const targetCard = cards.find(c => c.id === targetId);
    
    if (!sourceCard || !targetCard) return;

    const combinedVotes = Array.from(new Set([...targetCard.votes, ...sourceCard.votes]));
    const newContent = `${targetCard.content}\n\n- ${sourceCard.content}`;

    try {
      setOptimisticCards(prev => {
        const withoutSource = prev.filter(c => c.id !== sourceId);
        return withoutSource.map(c => c.id === targetId ? {
          ...c,
          votes: combinedVotes,
          content: newContent,
          children: []
        } : c);
      });

      // Salva a alteração no alvo
      await retroApi.saveOrUpdateCard(boardId, {
        ...targetCard,
        votes: combinedVotes,
        content: newContent
      });

      // Exclui a origem
      await retroApi.deleteCard(boardId, sourceId);

      toast({
        title: "Ideias Fundidas!",
        description: "Os textos e votos foram combinados com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao fundir cards:", error);
      if (cards) setOptimisticCards(cards);
      toast({
        title: "Erro na Fusão",
        description: "Não foi possível combinar as ideias no banco de dados.",
        variant: "destructive"
      });
    }
  }, [boardId, cards, toast, boardData]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !cards || !boardId) return;

    const activeCard = cards.find(c => c.id === active.id);
    if (!activeCard) return;

    const overId = over.id as string;
    const isOverAColumn = over.data.current?.type === 'column';

    let newColumnKey = activeCard.columnKey;
    let newOrder: number;

    const sortedCards = [...cards].sort((a, b) => a.order - b.order);

    try {
      if (isOverAColumn) {
        newColumnKey = overId as RetroColumnKey;
        if (newColumnKey === activeCard.columnKey) return;
        const cardsInNewColumn = sortedCards.filter(c => c.columnKey === newColumnKey);
        const lastCard = cardsInNewColumn[cardsInNewColumn.length - 1];
        newOrder = lastCard ? lastCard.order + 1000 : Date.now();
        
        await retroApi.saveOrUpdateCard(boardId, {
          ...activeCard,
          columnKey: newColumnKey,
          order: newOrder
        });
      } else {
        const overCard = cards.find(c => c.id === overId);
        if (!overCard || overCard.id === activeCard.id) return;

        newColumnKey = overCard.columnKey;
        const cardsInTargetColumn = sortedCards.filter(c => c.columnKey === newColumnKey);
        const activeIndex = cardsInTargetColumn.findIndex(c => c.id === activeCard.id);
        const overIndex = cardsInTargetColumn.findIndex(c => c.id === overCard.id);

        if(activeIndex !== -1) cardsInTargetColumn.splice(activeIndex, 1);
        
        const newOverIndex = cardsInTargetColumn.findIndex(c => c.id === overCard.id);
        const isDroppingBefore = activeIndex === -1 || activeIndex > overIndex;
        const cardBefore = isDroppingBefore ? cardsInTargetColumn[newOverIndex - 1] : overCard;
        const cardAfter = isDroppingBefore ? overCard : cardsInTargetColumn[newOverIndex + 1];

        const orderBefore = cardBefore?.order;
        const orderAfter = cardAfter?.order;

        if (orderBefore !== undefined && orderAfter !== undefined && (orderAfter - orderBefore) < 1) {
          const finalColumnCards = [...cardsInTargetColumn];
          const insertAt = isDroppingBefore ? newOverIndex : newOverIndex + 1;
          finalColumnCards.splice(insertAt, 0, activeCard);
          
          for (let idx = 0; idx < finalColumnCards.length; idx++) {
            const c = finalColumnCards[idx];
            await retroApi.saveOrUpdateCard(boardId, {
              ...c,
              columnKey: newColumnKey,
              order: (idx + 1) * 1000
            });
          }
        } else {
          if (orderBefore !== undefined && orderAfter !== undefined) {
            newOrder = (orderBefore + orderAfter) / 2;
          } else if (orderBefore !== undefined) {
            newOrder = orderBefore + 1000;
          } else if (orderAfter !== undefined) {
            newOrder = orderAfter / 2;
          } else {
            newOrder = Date.now();
          }
          await retroApi.saveOrUpdateCard(boardId, {
            ...activeCard,
            columnKey: newColumnKey,
            order: newOrder
          });
        }
      }
    } catch (error) {
      console.error("Erro ao mover card:", error);
      toast({
        title: "Não foi possível mover o card",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  }, [cards, boardId, toast]);

  const handleRemoveParticipant = useCallback((participantId: string) => {
    if(!boardId || !boardData) return;
    
    retroApi.removeParticipant(boardId, participantId).then(() => {
      const currentParticipantIds = boardData.participantIds || [];
      retroApi.saveOrUpdateBoard({
        ...boardData,
        participantIds: currentParticipantIds.filter(id => id !== participantId)
      });
    }).catch(error => {
      console.error("Erro ao remover participante:", error);
      toast({
        title: "Não foi possível remover o participante",
        description: "Tente novamente.",
        variant: "destructive"
      });
    });
  }, [boardId, boardData, toast]);

  const handleClaimCreator = useCallback(() => {
    if (!boardData || !isAuthenticated || !userProfile || !participants) return;

    retroApi.saveOrUpdateBoard({
      ...boardData,
      creatorId: userProfile.id
    }).then(async () => {
      const p = participants.find(part => part.id === userProfile.id);
      if (p) {
        await retroApi.addOrUpdateParticipant(boardId, { ...p, isCreator: true });
      }

      toast({
        title: "👑 Controle Assumido",
        description: `${userProfile?.name} agora é o organizador do quadro.`,
      });
    }).catch(error => {
      console.error("Erro ao assumir controle:", error);
      toast({
        title: "Erro ao assumir controle",
        description: "Não foi possível completar a operação no banco de dados.",
        variant: "destructive"
      });
    });
  }, [boardData, isAuthenticated, userProfile, participants, toast, boardId]);

  const handleLeaveRoom = () => {
    if (!currentUser) return;
    handleRemoveParticipant(currentUser.id);
    router.push('/');
  };

  const handleSetTimerDuration = useCallback((duration: number) => {
    if (!boardData) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      timer: {
        status: 'stopped',
        initialDuration: duration,
        remainingOnPause: duration,
        endTime: null,
      }
    }).catch(err => console.error(err));
  }, [boardData]);

  const handleStartTimer = useCallback((duration: number) => {
    if (!boardData) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      timer: {
        status: 'running',
        endTime: String(Date.now() + duration * 1000),
        initialDuration: duration,
        remainingOnPause: duration,
      }
    }).catch(err => console.error(err));
  }, [boardData]);

  const handlePauseTimer = useCallback(() => {
    const timer = boardData?.timer;
    if (!boardData || !timer?.endTime) return;
    const remaining = Math.max(0, Math.round((Number(timer.endTime) - Date.now()) / 1000));
    retroApi.saveOrUpdateBoard({
      ...boardData,
      timer: {
        ...timer,
        status: 'paused',
        remainingOnPause: remaining,
      }
    }).catch(err => console.error(err));
  }, [boardData]);

  const handleResumeTimer = useCallback(() => {
    const timer = boardData?.timer;
    if (!boardData || !timer) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      timer: {
        ...timer,
        status: 'running',
        endTime: String(Date.now() + timer.remainingOnPause * 1000),
      }
    }).catch(err => console.error(err));
  }, [boardData]);

  const handleResetTimer = useCallback(() => {
    const timer = boardData?.timer;
    if (!boardData || !timer) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      timer: {
        ...timer,
        status: 'stopped',
        endTime: null,
        remainingOnPause: timer.initialDuration,
      }
    }).catch(err => console.error(err));
  }, [boardData]);

  const handleToggleAuthorsRevealed = useCallback((show: boolean) => {
    if (!boardData) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      isAuthorsRevealed: show
    }).catch(err => console.error(err));
  }, [boardData]);

  const handleToggleSyncStage = useCallback((enabled: boolean) => {
    if (!boardData) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      syncStageEnabled: enabled,
      activeColumnKey: enabled ? activeStage : undefined,
    }).catch(err => console.error(err));
  }, [boardData, activeStage]);

  const handleToggleAutoRevealOnTimerEnd = useCallback((enabled: boolean) => {
    if (!boardData) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      autoRevealOnTimerEnd: enabled
    }).catch(err => console.error(err));
  }, [boardData]);

  const handleToggleAutoSortOnVoteEnd = useCallback((enabled: boolean) => {
    if (!boardData) return;
    retroApi.saveOrUpdateBoard({
      ...boardData,
      autoSortOnVoteEnd: enabled
    }).catch(err => console.error(err));
  }, [boardData]);

  const handleToggleColumnSort = useCallback((columnKey: string, isSorted: boolean) => {
    if (!boardData) return;
    const currentSorts = boardData?.columnSorts || {};
    retroApi.saveOrUpdateBoard({
      ...boardData,
      columnSorts: {
        ...currentSorts,
        [columnKey]: isSorted
      }
    }).catch(err => console.error(err));
  }, [boardData]);

  if (isLoading || isInitializing || isBoardLoading || areCardsLoading || areParticipantsLoading || !isAuthenticated || !userProfile) {
    if (!userProfile) {
      return <LoadingScreen message="Configurando identidade..." submessage="Preencha sua identidade para entrar no quadro" />;
    }
    return <LoadingScreen message="Retrospectiva" submessage="Sincronizando o quadro com o time..." />;
  }

  if (!boardData) return <NotFound resourceName="quadro retrospectivo" />;
  if (!currentUser) return <LoadingScreen message="Entrando" submessage="Validando seu acesso ao quadro..." />;

  // Adapta o objeto de timer vindo do backend para a interface compatível do front
  const mappedTimer: TimerState = {
    status: (boardData.timer?.status || 'stopped') as any,
    initialDuration: boardData.timer?.initialDuration || 300,
    remainingOnPause: boardData.timer?.remainingOnPause || 300,
    endTime: boardData.timer?.endTime ? Number(boardData.timer.endTime) : null
  };

  return (
    <>
      <RetroBoard
        boardId={boardId}
        boardData={boardData}
        cards={optimisticCards}
        participants={participants || []}
        currentUserId={userProfile.id}
        currentUser={{ uid: userProfile.id }}
        currentParticipant={currentUser}
        isCurrentUserCreator={isCurrentUserCreator}
        isAuthorsRevealed={boardData.isAuthorsRevealed === true}
        onToggleShowAuthors={handleToggleAuthorsRevealed}
        onToggleSyncStage={handleToggleSyncStage}
        onToggleAutoRevealOnTimerEnd={handleToggleAutoRevealOnTimerEnd}
        onToggleAutoSortOnVoteEnd={handleToggleAutoSortOnVoteEnd}
        onToggleColumnSort={handleToggleColumnSort}
        onAddCard={handleAddCard}
        onDeleteCard={handleDeleteCard}
        onUpdateCard={handleUpdateCard}
        onToggleCardsRevealed={handleToggleCardsRevealed}
        onSetVotingStatus={handleSetVotingStatus}
        onToggleVote={handleToggleVote}
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
      />
      <FeedbackWidget 
        toolName={`Retrospectiva: ${boardData?.title || 'Agile'}`} 
        triggerVariant="icon"
        showFloatingButton={true} 
        externalTriggerSignal={feedbackSignal} 
      />
      <SprintStatsDialog open={showStats} onClose={() => setShowStats(false)} />
    </>
  );
}
