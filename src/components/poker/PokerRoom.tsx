"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Participant, DeckType, Vote, VotingRound, TimerState, Role, Issue, Room } from '@/lib/types';
import { calculateRoleEfforts, buildDefaultSettingsPatch, getParticipantCategory, checkConsensus, canParticipantVote, TECHNICAL_CATEGORIES, isParticipantPresent, getEligibleStatsVotes, resolveTshirtHours, computeSessionBreakdown, computeTopicTiming, roundEstimate, resolveRoundingMode } from '@/lib/poker-utils';
import { summarizeRound, divergenceLabel } from '@/lib/poker-results';
import { plainSnippet } from '@/lib/poker-table';
import { ParticipantList } from '@/components/poker/ParticipantList';
import { Controls } from '@/components/poker/Controls';
import { RoundCenter, RoleBreakdown, CopyEstimateCard } from '@/components/poker/Results';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, History as HistoryIcon, EyeOff, HelpCircle, Hourglass, Layers, ListChecks, Pin, Play, RotateCcw, RotateCw, Send, SkipForward, StickyNote, Users, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TopicDisplay } from './TopicDisplay';
import { RefinementNotes } from './RefinementNotes';
import { History } from './History';
import { JiraPublishDialog } from './JiraPublishDialog';
import { JiraPublishQueue } from './JiraPublishQueue';
import { jiraPublishApi, JIRA_PUBLISH_EVENT, type JiraPublishJob } from '@/app/room/jira-publish-api';
import { FacilitatorPanel } from './FacilitatorPanel';
import { pokerApi } from '../../app/room/api';
import { TopicQueue } from './TopicQueue';
import { cn } from '@/lib/utils';
import { PokerGuide } from './PokerGuide';
import { PokerChat } from './PokerChat';
import { TeamChat } from './team-chat/TeamChat';
import { IssueDetail } from './IssueDetail';
import { OutlierPrompt } from './OutlierPrompt';
import { ConfidenceSummary } from './ConfidenceSummary';
import { useSaveRoomTemplate } from './TemplateDialogs';
import { ReactionBar, ReactionBubbles, type RoomReaction } from './ReactionOverlay';
import { ShareRoomDialog } from './ShareRoomDialog';
import { RoomWelcome, RoomWaiting } from './RoomWelcome';
import { SwitchIssueDialog, OffTableDialog, CancelIssueDialog, FinishSessionDialog, CeremonySettingsDialog } from './PokerDialogs';
import { PokerRoomBar } from './PokerRoomBar';
import { PokerTable } from './PokerTable';
import { DecisionPanel } from './DecisionPanel';
import { TaskActionsMenu } from './TaskActionsMenu';
import { PokerSessionReport } from './PokerSessionReport';
import { Modal, ModalButton, pokerPhase, ResponsivePanel, RoomTimer, StatusChip } from '@/components/room-kit';

const WELCOME_DECK_LABELS: Record<string, string> = {
  fibonacci: 'Fibonacci',
  hours: 'Horas reais',
  tshirt: 'Camisetas',
};

interface PokerRoomProps {
  roomId: string;
  currentUser: Participant;
  participants: Participant[];
  /** Contas com a sala aberta agora (presença do WebSocket). `null`/ausente = o servidor não informa: vale o heartbeat (`lastSeen`). */
  socketOnline?: ReadonlySet<string> | null;
  votes: Vote[];
  deck: DeckType;
  votesRevealed: boolean;
  currentUserVote: string | null;
  onVote: (vote: string) => void;
  onSetConfidence?: (confidence: 'low' | 'medium' | 'high') => void;
  currentUserConfidence?: 'low' | 'medium' | 'high' | null;
  onSetDecisionNote?: (note: string) => void;
  onUpdateRefinementNotes?: (notes: { devNotes?: string; qaNotes?: string }) => void;
  reactionsEnabled?: boolean;
  reactions?: RoomReaction[];
  onReact?: (emoji: string) => void;
  onReveal: () => void;
  onClear: () => void;
  onSelectiveRevote?: (category: string) => void;
  selectiveRevotingRole?: string | null;
  onSetDeck: (deck: DeckType) => void;
  onRemoveParticipant: (id: string) => void;
  onUpdateParticipantRole: (id: string, newRole: Role) => void;
  isCurrentUserFacilitator: boolean;
  currentTopic?: string;
  onSetTopic: (topic: string) => void;
  votingRounds: VotingRound[] | null;
  timer?: TimerState;
  onSetTimerDuration: (duration: number) => void;
  onStartTimer: (duration: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  serverTimeOffset?: number;
  isSoundEnabled: boolean;
  onSetIsSoundEnabled: (enabled: boolean) => void;
  onOpenFeedback: () => void;
  onOpenRetro?: () => void;
  roomTitle?: string;
  roomTeam?: string;
  issuesQueue: Issue[];
  activeIssueId: string | null;
  referenceBaseline?: Room['referenceBaseline'];
  onSetReference?: (issueId: string | null) => void;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  onAddIssue: (title: string, jiraLink?: string, type?: Issue['type'], extraData?: Partial<Issue>) => void;
  onBulkAddIssues: (items: Partial<Issue>[]) => number | void;
  onSelectIssue: (issueId: string, autoSavePoints?: { points: string; devPoints?: string; qaPoints?: string }) => void;
  onDeleteIssue: (issueId: string) => void;
  onCompleteIssue: (points: string, devPoints?: string, qaPoints?: string, rolePoints?: Record<string, string>) => void;
  onSkipIssue: (note: string) => void;
  onParkIssue?: (note: string) => void;
  onCancelIssue?: (issueId: string, note?: string) => void;
  onStartSession?: () => void;
  onFinishSession?: () => void;
  onUnskipIssue?: (id: string) => void;
  onUncancelIssue?: (id: string) => void;
  onRevoteIssue?: (id: string) => void;
  settings?: Room['settings'];
  onUpdateSettings: (settings: Partial<NonNullable<Room['settings']>>) => void;
  onClaimFacilitator: () => void;
  messagesByChannel?: Record<string, any[]>;
  onSendMessage?: (text: string, kind: 'text' | 'code', channelId: string) => void;
  onDeleteMessage?: (messageId: string, channelId: string) => void;
}

const PokerRoomComponent = ({
  roomId,
  currentUser,
  participants,
  socketOnline = null,
  votes,
  deck,
  votesRevealed,
  currentUserVote,
  onVote,
  onSetConfidence,
  currentUserConfidence,
  onSetDecisionNote,
  onUpdateRefinementNotes,
  reactionsEnabled,
  reactions,
  onReact,
  onReveal,
  onClear,
  onSelectiveRevote,
  selectiveRevotingRole,
  onSetDeck,
  onRemoveParticipant,
  onUpdateParticipantRole,
  isCurrentUserFacilitator,
  currentTopic,
  onSetTopic,
  votingRounds,
  timer,
  onSetTimerDuration,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  serverTimeOffset = 0,
  isSoundEnabled,
  onSetIsSoundEnabled,
  onOpenFeedback,
  onOpenRetro,
  roomTitle,
  roomTeam,
  issuesQueue,
  activeIssueId,
  referenceBaseline,
  onSetReference,
  sessionStartedAt,
  sessionEndedAt,
  onAddIssue,
  onBulkAddIssues,
  onSelectIssue,
  onDeleteIssue,
  onCompleteIssue,
  onSkipIssue,
  onParkIssue,
  onCancelIssue,
  onStartSession,
  onFinishSession,
  onUnskipIssue,
  onUncancelIssue,
  onRevoteIssue,
  settings,
  onUpdateSettings,
  onClaimFacilitator,
  messagesByChannel = {},
  onSendMessage = () => {},
  onDeleteMessage = () => {},
}: PokerRoomProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isFacilitatorSettingsOpen, setIsFacilitatorSettingsOpen] = useState(false);
  const [isOffTableDialogOpen, setIsOffTableDialogOpen] = useState(false);
  const [offTableMode, setOffTableMode] = useState<'skip' | 'park'>('skip');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isTeamChatOpen, setIsTeamChatOpen] = useState(false);
  const [teamChatUnread, setTeamChatUnread] = useState(0);

  // Assistente da Base e chat do time abrem no mesmo painel lateral: abrir um
  // fecha o outro para não empilhar dois painéis no mesmo lugar.
  const toggleKnowledgeChat = () => {
    setIsTeamChatOpen(false);
    setIsParticipantsOpen(false);
    setIsHistoryOpen(false);
    setIsChatOpen(v => !v);
  };
  const toggleTeamChat = () => {
    setIsChatOpen(false);
    setIsParticipantsOpen(false);
    setIsHistoryOpen(false);
    setIsTeamChatOpen(v => !v);
  };
  const toggleParticipants = () => {
    setIsChatOpen(false);
    setIsTeamChatOpen(false);
    setIsHistoryOpen(false);
    setIsParticipantsOpen(v => !v);
  };
  const toggleHistory = () => {
    setIsChatOpen(false);
    setIsTeamChatOpen(false);
    setIsParticipantsOpen(false);
    setIsHistoryOpen(v => !v);
  };
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Ajuste manual das horas finais por papel (baralho de horas). Vale ao salvar e ao copiar; zera a cada rodada.
  const [adjusted, setAdjusted] = useState<Record<string, string>>({});
  const [pendingIssueId, setPendingIssueId] = useState<string | null>(null);
  // Pular e Adiar dividem um botao so ("Tirar da mesa") e um modal so: o modo
  // escolhido dentro do modal decide qual handler roda. Economiza espaco numa
  // toolbar que ja disputa largura com Revelar/Cancelar/Encerrar.
  const canParkTask = (settings?.parkTask ?? true) && !!onParkIssue;
  const openOffTableDialog = (mode: 'skip' | 'park') => {
    setOffTableMode(canParkTask ? mode : 'skip');
    setIsOffTableDialogOpen(true);
  };
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);

  // Esc sai da apresentação: é o gesto que todo mundo tenta primeiro quando
  // uma tela "toma conta" do monitor.
  useEffect(() => {
    if (!isTheaterMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsTheaterMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTheaterMode]);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [jiraImportSignal, setJiraImportSignal] = useState(0);
  const [addFormSignal, setAddFormSignal] = useState(0);

  // Tick de presença: re-avalia online/offline a cada 15s mesmo sem novos
  // dados (participante offline para de escrever, então precisamos de um
  // relógio local para expirá-lo).
  const [presenceTick, setPresenceTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setPresenceTick(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  const onlineIds = useMemo(
    () => new Set(participants.filter(p => isParticipantPresent(p, presenceTick, socketOnline)).map(p => p.id)),
    [participants, presenceTick, socketOnline]
  );

  // Pede permissão de notificação do navegador assim que o recurso é ligado,
  // para poder avisar mesmo com a aba em segundo plano.
  useEffect(() => {
    if (!settings?.turnNotification) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
  }, [settings?.turnNotification]);

  // Notificação "sua vez" (opt-in): avisa o votante quando uma nova rodada
  // abre e ele ainda não votou. Uma vez por tópico ativo (ref evita repetir).
  const notifiedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settings?.turnNotification) { notifiedTurnRef.current = null; return; }
    if (!activeIssueId || votesRevealed || currentUserVote) return;
    if (!canParticipantVote(currentUser, settings?.allowManagementToVote)) return;
    if (notifiedTurnRef.current === activeIssueId) return;
    notifiedTurnRef.current = activeIssueId;
    toast({ title: 'É a sua vez de votar!', description: 'Uma nova rodada foi aberta.' });
    if (isSoundEnabled) {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch { /* ignore */ }
    }
    if (typeof document !== 'undefined' && document.hidden && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const issueTitle = issuesQueue.find(i => i.id === activeIssueId)?.title;
      try {
        const notification = new Notification('É a sua vez de votar!', {
          body: issueTitle ? `Nova rodada aberta: ${issueTitle}` : 'Uma nova rodada foi aberta no Scrum Poker.',
          tag: 'poker-turn-notification',
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch { /* ignore */ }
    }
  }, [settings?.turnNotification, settings?.allowManagementToVote, activeIssueId, votesRevealed, currentUserVote, currentUser, isSoundEnabled, toast, issuesQueue]);

  const isInitialState = issuesQueue.length === 0;
  // Sessão encerrada: ou a fila acabou (todos concluídos), ou o facilitador
  // encerrou com itens ainda pendentes ("acabou o tempo"). No segundo caso
  // sobram itens `pending`, então a checagem antiga (`every completed`) não
  // vale — o marco passa a ser o sessionEndedAt sem nenhum item na mesa.
  const isSessionFinished = !activeIssueId && issuesQueue.length > 0 &&
    (issuesQueue.every(i => i.status === 'completed' || i.skipped || i.cancelled || i.parked) || !!sessionEndedAt);

  const divergences = useMemo(() => {
    const map = new Map<string, 'warning' | 'destructive' | 'none'>();
    if (!votesRevealed) return map;

    const participantMap = new Map(participants.map(p => [p.id, p]));
    const groupedVotes = new Map<string, { participantId: string; value: string }[]>();

    votes.forEach(vote => {
      const p = participantMap.get(vote.participantId);
      if (!p) return;
      
      const category = getParticipantCategory(p);
      if (category && category !== 'Management') {
        if (!groupedVotes.has(category)) {
          groupedVotes.set(category, []);
        }
        groupedVotes.get(category)!.push({ participantId: p.id, value: vote.value });
      }
    });

    groupedVotes.forEach((roleVotes) => {
      if (roleVotes.length > 1) {
        if (deck === 'hours') {
          const numericValues = roleVotes.map(v => Number(v.value)).filter(n => !isNaN(n));
          if (numericValues.length > 1) {
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);
            const diff = max - min;

            // Limites configuráveis pelo facilitador; ausência = padrão 2/5.
            const warn = settings?.divergenceThresholds?.warn ?? 2;
            const high = settings?.divergenceThresholds?.high ?? 5;

            if (diff > high) {
              roleVotes.forEach(v => map.set(v.participantId, 'destructive'));
            } else if (diff > warn) {
              roleVotes.forEach(v => map.set(v.participantId, 'warning'));
            }
          }
        } else {
          if (!checkConsensus(roleVotes as any)) {
            roleVotes.forEach(v => map.set(v.participantId, 'destructive'));
          }
        }
      }
    });

    return map;
  }, [votesRevealed, votes, participants, deck, settings?.divergenceThresholds?.warn, settings?.divergenceThresholds?.high]);

  const stats = useMemo(() => {
    if (!isSessionFinished) return null;

    const estimatedIssues = issuesQueue.filter(i => !i.skipped && !i.cancelled && i.status === 'completed');
    const skippedIssues = issuesQueue.filter(i => i.skipped && !i.cancelled);
    const cancelledIssues = issuesQueue.filter(i => i.cancelled);
    // Adiadas: passaram pelo park ao menos uma vez (parkCount persiste mesmo
    // depois de estimadas). `parked` cobre sessões antigas sem o contador.
    const parkedIssues = issuesQueue.filter(i => (i.parkCount || 0) > 0 || i.parked);
    const untouchedIssues = issuesQueue.filter(i => !i.skipped && !i.cancelled && i.status !== 'completed');
    const breakdown = computeSessionBreakdown(issuesQueue, votingRounds || []);

    const totalTopics = estimatedIssues.length;
    const totalPoints = estimatedIssues.reduce((acc, issue) => {
      const p = parseFloat(issue.estimatedPoints || '0');
      return acc + (isNaN(p) ? 0 : p);
    }, 0);

    let totalDevHours = 0;
    let totalQaHours = 0;

    if (deck === 'hours') {
      estimatedIssues.forEach(issue => {
        totalDevHours += parseFloat(issue.devPoints || '0');
        totalQaHours += parseFloat(issue.qaPoints || '0');
      });
    }

    let durationStr = "N/A";
    let avgTimePerTopic = "N/A";
    let idleMins = 0;

    // Duração ativa = soma do tempo por tópico, que já desconta pausas longas
    // (sala aberta de manhã pra sessão da tarde). Sem rodadas suficientes, cai
    // no delta cru início-fim como antes.
    const timing = computeTopicTiming(votingRounds || [], issuesQueue, sessionStartedAt);
    const activeMins = timing.reduce((s, r) => s + r.mins, 0);
    idleMins = timing.reduce((s, r) => s + r.idleMins, 0);

    if (activeMins > 0 || (sessionStartedAt && sessionEndedAt)) {
      const rawMins = sessionStartedAt && sessionEndedAt
        ? Math.max(1, Math.round((new Date(sessionEndedAt).getTime() - new Date(sessionStartedAt).getTime()) / 60000))
        : 0;
      const mins = activeMins > 0 ? activeMins : rawMins;
      durationStr = `${mins} min`;
      avgTimePerTopic = breakdown.discussed > 0
        ? `${(mins / breakdown.discussed).toFixed(1)} min/item`
        : '0 min/item';
    }

    return {
      totalTopics, totalPoints, durationStr, avgTimePerTopic, idleMins,
      totalDevHours, totalQaHours,
      estimatedIssues, skippedIssues, cancelledIssues, parkedIssues, untouchedIssues, breakdown,
    };
  }, [isSessionFinished, issuesQueue, sessionStartedAt, sessionEndedAt, deck, votingRounds]);

  const handleCopyLink = () => {
    setIsShareDialogOpen(true);
  };

  const saveRoomTemplate = useSaveRoomTemplate({ roomTitle, deck, settings, issues: issuesQueue });

  const handleReveal = () => {
    onReveal();
    setIsFacilitatorSettingsOpen(false);
  };

  const handleExportTasksToWorkspace = async () => {
    if (issuesQueue.length === 0) {
      toast({ title: "Nenhuma tarefa para exportar", variant: "destructive" });
      return;
    }

    // Salvamento manual (caso queiram forçar uma atualização)
    const finishedIssues = issuesQueue.filter(i => i.status === 'completed');
    const summary = {
      estimatedTasks: finishedIssues.map(i => ({ title: i.title, points: i.estimatedPoints })),
      stats: stats || {}
    };

    try {
      // saveOrUpdateRoom persiste o registro inteiro (sem PATCH parcial no
      // backend), então buscamos o estado atual da sala antes de gravar só o
      // resumo por cima, evitando sobrescrever os demais campos com valores vazios.
      const currentRoom = await pokerApi.getRoom(roomId);
      await pokerApi.saveOrUpdateRoom({ ...currentRoom, summary });
      toast({ title: "Histórico sincronizado!", description: "O resumo da sessão foi atualizado para todos no Workspace." });
    } catch (err) {
      console.error('Erro ao sincronizar resumo da sessão:', err);
      toast({ title: "Erro ao sincronizar", description: "Não foi possível atualizar o resumo da sessão.", variant: "destructive" });
    }
  };

  const roundingMode = resolveRoundingMode(settings?.roundingMode);

  const getCalculatedPoints = () => {
    if (votes.length === 0) return null;

    if (deck === 'hours' || deck === 'fibonacci' || !deck) {
      const result = calculateRoleEfforts(votes, participants, deck || 'fibonacci', undefined, roundingMode);
      if (deck === 'hours' && Object.keys(adjusted).length > 0) {
        const rolePoints = { ...result.rolePoints, ...adjusted };
        const total = Object.values(rolePoints).reduce((acc, v) => acc + (Number(v) || 0), 0);
        return {
          points: String(total),
          devPoints: rolePoints['Developer'] || '0',
          qaPoints: rolePoints['QA'] || '0',
          rolePoints,
        };
      }
      return {
        points: result.totalPoints,
        devPoints: result.devPoints,
        qaPoints: result.qaPoints,
        rolePoints: result.rolePoints
      };
    } else if (deck === 'tshirt') {
      // Mesma equivalência usada no Results ao vivo — sem isso a estimativa
      // FINAL salva na issue ficava presa na moda mesmo quando o card já
      // mostrava a média real em horas (inconsistência entre o que se vê e
      // o que se salva).
      // Só votos elegíveis (sem gestão/espectador), igual ao que o resumo da revelação mostra.
      const eligible = getEligibleStatsVotes(votes, participants, settings?.allowManagementToVote);
      const numericVals = eligible
        .map(v => resolveTshirtHours(v.value, settings?.tshirtEquivalents))
        .filter(n => !isNaN(n));
      if (numericVals.length > 0) {
        const avg = roundEstimate(numericVals.reduce((a, b) => a + b, 0) / numericVals.length, roundingMode, deck);
        return { points: String(avg) };
      }
      const allVoteValues = eligible.map(v => v.value).filter(v => v !== '?' && v !== '☕');
      if (allVoteValues.length === 0) return null;
      const voteCounts = allVoteValues.reduce((acc, value) => { acc[value] = (acc[value] || 0) + 1; return acc; }, {} as Record<string, number>);
      const points = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
      return { points };
    }
    
    return null;
  };

  // Publicação no Jira: fila de envios da sala (carregada uma vez; o WebSocket avisa as mudanças pelo
  // evento de janela JIRA_PUBLISH_EVENT, disparado pela página) e a tarefa cuja prévia está aberta.
  const [jiraJobs, setJiraJobs] = useState<JiraPublishJob[]>([]);
  const [jiraPublishIssue, setJiraPublishIssue] = useState<Issue | null>(null);
  const [jiraRetryingId, setJiraRetryingId] = useState<string | null>(null);
  const mergeJiraJob = (job: JiraPublishJob) => {
    setJiraJobs(prev => {
      const idx = prev.findIndex(j => j.id === job.id);
      if (idx < 0) return [job, ...prev];
      const next = [...prev];
      next[idx] = job;
      return next;
    });
  };
  useEffect(() => {
    let alive = true;
    jiraPublishApi.list(roomId).then(jobs => { if (alive) setJiraJobs(jobs); }).catch(() => { /* sem fila ainda, ou backend antigo */ });
    const onUpdate = (e: Event) => {
      const job = (e as CustomEvent<JiraPublishJob>).detail;
      if (job && job.roomId === roomId) mergeJiraJob(job);
    };
    window.addEventListener(JIRA_PUBLISH_EVENT, onUpdate);
    return () => { alive = false; window.removeEventListener(JIRA_PUBLISH_EVENT, onUpdate); };
  }, [roomId]);
  const jiraStatusByIssueId = useMemo(() => {
    // O envio mais recente de cada tarefa (a lista vem do mais novo para o mais antigo).
    const out: Record<string, JiraPublishJob['status']> = {};
    for (const j of jiraJobs) if (j.issueId && !(j.issueId in out)) out[j.issueId] = j.status;
    return out;
  }, [jiraJobs]);
  const handleJiraRetry = async (jobId: string) => {
    setJiraRetryingId(jobId);
    try {
      mergeJiraJob(await jiraPublishApi.retry(roomId, jobId));
    } catch (e) {
      toast({ title: 'Não foi possível tentar de novo', description: e instanceof Error ? e.message : 'Erro inesperado.', variant: 'destructive' });
    } finally {
      setJiraRetryingId(null);
    }
  };
  const activeIssueForJira = useMemo(
    () => (activeIssueId ? issuesQueue.find(i => i.id === activeIssueId) ?? null : null),
    [issuesQueue, activeIssueId]
  );

  const handleCalculateAndComplete = () => {
    const result = getCalculatedPoints() as any;
    // Só "?" / café (ou só gestão) não é estimativa: salvar "0" apagaria a informação de que ninguém estimou.
    const hasNumericVote = votes.some(v => v.value !== '?' && v.value !== '☕');
    if (!result || !hasNumericVote || (deck !== 'tshirt' && Number(result.points) === 0 && !votes.some(v => Number(v.value) === 0))) {
      toast({
        title: 'Sem estimativa para salvar',
        description: 'Os votos são "?" ou café, ou só de gestão. Reabra a votação, pule ou adie a tarefa.',
        variant: 'destructive',
      });
      return;
    }
    onCompleteIssue(result.points, result.devPoints, result.qaPoints, result.rolePoints);
  };

  // Consenso pleno (todos os votos elegíveis iguais) e divergência crítica —
  // alimentam o auto-consenso e a sugestão de revotação (ambos opt-in).
  const hasConsensus = useMemo(() => {
    const eligible = getEligibleStatsVotes(votes, participants, settings?.allowManagementToVote);
    return eligible.length > 1 && new Set(eligible.map(v => v.value)).size === 1;
  }, [votes, participants, settings?.allowManagementToVote]);
  const hasHighDivergence = useMemo(() => [...divergences.values()].some(d => d === 'destructive'), [divergences]);

  // Resultado da rodada revelada (mesma conta do salvar): alimenta o centro da mesa, os cartões por papel e o "Copiar estimativa".
  const summary = useMemo(
    () => (votesRevealed
      ? summarizeRound(votes, participants, deck, { allowManagementToVote: settings?.allowManagementToVote, tshirtEquivalents: settings?.tshirtEquivalents, roundingMode })
      : null),
    [votesRevealed, votes, participants, deck, settings?.allowManagementToVote, settings?.tshirtEquivalents, roundingMode]
  );
  const roundDivergenceLabel = useMemo(() => {
    if (!summary) return undefined;
    const levels: Partial<Record<string, 'warning' | 'destructive'>> = {};
    participants.forEach(p => {
      const level = divergences.get(p.id);
      const cat = getParticipantCategory(p);
      if (cat && (level === 'warning' || level === 'destructive')) levels[cat] = level;
    });
    return divergenceLabel(summary, levels, deck);
  }, [summary, participants, divergences, deck]);

  // Ajuste manual vale só para a rodada atual: nova tarefa ou nova votação zera.
  useEffect(() => { setAdjusted({}); }, [activeIssueId, votesRevealed]);

  // Contador de rodadas do item ativo: cada REVELAR grava um round com o
  // issueId (rounds pulados não contam). Alimenta o badge e o aviso opt-in
  // roundNudge ("muitas rodadas, quebre ou adie").
  const activeRoundCount = useMemo(() => {
    if (!activeIssueId) return 0;
    return (votingRounds || []).filter(r => r.issueId === activeIssueId && !r.skipped).length;
  }, [votingRounds, activeIssueId]);
  const maxRounds = settings?.maxRounds ?? 3;
  // Revelado: mostra a rodada recém-fechada; em votação: a rodada em andamento.
  const currentRoundNumber = votesRevealed ? Math.max(1, activeRoundCount) : activeRoundCount + 1;
  const showRoundNudge = !!settings?.roundNudge && votesRevealed && !hasConsensus && activeRoundCount >= maxRounds;

  // Auto-consenso: ao revelar com consenso, salva e avança sozinho (uma vez por
  // tópico). Ao completar, votesRevealed volta a false e o gate impede repetir.
  const autoConsensusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settings?.autoConsensus || !isCurrentUserFacilitator || !votesRevealed || !activeIssueId || !hasConsensus) return;
    if (autoConsensusRef.current === activeIssueId) return;
    autoConsensusRef.current = activeIssueId;
    handleCalculateAndComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.autoConsensus, isCurrentUserFacilitator, votesRevealed, activeIssueId, hasConsensus]);

  const handlePreSelectIssue = (id: string) => {
    if (id === activeIssueId) return;

    // Se houver votos na mesa, precisamos decidir o que fazer
    if (isCurrentUserFacilitator && votes.length > 0) {
      // Se já estiver REVELADO, salvamos e mudamos de forma ATÔMICA
      if (votesRevealed) {
        const result = getCalculatedPoints();
        if (result) {
          // Chamamos onSelectIssue passando os pontos para salvamento no MESMO update
          onSelectIssue(id, {
            points: result.points,
            devPoints: result.devPoints,
            qaPoints: result.qaPoints,
            rolePoints: result.rolePoints
          } as any);
          return;
        }
      } else {
        // Se estiver OCULTO, perguntamos se quer descartar
        setPendingIssueId(id);
        return;
      }
    }

    onSelectIssue(id);
  };

  const confirmIssueSwitch = () => {
    if (pendingIssueId) {
      onSelectIssue(pendingIssueId);
      setPendingIssueId(null);
    }
  };

  const activeIssue = issuesQueue.find(i => i.id === activeIssueId);
  const activeIssueIndex = issuesQueue.findIndex(i => i.id === activeIssueId);
  const hasNextPending = activeIssueIndex !== -1 && issuesQueue.slice(activeIssueIndex + 1).some(i => i.status === 'pending');

  // Quórum: votantes elegíveis (mesma regra do denominador) E online que ainda
  // não votaram. Excluir offline evita que um fantasma (aba fechada) trave o
  // "FALTAM N" pra sempre. Alimenta o aviso antes da revelação.
  const eligibleVoters = participants.filter(p => canParticipantVote(p, settings?.allowManagementToVote) && onlineIds.has(p.id));

  // Categorias técnicas realmente presentes na sala — alimentam o revote
  // seletivo genérico (antes só Dev/QA fixos).
  const presentCategories = TECHNICAL_CATEGORIES.filter(cat =>
    participants.some(p => getParticipantCategory(p) === cat)
  );

  const queueContent = (
    <TopicQueue
      issues={issuesQueue}
      activeIssueId={activeIssueId}
      isFacilitator={isCurrentUserFacilitator}
      onAddIssue={onAddIssue}
      onBulkAddIssues={onBulkAddIssues}
      onSelectIssue={handlePreSelectIssue}
      onDeleteIssue={onDeleteIssue}
      onUnskipIssue={onUnskipIssue}
      onRevoteIssue={onRevoteIssue}
      onCancelIssue={onCancelIssue}
      onUncancelIssue={onUncancelIssue}
      onSetReference={onSetReference}
      referenceIssueId={referenceBaseline?.issueId || null}
      referenceEnabled={!!settings?.referenceStory}
      deck={deck}
      rounds={votingRounds || []}
      participants={participants}
      autoOpenJiraImportSignal={jiraImportSignal}
      autoOpenAddFormSignal={addFormSignal}
    />
  );

  const participantsPanel = (
    <ParticipantList
      participants={participants}
      votes={votes}
      currentUserId={currentUser.id}
      isFacilitator={isCurrentUserFacilitator}
      onRemoveParticipant={onRemoveParticipant}
      onUpdateParticipantRole={onUpdateParticipantRole}
      onClaimFacilitator={onClaimFacilitator}
      onlineIds={onlineIds}
      allowManagementToVote={settings?.allowManagementToVote}
    />
  );

  const phase = pokerPhase({ hasActiveIssue: !!activeIssueId && !isSessionFinished, sessionStarted: !!sessionStartedAt, revealed: votesRevealed });
  const deckLabel = WELCOME_DECK_LABELS[deck] || deck;
  const showRevealButton = !!activeIssueId && !isSessionFinished && !votesRevealed;
  const timerVisible = !!timer && (timer.initialDuration > 0 || timer.status !== 'stopped');
  const sessionStatus = isSessionFinished ? 'done' : sessionStartedAt ? 'live' : 'waiting';
  const presencePeople = participants.map(p => ({ id: p.id, name: p.nickname, online: onlineIds.has(p.id) }));
  const pendingQueueCount = issuesQueue.filter(i => i.status !== 'completed' && !i.skipped && !i.cancelled && !i.parked).length;

  const taskMenu = isCurrentUserFacilitator && activeIssueId && !isSessionFinished ? (
    <TaskActionsMenu
      canTakeOffTable={!votesRevealed}
      canPark={canParkTask}
      onTakeOffTable={() => openOffTableDialog('skip')}
      canCancel={!votesRevealed && (settings?.cancelTask ?? true) && !!onCancelIssue}
      onCancel={() => setIsCancelDialogOpen(true)}
      canFinish={!!onFinishSession && !!sessionStartedAt}
      onFinish={() => setIsFinishDialogOpen(true)}
    />
  ) : null;

  const hasNotes = !!(activeIssue?.devNotes?.trim() || activeIssue?.qaNotes?.trim());

  const tableFooter = (
    <>
      {settings?.referenceStory && referenceBaseline && !votesRevealed ? (
        <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1.5 text-xs text-muted-foreground">
          <Pin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">Régua: <strong className="font-semibold text-foreground">{referenceBaseline.key ? `${referenceBaseline.key} = ` : ''}{referenceBaseline.display}</strong> · {referenceBaseline.title}</span>
          {isCurrentUserFacilitator && onSetReference && (
            <button type="button" onClick={() => onSetReference(null)} aria-label="Remover referência" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-3 w-3" strokeWidth={1.5} />
            </button>
          )}
        </span>
      ) : <span />}
      {reactionsEnabled && onReact && <ReactionBar onReact={onReact} />}
    </>
  );

  const theaterBar = (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <StatusChip tone="danger" dot className="uppercase tracking-wide">Apresentando</StatusChip>
        <span className="truncate text-sm font-semibold">{roomTitle || 'Scrum Poker'}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {timerVisible && timer && (
          <RoomTimer
            timer={timer}
            isFacilitator={isCurrentUserFacilitator}
            onStart={onStartTimer}
            onPause={onPauseTimer}
            onResume={onResumeTimer}
            onReset={onResetTimer}
            onSetDuration={onSetTimerDuration}
            isSoundEnabled={isSoundEnabled}
            serverOffset={serverTimeOffset}
          />
        )}
        <Button variant="outline" size="sm" onClick={() => setIsTheaterMode(false)} className="h-9 gap-2 rounded-lg">
          <X className="h-4 w-4" strokeWidth={1.5} /> Sair da apresentação <kbd className="hidden rounded border border-border px-1 text-[11px] md:inline">Esc</kbd>
        </Button>
      </div>
    </header>
  );

  const banners: React.ReactNode[] = [];
  if (votesRevealed && settings?.suggestRevote && hasHighDivergence) {
    banners.push(
      <div key="revote" className="flex flex-col justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/5 p-3.5 sm:flex-row sm:items-center">
        <span className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.5} /> Divergência crítica entre os votos. Vale discutir e revotar.</span>
        {isCurrentUserFacilitator && <Button size="sm" variant="outline" onClick={onClear} className="h-9 gap-2 whitespace-nowrap rounded-lg"><RotateCcw className="h-4 w-4" strokeWidth={1.5} /> Revotar todos</Button>}
      </div>
    );
  }
  if (showRoundNudge) {
    banners.push(
      <div key="nudge" className="flex flex-col justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 sm:flex-row sm:items-center">
        <span className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"><Layers className="h-4 w-4 shrink-0" strokeWidth={1.5} /> {activeRoundCount} rodadas sem consenso. Considere quebrar a história em partes menores ou adiá-la.</span>
        {isCurrentUserFacilitator && (
          <Button size="sm" variant="outline" onClick={() => openOffTableDialog('park')} className="h-9 gap-2 whitespace-nowrap rounded-lg">
            {canParkTask ? <><Hourglass className="h-4 w-4" strokeWidth={1.5} /> Adiar</> : <><SkipForward className="h-4 w-4" strokeWidth={1.5} /> Pular</>}
          </Button>
        )}
      </div>
    );
  }
  if (votesRevealed && settings?.groomingFlag && votes.some(v => v.value === '?')) {
    banners.push(
      <div key="grooming" className="flex flex-col justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 sm:flex-row sm:items-center">
        <span className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"><HelpCircle className="h-4 w-4 shrink-0" strokeWidth={1.5} /> {votes.filter(v => v.value === '?').length} pessoa(s) pediram mais informação (voto &quot;?&quot;).</span>
        {isCurrentUserFacilitator && (
          <Button size="sm" variant="outline" onClick={() => onSkipIssue('Enviado para grooming — faltou informação para estimar.')} className="h-9 gap-2 whitespace-nowrap rounded-lg">
            <SkipForward className="h-4 w-4" strokeWidth={1.5} /> Enviar para grooming
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {isTheaterMode ? theaterBar : (
        <>
          <PokerRoomBar
            roomTitle={roomTitle || 'Scrum Poker'}
            roomTeam={roomTeam}
            deckLabel={deckLabel}
            phase={isSessionFinished ? null : phase}
            status={sessionStatus}
            people={presencePeople}
            queueCount={pendingQueueCount}
            onOpenFeedback={onOpenFeedback}
            isFacilitator={isCurrentUserFacilitator}
            timer={timer}
            serverTimeOffset={serverTimeOffset}
            isSoundEnabled={isSoundEnabled}
            onSetIsSoundEnabled={onSetIsSoundEnabled}
            onStartTimer={onStartTimer}
            onPauseTimer={onPauseTimer}
            onResumeTimer={onResumeTimer}
            onResetTimer={onResetTimer}
            onSetTimerDuration={onSetTimerDuration}
            isQueueOpen={isQueueOpen}
            onToggleQueue={() => setIsQueueOpen(v => !v)}
            isParticipantsOpen={isParticipantsOpen}
            onToggleParticipants={toggleParticipants}
            isTeamChatOpen={isTeamChatOpen}
            teamChatUnread={teamChatUnread}
            onToggleTeamChat={toggleTeamChat}
            isKnowledgeOpen={isChatOpen}
            onToggleKnowledge={toggleKnowledgeChat}
            isHistoryOpen={isHistoryOpen}
            historyCount={(votingRounds || []).length}
            onToggleHistory={toggleHistory}
            onShare={handleCopyLink}
            onOpenSettings={() => setIsFacilitatorSettingsOpen(true)}
            onOpenGuide={() => setIsGuideOpen(true)}
            onTheater={() => setIsTheaterMode(true)}
            onOpenRetro={onOpenRetro}
            canReveal={votes.length > 0}
            showReveal={showRevealButton}
            votedCount={votes.length}
            voterTotal={Math.max(eligibleVoters.length, votes.length)}
            onReveal={handleReveal}
          />
        </>
      )}

      <div className="relative flex min-h-0 flex-1">
        {!isTheaterMode && (
          <ResponsivePanel
            side="left"
            open={isQueueOpen}
            onOpenChange={setIsQueueOpen}
            sheetBelow={1024}
            widthClass="w-80"
            title="Fila"
            icon={ListChecks}
            count={issuesQueue.length}
            flush
          >
            {queueContent}
          </ResponsivePanel>
        )}

        <main className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div aria-hidden="true" className="room-halo pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]" />

          {/* Miolo rolável: os filhos não encolhem (sem isso a mesa, com overflow oculto, era espremida e cortada); só a mesa estica. */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:px-5 [&>*]:shrink-0">
          {isInitialState ? (
            <div className="flex flex-1 items-start justify-center py-1">
              {isCurrentUserFacilitator ? (
                <RoomWelcome
                  deck={deck}
                  maxHours={settings?.maxHours}
                  deckLabel={deckLabel}
                  roomTeam={roomTeam}
                  participants={participants}
                  onlineIds={onlineIds}
                  roomUrl={typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : ''}
                  onShare={handleCopyLink}
                  onImportJira={() => { setIsQueueOpen(true); setJiraImportSignal(s => s + 1); }}
                  onAddManual={() => { setIsQueueOpen(true); setAddFormSignal(s => s + 1); }}
                />
              ) : (
                <RoomWaiting deck={deck} maxHours={settings?.maxHours} deckLabel={deckLabel} roomTeam={roomTeam} participants={participants} onlineIds={onlineIds} />
              )}
            </div>
          ) : isSessionFinished && stats ? (
            <PokerSessionReport
              roomId={roomId}
              roomTitle={roomTitle}
              roomTeam={roomTeam}
              deck={deck}
              stats={stats}
              issues={issuesQueue}
              participants={participants}
              rounds={votingRounds || []}
              sessionStartedAt={sessionStartedAt}
              sessionEndedAt={sessionEndedAt}
              settings={settings}
              onRefreshHistory={handleExportTasksToWorkspace}
              onOpenRetro={onOpenRetro}
              onNewSession={() => router.push('/room?nova=1')}
            />
          ) : (
            <>
              <TopicDisplay
                topic={String(activeIssue?.title || currentTopic || '')}
                jiraLink={activeIssue?.jiraLink || undefined}
                issueKey={activeIssue?.key}
                issueType={activeIssue?.jiraType}
                snippet={plainSnippet(activeIssue?.description)}
                hasDetail={!!(activeIssue?.jiraLink || activeIssue?.description || activeIssue?.acceptanceCriteria)}
                onSetTopic={onSetTopic}
                isFacilitator={isCurrentUserFacilitator}
                isTheaterMode={isTheaterMode}
                onShowDetail={() => setIsDetailOpen(true)}
                onShowNotes={settings?.refinementNotes && activeIssueId ? () => setIsNotesOpen(true) : undefined}
                hasNotes={hasNotes}
                menu={taskMenu}
                round={activeIssueId ? currentRoundNumber : undefined}
                maxRounds={settings?.roundNudge ? maxRounds : undefined}
                revealed={votesRevealed}
              />

              {banners.length > 0 && <div className="flex flex-col gap-2.5">{banners}</div>}

              {/* Início explícito da cerimônia: o relógio da sessão e o tempo de cada tarefa contam daqui. */}
              {activeIssueId && !sessionStartedAt && (
                <section aria-label="Início do refinamento" className="room-rise flex flex-col items-stretch justify-between gap-3 rounded-[14px] border border-primary/40 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary ring-1 ring-inset ring-primary/25 dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
                      <Clock className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <h2 className="m-0 text-[15px] font-semibold">{isCurrentUserFacilitator ? 'Tudo pronto para começar' : 'Aguardando o facilitador iniciar o refinamento'}</h2>
                  </div>
                  {isCurrentUserFacilitator && onStartSession && (
                    <ModalButton variant="primary" onClick={onStartSession} className="h-10 w-full gap-2 px-6 sm:w-auto">
                      <Play className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Iniciar refinamento
                    </ModalButton>
                  )}
                </section>
              )}

              {votesRevealed && summary ? (
                <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="flex min-w-0 flex-col gap-4">
                    <PokerTable
                      participants={participants}
                      votes={votes}
                      votesRevealed
                      roomy
                      deck={deck}
                      currentUserId={currentUser.id}
                      allowManagementToVote={settings?.allowManagementToVote}
                      divergences={divergences}
                      groupByRole={!!settings?.groupVotesByRole}
                      anonymousReveal={!!settings?.anonymousReveal}
                      onlineIds={onlineIds}
                      large={isTheaterMode}
                      revealedCenter={
                        settings?.anonymousReveal ? (
                          <span className="flex items-center gap-2 text-sm text-muted-foreground"><EyeOff className="h-4 w-4" strokeWidth={1.5} /> Revelação anônima: só o resultado aparece</span>
                        ) : (
                          <RoundCenter summary={summary} deck={deck} tshirtEquivalents={settings?.tshirtEquivalents} divergenceLabel={roundDivergenceLabel} large={isTheaterMode} />
                        )
                      }
                    />
                    <RoleBreakdown summary={summary} deck={deck} showBars={!!settings?.showDistribution} />
                    {summary.unmappedTshirt > 0 && (
                      <p className="m-0 text-xs text-amber-700 dark:text-amber-300">{summary.unmappedTshirt} voto{summary.unmappedTshirt > 1 ? 's' : ''} em tamanho sem equivalência ficou fora da média.</p>
                    )}
                    {deck === 'fibonacci' && summary.totalHours !== '0' && summary.totalHours !== summary.avg && (
                      <p className="m-0 text-xs text-muted-foreground" title="Ao salvar, vale a soma das médias por papel">Total ao salvar: {summary.totalHours}</p>
                    )}
                    {settings?.confidenceVote && <ConfidenceSummary votes={votes} participants={participants} allowManagementToVote={settings?.allowManagementToVote} />}
                  </div>
                  <aside className="flex min-w-0 flex-col gap-4" aria-label="Resultado da rodada">
                    <CopyEstimateCard summary={summary} deck={deck} values={deck === 'hours' ? adjusted : undefined} />
                    {activeIssueForJira?.key && activeIssueForJira.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-full gap-2 rounded-lg"
                        onClick={() => setJiraPublishIssue(activeIssueForJira)}
                        disabled={jiraStatusByIssueId[activeIssueForJira.id] === 'DONE' || jiraStatusByIssueId[activeIssueForJira.id] === 'RUNNING'}
                      >
                        <Send className="h-4 w-4" strokeWidth={1.5} />
                        {jiraStatusByIssueId[activeIssueForJira.id] === 'DONE' ? 'Enviado ao Jira' : 'Enviar para o Jira'}
                      </Button>
                    )}
                    {settings?.outlierPrompt && !settings?.anonymousReveal && (
                      <OutlierPrompt votes={votes} participants={participants} deck={deck} tshirtEquivalents={settings?.tshirtEquivalents} />
                    )}
                    {isCurrentUserFacilitator && (
                      <DecisionPanel
                        deck={deck}
                        summary={summary}
                        adjusted={adjusted}
                        onAdjust={(role, value) => setAdjusted(prev => ({ ...prev, [role]: value }))}
                        presentCategories={presentCategories}
                        onClear={onClear}
                        onSelectiveRevote={onSelectiveRevote}
                        onSave={handleCalculateAndComplete}
                        hasNextPending={hasNextPending}
                        decisionNote={settings?.decisionNotes && onSetDecisionNote ? { key: activeIssueId || 'none', value: activeIssue?.decisionNote || '', onSave: onSetDecisionNote } : null}
                      />
                    )}
                  </aside>
                </div>
              ) : (
                <>
                  <PokerTable
                    participants={participants}
                    votes={votes}
                    votesRevealed={false}
                    deck={deck}
                    currentUserId={currentUser.id}
                    allowManagementToVote={settings?.allowManagementToVote}
                    groupByRole={!!settings?.groupVotesByRole}
                    onlineIds={onlineIds}
                    large={isTheaterMode}
                    locked={!!activeIssueId && !sessionStartedAt}
                    footer={tableFooter}
                    overlay={reactionsEnabled ? <ReactionBubbles reactions={reactions || []} /> : undefined}
                  />
                </>
              )}

            </>
          )}
          </div>

          {/* Baralho fixo embaixo: nunca cobre a mesa, que rola por cima dele se precisar. */}
          {!isInitialState && !(isSessionFinished && stats) && !(votesRevealed && summary) && (
            <div className="shrink-0">
              {activeIssueId && currentUser.role !== 'spectator' ? (
                <Controls
                  deck={deck}
                  maxHours={settings?.maxHours}
                  currentUserVote={currentUserVote}
                  onVote={onVote}
                  votesRevealed={votesRevealed}
                  currentUser={currentUser}
                  allowManagementToVote={settings?.allowManagementToVote}
                  selectiveRevotingRole={selectiveRevotingRole}
                  isTheaterMode={isTheaterMode}
                  isSessionNotStarted={!!activeIssueId && !sessionStartedAt}
                  confidenceEnabled={!!settings?.confidenceVote}
                  onSetConfidence={onSetConfidence}
                  currentUserConfidence={currentUserConfidence}
                  onAllowManagementVote={isCurrentUserFacilitator ? () => onUpdateSettings({ allowManagementToVote: true }) : undefined}
                />
              ) : (
                <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
                  <Users className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-sm font-semibold">{!activeIssueId ? 'Sessão finalizada' : 'Você acompanha como espectador'}</span>
                </section>
              )}
            </div>
          )}
        </main>

        {!isTheaterMode && (
          <ResponsivePanel
            side="right"
            open={isParticipantsOpen}
            onOpenChange={setIsParticipantsOpen}
            sheetBelow={1024}
            widthClass="w-80"
            title="Participantes"
            icon={Users}
            count={participants.length}
            footer={
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="h-9 w-full gap-2 rounded-lg">
                Convidar o time
              </Button>
            }
          >
            {participantsPanel}
          </ResponsivePanel>
        )}

        {!isTheaterMode && (
          <ResponsivePanel
            side="right"
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            sheetBelow={1024}
            widthClass="w-[22rem]"
            title="Histórico da sessão"
            icon={HistoryIcon}
            count={(votingRounds || []).length}
          >
            <section className="mb-3" aria-labelledby="jira-queue-title">
              <h3 id="jira-queue-title" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Send className="h-3.5 w-3.5" aria-hidden /> Envios para o Jira
              </h3>
              <JiraPublishQueue jobs={jiraJobs} onRetry={handleJiraRetry} retryingId={jiraRetryingId} />
            </section>
            <History
              roomId={roomId}
              rounds={votingRounds || []}
              participants={participants}
              issues={issuesQueue}
              onPublishToJira={setJiraPublishIssue}
              jiraPublishStatusByIssueId={jiraStatusByIssueId}
            />
          </ResponsivePanel>
        )}
      </div>

      <JiraPublishDialog
        roomId={roomId}
        issue={jiraPublishIssue}
        open={!!jiraPublishIssue}
        onOpenChange={(open) => { if (!open) setJiraPublishIssue(null); }}
        onPublished={mergeJiraJob}
      />

      {/* Votos em andamento ao trocar a tarefa */}
      <SwitchIssueDialog
        open={!!pendingIssueId}
        onOpenChange={(open) => { if (!open) setPendingIssueId(null); }}
        votesCount={votes.length}
        onConfirm={confirmIssueSwitch}
      />

      {isCurrentUserFacilitator && (
        <CeremonySettingsDialog
          open={isFacilitatorSettingsOpen}
          onOpenChange={setIsFacilitatorSettingsOpen}
          onRestoreDefaults={() => onUpdateSettings(buildDefaultSettingsPatch())}
          onSaveTemplate={saveRoomTemplate.openDialog}
        >
          <FacilitatorPanel
            deck={deck}
            onUpdateSettings={onUpdateSettings}
            allowManagementToVote={settings?.allowManagementToVote}
            autoReveal={settings?.autoReveal}
            outlierPrompt={settings?.outlierPrompt}
            confidenceVote={settings?.confidenceVote}
            showVelocity={settings?.showVelocity}
            anonymousReveal={settings?.anonymousReveal}
            turnNotification={settings?.turnNotification}
            showDistribution={settings?.showDistribution}
            decisionNotes={settings?.decisionNotes}
            perTopicTime={settings?.perTopicTime !== false}
            autoTimer={settings?.autoTimer}
            groomingFlag={settings?.groomingFlag}
            autoConsensus={settings?.autoConsensus}
            suggestRevote={settings?.suggestRevote}
            reactions={settings?.reactions}
            roundingMode={settings?.roundingMode}
            blindVotes={settings?.blindVotes}
            groupVotesByRole={settings?.groupVotesByRole}
            referenceStory={settings?.referenceStory}
            roundNudge={settings?.roundNudge}
            maxRounds={settings?.maxRounds}
            refinementNotes={settings?.refinementNotes}
            parkTask={settings?.parkTask}
            cancelTask={settings?.cancelTask}
            maxHours={settings?.maxHours}
            hasVotes={votes.length > 0}
            divergenceThresholds={settings?.divergenceThresholds}
            tshirtEquivalents={settings?.tshirtEquivalents}
            onSetDeck={onSetDeck}
            onSaveTemplate={saveRoomTemplate.openDialog}
            templatesVersion={saveRoomTemplate.version}
          />
        </CeremonySettingsDialog>
      )}

      {isCurrentUserFacilitator && saveRoomTemplate.dialog}

      <OffTableDialog
        open={isOffTableDialogOpen}
        onOpenChange={setIsOffTableDialogOpen}
        initialMode={offTableMode}
        canPark={canParkTask}
        issueLabel={activeIssue?.key || undefined}
        onSkip={onSkipIssue}
        onPark={onParkIssue}
      />
      <CancelIssueDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
        onConfirm={(note) => { if (activeIssueId && onCancelIssue) onCancelIssue(activeIssueId, note); }}
      />
      <FinishSessionDialog
        open={isFinishDialogOpen}
        onOpenChange={setIsFinishDialogOpen}
        issues={issuesQueue}
        rounds={votingRounds || []}
        onConfirm={() => { onFinishSession && onFinishSession(); }}
      />

      {/* Notas de refinamento: DEV e QA em campos separados */}
      <Modal
        open={isNotesOpen}
        onOpenChange={setIsNotesOpen}
        size="lg"
        icon={StickyNote}
        title="Notas de refinamento"
        description={activeIssue ? `${activeIssue.key ? `${activeIssue.key} · ` : ''}${activeIssue.title}` : undefined}
        footer={<ModalButton variant="primary" onClick={() => setIsNotesOpen(false)}>Concluir</ModalButton>}
      >
        <RefinementNotes
          devNotes={activeIssue?.devNotes || ''}
          qaNotes={activeIssue?.qaNotes || ''}
          onUpdateNotes={onUpdateRefinementNotes}
          activeIssueId={activeIssueId}
        />
      </Modal>

      <PokerGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />

      <TeamChat
        roomId={roomId}
        currentUser={currentUser}
        participants={participants}
        onlineIds={socketOnline}
        canModerate={isCurrentUserFacilitator}
        isOpen={isTeamChatOpen}
        onClose={() => setIsTeamChatOpen(false)}
        onUnreadChange={setTeamChatUnread}
        messagesByChannel={messagesByChannel}
        onSendMessage={onSendMessage}
        onDeleteMessage={onDeleteMessage}
      />

      <PokerChat
        roomId={roomId}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        activeTopic={activeIssue?.title || currentTopic}
        activeIssue={activeIssue}
      />

      <IssueDetail
        issue={activeIssue ? {
          key: activeIssue.key || '',
          summary: activeIssue.title,
          description: activeIssue.description || '',
          type: activeIssue.jiraType,
          status: activeIssue.jiraStatus,
          priority: activeIssue.jiraPriority,
          assignee: activeIssue.jiraAssignee,
          updated: activeIssue.jiraUpdated,
          labels: activeIssue.jiraLabels,
          link: activeIssue.jiraLink || undefined,
          acceptanceCriteria: activeIssue.acceptanceCriteria,
        } : null}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      <ShareRoomDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        roomId={roomId}
        roomTitle={roomTitle}
        issues={issuesQueue}
      />
    </div>
  );
};

export const PokerRoom = React.memo(PokerRoomComponent);
