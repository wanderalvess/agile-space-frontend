'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
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
import { errorMessage } from '@/lib/ceremony-api';
import { connectRoomSocket } from '@/lib/room-socket';
import { FeedbackWidget } from '@/components/feedback-widget';

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx < 0) return [...list, item];
  const copy = [...list];
  copy[idx] = item;
  return copy;
}

export default function HealthCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const boardId = resolvedParams.id;

  const { isAuthenticated, isLoading } = useAuth();
  const { userProfile, isInitializing } = useUserContext();
  const { toast } = useToast();
  const router = useRouter();

  const [boardData, setBoardData] = useState<HealthCheckBoardType | null>(null);
  const [participants, setParticipants] = useState<HealthCheckParticipant[]>([]);
  // Votação aberta: só os votos da própria pessoa (o servidor não envia os dos outros, é isso que garante o anonimato).
  // Radar encerrado: todos os votos, sem identificar quem votou.
  const [votes, setVotes] = useState<HealthCheckVote[]>([]);

  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  // Só a recarga mais recente vale: uma resposta lenta de uma recarga antiga não pode sobrescrever a nova.
  const reloadSeq = useRef(0);
  const joinAttempted = useRef(false);
  const lastFinishedLoad = useRef<string | null>(null);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  const currentUser = useMemo(() => participants?.find(p => p.id === userProfile?.id) || null, [participants, userProfile?.id]);
  const userVotes = useMemo(() => votes.filter(v => v.participantId === currentUser?.id), [votes, currentUser?.id]);

  const isCurrentUserCreator = useMemo(() => {
    if (!userProfile || !boardData) return false;
    return userProfile.id === boardData.creatorId;
  }, [userProfile, boardData]);

  const boardDimensions = boardData?.dimensions || DEFAULT_HEALTH_CHECK_DIMENSIONS;

  const mapGlobalToTeamRole = (role: GlobalRole | undefined): TeamRole => {
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

  useEffect(() => {
    // O estado da sala não pode vazar de uma sala para outra ao trocar o id na URL.
    setBoardData(null);
    setParticipants([]);
    setVotes([]);
    setIsBoardLoading(true);
    setAreParticipantsLoading(true);
    joinAttempted.current = false;
    lastFinishedLoad.current = null;
  }, [boardId]);

  const reloadBoardData = useCallback(async () => {
    if (!isAuthenticated) return;
    const seq = ++reloadSeq.current;
    try {
      const [board, partsList, votesList] = await Promise.all([
        healthCheckApi.getBoard(boardId),
        healthCheckApi.getParticipants(boardId),
        healthCheckApi.getVotes(boardId)
      ]);
      if (seq !== reloadSeq.current) return;
      setBoardData(board);
      setParticipants(partsList);
      setVotes(votesList);
      lastFinishedLoad.current = board.status === 'finished' ? board.id : null;
    } catch (e) {
      if (seq !== reloadSeq.current) return;
      console.error("Erro ao carregar dados do Radar de Saúde:", e);
    } finally {
      if (seq === reloadSeq.current) {
        setIsBoardLoading(false);
        setAreParticipantsLoading(false);
      }
    }
  }, [boardId, isAuthenticated]);

  // Conexão WebSocket (com reconexão e ressincronização) e carga inicial
  useEffect(() => {
    if (!isAuthenticated) return;

    reloadBoardData();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/health-check/') + boardId;

    return connectRoomSocket({
      buildUrl: () => wsBase + '?token=' + encodeURIComponent(getAuthToken() || ''),
      onReconnect: reloadBoardData,
      onError: () => reloadBoardData(),
      onMessage: (message) => {
        const payload = message.payload as any;
        switch (message.type) {
          case 'BOARD_UPDATED':
            if (payload) setBoardData(payload);
            break;

          case 'BOARD_DELETED':
            toast({ title: 'Este radar foi apagado', description: 'O organizador removeu a sessão.', variant: 'destructive' });
            router.push('/health-check');
            break;

          case 'PARTICIPANT_JOINED':
            if (payload) setParticipants(prev => upsertById(prev, payload));
            break;

          case 'PARTICIPANT_LEFT':
            if (payload?.userId) {
              setParticipants(prev => prev.filter(p => p.id !== payload.userId));
            }
            break;

          case 'VOTE_SAVED':
            // chega só ao próprio votante (outras abas dele); os votos dos outros nunca trafegam
            if (payload) setVotes(prev => upsertById(prev, payload));
            break;

          case 'REFRESH_BOARD':
          default:
            reloadBoardData();
            break;
        }
      },
    });
  }, [boardId, reloadBoardData, isAuthenticated, router, toast]);

  // Ao encerrar, a lista de votos muda de "só os meus" para "todos, sem identificação": recarrega uma vez.
  useEffect(() => {
    if (!isAuthenticated || boardData?.status !== 'finished') return;
    if (lastFinishedLoad.current === boardData.id) return;
    lastFinishedLoad.current = boardData.id;
    healthCheckApi.getVotes(boardId)
      .then(setVotes)
      .catch(e => {
        lastFinishedLoad.current = null;
        console.error("Erro ao carregar os votos do radar encerrado:", e);
      });
  }, [isAuthenticated, boardData?.id, boardData?.status, boardId]);

  // Auto-join como participante (uma vez por sala; o servidor usa a identidade do login)
  useEffect(() => {
    if (isLoading || areParticipantsLoading || !isAuthenticated || !userProfile || !boardData) {
      return;
    }
    if (joinAttempted.current || participants.some(p => p.id === userProfile.id)) return;
    joinAttempted.current = true;

    healthCheckApi.joinBoard(boardId, {
      nickname: userProfile.name,
      role: mapGlobalToTeamRole(userProfile.role),
    }).then(joined => {
      setParticipants(prev => upsertById(prev, joined));
    }).catch(e => {
      joinAttempted.current = false;
      console.error("Erro ao entrar no radar:", e);
      toast({ title: 'Não foi possível entrar na sala', description: errorMessage(e, 'Recarregue a página para tentar de novo.'), variant: 'destructive' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, areParticipantsLoading, isAuthenticated, userProfile, boardData, participants, boardId]);

  // Título Dinâmico da Aba
  useEffect(() => {
    const baseTitle = "Portal Tech V&D";
    const moduleName = "Radar de Saúde";
    const sessionName = boardData?.sprintName || boardData?.team;

    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [boardData]);

  /** Devolve true se salvou: a tela mantém o comentário digitado quando falha. */
  const handleVote = async (dimensionKey: string, value: HealthCheckVoteValue, comment?: string): Promise<boolean> => {
    if (!userProfile || !currentUser) return false;
    try {
      const saved = await healthCheckApi.saveVote(boardId, { dimensionKey, value, comment: comment || '' });
      setVotes(prev => upsertById(prev, saved));
      return true;
    } catch (e) {
      console.error("Erro ao salvar voto:", e);
      toast({ title: "Erro ao votar", description: errorMessage(e, "Não foi possível registrar o voto. O seu comentário foi mantido na tela."), variant: "destructive" });
      return false;
    }
  };

  const handleFinish = async () => {
    if (!boardData) {
      toast({ title: "Aguarde", description: "Sincronizando com o servidor...", variant: "destructive" });
      return;
    }

    if (!isCurrentUserCreator) {
      toast({ title: "Acesso negado", description: "Apenas o organizador pode encerrar a votação.", variant: "destructive" });
      return;
    }

    if (isFinishing) return;
    setIsFinishing(true);
    try {
      // médias, contagens e destaques são calculados no servidor com todos os votos já gravados
      const finished = await healthCheckApi.finishBoard(boardId);
      setBoardData(finished);
      toast({ title: "Radar finalizado!" });
    } catch (error) {
      console.error("Error finalizing health check:", error);
      toast({ title: "Erro ao finalizar", description: errorMessage(error, "Não foi possível encerrar a votação."), variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleLeaveRoom = () => {
    router.push('/workspace');
  };

  // --- Render Logic ---

  if (isLoading || isInitializing || isBoardLoading || areParticipantsLoading || !isAuthenticated || !userProfile) {
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
            votes={votes}
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
          participants={participants}
          userVotes={userVotes}
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
