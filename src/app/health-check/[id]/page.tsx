'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { healthCheckApi } from '../api';
import type { HealthCheckBoard as HealthCheckBoardType, HealthCheckParticipant, HealthCheckVote, HealthCheckVoteValue, TeamRole, GlobalRole } from '@/lib/types';
import { HealthCheckVotingBoard } from '@/components/health-check/HealthCheckVotingBoard';
import { HealthCheckResults } from '@/components/health-check/HealthCheckResults';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_HEALTH_CHECK_DIMENSIONS } from '@/lib/health-check-defaults';
import { NotFound } from '@/components/NotFound';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useUserContext } from '@/context/UserContext';
import { getAuthToken } from '@/lib/auth-client';
import { FeedbackWidget } from '@/components/feedback-widget';

export default function HealthCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const boardId = resolvedParams.id;
  
  const { user, isUserLoading } = useFirebase();
  const { userProfile, isInitializing } = useUserContext();
  const { toast } = useToast();
  const router = useRouter();

  const [boardData, setBoardData] = useState<HealthCheckBoardType | null>(null);
  const [participants, setParticipants] = useState<HealthCheckParticipant[]>([]);
  const [votes, setVotes] = useState<HealthCheckVote[]>([]);

  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  const currentUser = useMemo(() => participants?.find(p => p.id === user?.uid) || null, [participants, user?.uid]);
  const userVotes = useMemo(() => votes?.filter(v => v.participantId === currentUser?.id) || [], [votes, currentUser?.id]);
  const allVotes = votes;

  const isCurrentUserCreator = useMemo(() => {
    if (!user || !boardData) return false;
    return user.uid === boardData.creatorId;
  }, [user?.uid, boardData?.creatorId]);

  const boardDimensions = boardData?.dimensions || DEFAULT_HEALTH_CHECK_DIMENSIONS;

  const mapGlobalToTeamRole = (role: GlobalRole | undefined): TeamRole => {
    switch (role) {
      case 'Agile Master': return 'AM';
      case 'Product Owner': return 'PO';
      case 'Tech Lead': return 'PL';
      case 'QA': return 'QA';
      case 'Designer': return 'UX';
      case 'UX': return 'UX';
      case 'Developer': return 'DEV';
      case 'Scrum Master': return 'AM';
      case 'People Lead': return 'PL';
      default: return 'OUTRO';
    }
  };

  const reloadBoardData = useCallback(async () => {
    if (!user) return;
    try {
      const [board, partsList, votesList] = await Promise.all([
        healthCheckApi.getBoard(boardId),
        healthCheckApi.getParticipants(boardId),
        healthCheckApi.getVotes(boardId)
      ]);
      setBoardData(board);
      setParticipants(partsList);
      setVotes(votesList);
    } catch (e) {
      console.error("Erro ao carregar dados do Radar de Saúde:", e);
    } finally {
      setIsBoardLoading(false);
      setAreParticipantsLoading(false);
    }
  }, [boardId, user]);

  // Conexão WebSocket Nativa e Carga Inicial
  useEffect(() => {
    if (!user) return;

    reloadBoardData();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/health-check/') + boardId
      + '?token=' + encodeURIComponent(getAuthToken() || '');

    let socket: WebSocket | null = null;
    let isSubscribed = true;

    try {
      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        if (!isSubscribed) return;
        try {
          const payload = JSON.parse(event.data);
          switch (payload.type) {
            case 'BOARD_UPDATED':
              if (payload.payload) {
                setBoardData(payload.payload);
              }
              break;

            case 'PARTICIPANT_JOINED':
              if (payload.payload) {
                setParticipants(prev => {
                  const idx = prev.findIndex(p => p.id === payload.payload.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = payload.payload;
                    return copy;
                  }
                  return [...prev, payload.payload];
                });
              }
              break;

            case 'PARTICIPANT_LEFT':
              if (payload.payload?.userId) {
                setParticipants(prev => prev.filter(p => p.id !== payload.payload.userId));
              }
              break;

            case 'VOTE_SAVED':
              if (payload.payload) {
                setVotes(prev => {
                  const idx = prev.findIndex(v => v.id === payload.payload.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = payload.payload;
                    return copy;
                  }
                  return [...prev, payload.payload];
                });
              }
              break;

            case 'REFRESH_BOARD':
            default:
              reloadBoardData();
              break;
          }
        } catch (e) {
          console.error("Erro ao processar mensagem do WebSocket do Health Check:", e);
          reloadBoardData();
        }
      };

      socket.onerror = (err) => {
        console.warn("WebSocket Health Check warning:", err);
      };
    } catch (err) {
      console.warn("Falha ao inicializar WebSocket do Health Check:", err);
    }

    return () => {
      isSubscribed = false;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [boardId, reloadBoardData, user]);

  // Auto-join como participante
  useEffect(() => {
    if (isUserLoading || areParticipantsLoading || !user || !userProfile || !boardData || !participants) {
      return;
    }

    const isAlreadyParticipant = participants.some(p => p.id === user.uid);
    if (isAlreadyParticipant) return;

    const newParticipant: HealthCheckParticipant = {
      id: user.uid,
      boardId: boardId,
      nickname: userProfile.name,
      role: mapGlobalToTeamRole(userProfile.role),
    };
    
    healthCheckApi.joinBoard(boardId, newParticipant).catch(e => console.error("Erro ao entrar no radar:", e));
  }, [isUserLoading, areParticipantsLoading, user, userProfile, boardData, participants, boardId]);

  // Título Dinâmico da Aba
  useEffect(() => {
    const baseTitle = "Espaço Ágil";
    const moduleName = "Radar de Saúde";
    const sessionName = boardData?.sprintName || boardData?.team;
    
    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [boardData]);

  const handleVote = async (dimensionKey: string, value: HealthCheckVoteValue, comment?: string) => {
    if (!user || !currentUser) return;
    const newVote: Partial<HealthCheckVote> = {
      boardId: boardId,
      participantId: user.uid,
      participantRole: currentUser.role,
      dimensionKey,
      value,
      comment: comment || '',
      timestamp: new Date().toISOString(),
    };
    try {
      await healthCheckApi.saveVote(boardId, newVote);
    } catch (e) {
      console.error("Erro ao salvar voto:", e);
      toast({ title: "Erro ao votar", description: "Não foi possível registrar o voto.", variant: "destructive" });
    }
  };
  
  const handleFinish = async () => {
    if (!boardData) {
      toast({ title: "Aguarde", description: "Sincronizando com o servidor...", variant: "destructive" });
      return;
    }
    
    if (!isCurrentUserCreator) {
      toast({ title: "Acesso Negado", description: "Apenas o organizador pode encerrar a votação.", variant: "destructive" });
      return;
    }

    setIsFinishing(true);
    try {
      const currentVotes = await healthCheckApi.getVotes(boardId);
      
      if (currentVotes.length === 0) {
        toast({ title: "Nenhum voto", description: "É necessário pelo menos um voto para encerrar.", variant: "destructive" });
        setIsFinishing(false);
        return;
      }

      const results = boardDimensions.map(dim => {
        const votesForDim = currentVotes.filter(v => v.dimensionKey === dim.key);
        const values: Record<string, number> = {};
        let totalValue = 0;
        let count = 0;

        votesForDim.forEach(v => {
          values[v.value] = (values[v.value] || 0) + 1;
          
          let numericValue = 0;
          const val = v.value;
          if (val === 'green' || val === 'happy') numericValue = 3;
          else if (val === 'yellow' || val === 'neutral') numericValue = 2;
          else if (val === 'red' || val === 'sad') numericValue = 1;
          else if (!isNaN(Number(val))) numericValue = Number(val);
          
          if (numericValue > 0) {
            totalValue += numericValue;
            count++;
          }
        });

        return {
          dimensionKey: dim.key,
          values,
          average: count > 0 ? totalValue / count : 0
        };
      });

      const sortedResults = [...results].sort((a, b) => (b.average || 0) - (a.average || 0));

      const topMetrics = sortedResults
        .filter(r => (r.average || 0) >= 2)
        .slice(0, 3)
        .map(r => boardDimensions.find(d => d.key === r.dimensionKey)?.title || r.dimensionKey);

      const lowMetrics = sortedResults
        .reverse()
        .filter(r => (r.average || 0) > 0 && (r.average || 0) < 2)
        .slice(0, 3)
        .map(r => boardDimensions.find(d => d.key === r.dimensionKey)?.title || r.dimensionKey);

      await healthCheckApi.saveOrUpdateBoard({ 
        ...boardData,
        status: 'finished',
        summary: { topMetrics, lowMetrics, results }
      });
      
      toast({ title: "Radar Finalizado!" });
    } catch (error: any) {
      console.error("Error finalizing health check:", error);
      toast({ title: "Erro ao finalizar", variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleLeaveRoom = () => {
    router.push('/workspace');
  };

  // --- Render Logic ---

  if (isUserLoading || isInitializing || isBoardLoading || areParticipantsLoading || !user || !userProfile) {
    if (!userProfile) {
      return <LoadingScreen message="Configurando identidade..." submessage="Preencha sua identidade para entrar no radar" />;
    }
    return <LoadingScreen message="Carregando Radar de Saúde..." />;
  }

  if (!boardData) return <NotFound resourceName="radar de saúde" />;
  
  if (!currentUser) {
     return <LoadingScreen message="Juntando-se à sala..." />;
  }

  if (boardData.status === 'finished') {
    return (
      <>
        <HealthCheckResults
            boardId={boardId}
            isCreator={isCurrentUserCreator}
            onLeave={handleLeaveRoom}
            dimensions={boardDimensions}
            roomTitle={boardData.sprintName}
            votes={allVotes || []}
            results={boardData.summary?.results || []}
            onOpenFeedback={handleOpenFeedback}
            scaleType={boardData.scaleType}
        />
        <FeedbackWidget toolName="Health Radar" triggerVariant="icon" externalTriggerSignal={feedbackSignal} />
      </>
    );
  }

  return (
    <>
      <HealthCheckVotingBoard
          boardId={boardId}
          participants={participants || []}
          userVotes={userVotes || []}
          onVote={handleVote}
          isCreator={isCurrentUserCreator}
          onFinish={handleFinish}
          isFinishing={isFinishing}
          onLeave={handleLeaveRoom}
          dimensions={boardDimensions}
          roomTitle={boardData.sprintName}
          onOpenFeedback={handleOpenFeedback}
          scaleType={boardData.scaleType}
      />
      <FeedbackWidget toolName="Health Radar" triggerVariant="icon" externalTriggerSignal={feedbackSignal} />
    </>
  );
}
