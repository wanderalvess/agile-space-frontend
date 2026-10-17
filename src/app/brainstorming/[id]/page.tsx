'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useCallback, useMemo, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { brainstormingApi, type BrainstormingBoardPatch } from '../api';
import type {
  BrainstormingBoard,
  BrainstormingIdea,
  BrainstormingGroup,
  BrainstormingPhase,
  Participant,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useStableCallback } from '@/hooks/use-stable-callback';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useUserContext } from '@/context/UserContext';
import { useMyMemberships } from '@/hooks/useMyMemberships';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { getAuthToken } from '@/lib/auth-client';
import { CeremonyApiError, errorMessage } from '@/lib/ceremony-api';
import { connectRoomSocket } from '@/lib/room-socket';
import { useRoomPresence } from '@/hooks/useRoomPresence';
import { applyGroupDeleted, applyIdeaDeleted, upsertById } from '@/lib/brainstorming-utils';
import { FeedbackWidget } from '@/components/feedback-widget';
import { squadLabel as resolveSquadLabel, squadOptions } from '@/components/showcase/review-room-logic';
import { BrainstormRoom } from '@/components/brainstorming/BrainstormRoom';
import { BrainstormRoomState } from '@/components/brainstorming/BrainstormRoomState';
import { effectiveFacilitatorId, isEndpointUnavailable, type CeremonyAction } from '@/components/brainstorming/brainstorm-ceremony';
import {
  INITIAL_CONNECTION,
  nextConnection,
  nextGroupColor,
  pausedTimer,
  resetTimer,
  resumedTimer,
  runningTimer,
  stoppedTimer,
  type RoomConnectionState,
} from '@/components/brainstorming/brainstorm-room-logic';

/** Depois de apagada pelo facilitador, a sala mostra o aviso por este tempo e volta ao Brainstorming. */
const DELETED_REDIRECT_MS = 4000;

export default function BrainstormingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const boardId = resolvedParams.id;

  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { userProfile, isInitializing } = useUserContext();
  const { squadId: activeSquadId, squadName: activeSquadName } = useActiveSquad();
  const { memberships } = useMyMemberships();

  const [boardData, setBoardData] = useState<BrainstormingBoard | null>(null);
  const [ideas, setIdeas] = useState<BrainstormingIdea[]>([]);
  const [groups, setGroups] = useState<BrainstormingGroup[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [areIdeasLoading, setAreIdeasLoading] = useState(true);
  const [areGroupsLoading, setAreGroupsLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);
  // 'notfound' = o servidor disse que o mural não existe; 'failed' = não deu para carregar (rede, sessão, 5xx).
  const [loadError, setLoadError] = useState<null | 'notfound' | 'failed'>(null);
  const [deleted, setDeleted] = useState(false);
  const [connection, setConnection] = useState<RoomConnectionState>(INITIAL_CONNECTION);
  // Quem está com a sala aberta agora (null = o servidor não informa; a sala mostra só o total, como antes).
  const presence = useRoomPresence({ module: 'brainstorming', roomId: boardId });
  const presenceBindings = presence.bindings;

  const [mergingSourceId, setMergingSourceId] = useState<string | null>(null);
  // Encerrar/assumir/passar: ocupado enquanto a chamada roda; indisponível quando o servidor não tem a rota (backend antigo).
  const [ceremonyBusy, setCeremonyBusy] = useState(false);
  const [ceremonyUnavailable, setCeremonyUnavailable] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  // Só a recarga mais recente vale: uma resposta lenta de uma recarga antiga não pode sobrescrever a nova.
  const reloadSeq = useRef(0);
  const joinAttempted = useRef(false);
  const boardLoaded = useRef(false);
  // O facilitador que apaga o mural também recebe BOARD_DELETED: para ele não é "a sessão foi encerrada".
  const deletingSelf = useRef(false);
  // Facilitador atual: `facilitatorId` (backend novo, muda ao assumir/passar), ou o criador (mural e servidor antigos).
  const isFacilitator = !!userProfile && !!boardData && effectiveFacilitatorId(boardData) === userProfile.id;
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    // O estado da sala não pode vazar de uma sala para outra ao trocar o id na URL.
    reloadSeq.current += 1;
    setBoardData(null);
    setIdeas([]);
    setGroups([]);
    setParticipants([]);
    setMergingSourceId(null);
    setLoadError(null);
    setDeleted(false);
    setConnection(INITIAL_CONNECTION);
    setCeremonyBusy(false);
    setCeremonyUnavailable(false);
    setIsBoardLoading(true);
    setAreIdeasLoading(true);
    setAreGroupsLoading(true);
    setAreParticipantsLoading(true);
    joinAttempted.current = false;
    boardLoaded.current = false;
    deletingSelf.current = false;
    lastVisibilityKey.current = null;
  }, [boardId]);

  const reloadBoardData = useCallback(async () => {
    if (!isAuthenticated) return;
    const seq = ++reloadSeq.current;
    try {
      const [board, ideasList, groupsList, partsList] = await Promise.all([
        brainstormingApi.getBoard(boardId),
        brainstormingApi.getIdeas(boardId),
        brainstormingApi.getGroups(boardId),
        brainstormingApi.getParticipants(boardId),
      ]);
      if (seq !== reloadSeq.current) return;
      boardLoaded.current = true;
      setBoardData(board);
      setIdeas(ideasList);
      setGroups(groupsList);
      setParticipants(partsList);
      setLoadError(null);
    } catch (e) {
      if (seq !== reloadSeq.current) return;
      console.error('Erro ao recarregar dados do Brainstorming:', e);
      // Já com o mural na tela, uma falha de rede passageira não derruba nada: o próximo evento ou reconexão ressincroniza.
      if (!boardLoaded.current) setLoadError(e instanceof CeremonyApiError && e.status === 404 ? 'notfound' : 'failed');
    } finally {
      if (seq === reloadSeq.current) {
        setIsBoardLoading(false);
        setAreIdeasLoading(false);
        setAreGroupsLoading(false);
        setAreParticipantsLoading(false);
      }
    }
  }, [boardId, isAuthenticated]);

  // Conexão WebSocket (com reconexão e ressincronização) e carga inicial
  useEffect(() => {
    if (!isAuthenticated) return;

    reloadBoardData();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/brainstorming/') + boardId;

    return connectRoomSocket({
      buildUrl: () => wsBase + '?token=' + encodeURIComponent(getAuthToken() || ''),
      ...presenceBindings,
      onOpen: () => setConnection((c) => nextConnection(c, 'open')),
      onClose: () => setConnection((c) => nextConnection(c, 'close')),
      onReconnect: reloadBoardData,
      onError: () => reloadBoardData(),
      onMessage: (message) => {
        const payload = message.payload as any;
        switch (message.type) {
          case 'BOARD_UPDATED':
            if (payload) setBoardData(payload);
            break;

          case 'BOARD_DELETED':
            if (deletingSelf.current) {
              router.push('/brainstorming');
              break;
            }
            toast({ title: 'Esta sessão foi encerrada', description: 'O facilitador apagou o mural.', variant: 'destructive' });
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

          case 'IDEA_SAVED':
            if (payload) setIdeas(prev => upsertById(prev, payload));
            break;

          case 'IDEA_DELETED':
            if (payload?.ideaId) {
              setIdeas(prev => applyIdeaDeleted(prev, payload.ideaId));
              setMergingSourceId(current => (current === payload.ideaId ? null : current));
            }
            break;

          case 'GROUP_SAVED':
            if (payload) setGroups(prev => upsertById(prev, payload));
            break;

          case 'GROUP_DELETED':
            if (payload?.groupId) {
              // o servidor também publica cada ideia solta; isto cobre o intervalo até esses eventos chegarem
              setGroups(prev => prev.filter(g => g.id !== payload.groupId));
              setIdeas(prev => prev.map(i => (i.groupId === payload.groupId ? { ...i, groupId: null } : i)));
            }
            break;

          case 'REFRESH_BOARD':
          default:
            reloadBoardData();
            break;
        }
      },
    });
  }, [boardId, reloadBoardData, isAuthenticated, router, toast, presenceBindings]);

  // Sessão apagada pelo facilitador: mostra o aviso e volta ao Brainstorming sozinho.
  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => router.push('/brainstorming'), DELETED_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [deleted, router]);

  // Entra na sala uma vez por sala (o servidor usa a identidade do login; o corpo só dá apelido e papel)
  useEffect(() => {
    if (!isAuthenticated || !boardData || !userProfile || areParticipantsLoading) return;
    if (joinAttempted.current || participants.some(p => p.id === userProfile.id)) return;
    joinAttempted.current = true;

    brainstormingApi.joinBoard(boardId, {
      nickname: userProfile.name,
      role: userProfile.role || 'DEV',
    } as any).then(joined => {
      setParticipants(prev => upsertById(prev, joined as any));
    }).catch(e => {
      joinAttempted.current = false;
      console.error("Erro ao entrar no mural:", e);
      toast({ title: 'Não foi possível entrar na lista de participantes', description: errorMessage(e, 'Recarregue a página para tentar de novo.'), variant: 'destructive' });
    });
  }, [isAuthenticated, boardData, userProfile, participants, areParticipantsLoading, boardId, toast]);

  // Revelar/ocultar ideias, autores anônimos ou trocar o facilitador muda o que o servidor envia a cada pessoa (o texto
  // das ideias ocultas vai para o facilitador): recarrega só as ideias, trocando a lista inteira de uma vez (sem piscar).
  // Não roda na primeira carga.
  const visibilityKey = boardData ? `${boardData.settings.isRevealed === false}|${!!boardData.settings.isAnonymous}|${effectiveFacilitatorId(boardData) ?? ''}` : null;
  const lastVisibilityKey = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated || visibilityKey === null) return;
    const previous = lastVisibilityKey.current;
    lastVisibilityKey.current = visibilityKey;
    if (previous === null || previous === visibilityKey) return;
    brainstormingApi.getIdeas(boardId).then(setIdeas).catch(e => console.error("Erro ao recarregar as ideias:", e));
  }, [visibilityKey, isAuthenticated, boardId]);

  // Título Dinâmico da Aba
  useEffect(() => {
    const baseTitle = "Portal Tech V&D";
    const moduleName = "Brainstorming";
    const sessionName = boardData?.title || boardData?.team;

    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [boardData]);

  // Nome da squad para o chip: o vínculo dá o nome; sem ele, a chave que o mural guarda.
  const squadLabel = useMemo(
    () => resolveSquadLabel(boardData?.team, squadOptions(memberships?.memberships, { squadId: activeSquadId, squadName: activeSquadName })),
    [boardData?.team, memberships, activeSquadId, activeSquadName]
  );

  // --- Handlers ---
  // useStableCallback: identidade fixa e sempre a versão mais recente (nada de closure velha sobre `ideas`),
  // então a teia e as listas não re-renderizam à toa nem agem sobre um estado antigo.

  /**
   * Erro vira aviso na tela (com a mensagem do servidor), nunca só console. Um 409 pode ser o mural encerrado, o limite
   * de votos ou a facilitação que mudou: recarrega só o mural para a tela alcançar o estado do servidor.
   */
  const fail = (title: string, error: unknown, fallback = 'Tente novamente.') => {
    console.error(title, error);
    toast({ title, description: errorMessage(error, fallback), variant: 'destructive' });
    if (error instanceof CeremonyApiError && error.status === 409) {
      brainstormingApi.getBoard(boardId).then((board) => { if (board?.id) setBoardData(board); }).catch(() => undefined);
    }
  };

  const applyIdea = (idea: BrainstormingIdea) => setIdeas(prev => upsertById(prev, idea));

  /** Devolve true quando salvou; a tela só limpa o campo digitado nesse caso (o texto não se perde se falhar). */
  const handleAddIdea = useStableCallback(async (content: string): Promise<boolean> => {
    if (!isAuthenticated || !userProfile || !boardId) return false;
    try {
      const created = await brainstormingApi.saveOrUpdateIdea(boardId, {
        content,
        position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      });
      applyIdea(created);
      return true;
    } catch (e) {
      fail('Não foi possível lançar a ideia', e, 'Seu texto foi mantido no campo. Tente novamente.');
      return false;
    }
  });

  const handleDeleteIdea = useStableCallback(async (ideaId: string) => {
    try {
      await brainstormingApi.deleteIdea(boardId, ideaId);
      setIdeas(prev => applyIdeaDeleted(prev, ideaId));
    } catch (e) {
      fail('Não foi possível apagar a ideia', e);
    }
  });

  const handleToggleVote = useStableCallback(async (ideaId: string) => {
    try {
      applyIdea(await brainstormingApi.toggleVote(boardId, ideaId));
    } catch (e) {
      fail('Não foi possível registrar o voto', e);
    }
  });

  const handleMergeIdeas = useStableCallback(async (sourceId: string, targetId: string) => {
    try {
      const merged = await brainstormingApi.mergeIdeas(boardId, targetId, sourceId);
      setIdeas(prev => applyIdeaDeleted(prev, sourceId).map(i => (i.id === merged.id ? merged : i)));
      setMergingSourceId(null);
      toast({
        title: "Ideias fundidas!",
        description: "Os textos e votos foram combinados com sucesso.",
      });
    } catch (e) {
      fail('Erro na fusão', e, 'Não foi possível combinar as ideias.');
    }
  });

  const patchIdea = async (ideaId: string, patch: Parameters<typeof brainstormingApi.patchIdea>[2], errorTitle: string): Promise<boolean> => {
    try {
      applyIdea(await brainstormingApi.patchIdea(boardId, ideaId, patch));
      return true;
    } catch (e) {
      fail(errorTitle, e);
      return false;
    }
  };

  const handleUpdateIdeaPosition = useStableCallback((ideaId: string, x: number, y: number) =>
    patchIdea(ideaId, { position: { x, y } }, 'Não foi possível salvar a posição da ideia'));

  /** Devolve true quando salvou; o card só sai do modo de edição nesse caso (o texto editado não se perde). */
  const handleUpdateIdea = useStableCallback((ideaId: string, content: string) =>
    patchIdea(ideaId, { content }, 'Não foi possível salvar a ideia'));

  const handleConnectIdeas = useStableCallback((sourceId: string, targetId: string) =>
    patchIdea(targetId, { parentId: sourceId }, 'Não foi possível ligar as ideias'));

  const handleDisconnectIdea = useStableCallback((ideaId: string) =>
    patchIdea(ideaId, { parentId: null }, 'Não foi possível remover a ligação'));

  const handleMoveIdeaToGroup = useStableCallback((ideaId: string, groupId: string | null) =>
    patchIdea(ideaId, { groupId }, 'Não foi possível mover a ideia'));

  const handleUpdateIdeaQualifiers = useStableCallback((ideaId: string, qualifiers: { roi?: number, effort?: number }) =>
    patchIdea(ideaId, { qualifiers }, 'Não foi possível salvar a priorização'));

  /** Cada grupo novo recebe uma cor da paleta (o servidor guarda; Matriz e Plano usam a mesma). */
  const handleAddGroup = useStableCallback(async (title: string): Promise<boolean> => {
    try {
      const created = await brainstormingApi.saveOrUpdateGroup(boardId, { title, color: nextGroupColor(groups) });
      setGroups(prev => upsertById(prev, created));
      return true;
    } catch (e) {
      fail('Não foi possível criar o grupo', e, 'O nome foi mantido no campo. Tente novamente.');
      return false;
    }
  });

  const handleDeleteGroup = useStableCallback(async (groupId: string) => {
    try {
      await brainstormingApi.deleteGroup(boardId, groupId);
      const result = applyGroupDeleted(groups, ideas, groupId);
      setGroups(result.groups);
      setIdeas(result.ideas);
    } catch (e) {
      fail('Não foi possível apagar o grupo', e);
    }
  });

  /** Mudança do facilitador: só os campos do patch são gravados (nada de regravar o mural inteiro). */
  const patchBoard = async (patch: BrainstormingBoardPatch) => {
    try {
      const updated = await brainstormingApi.patchBoard(boardId, patch);
      if (updated?.id) setBoardData(updated);
    } catch (e) {
      fail('Não foi possível salvar a alteração da sessão', e);
    }
  };

  const handlePhaseChange = useStableCallback((phase: BrainstormingPhase) => patchBoard({ phase }));

  const handleRename = useStableCallback((title: string) => patchBoard({ title }));

  const handleSetTimerDuration = useStableCallback((duration: number) => patchBoard({ timer: stoppedTimer(duration) }));

  const handleStartTimer = useStableCallback((duration: number) => patchBoard({ timer: runningTimer(duration, Date.now()) }));

  const handlePauseTimer = useStableCallback(() => {
    const next = pausedTimer(boardData?.timer, Date.now());
    if (next) return patchBoard({ timer: next });
  });

  const handleResumeTimer = useStableCallback(() => {
    const next = resumedTimer(boardData?.timer, Date.now());
    if (next) return patchBoard({ timer: next });
  });

  const handleResetTimer = useStableCallback(() => {
    const next = resetTimer(boardData?.timer);
    if (next) return patchBoard({ timer: next });
  });

  const handleToggleAnonymous = useStableCallback(() =>
    patchBoard({ settings: { isAnonymous: !boardData?.settings.isAnonymous } }));

  const handleTogglePresentationMode = useStableCallback(() =>
    patchBoard({ settings: { isPresentationMode: !boardData?.settings.isPresentationMode } }));

  const handleToggleReveal = useStableCallback(() =>
    patchBoard({ settings: { isRevealed: boardData?.settings.isRevealed === false } }));

  const handleVoteLimitChange = useStableCallback((value: number | null) => patchBoard({ votesPerParticipant: value }));

  const handleRestrictEditsChange = useStableCallback((value: boolean) => patchBoard({ settings: { restrictEdits: value } }));

  /**
   * Encerrar, reabrir, assumir e passar: o servidor devolve o mural novo. 404/405 = backend antigo (a função some, sem
   * erro na tela); 403/409 mostram a mensagem do servidor em português ("O facilitador está online.", etc.).
   */
  const runCeremony = async (action: CeremonyAction, call: () => Promise<BrainstormingBoard>, errorTitle: string, doneTitle: string) => {
    setCeremonyBusy(true);
    try {
      const updated = await call();
      if (updated?.id) setBoardData(updated);
      toast({ title: doneTitle });
    } catch (e) {
      if (isEndpointUnavailable(action, e)) {
        setCeremonyUnavailable(true);
        toast({ title: 'Função indisponível neste servidor', description: 'Ela entra quando o servidor for atualizado.' });
      } else {
        fail(errorTitle, e);
      }
    } finally {
      setCeremonyBusy(false);
    }
  };

  const handleFinish = useStableCallback(() => runCeremony('finish', () => brainstormingApi.finishBoard(boardId), 'Não foi possível encerrar o brainstorming', 'Brainstorming encerrado'));

  const handleReopen = useStableCallback(() => runCeremony('reopen', () => brainstormingApi.reopenBoard(boardId), 'Não foi possível reabrir o brainstorming', 'Brainstorming reaberto'));

  const handleClaimFacilitation = useStableCallback(() =>
    runCeremony('claim', () => brainstormingApi.claimFacilitation(boardId), 'Não foi possível assumir a facilitação', 'Você agora facilita a sessão'));

  const handleTransferFacilitation = useStableCallback((userId: string) =>
    runCeremony('transfer', () => brainstormingApi.transferFacilitation(boardId, userId), 'Não foi possível passar a facilitação', 'Facilitação passada'));

  const handleRemoveParticipant = useStableCallback(async (participantId: string) => {
    try {
      await brainstormingApi.leaveBoard(boardId, participantId);
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (e) {
      fail('Não foi possível remover o participante', e);
    }
  });

  /** Apaga o mural (só o facilitador); o servidor avisa a sala com BOARD_DELETED. */
  const handleDeleteBoard = useStableCallback(async () => {
    deletingSelf.current = true;
    try {
      await brainstormingApi.deleteBoard(boardId);
      toast({ title: 'Brainstorming apagado', description: boardData?.title });
      router.push('/brainstorming');
    } catch (e) {
      deletingSelf.current = false;
      fail('Não foi possível apagar o brainstorming', e);
    }
  });

  const handleOpenFeedback = useCallback(() => setFeedbackSignal(Date.now()), []);

  const retryLoad = () => {
    setLoadError(null);
    setIsBoardLoading(true);
    setAreIdeasLoading(true);
    setAreGroupsLoading(true);
    setAreParticipantsLoading(true);
    void reloadBoardData();
  };

  const goBack = () => router.push('/brainstorming');

  if (deleted) return <BrainstormRoomState kind="deleted" onBack={goBack} />;

  if (loadError === 'failed' && !boardData) return <BrainstormRoomState kind="error" onRetry={retryLoad} onBack={goBack} />;

  if (isLoading || isInitializing || isBoardLoading || areIdeasLoading || areGroupsLoading || areParticipantsLoading || !isAuthenticated || !userProfile) {
    if (!userProfile) {
      return <LoadingScreen message="Configurando identidade..." submessage="Preencha sua identidade para entrar na sessão" />;
    }
    return <BrainstormRoomState kind="loading" />;
  }

  if (!boardData) return <BrainstormRoomState kind="notfound" onBack={goBack} />;

  return (
    <>
      <BrainstormRoom
        boardId={boardId}
        boardData={boardData}
        ideas={ideas}
        groups={groups}
        participants={participants}
        onlineIds={presence.online}
        currentUserId={userProfile.id}
        isFacilitator={isFacilitator}
        mergingSourceId={mergingSourceId}
        connection={connection.status}
        squadLabel={squadLabel}
        onAddIdea={handleAddIdea}
        onDeleteIdea={handleDeleteIdea}
        onUpdateIdea={handleUpdateIdea}
        onVoteIdea={handleToggleVote}
        onStartMerge={setMergingSourceId}
        onExecuteMerge={handleMergeIdeas}
        onUpdateIdeaPosition={handleUpdateIdeaPosition}
        onConnectIdeas={handleConnectIdeas}
        onDisconnectIdea={handleDisconnectIdea}
        onMoveIdeaToGroup={handleMoveIdeaToGroup}
        onUpdateIdeaQualifiers={handleUpdateIdeaQualifiers}
        onAddGroup={handleAddGroup}
        onDeleteGroup={handleDeleteGroup}
        onPhaseChange={handlePhaseChange}
        onRename={handleRename}
        onToggleAnonymous={handleToggleAnonymous}
        onToggleReveal={handleToggleReveal}
        onTogglePresentation={handleTogglePresentationMode}
        onStartTimer={handleStartTimer}
        onPauseTimer={handlePauseTimer}
        onResumeTimer={handleResumeTimer}
        onResetTimer={handleResetTimer}
        onSetTimerDuration={handleSetTimerDuration}
        onRemoveParticipant={handleRemoveParticipant}
        onDeleteBoard={handleDeleteBoard}
        onOpenFeedback={handleOpenFeedback}
        isAdmin={isAdmin}
        ceremonyBusy={ceremonyBusy}
        ceremonyUnavailable={ceremonyUnavailable}
        onFinish={handleFinish}
        onReopen={handleReopen}
        onClaimFacilitation={handleClaimFacilitation}
        onTransferFacilitation={handleTransferFacilitation}
        onVoteLimitChange={handleVoteLimitChange}
        onRestrictEditsChange={handleRestrictEditsChange}
      />
      <FeedbackWidget toolName="Brainstorming" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </>
  );
}
