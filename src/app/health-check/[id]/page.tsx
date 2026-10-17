'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { healthCheckApi } from '../api';
import type { HealthCheckBoard as HealthCheckBoardType, HealthCheckParticipant, HealthCheckVote, HealthCheckVoteValue, TeamRole, GlobalRole } from '@/lib/types';
import { HealthCheckVotingBoard, type FinishResult } from '@/components/health-check/HealthCheckVotingBoard';
import { HealthCheckResults } from '@/components/health-check/HealthCheckResults';
import { HealthRoomState } from '@/components/health-check/HealthRoomStates';
import { OFFLINE_AFTER_ATTEMPTS, type HealthConnection } from '@/components/health-check/health-ui';
import { useToast } from '@/hooks/use-toast';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { DEFAULT_HEALTH_CHECK_DIMENSIONS } from '@/lib/health-check-defaults';
import { removeLocalRoomMeta, squadChoices, squadDisplayName } from '@/lib/health-check-lobby';
import { useUserContext } from '@/context/UserContext';
import { getAuthToken } from '@/lib/auth-client';
import { CeremonyApiError, errorMessage } from '@/lib/ceremony-api';
import { connectRoomSocket } from '@/lib/room-socket';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { FeedbackWidget } from '@/components/feedback-widget';
import {
  isBoardFinished,
  pendingPeople as pendingPeopleOf,
  publishedStageOf,
  responseCounts as responseCountsOf,
  shouldRefetchProgress,
  type HealthProgress,
} from '@/lib/health-check-progress';
import type { PublishResult } from '@/hooks/useHealthPresentationSync';

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx < 0) return [...list, item];
  const copy = [...list];
  copy[idx] = item;
  return copy;
}

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

export default function HealthCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const boardId = resolvedParams.id;

  const { isAuthenticated, isLoading } = useAuth();
  const { userProfile, isInitializing } = useUserContext();
  const { toast } = useToast();
  const router = useRouter();
  const { squadId: activeSquadId, squadName: activeSquadName } = useActiveSquad();
  const { memberships } = useMyMemberships();

  const [boardData, setBoardData] = useState<HealthCheckBoardType | null>(null);
  const [participants, setParticipants] = useState<HealthCheckParticipant[]>([]);
  // Votação aberta: só os votos da própria pessoa (o servidor não envia os dos outros, é isso que garante o anonimato).
  // Radar encerrado: todos os votos, sem identificar quem votou.
  const [votes, setVotes] = useState<HealthCheckVote[]>([]);

  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);
  const [loadError, setLoadError] = useState<'notfound' | 'error' | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [connection, setConnection] = useState<HealthConnection>({ state: 'connecting' });
  const [isFinishing, setIsFinishing] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  // Etapa da apresentação publicada pelo facilitador. undefined = o servidor não conhece o recurso (backend antigo).
  const [presentationStage, setPresentationStage] = useState<string | null | undefined>(undefined);
  // "Ainda não votaram" (só o facilitador recebe a lista) e o respondedCount para o qual ela foi buscada.
  const [progress, setProgress] = useState<HealthProgress | null>(null);
  const progressFor = useRef<number | null>(null);
  const progressSeq = useRef(0);
  const progressUnavailable = useRef(false);

  // Só a recarga mais recente vale: uma resposta lenta de uma recarga antiga não pode sobrescrever a nova.
  const reloadSeq = useRef(0);
  const joinAttempted = useRef(false);
  const lastFinishedLoad = useRef<string | null>(null);
  // Quem apaga o radar também recebe BOARD_DELETED: a tela dele segue para a lista, não para o aviso de "apagado".
  const deletingRef = useRef(false);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  // Quem está com a sala aberta agora (null = o servidor não informa; a sala mostra só o total, como antes).
  const presence = useRoomPresence({ module: 'health-check', roomId: boardId });
  const presenceBindings = presence.bindings;

  const currentUser = useMemo(() => participants?.find(p => p.id === userProfile?.id) || null, [participants, userProfile?.id]);
  const userVotes = useMemo(() => votes.filter(v => v.participantId === currentUser?.id), [votes, currentUser?.id]);

  const isCurrentUserCreator = useMemo(() => {
    if (!userProfile || !boardData) return false;
    return userProfile.id === boardData.creatorId;
  }, [userProfile, boardData]);
  // Criador ou ADMIN (o backend aceita os dois): vê quem ainda não votou e publica a etapa da apresentação.
  const canFacilitate = isCurrentUserCreator || userProfile?.role === 'admin';

  const boardDimensions = boardData?.dimensions || DEFAULT_HEALTH_CHECK_DIMENSIONS;

  const choices = useMemo(
    () => squadChoices(memberships?.memberships, { squadId: activeSquadId, squadName: activeSquadName }),
    [memberships, activeSquadId, activeSquadName]
  );
  const squadLabel = squadDisplayName(boardData?.team, choices);
  const creatorName = participants.find((p) => p.id === boardData?.creatorId)?.nickname;

  useEffect(() => {
    // O estado da sala não pode vazar de uma sala para outra ao trocar o id na URL.
    setBoardData(null);
    setParticipants([]);
    setVotes([]);
    setPresentationStage(undefined);
    setProgress(null);
    progressFor.current = null;
    progressSeq.current += 1;
    progressUnavailable.current = false;
    setIsBoardLoading(true);
    setAreParticipantsLoading(true);
    setLoadError(null);
    setDeleted(false);
    setConnection({ state: 'connecting' });
    joinAttempted.current = false;
    lastFinishedLoad.current = null;
    deletingRef.current = false;
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
      setPresentationStage(publishedStageOf(board));
      setParticipants(partsList);
      setVotes(votesList);
      setLoadError(null);
      lastFinishedLoad.current = isBoardFinished(board) ? board.id : null;
    } catch (e) {
      if (seq !== reloadSeq.current) return;
      console.error("Erro ao carregar dados do Radar de clima:", e);
      // Falha de rede ou 500 não pode parecer "não encontrado": só 404/403 dizem que a sala não existe ou não é acessível.
      setLoadError(e instanceof CeremonyApiError && (e.status === 404 || e.status === 403) ? 'notfound' : 'error');
    } finally {
      if (seq === reloadSeq.current) {
        setIsBoardLoading(false);
        setAreParticipantsLoading(false);
      }
    }
  }, [boardId, isAuthenticated]);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setIsBoardLoading(true);
    setAreParticipantsLoading(true);
    void reloadBoardData();
  }, [reloadBoardData]);

  // Conexão WebSocket (com reconexão e ressincronização) e carga inicial
  useEffect(() => {
    if (!isAuthenticated) return;

    reloadBoardData();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/health-check/') + boardId;

    return connectRoomSocket({
      buildUrl: () => wsBase + '?token=' + encodeURIComponent(getAuthToken() || ''),
      ...presenceBindings,
      // Etapa da apresentação do facilitador (backend antigo ignora o parâmetro e nunca envia o evento).
      presentation: true,
      onOpen: () => setConnection({ state: 'live' }),
      onClose: ({ attempt, retryInMs }) =>
        setConnection({ state: attempt >= OFFLINE_AFTER_ATTEMPTS ? 'offline' : 'reconnecting', retryInSec: Math.max(1, Math.round(retryInMs / 1000)) }),
      onReconnect: reloadBoardData,
      onError: () => reloadBoardData(),
      onMessage: (message) => {
        const payload = message.payload as any;
        switch (message.type) {
          case 'BOARD_UPDATED':
            if (payload) {
              setBoardData(payload);
              const published = publishedStageOf(payload);
              if (published !== undefined) setPresentationStage(published);
            }
            break;

          case 'PRESENTATION_STAGE':
            // Estado completo: a etapa atual (ou null quando o facilitador encerrou a apresentação).
            if (payload && typeof payload === 'object') setPresentationStage(typeof payload.stage === 'string' ? payload.stage : null);
            break;

          case 'BOARD_DELETED':
            if (deletingRef.current) break;
            setDeleted(true);
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
  }, [boardId, reloadBoardData, isAuthenticated, presenceBindings]);

  // Ao encerrar, a lista de votos muda de "só os meus" para "todos, sem identificação": recarrega uma vez.
  useEffect(() => {
    if (!isAuthenticated || !boardData || !isBoardFinished(boardData)) return;
    if (lastFinishedLoad.current === boardData.id) return;
    lastFinishedLoad.current = boardData.id;
    healthCheckApi.getVotes(boardId)
      .then(setVotes)
      .catch(e => {
        lastFinishedLoad.current = null;
        console.error("Erro ao carregar os votos do radar encerrado:", e);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, boardData?.id, boardData?.status, boardData?.lifecycleStatus, boardId]);

  // "Ainda não votaram": só o facilitador lê a lista, refeita quando o número de respondentes muda (uma chamada leve).
  const respondedNow = boardData?.respondedCount;
  const boardFinishedNow = boardData ? isBoardFinished(boardData) : true;
  useEffect(() => {
    if (!isAuthenticated || progressUnavailable.current) return;
    if (!shouldRefetchProgress({ enabled: canFacilitate, finished: boardFinishedNow, respondedCount: respondedNow, lastFetchedFor: progressFor.current })) return;
    progressFor.current = respondedNow ?? null;
    const seq = ++progressSeq.current;
    healthCheckApi.getProgress(boardId)
      .then((result) => {
        if (seq !== progressSeq.current) return;
        if (result.status === 'ok') setProgress(result.data);
        else progressUnavailable.current = true; // 404/405 (backend antigo) ou 403: some o bloco, sem erro na tela
      })
      .catch((e) => {
        if (seq === progressSeq.current) progressFor.current = null;
        console.warn('Não foi possível carregar quem ainda não votou', e);
      });
  }, [isAuthenticated, canFacilitate, boardFinishedNow, respondedNow, boardId]);

  const responseCounts = useMemo(() => (boardData ? responseCountsOf(boardData, participants) : null), [boardData, participants]);
  const pendingPeople = useMemo(() => (canFacilitate ? pendingPeopleOf(progress, participants) : null), [canFacilitate, progress, participants]);

  const publishStage = useCallback(async (stage: string | null): Promise<PublishResult> => {
    const result = stage === null ? await healthCheckApi.clearPresentationStage(boardId) : await healthCheckApi.setPresentationStage(boardId, stage);
    return result.status === 'ok' ? 'ok' : result.status;
  }, [boardId]);

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
    const moduleName = "Radar de clima";
    const sessionName = boardData?.sprintName || squadLabel;

    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [boardData?.sprintName, squadLabel]);

  /** Devolve true se salvou: a tela mantém o comentário digitado quando falha. */
  const handleVote = async (dimensionKey: string, value: HealthCheckVoteValue, comment?: string): Promise<boolean> => {
    if (!userProfile || !currentUser) return false;
    try {
      const saved = await healthCheckApi.saveVote(boardId, { dimensionKey, value, comment: comment || '' });
      setVotes(prev => upsertById(prev, saved));
      return true;
    } catch (e) {
      console.error("Erro ao salvar voto:", e);
      // Voto depois do encerramento (409): a tela já terá trocado para o resultado; o texto do servidor explica.
      toast({ title: "Erro ao votar", description: errorMessage(e, "Não foi possível registrar o voto. O seu comentário foi mantido na tela."), variant: "destructive" });
      return false;
    }
  };

  /** Encerra a votação. Os erros voltam para a própria janela de confirmação (sem toast). */
  const handleFinish = async (): Promise<FinishResult> => {
    if (!boardData) return { ok: false, message: 'Sincronizando com o servidor. Aguarde um instante e tente de novo.' };
    if (!isCurrentUserCreator) return { ok: false, message: 'Apenas o organizador pode encerrar a votação.' };
    if (isFinishing) return { ok: false };
    setIsFinishing(true);
    try {
      // médias, contagens e destaques são calculados no servidor com todos os votos já gravados
      const finished = await healthCheckApi.finishBoard(boardId);
      setBoardData(finished);
      setPresentationStage(publishedStageOf(finished));
      toast({ title: "Radar finalizado!" });
      return { ok: true };
    } catch (error) {
      console.error("Error finalizing health check:", error);
      return { ok: false, message: errorMessage(error, "Não foi possível encerrar a votação.") };
    } finally {
      setIsFinishing(false);
    }
  };

  const handleDeleteBoard = async () => {
    deletingRef.current = true;
    try {
      await healthCheckApi.deleteBoard(boardId);
    } catch (e) {
      deletingRef.current = false;
      throw e;
    }
    removeLocalRoomMeta(boardId, window.localStorage);
    toast({ title: 'Radar apagado' });
    router.push('/health-check');
  };

  // --- Render Logic ---

  if (deleted) return <HealthRoomState kind="deleted" />;

  if (!boardData) {
    if (isLoading || isInitializing || isBoardLoading || !isAuthenticated || !userProfile) return <HealthRoomState kind="loading" />;
    return <HealthRoomState kind={loadError === 'notfound' ? 'notfound' : 'error'} onRetry={retryLoad} />;
  }

  if (isLoading || isInitializing || areParticipantsLoading || !isAuthenticated || !userProfile) return <HealthRoomState kind="loading" />;

  if (!currentUser) return <HealthRoomState kind="entering" />;

  const shared = {
    board: boardData,
    squadLabel,
    participants,
    onlineIds: presence.online,
    currentUserId: userProfile.id,
    connection,
    onDeleteBoard: handleDeleteBoard,
    onOpenFeedback: handleOpenFeedback,
    responseCounts,
  };

  return (
    <>
      {isBoardFinished(boardData) ? (
        <HealthCheckResults
          {...shared}
          boardId={boardId}
          isCreator={isCurrentUserCreator}
          creatorName={creatorName}
          dimensions={boardDimensions}
          votes={votes}
          results={boardData.summary?.results}
          presentation={{ published: presentationStage, canPublish: canFacilitate && presentationStage !== undefined, publish: publishStage }}
        />
      ) : (
        <HealthCheckVotingBoard
          {...shared}
          userVotes={userVotes}
          onVote={handleVote}
          isCreator={isCurrentUserCreator}
          onFinish={handleFinish}
          isFinishing={isFinishing}
          dimensions={boardDimensions}
          pendingPeople={pendingPeople}
        />
      )}
      <FeedbackWidget toolName="Radar de clima" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </>
  );
}
