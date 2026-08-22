'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DeckType, Participant, Role, Room, Vote, VotingRound, Issue, GlobalRole, ConfidenceLevel } from '@/lib/types';
import { PokerRoom } from '@/components/poker/PokerRoom';
import { AsyncPokerRoom } from '@/components/poker/AsyncPokerRoom';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { NotFound } from '@/components/NotFound';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useUserContext } from '@/context/UserContext';
import { getAuthToken } from '@/lib/auth-client';
import { FeedbackWidget } from '@/components/feedback-widget';
import { isValidJiraKey } from '@/lib/utils';
import { canParticipantVote, getEligibleStatsVotes, getParticipantCategory, resolveTshirtHours, formatBaselineDisplay, computeSessionBreakdown, computeTopicTiming } from '@/lib/poker-utils';
import { useStableCallback } from '@/hooks/use-stable-callback';
import { pokerApi } from '../api';
import { authFetch } from '@/lib/auth-client';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useFirebase();
  const { userProfile, requestIdentity, isInitializing } = useUserContext();

  useEffect(() => {
    if (!isUserLoading && !userProfile) {
      requestIdentity();
    }
  }, [isUserLoading, userProfile, requestIdentity]);

  // Fallback seguro de offset de relógio local/servidor
  const clockOffset = 0;

  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<number | undefined>();
  const [hasJoined, setHasJoined] = useState(false);

  // States locais carregados via REST e sincronizados via WebSocket
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [votingRounds, setVotingRounds] = useState<VotingRound[]>([]);
  const [reactions, setReactions] = useState<{ id: string; uid: string; emoji: string; ts: string; nickname?: string }[]>([]);

  const [isRoomLoading, setIsRoomLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);

  const reactionsEnabled = !!roomData?.settings?.reactions;
  const currentUser = useMemo(() => participants?.find(p => p.id === user?.uid && p.roomId === roomId) || null, [participants, user, roomId]);
  const isCurrentUserFacilitator = useMemo(() => !!(user && roomData && (user.uid === roomData.creatorId || currentUser?.role === 'organizador')), [user, roomData, currentUser]);
  
  const currentUserVote = useMemo(() => votes?.find(v => v.participantId === currentUser?.id)?.value || null, [votes, currentUser]);
  const currentUserConfidence = useMemo(() => votes?.find(v => v.participantId === currentUser?.id)?.confidence || null, [votes, currentUser]);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  const reloadRoomData = useCallback(async () => {
    if (!user) return;
    try {
      const [room, partsList, votesList, roundsList] = await Promise.all([
        pokerApi.getRoom(roomId),
        pokerApi.getParticipants(roomId),
        pokerApi.getVotes(roomId),
        pokerApi.getRounds(roomId, 100)
      ]);
      setRoomData(room);
      setParticipants(partsList);
      setVotes(votesList);
      setVotingRounds(roundsList);
    } catch (e) {
      console.error("Erro ao carregar dados da sala de Poker:", e);
    } finally {
      setIsRoomLoading(false);
      setAreParticipantsLoading(false);
    }
  }, [roomId, user]);

  // Conexão WebSocket e Carga Inicial
  useEffect(() => {
    if (!user) return;

    reloadRoomData();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/poker/') + roomId
      + '?token=' + encodeURIComponent(getAuthToken() || '');

    console.log("Conectando ao WebSocket do Poker Room:", wsUrl);
    let socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'ROOM_UPDATED':
            if (data.payload) {
              setRoomData(data.payload);
            }
            break;

          case 'PARTICIPANT_JOINED':
            if (data.payload) {
              setParticipants(prev => {
                const idx = prev.findIndex(p => p.id === data.payload.id);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = data.payload;
                  return updated;
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

          case 'VOTE_SAVED':
            if (data.payload) {
              setVotes(prev => {
                const idx = prev.findIndex(v => v.participantId === data.payload.participantId);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = data.payload;
                  return updated;
                }
                return [...prev, data.payload];
              });
            }
            break;

          case 'VOTE_REMOVED':
            if (data.payload?.userId) {
              setVotes(prev => prev.filter(v => v.participantId !== data.payload.userId));
            }
            break;

          case 'VOTES_CLEARED':
            setVotes([]);
            break;

          case 'ROUND_SAVED':
            if (data.payload) {
              setVotingRounds(prev => {
                const exists = prev.some(r => r.id === data.payload.id);
                if (exists) {
                  return prev.map(r => r.id === data.payload.id ? data.payload : r);
                }
                return [data.payload, ...prev];
              });
            }
            break;

          case 'ROUNDS_CLEARED':
            setVotingRounds([]);
            break;

          case 'REACTION':
            setReactions(prev => {
              const updated = [...prev, {
                id: generateId(),
                uid: data.uid,
                emoji: data.emoji,
                ts: data.ts,
                nickname: data.nickname
              }];
              return updated.slice(-20);
            });
            break;

          case 'REFRESH_ROOM':
          default:
            reloadRoomData();
            break;
        }
      } catch (err) {
        console.error("Erro ao processar mensagem do WebSocket:", err);
        reloadRoomData();
      }
    };

    socket.onclose = () => {
      console.warn("Conexão WebSocket fechada. Tentando reconectar...");
      setTimeout(() => {
        reloadRoomData();
      }, 5000);
    };

    return () => {
      socket.close();
    };
  }, [roomId, user, reloadRoomData]);

  useEffect(() => {
    setHasJoined(false);
  }, [roomId]);

  // 3. IDENTIDADE GLOBAL E REGISTRO AUTOMÁTICO
  const mapGlobalToPokerRole = (role: GlobalRole | undefined): Role => {
    switch (role) {
      case 'QA':
      case 'Analista de QA':
        return 'qa';
      case 'Agile Master':
      case 'Scrum Master':
      case 'Scrum Master / Agile Coach':
      case 'Product Owner':
      case 'Product Owner (PO)':
      case 'Tech Lead':
      case 'Arquiteto(a) / Tech Lead':
      case 'People Lead':
      case 'SME':
        return 'organizador';
      case 'Stakeholder / Observador':
        return 'spectator';
      case 'Designer':
      case 'UX':
      case 'Designer / UI-UX':
      case 'Developer':
      case 'Desenvolvedor(a)':
      default:
        return 'dev';
    }
  };

  useEffect(() => {
    if (isUserLoading || !user || !userProfile || !roomData || hasJoined) {
      return;
    }

    const runJoin = async () => {
      try {
        const existingParts = await pokerApi.getParticipants(roomId);
        const alreadyInThisRoom = existingParts.some(p => p.id === user.uid);

        if (!alreadyInThisRoom) {
          const newParticipant: Participant = {
            id: user.uid,
            roomId: roomId,
            nickname: userProfile.name,
            email: userProfile.email || '',
            role: mapGlobalToPokerRole(userProfile.role),
            globalRole: userProfile.role,
            isFacilitator: user.uid === roomData.creatorId,
          };
          await pokerApi.joinRoom(roomId, newParticipant);
        }

        const currentParticipantIds = roomData.participantIds || [];
        if (!currentParticipantIds.includes(user.uid)) {
          await pokerApi.saveOrUpdateRoom({
            ...roomData,
            participantIds: [...currentParticipantIds, user.uid]
          });
        }
        reloadRoomData();
      } catch (error) {
        console.error('Falha ao entrar na sala:', error);
        toast({
          title: 'Não foi possível entrar na sala',
          description: 'Verifique sua conexão e tente novamente.',
          variant: 'destructive',
        });
      }
    };

    runJoin();
  }, [user, userProfile, roomData, isUserLoading, roomId, hasJoined, toast, reloadRoomData]);

  // 3.1 SINCRONIZAÇÃO DE PERFIL
  const lastSyncedProfileRef = useRef<{ name: string; role: string; email?: string } | null>(null);
  useEffect(() => {
    if (!user || !userProfile || !currentUser) return;

    if (
      lastSyncedProfileRef.current && 
      lastSyncedProfileRef.current.name === userProfile.name && 
      lastSyncedProfileRef.current.role === userProfile.role &&
      lastSyncedProfileRef.current.email === (userProfile.email || '')
    ) return;

    const needsNameUpdate = currentUser.nickname !== userProfile.name;
    const needsRoleUpdate = currentUser.globalRole !== userProfile.role;
    const needsEmailUpdate = (currentUser.email || '') !== (userProfile.email || '');

    if (needsNameUpdate || needsRoleUpdate || needsEmailUpdate) {
      const updates = { ...currentUser };
      if (needsNameUpdate) updates.nickname = userProfile.name;
      if (needsEmailUpdate) updates.email = userProfile.email || '';
      if (needsRoleUpdate) {
        updates.globalRole = userProfile.role;
        updates.role = mapGlobalToPokerRole(userProfile.role);
      }
      lastSyncedProfileRef.current = { 
        name: userProfile.name, 
        role: userProfile.role,
        email: userProfile.email || ''
      };
      pokerApi.joinRoom(roomId, updates).catch(err => console.error(err));
    } else {
      lastSyncedProfileRef.current = { 
        name: userProfile.name, 
        role: userProfile.role,
        email: userProfile.email || ''
      };
    }
  }, [user, userProfile, currentUser, roomId]);

  useEffect(() => {
    setHasJoined(!!currentUser);
  }, [currentUser]);

  // Heartbeat de presença: envia lastSeen silenciosamente via REST a cada 25s
  useEffect(() => {
    if (!currentUser) return;
    const beat = () => {
      pokerApi.sendHeartbeat(roomId, currentUser.id).catch(err => console.error("Heartbeat error", err));
    };
    beat();
    const interval = setInterval(beat, 25000);
    return () => clearInterval(interval);
  }, [currentUser?.id, roomId]);

  // Início explícito da cerimônia: o facilitador aperta "Iniciar Refinamento".
  const handleStartSession = useCallback(() => {
    if (!roomData || !isCurrentUserFacilitator) return;
    const now = new Date().toISOString();
    const newQueue = (roomData.issuesQueue || []).map(i =>
      i.id === roomData.activeIssueId ? { ...i, startedAt: now } : i
    );
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      sessionStartedAt: now,
      sessionEndedAt: undefined,
      issuesQueue: newQueue,
    }).then(() => {
      toast({ title: 'Refinamento iniciado!', description: 'O cronômetro da sessão começou agora.' });
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, toast]);

  // Carimba startedAt da tarefa ativa de forma automática
  useEffect(() => {
    if (!isCurrentUserFacilitator || !roomData) return;
    if (!roomData.sessionStartedAt || roomData.sessionEndedAt || !roomData.activeIssueId) return;
    const active = (roomData.issuesQueue || []).find(i => i.id === roomData.activeIssueId);
    if (!active || active.startedAt) return;
    const now = new Date().toISOString();
    
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: (roomData.issuesQueue || []).map(i =>
        i.id === roomData.activeIssueId ? { ...i, startedAt: now } : i
      ),
    }).catch(err => console.error(err));
  }, [isCurrentUserFacilitator, roomData]);

  // Título Dinâmico da Aba
  useEffect(() => {
    const baseTitle = "Espaço Ágil";
    const moduleName = "Scrum Poker";
    const sessionName = roomData?.title || roomData?.team;
    
    if (sessionName) {
      document.title = `${sessionName} | ${moduleName} | ${baseTitle}`;
    } else {
      document.title = `${moduleName} | ${baseTitle}`;
    }
  }, [roomData]);

  useEffect(() => {
    if (hasJoined && !currentUser && participants.length > 0) {
      toast({
        title: "Você saiu da sala",
        description: "Você foi removido ou a sessão expirou.",
      });
      router.push('/');
    }
  }, [hasJoined, currentUser, participants, router, toast]);

  useEffect(() => {
    const storedSoundPref = localStorage.getItem('poker-sound-enabled');
    if (storedSoundPref !== null) {
      setIsSoundEnabled(storedSoundPref === 'true');
    }
  }, []);

  const handleSetIsSoundEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem('poker-sound-enabled', String(enabled));
    setIsSoundEnabled(enabled);
  }, []);

  const handleUpdateSettings = useCallback((newSettings: Partial<NonNullable<Room['settings']>>) => {
    if (!isCurrentUserFacilitator || !roomData || !newSettings) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      settings: { ...roomData.settings, ...newSettings }
    }).catch(err => console.error(err));
  }, [isCurrentUserFacilitator, roomData]);

  const handleUpdateParticipantRole = useCallback((participantId: string, newRole: Role) => {
    if (!isCurrentUserFacilitator || !participants) return;
    const target = participants.find(p => p.id === participantId);
    if (!target) return;
    pokerApi.joinRoom(roomId, {
      ...target,
      role: newRole
    }).catch(err => console.error(err));
  }, [isCurrentUserFacilitator, participants, roomId]);

  const handleVote = useCallback((voteValue: string) => {
    if (!currentUser || !roomData) return;
    if (!canParticipantVote(currentUser, roomData.settings?.allowManagementToVote)) return;
    
    if (voteValue === currentUserVote) {
      pokerApi.removeVote(roomId, currentUser.id).catch(err => console.error(err));
      return;
    }

    const newVote: Partial<Vote> = {
      id: roomId + "_" + currentUser.id,
      participantId: currentUser.id,
      roomId: roomId,
      value: voteValue,
      timestamp: new Date().toISOString(),
      participantNickname: currentUser.nickname,
      participantRole: currentUser.role,
      participantGlobalRole: currentUser.globalRole,
      issueId: roomData.activeIssueId || undefined
    };
    pokerApi.saveVote(roomId, newVote).catch(err => console.error(err));
  }, [currentUser, currentUserVote, roomId, roomData]);

  const handleSetConfidence = useCallback((confidence: ConfidenceLevel) => {
    if (!currentUser || !currentUserVote) return;
    
    const voteId = roomId + "_" + currentUser.id;
    const updatedConfidence = confidence === currentUserConfidence ? undefined : confidence;
    pokerApi.saveVote(roomId, {
      id: voteId,
      participantId: currentUser.id,
      roomId: roomId,
      value: currentUserVote,
      timestamp: new Date().toISOString(),
      confidence: updatedConfidence
    }).catch(err => console.error(err));
  }, [currentUser, currentUserVote, currentUserConfidence, roomId]);

  // Envia reações flutuantes através da rota do proxy de WebSocket do Spring Boot
  const handleReact = useCallback((emoji: string) => {
    if (!currentUser) return;
    pokerApi.sendReaction(roomId, {
      uid: currentUser.id,
      emoji,
      nickname: currentUser.nickname,
      ts: new Date().toISOString(),
    }).catch(err => console.error(err));
  }, [currentUser, roomId]);

  const handleSetDecisionNote = useCallback((note: string) => {
    if (!roomData?.issuesQueue || !roomData.activeIssueId || !isCurrentUserFacilitator) return;
    const newQueue = roomData.issuesQueue.map(i =>
      i.id === roomData.activeIssueId ? { ...i, decisionNote: note.trim() || null } : i
    );
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator]);

  const handleUpdateRefinementNotes = useCallback((notes: { devNotes?: string; qaNotes?: string }) => {
    if (!roomData?.issuesQueue || !roomData.activeIssueId || !isCurrentUserFacilitator) return;
    const newQueue = roomData.issuesQueue.map(i =>
      i.id === roomData.activeIssueId
        ? { ...i, devNotes: notes.devNotes?.trim() || null, qaNotes: notes.qaNotes?.trim() || null }
        : i
    );
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator]);

  const handleReveal = useCallback(() => {
    if (!participants || !votes || votes.length === 0 || !roomData || !isCurrentUserFacilitator) return;

    const statsVotes = getEligibleStatsVotes(votes, participants, roomData.settings?.allowManagementToVote);
    const allVoteValues = statsVotes.map(v => v.value);
    const numericVotes = allVoteValues.filter((v): v is string => v !== null && !isNaN(Number(v))).map(Number);
    const stats: VotingRound['stats'] = { avg: 'N/A', min: 'N/A', max: 'N/A', consensus: false };
    
    if (allVoteValues.length > 0) {
      stats.consensus = allVoteValues.length > 1 && new Set(allVoteValues).size === 1;
      if (roomData.deckType === 'tshirt') {
        const numericTshirtVotes = allVoteValues
          .map(v => resolveTshirtHours(v, roomData.settings?.tshirtEquivalents))
          .filter(n => !isNaN(n));
        if (numericTshirtVotes.length > 0) {
          const sum = numericTshirtVotes.reduce((acc, val) => acc + val, 0);
          stats.avg = String(Math.ceil(sum / numericTshirtVotes.length));
          stats.min = String(Math.min(...numericTshirtVotes));
          stats.max = String(Math.max(...numericTshirtVotes));
        } else {
          const voteCounts = allVoteValues.reduce((acc, value) => { acc[value] = (acc[value] || 0) + 1; return acc; }, {} as Record<string, number>);
          stats.avg = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
        }
      } else if (numericVotes.length > 0) {
        const sum = numericVotes.reduce((acc, val) => acc + val, 0);
        stats.avg = String(Math.ceil(sum / numericVotes.length));
        stats.min = String(Math.min(...numericVotes));
        stats.max = String(Math.max(...numericVotes));
      }
    }

    const activeIssue = roomData.issuesQueue?.find(i => i.id === roomData.activeIssueId);
    const topicName = activeIssue?.title || roomData.currentTopic || 'Tópico não definido';

    const newRound: Partial<VotingRound> = {
      roomId: roomId,
      topic: topicName,
      issueId: roomData.activeIssueId || undefined,
      deckType: roomData.deckType,
      votes: votes,
      stats: stats,
      timestamp: new Date().toISOString(),
    };

    pokerApi.saveRound(roomId, newRound).then(() => {
      pokerApi.saveOrUpdateRoom({
        ...roomData,
        votesRevealed: true,
        selectiveRevotingRole: null
      });
    }).catch(err => console.error(err));
  }, [participants, votes, roomData, isCurrentUserFacilitator, roomId]);

  // Auto-revelar
  useEffect(() => {
    if (!roomData?.settings?.autoReveal || !isCurrentUserFacilitator) return;
    if (roomData.votesRevealed || !roomData.activeIssueId) return;
    if (!participants || !votes || votes.length === 0) return;

    const eligible = participants.filter(p => canParticipantVote(p, roomData.settings?.allowManagementToVote));
    if (eligible.length === 0) return;

    const votedIds = new Set(votes.map(v => v.participantId));
    if (eligible.every(p => votedIds.has(p.id))) {
      handleReveal();
    }
  }, [roomData, participants, votes, isCurrentUserFacilitator, handleReveal]);

  const handleClear = useCallback(() => {
    if (!roomData || !isCurrentUserFacilitator) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      votesRevealed: false,
      selectiveRevotingRole: null
    }).then(() => {
      pokerApi.clearVotes(roomId);
    }).catch(error => {
      console.error('Erro ao limpar votos:', error);
      toast({
        title: 'Erro ao limpar votos',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    });
  }, [roomData, isCurrentUserFacilitator, roomId, toast]);

  const handleSelectiveRevote = useCallback((targetCategory: string) => {
    if (!votes || !participants || !roomData || !isCurrentUserFacilitator) return;

    const targetUserIds = new Set(
      participants.filter(p => getParticipantCategory(p) === targetCategory).map(p => p.id)
    );

    pokerApi.saveOrUpdateRoom({
      ...roomData,
      votesRevealed: false,
      selectiveRevotingRole: targetCategory,
    }).then(() => {
      votes.forEach(vote => {
        if (targetUserIds.has(vote.participantId)) {
          pokerApi.removeVote(roomId, vote.participantId).catch(console.error);
        }
      });
    }).catch(error => {
      console.error('Erro ao revotar seletivamente:', error);
      toast({
        title: 'Erro ao iniciar revotação',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    });
  }, [votes, participants, roomData, isCurrentUserFacilitator, roomId, toast]);

  const handleAddIssue = useCallback((title: string, jiraLink?: string, type: Issue['type'] = 'dev', extraData?: Partial<Issue>) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    const newIssue: Issue = {
      id: generateId(),
      title,
      key: isValidJiraKey(title) ? title : null,
      jiraLink: jiraLink || '',
      status: 'pending',
      estimatedPoints: null,
      type,
      ...(extraData || {})
    };
    const currentQueue = roomData.issuesQueue || [];
    const newQueue = [...currentQueue, newIssue];
    const updates: Partial<Room> = { ...roomData, issuesQueue: newQueue };

    if (!roomData.activeIssueId || currentQueue.length === 0) {
      newIssue.status = 'active';
      updates.activeIssueId = newIssue.id;
    }

    pokerApi.saveOrUpdateRoom(updates).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator]);

  const handleBulkAddIssues = useCallback((items: Partial<Issue>[]) => {
    if (!roomData || !isCurrentUserFacilitator) return;

    const currentQueue = roomData.issuesQueue || [];
    const existingKeys = new Set(currentQueue.map(i => i.key).filter(Boolean));

    const newIssues: Issue[] = items
      .filter(item => {
        const key = item.key || (isValidJiraKey(item.title || '') ? item.title : null);
        return !(key && existingKeys.has(key));
      })
      .map(item => ({
        id: generateId(),
        title: item.title || 'Sem Título',
        key: item.key || (isValidJiraKey(item.title || '') ? item.title : null),
        jiraLink: item.jiraLink || '',
        status: 'pending',
        estimatedPoints: null,
        type: item.type || 'dev',
        description: item.description || '',
        jiraType: item.jiraType || '',
        jiraStatus: item.jiraStatus || '',
        jiraPriority: item.jiraPriority || '',
        jiraAssignee: item.jiraAssignee || '',
        jiraUpdated: item.jiraUpdated || '',
        jiraLabels: item.jiraLabels || [],
        acceptanceCriteria: item.acceptanceCriteria || '',
        jiraPoints: item.jiraPoints || '',
      }));

    if (newIssues.length === 0) return;

    const newQueue = [...currentQueue, ...newIssues];
    const updates: Partial<Room> = { ...roomData, issuesQueue: newQueue };

    if (!roomData.activeIssueId || currentQueue.length === 0) {
      if (newIssues.length > 0) {
        newIssues[0].status = 'active';
        updates.activeIssueId = newIssues[0].id;
      }
    }

    pokerApi.saveOrUpdateRoom(updates).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator]);

  const handleSelectIssue = useCallback((issueId: string, autoSavePoints?: { points: string; devPoints?: string; qaPoints?: string }) => {
    if (!roomData || !roomData.issuesQueue || !isCurrentUserFacilitator) return;
    
    let newQueue = [...roomData.issuesQueue];

    if (autoSavePoints && roomData.activeIssueId) {
      newQueue = newQueue.map(i => {
        if (i.id === roomData.activeIssueId) {
          return {
            ...i,
            status: 'completed' as const,
            estimatedPoints: autoSavePoints.points,
            devPoints: autoSavePoints.devPoints || null,
            qaPoints: autoSavePoints.qaPoints || null
          };
        }
        return i;
      });
    }

    newQueue = newQueue.map(i => {
      if (i.id === issueId) return { ...i, status: 'active' as const, startedAt: null };
      if (i.status === 'active' && i.id !== issueId) return { ...i, status: 'pending' as const };
      return i;
    });

    const targetIssue = newQueue.find(i => i.id === issueId);

    pokerApi.saveOrUpdateRoom({
      ...roomData,
      activeIssueId: issueId,
      currentTopic: targetIssue?.title || roomData.currentTopic,
      issuesQueue: newQueue,
      votesRevealed: false,
      sessionEndedAt: undefined,
    }).then(() => {
      handleClear();
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, handleClear]);

  const handleRevoteIssue = useCallback((issueId: string) => {
    if (!roomData || !roomData.issuesQueue || !isCurrentUserFacilitator) return;

    const newQueue = roomData.issuesQueue.map((i) => {
      if (i.id === issueId) {
        return {
          ...i,
          status: 'active',
          estimatedPoints: null,
          devPoints: null,
          qaPoints: null,
          rolePoints: null,
          skipped: false,
          note: null,
          startedAt: null,
        } as Issue;
      }
      if (i.status === 'active') {
        return { ...i, status: 'pending' } as Issue;
      }
      return i;
    });

    const targetIssue = newQueue.find(i => i.id === issueId);

    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: issueId,
      currentTopic: targetIssue?.title || roomData.currentTopic,
      votesRevealed: false,
      sessionEndedAt: undefined,
    }).then(() => {
      handleClear();
      toast({ title: "Tarefa reaberta para votação" });
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, handleClear, toast]);

  const handleDeleteIssue = useCallback((issueId: string) => {
    if (!roomData || !roomData.issuesQueue || !isCurrentUserFacilitator) return;

    const isDeletingActive = issueId === roomData.activeIssueId;
    const newQueue = roomData.issuesQueue.filter(i => i.id !== issueId);

    let nextActiveId = roomData.activeIssueId;

    if (isDeletingActive) {
      const nextPending = newQueue.find(i => i.status === 'pending');
      if (nextPending) {
        nextPending.status = 'active';
        nextActiveId = nextPending.id;
      } else {
        nextActiveId = null;
      }
      handleClear();
    }

    const nextActive = newQueue.find(i => i.id === nextActiveId);

    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: nextActiveId,
      currentTopic: nextActive?.title || roomData.currentTopic,
      votesRevealed: isDeletingActive ? false : roomData.votesRevealed
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, handleClear]);

  const buildSessionClosure = useCallback((newQueue: Issue[]): Partial<Room> => {
    const rounds = votingRounds || [];
    const sessionEnd = new Date().toISOString();

    const firstVoteMs = rounds
      .flatMap(r => (r.votes || []).map(v => new Date(v.timestamp).getTime()))
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b)[0];
    const sessionStart =
      roomData?.sessionStartedAt ||
      (firstVoteMs ? new Date(firstVoteMs).toISOString() : sessionEnd);

    const breakdown = computeSessionBreakdown(newQueue, rounds);
    const timing = computeTopicTiming(rounds, newQueue, sessionStart);

    const activeMins = timing.reduce((s, r) => s + r.mins, 0);
    const idleMins = timing.reduce((s, r) => s + r.idleMins, 0);
    const rawMins = Math.max(
      0,
      Math.round((new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()) / 60000)
    );
    const durationMins = activeMins > 0 ? activeMins : rawMins;

    const estimatedIssues = newQueue.filter(i => !i.skipped && i.status === 'completed');
    const skippedIssues = newQueue.filter(i => i.skipped);
    const parkedIssues = newQueue.filter(i => (i.parkCount || 0) > 0);
    const untouchedIssues = newQueue.filter(i => !i.skipped && i.status !== 'completed');

    const totalPoints = estimatedIssues.reduce((acc, issue) => {
      const p = parseFloat(issue.estimatedPoints || '0');
      return acc + (isNaN(p) ? 0 : p);
    }, 0);

    return {
      sessionStartedAt: sessionStart,
      sessionEndedAt: sessionEnd,
      summary: {
        estimatedTasks: estimatedIssues.map(i => ({ title: i.title, points: i.estimatedPoints })),
        skippedTasks: skippedIssues.map(i => ({ title: i.title, note: i.note || null })),
        parkedTasks: parkedIssues.map(i => ({
          title: i.title,
          note: i.parkedNote || null,
          times: i.parkCount || 0,
          resolved: i.status === 'completed' && !i.skipped,
        })),
        untouchedTasks: untouchedIssues.map(i => ({ title: i.title })),
        breakdown,
        stats: {
          totalTopics: breakdown.estimated,
          discussedTopics: breakdown.discussed,
          skippedTopics: breakdown.skipped,
          parkedTopics: breakdown.parked,
          untouchedTopics: breakdown.untouched,
          totalPoints,
          durationStr: `${durationMins} min`,
          idleStr: idleMins > 0 ? `${idleMins} min` : null,
          avgTimePerTopic:
            breakdown.discussed > 0
              ? `${(durationMins / breakdown.discussed).toFixed(1)} min/item`
              : '0 min/item',
        },
      },
    };
  }, [roomData?.sessionStartedAt, votingRounds]);

  const handleCompleteIssue = useCallback((points: string, devPoints?: string, qaPoints?: string, rolePoints?: Record<string, string>) => {
    if (!roomData || !roomData.issuesQueue || !roomData.activeIssueId || !isCurrentUserFacilitator) return;

    const currentIndex = roomData.issuesQueue.findIndex(i => i.id === roomData.activeIssueId);
    if (currentIndex === -1) return;

    const newQueue = [...roomData.issuesQueue];
    newQueue[currentIndex] = {
      ...newQueue[currentIndex],
      status: 'completed',
      estimatedPoints: points,
      devPoints: devPoints || null,
      qaPoints: qaPoints || null,
      rolePoints: rolePoints || null,
      parked: false,
    };

    let nextIssueId: string | null = null;
    let nextIndex = newQueue.findIndex((i, idx) => idx > currentIndex && i.status === 'pending');
    if (nextIndex === -1) {
      nextIndex = newQueue.findIndex(i => i.status === 'pending');
    }

    if (nextIndex !== -1) {
      newQueue[nextIndex].status = 'active';
      nextIssueId = newQueue[nextIndex].id;
    }

    const nextIssue = newQueue.find(i => i.id === nextIssueId);

    let updates: Partial<Room> = {
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: nextIssueId,
      currentTopic: nextIssue?.title || roomData.currentTopic,
      votesRevealed: false
    };

    if (!nextIssueId) {
      updates = { ...updates, ...buildSessionClosure(newQueue) };
    }

    pokerApi.saveOrUpdateRoom(updates).then(() => {
      const activeIssue = roomData.issuesQueue![currentIndex];
      if (activeIssue && activeIssue.key && roomData.team) {
        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api'}/work-items/${roomData.team}/${activeIssue.key}/estimate`;
        authFetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points_estimated: Number(points) })
        }).catch(err => console.error("Erro ao salvar pontos no backend", err));
      }

      const lastRound = votingRounds.find(r => r.issueId === roomData.activeIssueId);
      if (lastRound) {
        pokerApi.saveRound(roomId, {
          ...lastRound,
          stats: {
            ...lastRound.stats,
            avg: points
          },
          devPoints: devPoints || undefined,
          qaPoints: qaPoints || undefined,
          rolePoints: rolePoints as any
        }).catch(console.error);
      }
      handleClear();
      toast({ title: "Estimativa Salva!" });
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, votingRounds, roomId, handleClear, buildSessionClosure, toast]);

  const handleFinishSession = useCallback(() => {
    if (!roomData || !isCurrentUserFacilitator) return;
    const newQueue = (roomData.issuesQueue || []).map(i =>
      i.status === 'active' ? { ...i, status: 'pending' as const, startedAt: null } : i
    );
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: null,
      currentTopic: '',
      votesRevealed: false,
      ...buildSessionClosure(newQueue),
    }).then(() => {
      handleClear();
      const pendentes = newQueue.filter(i => !i.skipped && i.status !== 'completed').length;
      toast({
        title: 'Refinamento encerrado',
        description: pendentes > 0
          ? `${pendentes} tarefa(s) ficaram como não abordadas no relatório.`
          : 'Relatório da sessão disponível.',
      });
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, buildSessionClosure, handleClear, toast]);

  const handleParkIssue = useCallback((note: string) => {
    if (!roomData || !roomData.issuesQueue || !roomData.activeIssueId || !isCurrentUserFacilitator) return;
    const currentId = roomData.activeIssueId;
    const current = roomData.issuesQueue.find(i => i.id === currentId);
    if (!current) return;

    const rest = roomData.issuesQueue.filter(i => i.id !== currentId);
    
    // Procura primeiro a próxima tarefa pendente não-adiada
    let nextPending = rest.find(i => i.status === 'pending' && !i.parked);
    // Se não houver não-adiada, procura qualquer pendente
    if (!nextPending) {
      nextPending = rest.find(i => i.status === 'pending');
    }

    const parked: Issue = {
      ...current,
      status: 'pending',
      parked: true,
      parkCount: (current.parkCount || 0) + 1,
      parkedNote: note.trim() || null,
      startedAt: null,
      estimatedPoints: null,
      devPoints: null,
      qaPoints: null,
      rolePoints: null,
    };

    let newQueue = rest.map(i => (nextPending && i.id === nextPending.id ? { ...i, status: 'active' as const } : i));
    newQueue.push(parked);

    const nextActiveId = nextPending ? nextPending.id : null;
    const nextTopic = nextPending ? nextPending.title : '';

    let updates: Partial<Room> = {
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: nextActiveId,
      currentTopic: nextTopic,
      votesRevealed: false,
    };

    if (!nextActiveId) {
      updates = { ...updates, ...buildSessionClosure(newQueue) };
    }

    pokerApi.saveOrUpdateRoom(updates).then(() => {
      handleClear();
      toast({ title: 'Tarefa adiada', description: 'Volta pro fim da fila para revisitar.' });
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, handleClear, toast, buildSessionClosure]);

  const handleSkipIssue = useCallback((note: string) => {
    if (!roomData || !roomData.issuesQueue || !roomData.activeIssueId || !isCurrentUserFacilitator) return;

    const currentIndex = roomData.issuesQueue.findIndex(i => i.id === roomData.activeIssueId);
    if (currentIndex === -1) return;

    const skippedIssue = roomData.issuesQueue[currentIndex];
    const newQueue = [...roomData.issuesQueue];
    newQueue[currentIndex] = {
      ...newQueue[currentIndex],
      status: 'completed',
      estimatedPoints: null,
      skipped: true,
      note: note.trim() || null,
    };

    let nextIssueId: string | null = null;
    let nextIndex = newQueue.findIndex((i, idx) => idx > currentIndex && i.status === 'pending');
    if (nextIndex === -1) {
      nextIndex = newQueue.findIndex(i => i.status === 'pending');
    }

    if (nextIndex !== -1) {
      newQueue[nextIndex] = { ...newQueue[nextIndex], status: 'active' };
      nextIssueId = newQueue[nextIndex].id;
    }

    const nextIssue = newQueue.find(i => i.id === nextIssueId);

    const skippedRound: Partial<VotingRound> = {
      roomId,
      topic: skippedIssue.title,
      issueId: roomData.activeIssueId || undefined,
      deckType: roomData.deckType,
      votes: [],
      stats: { avg: 'N/A', min: 'N/A', max: 'N/A', consensus: false },
      timestamp: new Date().toISOString(),
      skipped: true,
      note: note.trim() || null,
    };

    pokerApi.saveRound(roomId, skippedRound).then(() => {
      let updates: Partial<Room> = {
        ...roomData,
        issuesQueue: newQueue,
        activeIssueId: nextIssueId,
        currentTopic: nextIssue?.title || roomData.currentTopic,
        votesRevealed: false
      };

      if (!nextIssueId) {
        updates = { ...updates, ...buildSessionClosure(newQueue) };
      }

      pokerApi.saveOrUpdateRoom(updates).then(() => {
        handleClear();
        toast({ title: "Tópico Pulado", description: "O tópico foi removido da estimativa." });
      });
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, roomId, handleClear, toast, buildSessionClosure]);

  const handleUnskipIssue = useCallback((issueId: string) => {
    if (!roomData || !roomData.issuesQueue || !isCurrentUserFacilitator) return;

    const newQueue = roomData.issuesQueue.map((i) => {
      if (i.id === issueId) {
        return {
          ...i,
          status: 'active',
          skipped: false,
          note: null,
          estimatedPoints: null,
          startedAt: null,
        } as Issue;
      }
      if (i.status === 'active') {
        return { ...i, status: 'pending' } as Issue;
      }
      return i;
    });

    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: issueId,
      votesRevealed: false,
      sessionEndedAt: undefined,
    }).then(() => {
      handleClear();
      toast({ title: "Tópico Retornado", description: "O tópico voltou para a mesa de votação." });
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, handleClear, toast]);

  const handleAsyncVote = useCallback((issueId: string, voteValue: string) => {
    if (!currentUser || !roomData) return;
    if (!canParticipantVote(currentUser, roomData.settings?.allowManagementToVote)) return;
    
    const voteId = `${currentUser.id}_${issueId}`;
    const existingVote = votes?.find(v => v.id === voteId)?.value;
    
    if (voteValue === existingVote) {
      pokerApi.removeVote(roomId, voteId).catch(console.error);
      return;
    }

    const newVote: Partial<Vote> = {
      id: voteId,
      participantId: currentUser.id,
      roomId: roomId,
      value: voteValue,
      timestamp: new Date().toISOString(),
      issueId: issueId,
    };
    pokerApi.saveVote(roomId, newVote).catch(console.error);
  }, [currentUser, votes, roomId, roomData]);

  const handleAsyncReveal = useCallback((issueId: string) => {
    if (!isCurrentUserFacilitator || !roomData) return;
    const currentRevealed = roomData.revealedIssues || [];
    if (!currentRevealed.includes(issueId)) {
      pokerApi.saveOrUpdateRoom({
        ...roomData,
        revealedIssues: [...currentRevealed, issueId]
      }).catch(console.error);
    }
  }, [isCurrentUserFacilitator, roomData]);

  const handleAsyncClear = useCallback((issueId: string) => {
    if (!isCurrentUserFacilitator || !roomData || !votes) return;
    const newRevealed = (roomData.revealedIssues || []).filter(id => id !== issueId);
    
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      revealedIssues: newRevealed
    }).then(() => {
      const issueVotes = votes.filter(v => v.issueId === issueId);
      issueVotes.forEach(vote => {
        pokerApi.removeVote(roomId, vote.id).catch(console.error);
      });
    }).catch(error => {
      console.error('Erro ao limpar votos assíncronos:', error);
      toast({
        title: 'Erro ao limpar votos',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    });
  }, [isCurrentUserFacilitator, roomData, votes, roomId, toast]);

  const handleAsyncCompleteIssue = useCallback((issueId: string, points: string, devPoints?: string, qaPoints?: string, rolePoints?: Record<string, string>) => {
    if (!roomData || !roomData.issuesQueue || !isCurrentUserFacilitator) return;

    const currentIndex = roomData.issuesQueue.findIndex(i => i.id === issueId);
    if (currentIndex === -1) return;

    const newQueue = [...roomData.issuesQueue];
    newQueue[currentIndex] = {
      ...newQueue[currentIndex],
      status: 'completed',
      estimatedPoints: points,
      devPoints: devPoints || null,
      qaPoints: qaPoints || null,
      rolePoints: rolePoints || null
    };

    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue
    }).then(() => {
      const activeIssue = roomData.issuesQueue![currentIndex];
      if (activeIssue && activeIssue.key && roomData.team) {
        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api'}/work-items/${roomData.team}/${activeIssue.key}/estimate`;
        authFetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points_estimated: Number(points) })
        }).catch(err => console.error("Erro ao salvar pontos no backend", err));
      }

      handleAsyncClear(issueId);
      toast({ title: "Estimativa Consolidada!" });
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, handleAsyncClear, toast]);

  const handleSetTopic = useCallback((topic: string) => {
    if (!isCurrentUserFacilitator || !roomData) return;
    
    let updates: Partial<Room> = { ...roomData };
    if (roomData.activeIssueId && roomData.issuesQueue) {
      const newQueue = roomData.issuesQueue.map(i => 
        i.id === roomData.activeIssueId ? { ...i, title: topic } : i
      );
      updates.issuesQueue = newQueue;
      updates.votesRevealed = false;
    } else {
      updates.currentTopic = topic;
      updates.votesRevealed = false;
    }

    pokerApi.saveOrUpdateRoom(updates).then(() => {
      if (votes) {
        votes.forEach(vote => {
          pokerApi.removeVote(roomId, vote.id).catch(console.error);
        });
      }
    }).catch(error => {
      console.error('Erro ao trocar de tópico:', error);
      toast({
        title: 'Erro ao trocar de tópico',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    });
  }, [isCurrentUserFacilitator, votes, roomData, roomId, toast]);

  const handleSetDeck = useCallback((newDeck: DeckType) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      deckType: newDeck,
      referenceBaseline: null
    }).then(() => {
      handleClear();
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, handleClear]);

  const handleSetReference = useCallback((issueId: string | null) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    if (!issueId) {
      pokerApi.saveOrUpdateRoom({ ...roomData, referenceBaseline: null }).catch(err => console.error(err));
      return;
    }
    const issue = roomData.issuesQueue?.find(i => i.id === issueId);
    if (!issue || issue.status !== 'completed' || issue.skipped || !issue.estimatedPoints) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      referenceBaseline: {
        issueId: issue.id,
        key: issue.key || null,
        title: issue.title,
        display: formatBaselineDisplay(issue.estimatedPoints, roomData.deckType),
        deckType: roomData.deckType,
      },
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator]);

  const handleRemoveParticipant = useCallback((participantId: string) => {
    if (!isCurrentUserFacilitator || !roomData) return;

    pokerApi.leaveRoom(roomId, participantId).then(() => {
      const currentParticipantIds = roomData.participantIds || [];
      pokerApi.saveOrUpdateRoom({
        ...roomData,
        participantIds: currentParticipantIds.filter(id => id !== participantId)
      });
    }).catch(console.error);
  }, [isCurrentUserFacilitator, roomId, roomData]);

  const handleClaimFacilitator = useCallback(async () => {
    if (!roomData || !user || !participants) return;

    try {
      await pokerApi.saveOrUpdateRoom({
        ...roomData,
        creatorId: user.uid
      });

      const p = participants.find(part => part.id === user.uid);
      if (p) {
        await pokerApi.joinRoom(roomId, {
          ...p,
          isFacilitator: true,
          role: 'organizador'
        });
      }

      toast({
        title: "👑 Controle Assumido",
        description: `${userProfile?.name} agora é o organizador da sala.`,
      });

      const staleFacilitators = participants.filter(p => p.id !== user.uid && (p.isFacilitator || p.role === 'organizador'));
      staleFacilitators.forEach(p => {
        pokerApi.joinRoom(roomId, { ...p, isFacilitator: false, role: 'dev' }).catch(console.error);
      });
      reloadRoomData();
    } catch (error) {
      console.error("Erro ao assumir controle:", error);
      toast({
        title: "Erro ao assumir controle",
        description: "Não foi possível completar a operação no banco de dados.",
        variant: "destructive"
      });
    }
  }, [roomData, user, participants, userProfile, toast, reloadRoomData, roomId]);

  const handleLeaveRoom = useCallback(() => {
    if (!currentUser) return;
    pokerApi.leaveRoom(roomId, currentUser.id).then(() => {
      pokerApi.removeVote(roomId, currentUser.id).catch(console.error);
      (votes || [])
        .filter(v => v.participantId === currentUser.id)
        .forEach(v => pokerApi.removeVote(roomId, v.id).catch(console.error));
      router.push('/');
    }).catch(console.error);
  }, [currentUser, votes, roomId, router]);

  const handleSetTimerDuration = useCallback((duration: number) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { status: 'stopped', initialDuration: duration, remainingOnPause: duration, endTime: null }
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator]);

  const handleStartTimer = useCallback((duration: number) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    const serverNow = Date.now() + clockOffset;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { status: 'running', endTime: String(serverNow + duration * 1000), initialDuration: duration, remainingOnPause: duration }
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, clockOffset]);

  const handlePauseTimer = useCallback(() => {
    if (!roomData?.timer?.endTime || !isCurrentUserFacilitator) return;
    const serverNow = Date.now() + clockOffset;
    const remaining = Math.max(0, Math.round((Number(roomData.timer.endTime) - serverNow) / 1000));
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { ...roomData.timer, status: 'paused', remainingOnPause: remaining }
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, clockOffset]);

  const handleResumeTimer = useCallback(() => {
    if (!roomData?.timer || !isCurrentUserFacilitator) return;
    const serverNow = Date.now() + clockOffset;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { ...roomData.timer, status: 'running', endTime: String(serverNow + roomData.timer.remainingOnPause * 1000) }
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator, clockOffset]);

  const handleResetTimer = useCallback(() => {
    if (!roomData?.timer || !isCurrentUserFacilitator) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { ...roomData.timer, status: 'stopped', endTime: null, remainingOnPause: roomData.timer.initialDuration }
    }).catch(err => console.error(err));
  }, [roomData, isCurrentUserFacilitator]);

  // Auto-timer
  const autoTimerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!roomData?.settings?.autoTimer || !isCurrentUserFacilitator || !roomData.activeIssueId) {
      if (!roomData?.settings?.autoTimer) autoTimerRef.current = null;
      return;
    }
    if (autoTimerRef.current === roomData.activeIssueId) return;
    autoTimerRef.current = roomData.activeIssueId;
    handleStartTimer(roomData.timer?.initialDuration || 120);
  }, [roomData?.settings?.autoTimer, roomData?.activeIssueId, isCurrentUserFacilitator, handleStartTimer, roomData?.timer?.initialDuration]);

  const stableVote = useStableCallback(handleVote);
  const stableSetConfidence = useStableCallback(handleSetConfidence);
  const stableSetDecisionNote = useStableCallback(handleSetDecisionNote);
  const stableUpdateRefinementNotes = useStableCallback(handleUpdateRefinementNotes);
  const stableReact = useStableCallback(handleReact);
  const stableReveal = useStableCallback(handleReveal);
  const stableClear = useStableCallback(handleClear);
  const stableSelectiveRevote = useStableCallback(handleSelectiveRevote);
  const stableSetDeck = useStableCallback(handleSetDeck);
  const stableSetReference = useStableCallback(handleSetReference);
  const stableRemoveParticipant = useStableCallback(handleRemoveParticipant);
  const stableUpdateParticipantRole = useStableCallback(handleUpdateParticipantRole);
  const stableSetTopic = useStableCallback(handleSetTopic);
  const stableSetTimerDuration = useStableCallback(handleSetTimerDuration);
  const stableStartTimer = useStableCallback(handleStartTimer);
  const stablePauseTimer = useStableCallback(handlePauseTimer);
  const stableResumeTimer = useStableCallback(handleResumeTimer);
  const stableResetTimer = useStableCallback(handleResetTimer);
  const stableLeaveRoom = useStableCallback(handleLeaveRoom);
  const stableSetIsSoundEnabled = useStableCallback(handleSetIsSoundEnabled);
  const stableAddIssue = useStableCallback(handleAddIssue);
  const stableBulkAddIssues = useStableCallback(handleBulkAddIssues);
  const stableSelectIssue = useStableCallback(handleSelectIssue);
  const stableDeleteIssue = useStableCallback(handleDeleteIssue);
  const stableCompleteIssue = useStableCallback(handleCompleteIssue);
  const stableSkipIssue = useStableCallback(handleSkipIssue);
  const stableParkIssue = useStableCallback(handleParkIssue);
  const stableStartSession = useStableCallback(handleStartSession);
  const stableFinishSession = useStableCallback(handleFinishSession);
  const stableUnskipIssue = useStableCallback(handleUnskipIssue);
  const stableRevoteIssue = useStableCallback(handleRevoteIssue);
  const stableUpdateSettings = useStableCallback(handleUpdateSettings);
  const stableClaimFacilitator = useStableCallback(handleClaimFacilitator);
  const stableOpenFeedback = useStableCallback(handleOpenFeedback);
  const stableAsyncVote = useStableCallback(handleAsyncVote);
  const stableAsyncReveal = useStableCallback(handleAsyncReveal);
  const stableAsyncClear = useStableCallback(handleAsyncClear);
  const stableAsyncCompleteIssue = useStableCallback(handleAsyncCompleteIssue);

  if (isUserLoading || isInitializing || isRoomLoading || areParticipantsLoading || !user || !userProfile) {
    if (!userProfile) {
      return <LoadingScreen message="Configurando identidade..." submessage="Preencha sua identidade para entrar na sala" />;
    }
    return <LoadingScreen message="Sincronizando cerimônia..." />;
  }

  if (!roomData) return <NotFound resourceName="sala de poker" />;
  if (!currentUser) return <LoadingScreen message="Juntando-se à squad..." submessage="Validando sua identidade global" />;

  const mappedTimer = roomData.timer ? {
    status: roomData.timer.status as any,
    initialDuration: roomData.timer.initialDuration || 120,
    remainingOnPause: roomData.timer.remainingOnPause || 120,
    endTime: roomData.timer.endTime ? Number(roomData.timer.endTime) : null
  } : undefined;

  if (roomData.mode === 'async') {
    return (
      <AsyncPokerRoom
        roomId={roomId}
        currentUser={currentUser}
        participants={participants || []}
        votes={votes || []}
        deck={roomData.deckType}
        revealedIssues={roomData.revealedIssues || []}
        onAsyncVote={stableAsyncVote}
        onAsyncReveal={stableAsyncReveal}
        onAsyncClear={stableAsyncClear}
        onSetDeck={stableSetDeck}
        onRemoveParticipant={stableRemoveParticipant}
        onUpdateParticipantRole={stableUpdateParticipantRole}
        isCurrentUserFacilitator={isCurrentUserFacilitator}
        roomTitle={roomData.title}
        roomTeam={roomData.team}
        issuesQueue={roomData.issuesQueue || []}
        onAddIssue={stableAddIssue}
        onBulkAddIssues={stableBulkAddIssues}
        onDeleteIssue={stableDeleteIssue}
        onCompleteIssue={stableAsyncCompleteIssue}
        onLeaveRoom={stableLeaveRoom}
        isSoundEnabled={isSoundEnabled}
        onSetIsSoundEnabled={stableSetIsSoundEnabled}
        onClaimFacilitator={stableClaimFacilitator}
        settings={roomData.settings}
        onUpdateSettings={stableUpdateSettings}
        creatorId={roomData.creatorId}
        onOpenFeedback={stableOpenFeedback}
      />
    );
  }

  return (
    <>
      <PokerRoom
        roomId={roomId}
        currentUser={currentUser}
        participants={participants || []}
        votes={votes || []}
        deck={roomData.deckType}
        votesRevealed={roomData.votesRevealed}
        selectiveRevotingRole={roomData.selectiveRevotingRole || null}
        onVote={stableVote}
        onSetConfidence={stableSetConfidence}
        currentUserConfidence={currentUserConfidence}
        onSetDecisionNote={stableSetDecisionNote}
        onUpdateRefinementNotes={stableUpdateRefinementNotes}
        reactionsEnabled={reactionsEnabled}
        reactions={reactions}
        onReact={stableReact}
        onReveal={stableReveal}
        onClear={stableClear}
        onSelectiveRevote={stableSelectiveRevote}
        onSetDeck={stableSetDeck}
        onRemoveParticipant={stableRemoveParticipant}
        onUpdateParticipantRole={stableUpdateParticipantRole}
        currentUserVote={currentUserVote}
        isCurrentUserFacilitator={isCurrentUserFacilitator}
        currentTopic={roomData.currentTopic}
        onSetTopic={stableSetTopic}
        votingRounds={votingRounds || []}
        timer={mappedTimer}
        onSetTimerDuration={stableSetTimerDuration}
        onStartTimer={stableStartTimer}
        onPauseTimer={stablePauseTimer}
        onResumeTimer={stableResumeTimer}
        onResetTimer={stableResetTimer}
        serverTimeOffset={clockOffset}
        onLeaveRoom={stableLeaveRoom}
        isSoundEnabled={isSoundEnabled}
        onSetIsSoundEnabled={stableSetIsSoundEnabled}
        roomTitle={roomData.title}
        roomTeam={roomData.team}
        issuesQueue={roomData.issuesQueue || []}
        creatorId={roomData.creatorId}
        activeIssueId={roomData.activeIssueId}
        referenceBaseline={roomData.referenceBaseline || null}
        onSetReference={stableSetReference}
        sessionStartedAt={roomData.sessionStartedAt}
        sessionEndedAt={roomData.sessionEndedAt}
        onAddIssue={stableAddIssue}
        onBulkAddIssues={stableBulkAddIssues}
        onSelectIssue={stableSelectIssue}
        onDeleteIssue={stableDeleteIssue}
        onCompleteIssue={stableCompleteIssue}
        onSkipIssue={stableSkipIssue}
        onParkIssue={stableParkIssue}
        onStartSession={stableStartSession}
        onFinishSession={stableFinishSession}
        onUnskipIssue={stableUnskipIssue}
        onRevoteIssue={stableRevoteIssue}
        settings={roomData.settings}
        onUpdateSettings={stableUpdateSettings}
        onClaimFacilitator={stableClaimFacilitator}
        onOpenFeedback={stableOpenFeedback}
      />
      <FeedbackWidget
        toolName="Scrum Poker"
        triggerVariant="none"
        externalTriggerSignal={feedbackSignal}
      />
    </>
  );
}
