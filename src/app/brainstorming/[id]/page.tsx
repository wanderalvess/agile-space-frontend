'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useEffect, useCallback, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { brainstormingApi } from '../api';
import type { 
  BrainstormingBoard, 
  BrainstormingIdea, 
  BrainstormingGroup,
  BrainstormingPhase,
  TimerState 
} from '@/lib/types';
import { NotFound } from '@/components/NotFound';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useUserContext } from '@/context/UserContext';
import { getAuthToken } from '@/lib/auth-client';
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
    try {
      const [board, ideasList, groupsList, partsList] = await Promise.all([
        brainstormingApi.getBoard(boardId),
        brainstormingApi.getIdeas(boardId),
        brainstormingApi.getGroups(boardId),
        brainstormingApi.getParticipants(boardId)
      ]);
      setBoardData(board);
      setIdeas(ideasList);
      setGroups(groupsList);
      setParticipants(partsList);
    } catch (e) {
      console.error("Erro ao recarregar dados do Brainstorming:", e);
    } finally {
      setIsBoardLoading(false);
      setAreIdeasLoading(false);
      setAreGroupsLoading(false);
      setAreParticipantsLoading(false);
    }
  }, [boardId, isAuthenticated]);

  // Conexão WebSocket Nativa e Carga Inicial
  useEffect(() => {
    if (!isAuthenticated) return;

    reloadBoardData();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/brainstorming/') + boardId
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

            case 'IDEA_SAVED':
              if (payload.payload) {
                setIdeas(prev => {
                  const idx = prev.findIndex(i => i.id === payload.payload.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = payload.payload;
                    return copy;
                  }
                  return [...prev, payload.payload];
                });
              }
              break;

            case 'IDEA_DELETED':
              if (payload.payload?.ideaId) {
                setIdeas(prev => prev.filter(i => i.id !== payload.payload.ideaId));
              }
              break;

            case 'GROUP_SAVED':
              if (payload.payload) {
                setGroups(prev => {
                  const idx = prev.findIndex(g => g.id === payload.payload.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = payload.payload;
                    return copy;
                  }
                  return [...prev, payload.payload];
                });
              }
              break;

            case 'GROUP_DELETED':
              if (payload.payload?.groupId) {
                setGroups(prev => prev.filter(g => g.id !== payload.payload.groupId));
              }
              break;

            case 'REFRESH_BOARD':
            default:
              reloadBoardData();
              break;
          }
        } catch (e) {
          console.error("Erro ao processar mensagem do WebSocket do Brainstorming:", e);
          reloadBoardData();
        }
      };

      socket.onerror = (err) => {
        console.warn("WebSocket Brainstorming warning:", err);
      };
    } catch (err) {
      console.warn("Falha ao inicializar WebSocket do Brainstorming:", err);
    }

    return () => {
      isSubscribed = false;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [boardId, reloadBoardData, isAuthenticated]);

  // Sincroniza informações do participante
  useEffect(() => {
    if (!isAuthenticated || !boardData || !userProfile || !participants) return;

    const isAlreadyPart = participants.some(p => p.id === userProfile.id);
    if (isAlreadyPart) return;

    const newParticipant = {
      id: userProfile.id,
      boardId,
      nickname: userProfile.name,
      role: userProfile.role || 'DEV',
      isCreator: boardData.creatorId === userProfile.id,
      lastActive: new Date().toISOString()
    };

    brainstormingApi.joinBoard(boardId, newParticipant as any).catch(e => console.error("Erro ao entrar no mural:", e));
  }, [isAuthenticated, boardData, userProfile, participants, boardId]);

  // Título Dinâmico da Aba
  useEffect(() => {
    const baseTitle = "Espaço Ágil";
    const moduleName = "Brainstorming";
    const sessionName = boardData?.title || boardData?.team;
    
    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [boardData]);

  // Handlers
  const handleAddIdea = useCallback((content: string) => {
    if (!isAuthenticated || !userProfile || !boardId) return;
    const newIdea: Partial<BrainstormingIdea> = {
      boardId,
      content,
      authorId: userProfile.id,
      votes: JSON.parse("[]"),
      position: JSON.parse(JSON.stringify({ x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 })),
      parentId: undefined,
      createdAt: new Date().toISOString()
    };
    brainstormingApi.saveOrUpdateIdea(boardId, newIdea).catch(e => console.error(e));
  }, [isAuthenticated, userProfile, boardId]);

  const handleDeleteIdea = useCallback((ideaId: string) => {
    if (!boardId) return;
    brainstormingApi.deleteIdea(boardId, ideaId).catch(e => console.error(e));
  }, [boardId]);

  const handleToggleVote = useCallback((ideaId: string) => {
    if (!boardId || !isAuthenticated || !userProfile || !ideas) return;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    const currentVotes = Array.isArray(idea.votes) ? (idea.votes as unknown as string[]) : [];
    const newVotes = currentVotes.includes(userProfile.id)
      ? currentVotes.filter(uid => uid !== userProfile.id)
      : [...currentVotes, userProfile.id];

    brainstormingApi.saveOrUpdateIdea(boardId, {
      ...idea,
      votes: JSON.parse(JSON.stringify(newVotes))
    }).catch(e => console.error(e));
  }, [boardId, isAuthenticated, userProfile, ideas]);

  const handleMergeIdeas = useCallback(async (sourceId: string, targetId: string) => {
    if (!boardId || !ideas) return;
    
    const sourceIdea = ideas.find(i => i.id === sourceId);
    const targetIdea = ideas.find(i => i.id === targetId);
    
    if (!sourceIdea || !targetIdea) return;

    const currentTargetVotes = Array.isArray(targetIdea.votes) ? (targetIdea.votes as unknown as string[]) : [];
    const currentSourceVotes = Array.isArray(sourceIdea.votes) ? (sourceIdea.votes as unknown as string[]) : [];

    const newContent = `${targetIdea.content}\n- ${sourceIdea.content}`;
    const combinedVotes = Array.from(new Set([...currentTargetVotes, ...currentSourceVotes]));

    try {
      await brainstormingApi.saveOrUpdateIdea(boardId, {
        ...targetIdea,
        content: newContent,
        votes: JSON.parse(JSON.stringify(combinedVotes))
      });
      await brainstormingApi.deleteIdea(boardId, sourceId);
      toast({
        title: "Ideias Fundidas!",
        description: "Os textos e votos foram combinados com sucesso.",
      });
      setMergingSourceId(null);
    } catch (error) {
      console.error("Merge failure:", error);
      toast({
        title: "Erro na Fusão",
        description: "Não foi possível combinar as ideias no banco de dados.",
        variant: "destructive"
      });
    }
  }, [boardId, ideas, toast]);

  const handleUpdateIdeaPosition = useCallback((ideaId: string, x: number, y: number) => {
    if (!boardId || !ideas) return;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;
    
    brainstormingApi.saveOrUpdateIdea(boardId, {
      ...idea,
      position: JSON.parse(JSON.stringify({ x, y }))
    }).catch(e => console.error(e));
  }, [boardId, ideas]);

  const handleUpdateIdea = useCallback((ideaId: string, content: string) => {
    if (!boardId || !ideas) return;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    brainstormingApi.saveOrUpdateIdea(boardId, {
      ...idea,
      content
    }).catch(e => console.error(e));
  }, [boardId, ideas]);

  const handleConnectIdeas = useCallback((sourceId: string, targetId: string) => {
    if (!boardId || !ideas) return;
    const idea = ideas.find(i => i.id === targetId);
    if (!idea) return;
    
    brainstormingApi.saveOrUpdateIdea(boardId, {
      ...idea,
      parentId: sourceId
    }).catch(e => console.error(e));
  }, [boardId, ideas]);

  const handleDisconnectIdea = useCallback((ideaId: string) => {
    if (!boardId || !ideas) return;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    // Em vez de delete, enviamos o parentId nulo para desassociar na árvore
    const payload = { ...idea };
    delete (payload as any).parentId; // No Jackson do backend, parentId nulo remove a associação
    
    brainstormingApi.saveOrUpdateIdea(boardId, {
      ...idea,
      parentId: undefined
    }).catch(e => console.error(e));
  }, [boardId, ideas]);

  const handleAddGroup = useCallback(async (title: string) => {
    if (!boardId) return;
    const newGroup = {
      boardId,
      title,
      order: groups?.length || 0,
      createdAt: new Date().toISOString()
    };
    brainstormingApi.saveOrUpdateGroup(boardId, newGroup).catch(e => console.error(e));
  }, [boardId, groups?.length]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    if (!boardId) return;
    brainstormingApi.deleteGroup(boardId, groupId).catch(e => console.error(e));
  }, [boardId]);

  const handleMoveIdeaToGroup = useCallback((ideaId: string, groupId: string | null) => {
    if (!boardId || !ideas) return;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    brainstormingApi.saveOrUpdateIdea(boardId, {
      ...idea,
      groupId: groupId || undefined
    }).catch(e => console.error(e));
  }, [boardId, ideas]);

  const handleUpdateIdeaQualifiers = useCallback((ideaId: string, qualifiers: { roi?: number, effort?: number }) => {
    if (!boardId || !ideas) return;
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    brainstormingApi.saveOrUpdateIdea(boardId, {
      ...idea,
      qualifiers: JSON.parse(JSON.stringify(qualifiers))
    }).catch(e => console.error(e));
  }, [boardId, ideas]);

  const handlePhaseChange = useCallback((phase: BrainstormingPhase) => {
    if (!boardData) return;
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      phase
    }).catch(e => console.error(e));
  }, [boardData]);

  const handleSetTimerDuration = useCallback((duration: number) => {
    if (!boardData) return;
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      timer: JSON.parse(JSON.stringify({ status: 'stopped', initialDuration: duration, remainingOnPause: duration, endTime: null }))
    }).catch(e => console.error(e));
  }, [boardData]);

  const handleStartTimer = useCallback((duration: number) => {
    if (!boardData) return;
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      timer: JSON.parse(JSON.stringify({ status: 'running', endTime: Date.now() + duration * 1000, initialDuration: duration, remainingOnPause: duration }))
    }).catch(e => console.error(e));
  }, [boardData]);

  const handlePauseTimer = useCallback(() => {
    if (!boardData || !boardData.timer || !boardData.timer.endTime) return;
    const remaining = Math.max(0, Math.round((boardData.timer.endTime - Date.now()) / 1000));
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      timer: JSON.parse(JSON.stringify({ ...boardData.timer, status: 'paused', remainingOnPause: remaining }))
    }).catch(e => console.error(e));
  }, [boardData]);

  const handleResumeTimer = useCallback(() => {
    if (!boardData || !boardData.timer) return;
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      timer: JSON.parse(JSON.stringify({ ...boardData.timer, status: 'running', endTime: Date.now() + boardData.timer.remainingOnPause * 1000 }))
    }).catch(e => console.error(e));
  }, [boardData]);

  const handleResetTimer = useCallback(() => {
    if (!boardData || !boardData.timer) return;
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      timer: JSON.parse(JSON.stringify({ ...boardData.timer, status: 'stopped', endTime: null, remainingOnPause: boardData.timer.initialDuration }))
    }).catch(e => console.error(e));
  }, [boardData]);

  const handleToggleAnonymous = useCallback(() => {
    if (!boardData) return;
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      settings: {
        ...boardData.settings,
        isAnonymous: !boardData.settings.isAnonymous
      }
    }).catch(e => console.error(e));
  }, [boardData]);

  const handleTogglePresentationMode = useCallback(() => {
    if (!boardData) return;
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      settings: {
        ...boardData.settings,
        isPresentationMode: !boardData.settings.isPresentationMode
      }
    }).catch(e => console.error(e));
  }, [boardData]);

  const handleToggleReveal = useCallback(() => {
    if (!boardData) return;
    brainstormingApi.saveOrUpdateBoard({
      ...boardData,
      settings: {
        ...boardData.settings,
        isRevealed: boardData.settings.isRevealed === false
      }
    }).catch(e => console.error(e));
  }, [boardData]);

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
        ideas={ideas || []}
        groups={groups || []}
        isCreator={boardData.creatorId === userProfile?.id}
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
              ideas={ideas || []}
              currentUserId={userProfile?.id}
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
              ideas={ideas || []}
              boardId={boardId}
              isAnonymous={boardData.settings.isAnonymous}
              isRevealed={boardData.settings.isRevealed}
              {...({ isPresentationMode: boardData.settings.isPresentationMode } as any)}
              onConnect={handleConnectIdeas}
              onDisconnect={handleDisconnectIdea}
              onMove={handleUpdateIdeaPosition}
              currentUserId={userProfile?.id}
              isExporting={isExporting}
              onExportComplete={() => setIsExporting(false)}
            />
          ) : boardData.phase === 'grouping' ? (
            <GroupingPhase
              ideas={ideas || []}
              groups={groups || []}
              onAddGroup={handleAddGroup}
              onDeleteGroup={handleDeleteGroup}
              onMoveIdeaToGroup={handleMoveIdeaToGroup}
              {...({ isExporting, onExportComplete: () => setIsExporting(false) } as any)}
            />
          ) : boardData.phase === 'prioritization' ? (
            <PrioritizationPhase
              ideas={ideas || []}
              onUpdateQualifiers={handleUpdateIdeaQualifiers}
              {...({ isExporting, onExportComplete: () => setIsExporting(false) } as any)}
            />
          ) : (
            <ActionsPhase
              ideas={ideas || []}
              {...({ boardId, isExporting, onExportComplete: () => setIsExporting(false) } as any)}
            />
          )}
        </main>

        <EliteSidebar 
          isOpen={isParticipantsOpen} 
          onClose={() => setIsParticipantsOpen(false)} 
          title="PARTICIPANTES"
          {...({ participantsCount: participants?.length || 0, onCopyLink: () => {} } as any)}
        >
          <EliteParticipantList 
            participants={participants || []} 
            {...({ currentUserId: userProfile?.id || '', isFacilitator: boardData.creatorId === userProfile?.id, onRemoveParticipant: () => {} } as any)}
          />
        </EliteSidebar>
      </div>

      <FeedbackWidget toolName="Brainstorming" triggerVariant="none" externalTriggerSignal={feedbackSignal} />
    </div>
  );
}
