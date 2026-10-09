'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useCallback, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { brainstormingApi, type BrainstormingBoardPatch } from '../api';
import type {
  BrainstormingBoard,
  BrainstormingIdea,
  BrainstormingGroup,
  BrainstormingPhase,
} from '@/lib/types';
import { NotFound } from '@/components/NotFound';
import { useToast } from '@/hooks/use-toast';
import { useStableCallback } from '@/hooks/use-stable-callback';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useUserContext } from '@/context/UserContext';
import { getAuthToken } from '@/lib/auth-client';
import { errorMessage } from '@/lib/ceremony-api';
import { connectRoomSocket } from '@/lib/room-socket';
import { applyGroupDeleted, applyIdeaDeleted, upsertById } from '@/lib/brainstorming-utils';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { FeedbackWidget } from '@/components/feedback-widget';
import { MuralPhase } from '@/components/brainstorming/MuralPhase';
import { DiagramPhase } from '@/components/brainstorming/DiagramPhase';
import { BrainstormingToolbar } from '@/components/brainstorming/Toolbar';
import { GroupingPhase } from '@/components/brainstorming/GroupingPhase';
import { PrioritizationPhase } from '@/components/brainstorming/PrioritizationPhase';
import { ActionsPhase } from '@/components/brainstorming/ActionsPhase';
import { EliteSidebar } from '@/components/shared/EliteSidebar';
import { EliteParticipantList } from '@/components/shared/EliteParticipantList';
import { type Participant } from '@/lib/types';

export default function BrainstormingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const boardId = resolvedParams.id;

  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { userProfile, isInitializing } = useUserContext();

  const [boardData, setBoardData] = useState<BrainstormingBoard | null>(null);
  const [ideas, setIdeas] = useState<BrainstormingIdea[]>([]);
  const [groups, setGroups] = useState<BrainstormingGroup[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [areIdeasLoading, setAreIdeasLoading] = useState(true);
  const [areGroupsLoading, setAreGroupsLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);

  const [mergingSourceId, setMergingSourceId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();

  // Só a recarga mais recente vale: uma resposta lenta de uma recarga antiga não pode sobrescrever a nova.
  const reloadSeq = useRef(0);
  const joinAttempted = useRef(false);
  const isFacilitator = !!userProfile && boardData?.creatorId === userProfile.id;

  useEffect(() => {
    // O estado da sala não pode vazar de uma sala para outra ao trocar o id na URL.
    setBoardData(null);
    setIdeas([]);
    setGroups([]);
    setParticipants([]);
    setMergingSourceId(null);
    setIsBoardLoading(true);
    setAreIdeasLoading(true);
    setAreGroupsLoading(true);
    setAreParticipantsLoading(true);
    joinAttempted.current = false;
  }, [boardId]);

  useEffect(() => {
    const storedSoundPref = localStorage.getItem('brainstorming-sound-enabled');
    if (storedSoundPref !== null) {
      setIsSoundEnabled(storedSoundPref === 'true');
    }
  }, []);

  const handleSetIsSoundEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem('brainstorming-sound-enabled', String(enabled));
    setIsSoundEnabled(enabled);
  }, []);

  const reloadBoardData = useCallback(async () => {
    if (!isAuthenticated) return;
    const seq = ++reloadSeq.current;
    try {
      const [board, ideasList, groupsList, partsList] = await Promise.all([
        brainstormingApi.getBoard(boardId),
        brainstormingApi.getIdeas(boardId),
        brainstormingApi.getGroups(boardId),
        brainstormingApi.getParticipants(boardId)
      ]);
      if (seq !== reloadSeq.current) return;
      setBoardData(board);
      setIdeas(ideasList);
      setGroups(groupsList);
      setParticipants(partsList);
    } catch (e) {
      if (seq !== reloadSeq.current) return;
      console.error("Erro ao recarregar dados do Brainstorming:", e);
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
      onReconnect: reloadBoardData,
      onError: () => reloadBoardData(),
      onMessage: (message) => {
        const payload = message.payload as any;
        switch (message.type) {
          case 'BOARD_UPDATED':
            if (payload) setBoardData(payload);
            break;

          case 'BOARD_DELETED':
            toast({ title: 'Esta sessão foi encerrada', description: 'O facilitador apagou o mural.', variant: 'destructive' });
            router.push('/brainstorming');
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
  }, [boardId, reloadBoardData, isAuthenticated, router, toast]);

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

  // --- Handlers ---
  // useStableCallback: identidade fixa e sempre a versão mais recente (nada de closure velha sobre `ideas`),
  // então a teia e as listas não re-renderizam à toa nem agem sobre um estado antigo.

  /** Erro vira aviso na tela (com a mensagem do servidor), nunca só console. */
  const fail = (title: string, error: unknown, fallback = 'Tente novamente.') => {
    console.error(title, error);
    toast({ title, description: errorMessage(error, fallback), variant: 'destructive' });
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

  const handleAddGroup = useStableCallback(async (title: string): Promise<boolean> => {
    try {
      const created = await brainstormingApi.saveOrUpdateGroup(boardId, { title });
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

  const handleSetTimerDuration = useStableCallback((duration: number) =>
    patchBoard({ timer: { status: 'stopped', initialDuration: duration, remainingOnPause: duration, endTime: null } }));

  const handleStartTimer = useStableCallback((duration: number) =>
    patchBoard({ timer: { status: 'running', endTime: Date.now() + duration * 1000, initialDuration: duration, remainingOnPause: duration } }));

  const handlePauseTimer = useStableCallback(() => {
    const timer = boardData?.timer;
    if (!timer || !timer.endTime) return;
    const remaining = Math.max(0, Math.round((timer.endTime - Date.now()) / 1000));
    return patchBoard({ timer: { ...timer, status: 'paused', remainingOnPause: remaining } });
  });

  const handleResumeTimer = useStableCallback(() => {
    const timer = boardData?.timer;
    if (!timer) return;
    return patchBoard({ timer: { ...timer, status: 'running', endTime: Date.now() + timer.remainingOnPause * 1000 } });
  });

  const handleResetTimer = useStableCallback(() => {
    const timer = boardData?.timer;
    if (!timer) return;
    return patchBoard({ timer: { ...timer, status: 'stopped', endTime: null, remainingOnPause: timer.initialDuration } });
  });

  const handleToggleAnonymous = useStableCallback(() =>
    patchBoard({ settings: { isAnonymous: !boardData?.settings.isAnonymous } }));

  const handleTogglePresentationMode = useStableCallback(() =>
    patchBoard({ settings: { isPresentationMode: !boardData?.settings.isPresentationMode } }));

  const handleToggleReveal = useStableCallback(() =>
    patchBoard({ settings: { isRevealed: boardData?.settings.isRevealed === false } }));

  const handleCopyLink = useStableCallback(async () => {
    const ok = await copyToClipboard(window.location.href);
    toast(ok
      ? { title: 'Link copiado!', description: 'Convide seu time para a sessão.' }
      : { title: 'Não foi possível copiar o link', variant: 'destructive' });
  });

  const handleRemoveParticipant = useStableCallback(async (participantId: string) => {
    try {
      await brainstormingApi.leaveBoard(boardId, participantId);
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (e) {
      fail('Não foi possível remover o participante', e);
    }
  });

  if (isLoading || isInitializing || isBoardLoading || areIdeasLoading || areGroupsLoading || areParticipantsLoading || !isAuthenticated || !userProfile) {
     if (!userProfile) {
       return <LoadingScreen message="Configurando identidade..." submessage="Preencha sua identidade para entrar na sessão" />;
     }
     return <LoadingScreen message="Brainstorming" submessage="Inspirando mentes e conectando ideias..." />;
  }

  if (!boardData) return <NotFound resourceName="sessão de brainstorming" />;

  return (
    <div className="flex flex-col h-dvh w-full overflow-hidden bg-slate-50">
      <BrainstormingToolbar
        boardData={boardData}
        ideas={ideas}
        groups={groups}
        isCreator={isFacilitator}
        onPhaseChange={handlePhaseChange}
        onToggleAnonymous={handleToggleAnonymous}
        onExportImage={() => setIsExporting(true)}
        isParticipantsOpen={isParticipantsOpen}
        onToggleParticipants={setIsParticipantsOpen}
        timer={boardData.timer}
        onSetTimerDuration={handleSetTimerDuration}
        onStartTimer={handleStartTimer}
        onPauseTimer={handlePauseTimer}
        onResumeTimer={handleResumeTimer}
        onToggleReveal={handleToggleReveal}
        onResetTimer={handleResetTimer}
        isSoundEnabled={isSoundEnabled}
        onSetIsSoundEnabled={handleSetIsSoundEnabled}
        onTogglePresentationMode={handleTogglePresentationMode}
      />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 relative overflow-hidden">
          {boardData.phase === 'ideation' ? (
            <MuralPhase
              ideas={ideas}
              currentUserId={userProfile.id}
              onAddIdea={handleAddIdea}
              onDeleteIdea={handleDeleteIdea}
              onUpdateIdea={handleUpdateIdea}
              onVoteIdea={handleToggleVote}
              onStartMerge={setMergingSourceId}
              onExecuteMerge={handleMergeIdeas}
              mergingSourceId={mergingSourceId}
              isAnonymous={boardData.settings.isAnonymous}
              isRevealed={boardData.settings.isRevealed}
              isPresentationMode={boardData.settings.isPresentationMode}
              isExporting={isExporting}
              onExportComplete={() => setIsExporting(false)}
            />
          ) : boardData.phase === 'diagram' ? (
            <DiagramPhase
              ideas={ideas}
              boardId={boardId}
              currentUserId={userProfile.id}
              isAnonymous={boardData.settings.isAnonymous}
              isRevealed={boardData.settings.isRevealed}
              onVoteIdea={handleToggleVote}
              onUpdateIdea={handleUpdateIdea}
              onUpdatePosition={handleUpdateIdeaPosition}
              onConnectIdeas={handleConnectIdeas}
              onDisconnectIdea={handleDisconnectIdea}
              isExporting={isExporting}
              onExportComplete={() => setIsExporting(false)}
            />
          ) : boardData.phase === 'grouping' ? (
            <GroupingPhase
              ideas={ideas}
              groups={groups}
              currentUserId={userProfile.id}
              onAddGroup={handleAddGroup}
              onDeleteGroup={handleDeleteGroup}
              onMoveIdeaToGroup={handleMoveIdeaToGroup}
              isAnonymous={boardData.settings.isAnonymous}
              isRevealed={boardData.settings.isRevealed}
              onVoteIdea={handleToggleVote}
            />
          ) : boardData.phase === 'prioritization' ? (
            <PrioritizationPhase
              ideas={ideas}
              groups={groups}
              onUpdateQualifiers={handleUpdateIdeaQualifiers}
              isAnonymous={boardData.settings.isAnonymous}
            />
          ) : (
            <ActionsPhase
              ideas={ideas}
              groups={groups}
              boardData={boardData}
              onUpdateIdea={handleUpdateIdea}
              onMoveIdea={handleMoveIdeaToGroup}
            />
          )}
        </main>

        <EliteSidebar
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          title="PARTICIPANTES"
          participantsCount={participants.length}
          onCopyLink={handleCopyLink}
        >
          <EliteParticipantList
            participants={participants}
            currentUserId={userProfile.id}
            isFacilitator={isFacilitator}
            onRemoveParticipant={handleRemoveParticipant}
          />
        </EliteSidebar>
      </div>

      <FeedbackWidget toolName="Brainstorming" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}
