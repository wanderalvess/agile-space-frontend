'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DeckType, Participant, Role, Room, Vote, VotingRound, Issue, GlobalRole, ConfidenceLevel } from '@/lib/types';
import { PokerRoom } from '@/components/poker/PokerRoom';
import { AsyncPokerRoom } from '@/components/poker/AsyncPokerRoom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { NotFound } from '@/components/NotFound';
import { LoadingScreen } from '@/components/layout/LoadingScreen';
import { useUserContext } from '@/context/UserContext';
import { getAuthToken } from '@/lib/auth-client';
import { FeedbackWidget } from '@/components/feedback-widget';
import { isValidJiraKey } from '@/lib/utils';
import { canParticipantVote, getEligibleStatsVotes, getParticipantCategory, resolveTshirtHours, formatBaselineDisplay, computeSessionBreakdown, computeTopicTiming, isParticipantOnline, roundEstimate, resolveRoundingMode } from '@/lib/poker-utils';
import { useStableCallback } from '@/hooks/use-stable-callback';
import { pokerApi, ROOM_CONFLICT_EVENT, RoomConflictError } from '../api';
import { authFetch } from '@/lib/auth-client';
import { workItemsApi } from '@/app/work-items-api';
import { squadApi } from '@/app/squad/api';
import { openOrCreateRetro } from '@/lib/sprintCycleNav';

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
  const { session, isLoading } = useAuth();
  const { userProfile, requestIdentity, isInitializing } = useUserContext();

  useEffect(() => {
    // isInitializing precisa estar false também, senão requestIdentity() dispara
    // à toa numa janela em que userProfile ainda não terminou de carregar do
    // UserContext (mesma causa do modal de perfil abrindo sozinho no retro).
    if (!isLoading && !isInitializing && !userProfile) {
      requestIdentity();
    }
  }, [isLoading, isInitializing, userProfile, requestIdentity]);

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
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, any[]>>({});

  const [isRoomLoading, setIsRoomLoading] = useState(true);
  const [areParticipantsLoading, setAreParticipantsLoading] = useState(true);

  // Relógio de presença: sem ele "online" só era recalculado quando a lista de participantes mudava.
  const [presenceTick, setPresenceTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setPresenceTick(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const onlineParticipants = useMemo(
    () => (participants || []).filter(p => isParticipantOnline(p, presenceTick)),
    [participants, presenceTick]
  );

  // Falhas de ação aparecem para o usuário (antes só iam para o console). Conflito de versão já tem aviso próprio.
  const notifyError = useStableCallback((err: unknown) => {
    console.error(err);
    if (err instanceof RoomConflictError) return;
    toast({
      title: 'Não foi possível concluir a ação',
      description: err instanceof Error ? err.message : 'Tente novamente.',
      variant: 'destructive',
    });
  });

  const hasActiveHost = useMemo(() => {
    if (!roomData) return false;
    return onlineParticipants.some(p => p.id === roomData.creatorId || p.role === 'organizador');
  }, [roomData, onlineParticipants]);

  const currentUser = useMemo(() => participants?.find(p => p.id === session?.id && p.roomId === roomId) || null, [participants, session, roomId]);
  const isCurrentUserFacilitator = useMemo(() => {
    if (!session || !roomData) return false;
    if (session.id === roomData.creatorId || currentUser?.role === 'organizador') return true;
    // Fallback: se o criador/organizador cair ou sair, o primeiro integrante técnico online assume a facilitação temporária
    if (!hasActiveHost && currentUser && currentUser.role !== 'spectator') {
      const firstEligible = onlineParticipants.find(p => p.role !== 'spectator');
      return firstEligible?.id === session.id;
    }
    return false;
  }, [session, roomData, currentUser, hasActiveHost, onlineParticipants]);

  const reactionsEnabled = !!roomData?.settings?.reactions;


  const currentUserVote = useMemo(() => votes?.find(v => v.participantId === currentUser?.id)?.value || null, [votes, currentUser]);
  const currentUserConfidence = useMemo(() => votes?.find(v => v.participantId === currentUser?.id)?.confidence || null, [votes, currentUser]);

  const handleOpenFeedback = useCallback(() => {
    setFeedbackSignal(Date.now());
  }, []);

  const handleOpenRetro = useCallback(async () => {
    const activeIssue = roomData?.issuesQueue?.find(i => i.id === roomData.activeIssueId) || roomData?.issuesQueue?.[0];
    const issueProjectKey = activeIssue?.key?.includes('-') ? activeIssue.key.split('-')[0].toUpperCase() : '';
    const squadId = (roomData?.team && roomData.team !== 'Squad Geral' && roomData.team !== 'Geral')
      ? roomData.team
      : (issueProjectKey || userProfile?.squadId || session?.activeProjectId || '');
    if (!squadId) {
      toast({ title: "Squad não identificada", description: "Não foi possível resolver a squad desta sala.", variant: "destructive" });
      return;
    }
    try {
      const squad = await squadApi.getSquad(squadId);
      const sprintId = squad?.activeSprintId;
      if (!sprintId) {
        toast({ title: "Sem sprint ativa", description: "Essa squad não tem sprint ativa configurada.", variant: "destructive" });
        return;
      }
      openOrCreateRetro(router, sprintId, squadId);
    } catch (err) {
      console.error('[Poker] Falha ao resolver sprint ativa da squad:', err);
      toast({ title: "Erro", description: "Não foi possível abrir a retrospectiva.", variant: "destructive" });
    }
  }, [roomData?.team, roomData?.issuesQueue, roomData?.activeIssueId, userProfile?.squadId, session?.activeProjectId, router, toast]);

  // Versão otimista da sala já aplicada: um eco do WebSocket ou um GET que chegam atrasados
  // (versão menor) não podem desfazer um estado mais novo.
  const roomVersionRef = useRef(-1);
  const applyRoom = useCallback((next: Room) => {
    const v = typeof next.version === 'number' ? next.version : null;
    if (v !== null) {
      if (v < roomVersionRef.current) return;
      roomVersionRef.current = v;
    }
    setRoomData(next);
  }, []);
  const reloadSeqRef = useRef(0);
  // Cartas do chat já carregadas por canal; limpo ao reconectar para ressincronizar o que se perdeu offline.
  const loadedChannelsRef = useRef<Set<string>>(new Set());
  const [chatReloadKey, setChatReloadKey] = useState(0);

  const reloadRoomData = useCallback(async () => {
    if (!session) return;
    const seq = ++reloadSeqRef.current;
    try {
      const [room, partsList, votesList, roundsList] = await Promise.all([
        pokerApi.getRoom(roomId),
        pokerApi.getParticipants(roomId),
        pokerApi.getVotes(roomId),
        pokerApi.getRounds(roomId, 100)
      ]);
      // Uma recarga mais nova já saiu: esta resposta é velha.
      if (seq !== reloadSeqRef.current) return;
      applyRoom(room);
      setParticipants(partsList);
      setVotes(votesList);
      setVotingRounds(roundsList);
    } catch (e) {
      console.error("Erro ao carregar dados da sala de Poker:", e);
    } finally {
      setIsRoomLoading(false);
      setAreParticipantsLoading(false);
    }
  }, [roomId, session, applyRoom]);

  // Presença: o heartbeat grava no servidor mas não gera evento, então os `lastSeen` locais envelhecem
  // e todo mundo parecia offline. Um GET leve a cada 20s mantém o estado fiel.
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      pokerApi.getParticipants(roomId).then(list => {
        setParticipants(prev => {
          const same = prev.length === list.length && prev.every((p, i) =>
            p.id === list[i].id && p.lastSeen === list[i].lastSeen && p.role === list[i].role && p.nickname === list[i].nickname);
          return same ? prev : list;
        });
      }).catch(() => { /* próxima volta tenta de novo */ });
    }, 20000);
    return () => clearInterval(timer);
  }, [roomId, session]);

  // Votos às cegas: o servidor só entrega os valores depois da revelação, então busca de novo ao revelar.
  const blindVotes = !!roomData?.settings?.blindVotes;
  const revealedKey = `${roomData?.votesRevealed ? 1 : 0}:${(roomData?.revealedIssues || []).length}`;
  useEffect(() => {
    if (!session || !blindVotes || revealedKey === '0:0') return;
    pokerApi.getVotes(roomId).then(setVotes).catch(notifyError);
  }, [session, blindVotes, revealedKey, roomId]);

  // Conflito de gravação: duas ações partiram da mesma versão da sala e o backend recusou a mais
  // lenta (409). Recarrega o estado real e avisa, em vez de falhar em silêncio ou sobrescrever.
  // Vários conflitos em sequência (ações encadeadas) viram um único aviso e uma única recarga.
  const lastConflictAtRef = useRef(0);
  useEffect(() => {
    const onConflict = (e: Event) => {
      const detail = (e as CustomEvent<{ roomId?: string }>).detail;
      if (detail?.roomId && detail.roomId !== roomId) return;
      const now = Date.now();
      if (now - lastConflictAtRef.current < 2000) return;
      lastConflictAtRef.current = now;
      reloadRoomData();
      toast({
        title: 'A sala mudou',
        description: 'Outra pessoa atualizou a sala antes da sua ação ser salva. Os dados foram recarregados; repita a ação se ainda for necessária.',
      });
    };
    window.addEventListener(ROOM_CONFLICT_EVENT, onConflict);
    return () => window.removeEventListener(ROOM_CONFLICT_EVENT, onConflict);
  }, [roomId, reloadRoomData, toast]);

  // Conexão WebSocket com Reconexão Automática e Carga Inicial
  useEffect(() => {
    if (!session) return;

    reloadRoomData();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
    const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api$/, '/ws/poker/') + roomId;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let attempt = 0;

    const connect = () => {
    // Token lido a cada tentativa: o de antes pode ter expirado durante a queda.
    const ws = new WebSocket(wsBase + '?token=' + encodeURIComponent(getAuthToken() || ''));
    socket = ws;

    ws.onopen = () => {
      // Reconectou: o que aconteceu enquanto estava fora (votos, sala, chat) não chegou por evento.
      if (attempt > 0) {
        loadedChannelsRef.current.clear();
        setChatReloadKey(k => k + 1);
        reloadRoomData();
      }
      attempt = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'ROOM_UPDATED':
            if (data.payload) {
              applyRoom(data.payload);
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
                // Sala assíncrona guarda um voto por tarefa: a identidade é o id, não só o participante.
                const idx = prev.findIndex(v => data.payload.id && v.id
                  ? v.id === data.payload.id
                  : v.participantId === data.payload.participantId);
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
              const { userId, issueId } = data.payload;
              setVotes(prev => prev.filter(v => !(v.participantId === userId && (!issueId || v.issueId === issueId))));
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

          case 'CHAT_MESSAGE_SAVED':
            if (data.payload) {
              const msg = data.payload;
              const channel = msg.channelId;
              if (channel) {
                setMessagesByChannel(prev => {
                  const currentList = prev[channel] || [];
                  const exists = currentList.some(m => m.id === msg.id);
                  if (exists) {
                    return {
                      ...prev,
                      [channel]: currentList.map(m => m.id === msg.id ? msg : m)
                    };
                  }
                  return {
                    ...prev,
                    [channel]: [...currentList, msg]
                  };
                });
              }
            }
            break;

          case 'CHAT_MESSAGE_DELETED':
            if (data.payload?.messageId && data.payload?.channelId) {
              const { messageId, channelId } = data.payload;
              setMessagesByChannel(prev => ({
                ...prev,
                [channelId]: (prev[channelId] || []).filter(m => m.id !== messageId)
              }));
            }
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

    ws.onclose = () => {
      if (disposed) return;
      // Backoff exponencial (1s, 2s, 4s… até 30s) e ressincroniza a cada tentativa.
      const delay = Math.min(30000, 1000 * 2 ** attempt);
      attempt += 1;
      console.warn(`Conexão WebSocket fechada. Reconectando em ${Math.round(delay / 1000)}s...`);
      reloadRoomData();
      reconnectTimer = setTimeout(connect, delay);
    };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [roomId, session, reloadRoomData, applyRoom]);

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
    if (isLoading || !session || !userProfile || !roomData || hasJoined) {
      return;
    }

    const runJoin = async () => {
      try {
        const existingParts = await pokerApi.getParticipants(roomId);
        const alreadyInThisRoom = existingParts.some(p => p.id === session.id);

        if (!alreadyInThisRoom) {
          const newParticipant: Participant = {
            id: session.id,
            roomId: roomId,
            nickname: userProfile.name,
            email: userProfile.email || '',
            role: mapGlobalToPokerRole(userProfile.role),
            globalRole: userProfile.role,
            isFacilitator: session.id === roomData.creatorId,
          };
          await pokerApi.joinRoom(roomId, newParticipant);
        }

        // participantIds é registrado pelo próprio backend no join (com a sala travada): gravar a sala
        // inteira daqui dava 409 em entradas simultâneas.
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
  }, [session, userProfile, roomData, isLoading, roomId, hasJoined, toast, reloadRoomData]);

  // 3.1 SINCRONIZAÇÃO DE PERFIL
  const lastSyncedProfileRef = useRef<{ name: string; role: string; email?: string } | null>(null);
  useEffect(() => {
    if (!session || !userProfile || !currentUser) return;

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
      pokerApi.joinRoom(roomId, updates).catch(err => {
        // libera nova tentativa na próxima mudança de perfil/participante
        lastSyncedProfileRef.current = null;
        console.error(err);
      });
    } else {
      lastSyncedProfileRef.current = { 
        name: userProfile.name, 
        role: userProfile.role,
        email: userProfile.email || ''
      };
    }
  }, [session, userProfile, currentUser, roomId]);

  useEffect(() => {
    setHasJoined(!!currentUser);
  }, [currentUser]);

  // Carga das mensagens do chat da sala (canal geral e canais relevantes). Cada canal é buscado uma vez
  // (e de novo após reconectar); a lista de participantes mudar não refaz tudo, e o que já chegou pelo
  // WebSocket é mesclado em vez de sobrescrito.
  const participantIdsKey = (participants || []).map(p => p.id).sort().join(',');
  useEffect(() => {
    if (!currentUser || !roomId) return;
    const channelsToLoad = ['geral'];
    const myCat = getParticipantCategory(currentUser);
    if (myCat) channelsToLoad.push(`role-${myCat}`);

    (participants || []).forEach(p => {
      if (p.id !== currentUser.id) {
        channelsToLoad.push(`dm_${[currentUser.id, p.id].sort().join('_')}`);
      }
    });

    channelsToLoad.forEach(channelId => {
      if (loadedChannelsRef.current.has(channelId)) return;
      loadedChannelsRef.current.add(channelId);
      pokerApi.getChatMessages(roomId, channelId)
        .then(msgs => {
          setMessagesByChannel(prev => {
            const byId = new Map<string, any>();
            [...(msgs || []), ...(prev[channelId] || [])].forEach(m => byId.set(m.id, m));
            const merged = [...byId.values()].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
            return { ...prev, [channelId]: merged };
          });
        })
        .catch(err => {
          loadedChannelsRef.current.delete(channelId);
          console.error(`Erro ao carregar mensagens do canal ${channelId}:`, err);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, participantIdsKey, roomId, chatReloadKey]);

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
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, toast]);

  // Auto-início por quórum: o efeito abaixo já carimba o startedAt sozinho a
  // partir do 2º item (quando o facilitador troca de tarefa ativa), mas o 1º
  // item nasce ativo sem nenhuma troca para disparar isso — por isso hoje
  // depende 100% de alguém clicar em "Iniciar Refinamento". Assim que houver
  // 1 dev + 1 QA online na sala (offline = aba fechada, não conta — mesmo
  // critério de `isParticipantOnline` usado no quórum de votação), inicia
  // sozinho, sem esperar o clique.
  useEffect(() => {
    if (!isCurrentUserFacilitator || !roomData) return;
    if (roomData.sessionStartedAt || roomData.sessionEndedAt || !roomData.activeIssueId) return;

    const nowMs = Date.now();
    const hasDev = participants.some(p => p.role === 'dev' && isParticipantOnline(p, nowMs));
    const hasQa = participants.some(p => p.role === 'qa' && isParticipantOnline(p, nowMs));
    if (!hasDev || !hasQa) return;

    const now = new Date(nowMs).toISOString();
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      sessionStartedAt: now,
      sessionEndedAt: undefined,
      issuesQueue: (roomData.issuesQueue || []).map(i =>
        i.id === roomData.activeIssueId ? { ...i, startedAt: now } : i
      ),
    }).then(() => {
      toast({
        title: 'Refinamento iniciado automaticamente',
        description: 'Quórum atingido (1 dev + 1 QA online) — o cronômetro começou.',
      });
    }).catch(notifyError);
  }, [isCurrentUserFacilitator, roomData, participants, toast]);

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
    }).catch(notifyError);
  }, [isCurrentUserFacilitator, roomData]);

  // Título Dinâmico da Aba
  useEffect(() => {
    const baseTitle = "Portal Tech V&D";
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
    }).catch(notifyError);
  }, [isCurrentUserFacilitator, roomData]);

  const handleUpdateParticipantRole = useCallback((participantId: string, newRole: Role) => {
    if (!isCurrentUserFacilitator || !participants) return;
    const target = participants.find(p => p.id === participantId);
    if (!target) return;
    pokerApi.joinRoom(roomId, {
      ...target,
      role: newRole
    }).catch(notifyError);
  }, [isCurrentUserFacilitator, participants, roomId]);

  // Atualização otimista: o voto aparece na hora (o eco do servidor só confirma) e volta ao valor anterior
  // se a gravação falhar, em vez de a tela mostrar um voto que o servidor nunca recebeu.
  const handleVote = useCallback((voteValue: string) => {
    if (!currentUser || !roomData) return;
    if (!canParticipantVote(currentUser, roomData.settings?.allowManagementToVote)) return;
    if (roomData.votesRevealed) return;

    const previous = votes.find(v => v.participantId === currentUser.id);
    const restore = () => setVotes(prev => {
      const rest = prev.filter(v => v.participantId !== currentUser.id);
      return previous ? [...rest, previous] : rest;
    });

    if (voteValue === currentUserVote) {
      setVotes(prev => prev.filter(v => v.participantId !== currentUser.id));
      pokerApi.removeVote(roomId, currentUser.id).catch(err => { restore(); notifyError(err); });
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
      issueId: roomData.activeIssueId || undefined,
      // trocar de carta mantém a confiança já marcada
      confidence: previous?.confidence,
    };
    setVotes(prev => [...prev.filter(v => v.participantId !== currentUser.id), newVote as Vote]);
    pokerApi.saveVote(roomId, newVote)
      .then(saved => setVotes(prev => prev.map(v => v.participantId === saved.participantId ? saved : v)))
      .catch(err => { restore(); notifyError(err); });
  }, [currentUser, currentUserVote, votes, roomId, roomData, notifyError]);

  const handleSetConfidence = useCallback((confidence: ConfidenceLevel) => {
    if (!currentUser || !currentUserVote) return;

    const base = votes.find(v => v.participantId === currentUser.id);
    const updatedConfidence = confidence === currentUserConfidence ? undefined : confidence;
    // Reenvia o voto completo (apelido, papel, tarefa): o servidor grava a linha inteira.
    const next: Partial<Vote> = {
      id: roomId + "_" + currentUser.id,
      participantId: currentUser.id,
      roomId: roomId,
      value: currentUserVote,
      timestamp: base?.timestamp || new Date().toISOString(),
      participantNickname: base?.participantNickname || currentUser.nickname,
      participantRole: base?.participantRole || currentUser.role,
      participantGlobalRole: base?.participantGlobalRole || currentUser.globalRole,
      issueId: base?.issueId || roomData?.activeIssueId || undefined,
      confidence: updatedConfidence,
    };
    setVotes(prev => prev.map(v => v.participantId === currentUser.id ? { ...v, confidence: updatedConfidence } : v));
    pokerApi.saveVote(roomId, next).catch(err => {
      setVotes(prev => prev.map(v => v.participantId === currentUser.id ? { ...v, confidence: base?.confidence } : v));
      notifyError(err);
    });
  }, [currentUser, currentUserVote, currentUserConfidence, votes, roomData?.activeIssueId, roomId, notifyError]);

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
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator]);

  // Qualquer participante presente pode escrever. Vai por endpoint próprio (merge no servidor),
  // não por saveOrUpdateRoom: salvar a sala inteira com uma cópia local desatualizada poderia
  // sobrescrever a fila do facilitador.
  const handleUpdateRefinementNotes = useCallback((notes: { devNotes?: string; qaNotes?: string }) => {
    const issueId = roomData?.activeIssueId;
    if (!issueId || !currentUser) return;
    pokerApi.updateIssueNotes(roomId, issueId, notes).catch(notifyError);
  }, [roomData?.activeIssueId, roomId, currentUser]);

  // Revelar: primeiro vira a chave da sala (é isso que libera os votos para todos); só então busca os votos
  // definitivos e grava a rodada, com id fixo por (tarefa, versão da sala) — clicar de novo, auto-reveal em
  // vários navegadores ou retry não duplicam a rodada no histórico.
  const revealingRef = useRef<string | null>(null);
  const handleReveal = useCallback(async () => {
    if (!participants || !votes || votes.length === 0 || !roomData || !isCurrentUserFacilitator) return;

    const revealKey = `${roomData.activeIssueId ?? 'topic'}:${roomData.version ?? 0}`;
    if (revealingRef.current === revealKey) return;
    revealingRef.current = revealKey;

    try {
      const savedRoom = await pokerApi.saveOrUpdateRoom({
        ...roomData,
        votesRevealed: true,
        selectiveRevotingRole: null
      });

      // Votos definitivos do servidor (em salas às cegas só agora vêm com o valor real).
      let finalVotes = votes;
      try {
        finalVotes = await pokerApi.getVotes(roomId);
        setVotes(finalVotes);
      } catch (e) {
        console.error('Falha ao reler os votos na revelação; usando os da tela:', e);
      }
      // Voto de outra tarefa que sobrou (limpeza que falhou) não entra na conta desta.
      const roundVotes = finalVotes.filter(v => !v.issueId || !roomData.activeIssueId || v.issueId === roomData.activeIssueId);

      const rounding = resolveRoundingMode(roomData.settings?.roundingMode);
      const statsVotes = getEligibleStatsVotes(roundVotes, participants, roomData.settings?.allowManagementToVote);
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
            stats.avg = String(roundEstimate(sum / numericTshirtVotes.length, rounding, roomData.deckType));
            stats.min = String(Math.min(...numericTshirtVotes));
            stats.max = String(Math.max(...numericTshirtVotes));
          } else {
            const voteCounts = allVoteValues.reduce((acc, value) => { acc[value] = (acc[value] || 0) + 1; return acc; }, {} as Record<string, number>);
            stats.avg = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
          }
        } else if (numericVotes.length > 0) {
          const sum = numericVotes.reduce((acc, val) => acc + val, 0);
          stats.avg = String(roundEstimate(sum / numericVotes.length, rounding, roomData.deckType));
          stats.min = String(Math.min(...numericVotes));
          stats.max = String(Math.max(...numericVotes));
        }
      }

      const activeIssue = roomData.issuesQueue?.find(i => i.id === roomData.activeIssueId);
      const topicName = activeIssue?.title || roomData.currentTopic || 'Tópico não definido';

      const newRound: Partial<VotingRound> = {
        id: `${roomId}_${roomData.activeIssueId || 'topic'}_${savedRoom.version ?? Date.now()}`,
        roomId: roomId,
        topic: topicName,
        issueId: roomData.activeIssueId || undefined,
        deckType: roomData.deckType,
        votes: roundVotes,
        stats: stats,
        timestamp: new Date().toISOString(),
      };

      await pokerApi.saveRound(roomId, newRound);
    } catch (err) {
      // Permite tentar de novo (409, rede). Se a sala já virou "revelada" e só a rodada falhou, a revelação
      // vale e o aviso diz que o histórico não gravou.
      revealingRef.current = null;
      notifyError(err);
    }
  }, [participants, votes, roomData, isCurrentUserFacilitator, roomId, notifyError]);

  // Auto-revelar
  useEffect(() => {
    if (!roomData?.settings?.autoReveal || !isCurrentUserFacilitator) return;
    if (roomData.votesRevealed || !roomData.activeIssueId) return;
    if (!participants || !votes || votes.length === 0) return;

    // Quem está offline (aba fechada) não trava a revelação, e voto de outra tarefa não conta.
    const onlineIds = new Set(onlineParticipants.map(p => p.id));
    const eligible = participants.filter(p => canParticipantVote(p, roomData.settings?.allowManagementToVote) && onlineIds.has(p.id));
    if (eligible.length === 0) return;

    const votedIds = new Set(
      votes.filter(v => !v.issueId || v.issueId === roomData.activeIssueId).map(v => v.participantId)
    );
    if (eligible.every(p => votedIds.has(p.id))) {
      handleReveal();
    }
  }, [roomData, participants, onlineParticipants, votes, isCurrentUserFacilitator, handleReveal]);

  const handleClear = useCallback(() => {
    if (!roomData || !isCurrentUserFacilitator) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      votesRevealed: false,
      selectiveRevotingRole: null
    }).then(() => pokerApi.clearVotes(roomId)).catch(error => {
      console.error('Erro ao limpar votos:', error);
      if (error instanceof RoomConflictError) return;
      toast({
        title: 'Erro ao limpar votos',
        description: error instanceof Error ? error.message : 'Tente novamente.',
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
    }).then(async () => {
      const targets = votes.filter(vote => targetUserIds.has(vote.participantId));
      const results = await Promise.allSettled(targets.map(vote => pokerApi.removeVote(roomId, vote.participantId)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        throw new Error(`${failed} voto(s) não puderam ser removidos. Use "Revotar todos" ou tente novamente.`);
      }
    }).catch(error => {
      console.error('Erro ao revotar seletivamente:', error);
      if (error instanceof RoomConflictError) return;
      toast({
        title: 'Erro ao iniciar revotação',
        description: error instanceof Error ? error.message : 'Tente novamente.',
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
    if (newIssue.key && currentQueue.some(i => (i.key || '').toUpperCase() === newIssue.key!.toUpperCase())) {
      toast({ title: 'Tarefa já está na fila', description: `${newIssue.key} já foi adicionada.` });
      return;
    }
    const newQueue = [...currentQueue, newIssue];
    const updates: Partial<Room> = { ...roomData, issuesQueue: newQueue };

    if (!roomData.activeIssueId || currentQueue.length === 0) {
      newIssue.status = 'active';
      updates.activeIssueId = newIssue.id;
    }

    pokerApi.saveOrUpdateRoom(updates).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, toast]);

  // Devolve quantas tarefas realmente entraram (duplicadas — na fila ou no próprio lote — ficam de fora),
  // para o aviso de importação não contar o que foi descartado.
  const handleBulkAddIssues = useCallback((items: Partial<Issue>[]): number => {
    if (!roomData || !isCurrentUserFacilitator) return 0;

    const currentQueue = roomData.issuesQueue || [];
    const seenKeys = new Set(currentQueue.map(i => (i.key || '').toUpperCase()).filter(Boolean));

    const newIssues: Issue[] = items
      .filter(item => {
        const key = item.key || (isValidJiraKey(item.title || '') ? item.title : null);
        if (!key) return true;
        const normalized = key.toUpperCase();
        if (seenKeys.has(normalized)) return false;
        seenKeys.add(normalized);
        return true;
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

    if (newIssues.length === 0) return 0;

    const newQueue = [...currentQueue, ...newIssues];
    const updates: Partial<Room> = { ...roomData, issuesQueue: newQueue };

    if (!roomData.activeIssueId || currentQueue.length === 0) {
      if (newIssues.length > 0) {
        newIssues[0].status = 'active';
        updates.activeIssueId = newIssues[0].id;
      }
    }

    pokerApi.saveOrUpdateRoom(updates).catch(notifyError);
    return newIssues.length;
  }, [roomData, isCurrentUserFacilitator, notifyError]);

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
      selectiveRevotingRole: null,
      sessionEndedAt: undefined,
    }).then(() => {
      pokerApi.clearVotes(roomId).catch(notifyError);
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId]);

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
      selectiveRevotingRole: null,
      sessionEndedAt: undefined,
    }).then(() => {
      pokerApi.clearVotes(roomId).catch(notifyError);
      toast({ title: "Tarefa reaberta para votação" });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId, toast]);

  const handleDeleteIssue = useCallback((issueId: string) => {
    if (!roomData || !roomData.issuesQueue || !isCurrentUserFacilitator) return;

    const isDeletingActive = issueId === roomData.activeIssueId;
    const newQueue = roomData.issuesQueue.filter(i => i.id !== issueId);

    let nextActiveId = roomData.activeIssueId;

    if (isDeletingActive) {
      const nextPendingIdx = newQueue.findIndex(i => i.status === 'pending');
      if (nextPendingIdx !== -1) {
        // cópia: mutar o objeto de roomData deixava a tela diferente do servidor se o save falhasse
        newQueue[nextPendingIdx] = { ...newQueue[nextPendingIdx], status: 'active' };
        nextActiveId = newQueue[nextPendingIdx].id;
      } else {
        nextActiveId = null;
      }
    }

    const nextActive = newQueue.find(i => i.id === nextActiveId);

    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: nextActiveId,
      currentTopic: nextActive?.title || roomData.currentTopic,
      votesRevealed: isDeletingActive ? false : roomData.votesRevealed,
      selectiveRevotingRole: isDeletingActive ? null : roomData.selectiveRevotingRole
    }).then(() => {
      // Votos saem depois da fila salvar: handleClear() aqui mandaria a sala
      // inteira do roomData da closure e ressuscitaria a tarefa apagada.
      if (isDeletingActive) pokerApi.clearVotes(roomId).catch(notifyError);
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId]);

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

    const estimatedIssues = newQueue.filter(i => !i.skipped && !i.cancelled && i.status === 'completed');
    const skippedIssues = newQueue.filter(i => i.skipped && !i.cancelled);
    const cancelledIssues = newQueue.filter(i => i.cancelled);
    const parkedIssues = newQueue.filter(i => (i.parkCount || 0) > 0);
    const untouchedIssues = newQueue.filter(i => !i.skipped && !i.cancelled && i.status !== 'completed');

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
        cancelledTasks: cancelledIssues.map(i => ({ title: i.title, note: i.note || null })),
        parkedTasks: parkedIssues.map(i => ({
          title: i.title,
          note: i.parkedNote || null,
          times: i.parkCount || 0,
          resolved: i.status === 'completed' && !i.skipped && !i.cancelled,
        })),
        untouchedTasks: untouchedIssues.map(i => ({ title: i.title })),
        breakdown,
        stats: {
          totalTopics: breakdown.estimated,
          discussedTopics: breakdown.discussed,
          skippedTopics: breakdown.skipped,
          cancelledTopics: breakdown.cancelled,
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

  // Grava a estimativa final no item de trabalho (Jira/backlog). Só valores numéricos (camiseta "M" ou "?"
  // viraria null), com a falha avisada — antes o toast dizia que salvou mesmo quando não gravou.
  const syncEstimateToWorkItem = useCallback(async (issueKey: string, points: string) => {
    const value = Number(points);
    if (!roomData || points.trim() === '' || !Number.isFinite(value)) return;
    const issueProjectKey = issueKey.includes('-') ? issueKey.split('-')[0].toUpperCase() : '';
    const targetSquad = (roomData.team && roomData.team !== 'Squad Geral' && roomData.team !== 'Geral')
      ? roomData.team
      : (issueProjectKey || userProfile?.squadId || session?.activeProjectId || '');
    if (!targetSquad) return;
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api'}/work-items/${encodeURIComponent(targetSquad)}/${encodeURIComponent(issueKey)}/estimate`;
      const res = await authFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points_estimated: value })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Erro ao salvar pontos no backend', err);
      toast({
        title: `Estimativa não gravada em ${issueKey}`,
        description: 'A sala guardou o valor, mas o item de trabalho não foi atualizado. Ajuste manualmente.',
        variant: 'destructive',
      });
    }
  }, [roomData, userProfile?.squadId, session?.activeProjectId, toast]);

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
      newQueue[nextIndex] = { ...newQueue[nextIndex], status: 'active' };
      nextIssueId = newQueue[nextIndex].id;
    }

    const nextIssue = newQueue.find(i => i.id === nextIssueId);

    let updates: Partial<Room> = {
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: nextIssueId,
      currentTopic: nextIssue?.title || roomData.currentTopic,
      votesRevealed: false,
      selectiveRevotingRole: null,
    };

    if (!nextIssueId) {
      updates = { ...updates, ...buildSessionClosure(newQueue) };
    }

    pokerApi.saveOrUpdateRoom(updates).then(() => {
      const activeIssue = roomData.issuesQueue![currentIndex];
      if (activeIssue && activeIssue.key) {
        syncEstimateToWorkItem(activeIssue.key, points);
      }

      // A rodada de votação mais recente desta tarefa (pulada/cancelada não é rodada de estimativa).
      const lastRound = votingRounds.find(r => r.issueId === roomData.activeIssueId && !r.skipped && !r.cancelled);
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
      pokerApi.clearVotes(roomId).catch(notifyError);
      toast({ title: "Estimativa Salva!" });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, votingRounds, roomId, buildSessionClosure, toast, syncEstimateToWorkItem]);

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
      selectiveRevotingRole: null,
      ...buildSessionClosure(newQueue),
    }).then(() => {
      pokerApi.clearVotes(roomId).catch(notifyError);
      const pendentes = newQueue.filter(i => !i.skipped && i.status !== 'completed').length;
      toast({
        title: 'Refinamento encerrado',
        description: pendentes > 0
          ? `${pendentes} tarefa(s) ficaram como não abordadas no relatório.`
          : 'Relatório da sessão disponível.',
      });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId, buildSessionClosure, toast]);

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
      selectiveRevotingRole: null,
    };

    if (!nextActiveId) {
      updates = { ...updates, ...buildSessionClosure(newQueue) };
    }

    pokerApi.saveOrUpdateRoom(updates).then(() => {
      // Limpa os votos pela API de votos, nao por handleClear(): ele reenviaria
      // a sala inteira a partir do roomData da closure (estado pre-adiamento) e
      // desfaria o update que acabou de ser salvo.
      pokerApi.clearVotes(roomId).catch(notifyError);
      toast({ title: 'Tarefa adiada', description: 'Volta pro fim da fila para revisitar.' });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId, toast, buildSessionClosure]);

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

    let updates: Partial<Room> = {
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: nextIssueId,
      currentTopic: nextIssue?.title || roomData.currentTopic,
      votesRevealed: false,
      selectiveRevotingRole: null,
    };

    if (!nextIssueId) {
      updates = { ...updates, ...buildSessionClosure(newQueue) };
    }

    // A sala é gravada primeiro: se ela falhar (409) nada fica pela metade, e a rodada pulada leva id fixo
    // (tarefa + versão), então repetir a ação não duplica o histórico.
    pokerApi.saveOrUpdateRoom(updates).then(async (savedRoom) => {
      pokerApi.clearVotes(roomId).catch(notifyError);
      toast({ title: "Tópico Pulado", description: "O tópico foi removido da estimativa." });
      await pokerApi.saveRound(roomId, {
        ...skippedRound,
        id: `${roomId}_${skippedIssue.id}_skipped_${savedRoom.version ?? Date.now()}`,
      });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId, toast, buildSessionClosure]);

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
      selectiveRevotingRole: null,
      sessionEndedAt: undefined,
    }).then(() => {
      pokerApi.clearVotes(roomId).catch(notifyError);
      toast({ title: "Tópico Retornado", description: "O tópico voltou para a mesa de votação." });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId, toast]);

  const handleCancelIssue = useCallback((issueId: string, note?: string) => {
    if (!roomData || !roomData.issuesQueue || !isCurrentUserFacilitator) return;

    const targetIssueId: string | null = issueId;
    const noteText = note || '';

    if (!targetIssueId) return;

    const issueIdToCancel = targetIssueId;
    const currentIndex = roomData.issuesQueue.findIndex(i => i.id === issueIdToCancel);
    if (currentIndex === -1) return;

    const cancelledIssue = roomData.issuesQueue[currentIndex];
    const isTargetActive = issueIdToCancel === roomData.activeIssueId;
    const newQueue = [...roomData.issuesQueue];
    newQueue[currentIndex] = {
      ...newQueue[currentIndex],
      status: 'completed',
      estimatedPoints: null,
      cancelled: true,
      skipped: false,
      note: noteText.trim() || null,
    };

    let nextIssueId: string | null = roomData.activeIssueId;

    if (isTargetActive) {
      nextIssueId = null;
      let nextIndex = newQueue.findIndex((i, idx) => idx > currentIndex && i.status === 'pending');
      if (nextIndex === -1) {
        nextIndex = newQueue.findIndex(i => i.status === 'pending');
      }
      if (nextIndex !== -1) {
        newQueue[nextIndex] = { ...newQueue[nextIndex], status: 'active' };
        nextIssueId = newQueue[nextIndex].id;
      }
    }

    const nextIssue = newQueue.find(i => i.id === nextIssueId);

    const cancelledRound: Partial<VotingRound> = {
      roomId,
      topic: cancelledIssue.title,
      issueId: issueIdToCancel,
      deckType: roomData.deckType,
      votes: [],
      stats: { avg: 'N/A', min: 'N/A', max: 'N/A', consensus: false },
      timestamp: new Date().toISOString(),
      cancelled: true,
      note: noteText.trim() || null,
    };

    let updates: Partial<Room> = {
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: nextIssueId,
      currentTopic: nextIssue?.title || (isTargetActive ? '' : roomData.currentTopic),
      votesRevealed: isTargetActive ? false : roomData.votesRevealed,
      selectiveRevotingRole: isTargetActive ? null : roomData.selectiveRevotingRole,
    };

    if (!nextIssueId) {
      updates = { ...updates, ...buildSessionClosure(newQueue) };
    }

    // Mesma ordem do pulo: sala primeiro, rodada com id fixo depois.
    pokerApi.saveOrUpdateRoom(updates).then(async (savedRoom) => {
      if (isTargetActive) pokerApi.clearVotes(roomId).catch(notifyError);
      toast({ title: "Tarefa Cancelada", description: "A tarefa foi marcada como cancelada no refinamento." });
      await pokerApi.saveRound(roomId, {
        ...cancelledRound,
        id: `${roomId}_${issueIdToCancel}_cancelled_${savedRoom.version ?? Date.now()}`,
      });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId, toast, buildSessionClosure]);

  const handleUncancelIssue = useCallback((issueId: string) => {
    if (!roomData || !roomData.issuesQueue || !isCurrentUserFacilitator) return;

    const hasActive = !!roomData.activeIssueId && roomData.issuesQueue.some(i => i.id === roomData.activeIssueId && i.status === 'active');

    const newQueue = roomData.issuesQueue.map((i) => {
      if (i.id === issueId) {
        return {
          ...i,
          status: hasActive ? 'pending' : 'active',
          cancelled: false,
          skipped: false,
          note: null,
          estimatedPoints: null,
          startedAt: null,
        } as Issue;
      }
      return i;
    });

    const nextActiveId = hasActive ? roomData.activeIssueId : issueId;
    const activeIssue = newQueue.find(i => i.id === nextActiveId);

    pokerApi.saveOrUpdateRoom({
      ...roomData,
      issuesQueue: newQueue,
      activeIssueId: nextActiveId,
      currentTopic: activeIssue?.title || roomData.currentTopic,
      votesRevealed: hasActive ? roomData.votesRevealed : false,
      selectiveRevotingRole: hasActive ? roomData.selectiveRevotingRole : null,
      sessionEndedAt: undefined,
    }).then(() => {
      if (!hasActive) pokerApi.clearVotes(roomId).catch(notifyError);
      toast({ title: "Tarefa Reativada", description: "A tarefa voltou para o refinamento." });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId, toast]);

  // Sala assíncrona: um voto por (participante, tarefa). O servidor monta o id room_participant_issue.
  const handleAsyncVote = useCallback((issueId: string, voteValue: string) => {
    if (!currentUser || !roomData) return;
    if (!canParticipantVote(currentUser, roomData.settings?.allowManagementToVote)) return;
    if ((roomData.revealedIssues || []).includes(issueId)) return;

    const isMine = (v: Vote) => v.participantId === currentUser.id && v.issueId === issueId;
    const previous = votes.find(isMine);
    const restore = () => setVotes(prev => {
      const rest = prev.filter(v => !isMine(v));
      return previous ? [...rest, previous] : rest;
    });

    if (voteValue === previous?.value) {
      setVotes(prev => prev.filter(v => !isMine(v)));
      pokerApi.removeVote(roomId, currentUser.id, issueId).catch(err => { restore(); notifyError(err); });
      return;
    }

    const newVote: Partial<Vote> = {
      id: `${roomId}_${currentUser.id}_${issueId}`,
      participantId: currentUser.id,
      roomId: roomId,
      value: voteValue,
      timestamp: new Date().toISOString(),
      issueId: issueId,
      participantNickname: currentUser.nickname,
      participantRole: currentUser.role,
      participantGlobalRole: currentUser.globalRole,
    };
    setVotes(prev => [...prev.filter(v => !isMine(v)), newVote as Vote]);
    pokerApi.saveVote(roomId, newVote)
      .then(saved => setVotes(prev => prev.map(v => (v.id === saved.id ? saved : v))))
      .catch(err => { restore(); notifyError(err); });
  }, [currentUser, votes, roomId, roomData, notifyError]);

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
      return Promise.allSettled(issueVotes.map(vote => pokerApi.removeVote(roomId, vote.participantId, issueId))).then(results => {
        if (results.some(r => r.status === 'rejected')) {
          throw new Error('Alguns votos não puderam ser removidos. Tente novamente.');
        }
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
      if (activeIssue && activeIssue.key) {
        syncEstimateToWorkItem(activeIssue.key, points);
      }

      handleAsyncClear(issueId);
      toast({ title: "Estimativa Consolidada!" });
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, handleAsyncClear, toast, syncEstimateToWorkItem]);

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

    pokerApi.saveOrUpdateRoom(updates).then(() => pokerApi.clearVotes(roomId)).catch(error => {
      console.error('Erro ao trocar de tópico:', error);
      toast({
        title: 'Erro ao trocar de tópico',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    });
  }, [isCurrentUserFacilitator, roomData, roomId, toast]);

  const handleSetDeck = useCallback((newDeck: DeckType) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      deckType: newDeck,
      referenceBaseline: null,
      votesRevealed: false,
      selectiveRevotingRole: null
    }).then(() => {
      pokerApi.clearVotes(roomId).catch(notifyError);
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, roomId]);

  const handleSetReference = useCallback((issueId: string | null) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    if (!issueId) {
      pokerApi.saveOrUpdateRoom({ ...roomData, referenceBaseline: null }).catch(notifyError);
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
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator]);

  const handleRemoveParticipant = useCallback((participantId: string) => {
    if (!isCurrentUserFacilitator || !roomData) return;

    pokerApi.leaveRoom(roomId, participantId).then(() => {
      const currentParticipantIds = roomData.participantIds || [];
      return pokerApi.saveOrUpdateRoom({
        ...roomData,
        participantIds: currentParticipantIds.filter(id => id !== participantId)
      });
    }).catch(notifyError);
  }, [isCurrentUserFacilitator, roomId, roomData, notifyError]);

  const handleClaimFacilitator = useCallback(async () => {
    if (!roomData || !session || !participants) return;
    if (currentUser?.role === 'spectator') {
      toast({ title: 'Espectadores não podem assumir a sala', variant: 'destructive' });
      return;
    }

    try {
      await pokerApi.saveOrUpdateRoom({
        ...roomData,
        creatorId: session.id
      });

      const p = participants.find(part => part.id === session.id);
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

      const staleFacilitators = participants.filter(p => p.id !== session.id && (p.isFacilitator || p.role === 'organizador'));
      staleFacilitators.forEach(p => {
        pokerApi.joinRoom(roomId, { ...p, isFacilitator: false, role: 'dev' }).catch(console.error);
      });
      reloadRoomData();
    } catch (error) {
      console.error("Erro ao assumir controle:", error);
      toast({
        title: "Erro ao assumir controle",
        description: error instanceof Error && !(error instanceof RoomConflictError)
          ? error.message
          : "Não foi possível completar a operação. Se o organizador ainda estiver na sala, peça a ele para repassar o controle.",
        variant: "destructive"
      });
    }
  }, [roomData, session, participants, userProfile, currentUser?.role, toast, reloadRoomData, roomId]);

  const handleLeaveRoom = useCallback(() => {
    if (!currentUser) return;
    pokerApi.leaveRoom(roomId, currentUser.id).then(() => {
      // sem o voto a pessoa não fica como "participante ausente" na rodada em andamento
      pokerApi.removeVote(roomId, currentUser.id).catch(() => { /* já revelado: o voto fica como fato */ });
      router.push('/');
    }).catch(notifyError);
  }, [currentUser, roomId, router, notifyError]);

  const handleSetTimerDuration = useCallback((duration: number) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { status: 'stopped', initialDuration: duration, remainingOnPause: duration, endTime: null }
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator]);

  const handleStartTimer = useCallback((duration: number) => {
    if (!roomData || !isCurrentUserFacilitator) return;
    const serverNow = Date.now() + clockOffset;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { status: 'running', endTime: serverNow + duration * 1000, initialDuration: duration, remainingOnPause: duration }
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, clockOffset]);

  const handlePauseTimer = useCallback(() => {
    if (!roomData?.timer?.endTime || !isCurrentUserFacilitator) return;
    const serverNow = Date.now() + clockOffset;
    const remaining = Math.max(0, Math.round((Number(roomData.timer.endTime) - serverNow) / 1000));
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { ...roomData.timer, status: 'paused', remainingOnPause: remaining }
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, clockOffset]);

  const handleResumeTimer = useCallback(() => {
    if (!roomData?.timer || !isCurrentUserFacilitator) return;
    const serverNow = Date.now() + clockOffset;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { ...roomData.timer, status: 'running', endTime: serverNow + roomData.timer.remainingOnPause * 1000 }
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator, clockOffset]);

  const handleResetTimer = useCallback(() => {
    if (!roomData?.timer || !isCurrentUserFacilitator) return;
    pokerApi.saveOrUpdateRoom({
      ...roomData,
      timer: { ...roomData.timer, status: 'stopped', endTime: null, remainingOnPause: roomData.timer.initialDuration }
    }).catch(notifyError);
  }, [roomData, isCurrentUserFacilitator]);

  // Auto-timer
  // O timer só reinicia quando a tarefa ativa MUDA durante esta sessão de tela. Na primeira leitura (abrir a
  // sala, recarregar, reconectar, voltar a ser facilitador) apenas memoriza a tarefa atual: antes, todo F5 do
  // facilitador zerava o cronômetro da tarefa em andamento.
  const autoTimerRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!roomData?.settings?.autoTimer || !isCurrentUserFacilitator || !roomData.activeIssueId) {
      if (!roomData?.settings?.autoTimer) autoTimerRef.current = undefined;
      return;
    }
    if (autoTimerRef.current === undefined) {
      autoTimerRef.current = roomData.activeIssueId;
      return;
    }
    if (autoTimerRef.current === roomData.activeIssueId) return;
    autoTimerRef.current = roomData.activeIssueId;
    handleStartTimer(roomData.timer?.initialDuration || 120);
  }, [roomData?.settings?.autoTimer, roomData?.activeIssueId, isCurrentUserFacilitator, handleStartTimer, roomData?.timer?.initialDuration]);

  const handleSendMessage = useCallback((text: string, kind: string, channelId: string) => {
    if (!currentUser) return;
    const newMsg = {
      id: generateId(),
      roomId,
      channelId,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderCategory: currentUser.globalRole,
      text,
      kind,
      ts: new Date().toISOString(),
    };
    pokerApi.sendChatMessage(roomId, newMsg).catch(err => console.error("Erro ao enviar mensagem:", err));
  }, [currentUser, roomId]);

  const handleDeleteMessage = useCallback((messageId: string, channelId: string) => {
    pokerApi.deleteChatMessage(roomId, messageId).catch(err => console.error("Erro ao apagar mensagem:", err));
  }, [roomId]);

  const stableSendMessage = useStableCallback(handleSendMessage);
  const stableDeleteMessage = useStableCallback(handleDeleteMessage);

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
  const stableCancelIssue = useStableCallback(handleCancelIssue);
  const stableStartSession = useStableCallback(handleStartSession);
  const stableFinishSession = useStableCallback(handleFinishSession);
  const stableUnskipIssue = useStableCallback(handleUnskipIssue);
  const stableUncancelIssue = useStableCallback(handleUncancelIssue);
  const stableRevoteIssue = useStableCallback(handleRevoteIssue);
  const stableUpdateSettings = useStableCallback(handleUpdateSettings);
  const stableClaimFacilitator = useStableCallback(handleClaimFacilitator);
  const stableOpenFeedback = useStableCallback(handleOpenFeedback);
  const stableOpenRetro = useStableCallback(handleOpenRetro);
  const stableAsyncVote = useStableCallback(handleAsyncVote);
  const stableAsyncReveal = useStableCallback(handleAsyncReveal);
  const stableAsyncClear = useStableCallback(handleAsyncClear);
  const stableAsyncCompleteIssue = useStableCallback(handleAsyncCompleteIssue);

  if (isLoading || isInitializing || isRoomLoading || areParticipantsLoading || !session || !userProfile) {
    if (!userProfile) {
      // Só pede para preencher a identidade quando a autenticação já assentou e
      // de fato não há perfil; enquanto carrega, não faz sentido pedir nada.
      if (isLoading || isInitializing) {
        return <LoadingScreen message="Carregando seu perfil..." />;
      }
      return <LoadingScreen message="Configurando identidade..." submessage="Preencha sua identidade para entrar na sala" />;
    }
    return <LoadingScreen message="Sincronizando cerimônia..." />;
  }

  if (!roomData) return <NotFound resourceName="sala de poker" />;
  if (!currentUser) return <LoadingScreen message="Juntando-se à squad..." submessage="Validando sua identidade global" />;

  const mappedTimer = roomData.timer ? {
    status: roomData.timer.status,
    initialDuration: roomData.timer.initialDuration || 120,
    remainingOnPause: roomData.timer.remainingOnPause ?? 120,
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
        onOpenRetro={stableOpenRetro}
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
        onCancelIssue={stableCancelIssue}
        onStartSession={stableStartSession}
        onFinishSession={stableFinishSession}
        onUnskipIssue={stableUnskipIssue}
        onUncancelIssue={stableUncancelIssue}
        onRevoteIssue={stableRevoteIssue}
        settings={roomData.settings}
        onUpdateSettings={stableUpdateSettings}
        onClaimFacilitator={stableClaimFacilitator}
        onOpenFeedback={stableOpenFeedback}
        onOpenRetro={stableOpenRetro}
        messagesByChannel={messagesByChannel}
        onSendMessage={stableSendMessage}
        onDeleteMessage={stableDeleteMessage}
      />
      <FeedbackWidget
        toolName="Scrum Poker"
        triggerVariant="none"
        externalTriggerSignal={feedbackSignal}
      />
    </>
  );
}
