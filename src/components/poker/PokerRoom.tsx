
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Participant, DeckType, Vote, VotingRound, TimerState, Role, Issue, Room } from '@/lib/types';
import { calculateRoleEfforts, getParticipantCategory, checkConsensus, canParticipantVote, TECHNICAL_CATEGORIES, isParticipantOnline, getEligibleStatsVotes, resolveTshirtHours, computeSessionBreakdown, computeTopicTiming } from '@/lib/poker-utils';
import { Logo } from '@/components/Logo';
import { ParticipantList } from '@/components/poker/ParticipantList';
import { Toolbar } from './Toolbar';
import { Controls } from '@/components/poker/Controls';
import { VotingArea } from '@/components/poker/VotingArea';
import { Results } from '@/components/poker/Results';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Eye,
  EyeOff,
  RotateCcw,
  Volume2,
  Sparkles,
  HelpCircle,
  Info,
  WalletCards,
  BrainCircuit,
  Trophy,
  Users,
  ArrowLeft,
  LayoutGrid,
  CheckCircle2,
  PanelLeftClose,
  PanelRightClose,
  Clock,
  ListChecks,
  Target,
  AlertTriangle,
  TrendingUp,
  Award,
  Plus,
  ChevronDown,
  Code,
  Bug,
  SkipForward,
  FileText,
  ListPlus,
  Hourglass,
  Download,
  ClipboardCopy,
  Kanban,
  MessageSquare,
  RefreshCcw,
  RotateCw,
  ExternalLink,
  Pin,
  Layers,
  X,
  Settings,
  Flag,
  MoreHorizontal,
  CloudDownload
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { TopicDisplay } from './TopicDisplay';
import { RefinementNotes } from './RefinementNotes';
import { History } from './History';
import { EliteTimer } from '../shared/EliteTimer';
import { ExportDialog } from './ExportDialog';
import { FacilitatorPanel } from './FacilitatorPanel';
import { Card, CardContent } from '../ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '../ui/badge';
import { pokerApi } from '../../app/room/api';
import { TopicQueue } from './TopicQueue';
import { cn } from '@/lib/utils';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { EliteSidebar } from '../shared/EliteSidebar';
import { PokerGuide } from './PokerGuide';
import { PokerChat } from './PokerChat';
import { IssueDetail } from './IssueDetail';
import { OutlierPrompt } from './OutlierPrompt';
import { SessionVelocity } from './SessionVelocity';
import { VoteDistribution } from './VoteDistribution';
import { ConfidenceSummary } from './ConfidenceSummary';
import { TopicTiming } from './TopicTiming';
import { saveTemplate } from '@/lib/poker-templates';
import { ReactionOverlay, type RoomReaction } from './ReactionOverlay';
import { ShareRoomDialog } from './ShareRoomDialog';

// Retorna true enquanto a viewport for menor que `px`. Usado para trocar as
// sidebars fixas (desktop) por drawers (Sheet) no mobile/tablet.
function useBelowBreakpoint(px: number): boolean {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${px - 1}px)`);
    const update = () => setBelow(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [px]);
  return below;
}

const WELCOME_DECK_LABELS: Record<string, string> = {
  fibonacci: 'Fibonacci',
  hours: 'Horas Reais',
  tshirt: 'Camisetas',
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || '?';
}

interface PokerRoomProps {
  roomId: string;
  currentUser: Participant;
  participants: Participant[];
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
  onLeaveRoom: () => void;
  isSoundEnabled: boolean;
  onSetIsSoundEnabled: (enabled: boolean) => void;
  onOpenFeedback: () => void;
  roomTitle?: string;
  roomTeam?: string;
  issuesQueue: Issue[];
  activeIssueId: string | null;
  referenceBaseline?: Room['referenceBaseline'];
  onSetReference?: (issueId: string | null) => void;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  onAddIssue: (title: string, jiraLink?: string, type?: Issue['type'], extraData?: Partial<Issue>) => void;
  onBulkAddIssues: (items: Partial<Issue>[]) => void;
  onSelectIssue: (issueId: string, autoSavePoints?: { points: string; devPoints?: string; qaPoints?: string }) => void;
  onDeleteIssue: (issueId: string) => void;
  onCompleteIssue: (points: string, devPoints?: string, qaPoints?: string, rolePoints?: Record<string, string>) => void;
  onSkipIssue: (note: string) => void;
  onParkIssue?: (note: string) => void;
  onStartSession?: () => void;
  onFinishSession?: () => void;
  onUnskipIssue?: (id: string) => void;
  onRevoteIssue?: (id: string) => void;
  settings?: Room['settings'];
  onUpdateSettings: (settings: Partial<NonNullable<Room['settings']>>) => void;
  onClaimFacilitator: () => void;
  creatorId: string;
}

const PokerRoomComponent = ({
  roomId,
  currentUser,
  participants,
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
  onLeaveRoom,
  isSoundEnabled,
  onSetIsSoundEnabled,
  onOpenFeedback,
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
  onStartSession,
  onFinishSession,
  onUnskipIssue,
  onRevoteIssue,
  settings,
  onUpdateSettings,
  onClaimFacilitator,
  creatorId,
}: PokerRoomProps) => {
  const { toast } = useToast();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isFacilitatorSettingsOpen, setIsFacilitatorSettingsOpen] = useState(false);
  const [isSkipDialogOpen, setIsSkipDialogOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [pendingIssueId, setPendingIssueId] = useState<string | null>(null);
  const [skipNote, setSkipNote] = useState('');
  const [isParkDialogOpen, setIsParkDialogOpen] = useState(false);
  const [parkNote, setParkNote] = useState('');
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
    () => new Set(participants.filter(p => isParticipantOnline(p, presenceTick)).map(p => p.id)),
    [participants, presenceTick]
  );

  // Notificação "sua vez" (opt-in): avisa o votante quando uma nova rodada
  // abre e ele ainda não votou. Uma vez por tópico ativo (ref evita repetir).
  const notifiedTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settings?.turnNotification) { notifiedTurnRef.current = null; return; }
    if (!activeIssueId || votesRevealed || currentUserVote) return;
    if (!canParticipantVote(currentUser, settings?.allowManagementToVote)) return;
    if (notifiedTurnRef.current === activeIssueId) return;
    notifiedTurnRef.current = activeIssueId;
    toast({ title: '🗳️ É a sua vez de votar!', description: 'Uma nova rodada foi aberta.' });
    if (isSoundEnabled) {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch { /* ignore */ }
    }
  }, [settings?.turnNotification, settings?.allowManagementToVote, activeIssueId, votesRevealed, currentUserVote, currentUser, isSoundEnabled, toast]);

  const isInitialState = issuesQueue.length === 0;
  // Sessão encerrada: ou a fila acabou (todos concluídos), ou o facilitador
  // encerrou com itens ainda pendentes ("acabou o tempo"). No segundo caso
  // sobram itens `pending`, então a checagem antiga (`every completed`) não
  // vale — o marco passa a ser o sessionEndedAt sem nenhum item na mesa.
  const isSessionFinished = !activeIssueId && issuesQueue.length > 0 &&
    (issuesQueue.every(i => i.status === 'completed' || i.skipped || i.parked) || !!sessionEndedAt);

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

    const estimatedIssues = issuesQueue.filter(i => !i.skipped && i.status === 'completed');
    const skippedIssues = issuesQueue.filter(i => i.skipped);
    // Adiadas: passaram pelo park ao menos uma vez (parkCount persiste mesmo
    // depois de estimadas). `parked` cobre sessões antigas sem o contador.
    const parkedIssues = issuesQueue.filter(i => (i.parkCount || 0) > 0 || i.parked);
    const untouchedIssues = issuesQueue.filter(i => !i.skipped && i.status !== 'completed');
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
      skippedIssues, parkedIssues, untouchedIssues, breakdown,
    };
  }, [isSessionFinished, issuesQueue, sessionStartedAt, sessionEndedAt, deck, votingRounds]);

  const handleCopyLink = () => {
    setIsShareDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    saveTemplate({
      name: roomTitle || 'Template de Poker',
      deckType: deck,
      settings: settings || {},
      backlog: issuesQueue.map(i => ({ title: i.title, jiraLink: i.jiraLink || undefined, type: i.type })),
    });
    toast({ title: 'Template salvo!', description: 'Deck, configurações e backlog guardados para reusar numa nova sessão.' });
  };

  // Auto-close settings when sidebars open or votes are revealed
  useEffect(() => {
    if (isQueueOpen || isParticipantsOpen) {
      setIsFacilitatorSettingsOpen(false);
    }
  }, [isQueueOpen, isParticipantsOpen]);

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

  const getCalculatedPoints = () => {
    if (votes.length === 0) return null;

    if (deck === 'hours' || deck === 'fibonacci' || !deck) {
      const result = calculateRoleEfforts(votes, participants, deck || 'fibonacci');
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
      const numericVals = votes
        .map(v => resolveTshirtHours(v.value, settings?.tshirtEquivalents))
        .filter(n => !isNaN(n));
      if (numericVals.length > 0) {
        const avg = Math.ceil(numericVals.reduce((a, b) => a + b, 0) / numericVals.length);
        return { points: String(avg) };
      }
      const allVoteValues = votes.map(v => v.value);
      const voteCounts = allVoteValues.reduce((acc, value) => { acc[value] = (acc[value] || 0) + 1; return acc; }, {} as Record<string, number>);
      const points = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
      return { points };
    }
    
    return null;
  };

  const handleCalculateAndComplete = () => {
    const result = getCalculatedPoints() as any;
    if (result) {
      onCompleteIssue(result.points, result.devPoints, result.qaPoints, result.rolePoints);
    }
  };

  // Consenso pleno (todos os votos elegíveis iguais) e divergência crítica —
  // alimentam o auto-consenso e a sugestão de revotação (ambos opt-in).
  const hasConsensus = useMemo(() => {
    const eligible = getEligibleStatsVotes(votes, participants, settings?.allowManagementToVote);
    return eligible.length > 1 && new Set(eligible.map(v => v.value)).size === 1;
  }, [votes, participants, settings?.allowManagementToVote]);
  const hasHighDivergence = useMemo(() => [...divergences.values()].some(d => d === 'destructive'), [divergences]);

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
  const votedIds = new Set(votes.map(v => v.participantId));
  const pendingVoters = eligibleVoters.filter(p => !votedIds.has(p.id)).length;

  // Categorias técnicas realmente presentes na sala — alimentam o revote
  // seletivo genérico (antes só Dev/QA fixos).
  const presentCategories = TECHNICAL_CATEGORIES.filter(cat =>
    participants.some(p => getParticipantCategory(p) === cat)
  );
  const CATEGORY_ICON: Record<string, typeof Code> = {
    Developer: Code,
    QA: Bug,
    UX: Users,
    Designer: Users,
  };

  // No mobile/tablet as sidebars fixas somem (aside da fila é lg+, a de
  // participantes é md+); abaixo desses limites usamos drawers (Sheet).
  const queueIsDrawer = useBelowBreakpoint(1024);
  const participantsIsDrawer = useBelowBreakpoint(768);

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
    />
  );

  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden relative text-foreground">
      {/* BARRA LATERAL ESQUERDA: TAREFAS */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r shadow-sm bg-card transition-all duration-300 ease-in-out overflow-hidden relative",
          isQueueOpen && !isTheaterMode ? "w-72 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <div className="w-72 flex flex-col h-full shrink-0">
          <header className='p-4 border-b shrink-0 flex items-center justify-between'>
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-xs font-black tracking-widest uppercase">Tarefas</h2>
              <span className="bg-primary/10 text-primary text-[10px] px-2.5 py-0.5 rounded-full">{issuesQueue.length}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsQueueOpen(false)}
              className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </header>
          <div className='p-0 bg-muted/5 flex-1 flex flex-col min-h-0'>
            {queueContent}
          </div>
        </div>
      </aside>

      {/* DRAWER MOBILE/TABLET: TAREFAS (a aside acima é lg+) */}
      {queueIsDrawer && (
        <Sheet open={isQueueOpen} onOpenChange={setIsQueueOpen}>
          <SheetContent side="left" className="w-[88vw] max-w-sm p-0 flex flex-col">
            <SheetHeader className="p-4 border-b shrink-0 text-left">
              <SheetTitle className="text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Tarefas
                <span className="bg-primary/10 text-primary text-[10px] px-2.5 py-0.5 rounded-full">{issuesQueue.length}</span>
              </SheetTitle>
              <SheetDescription className="sr-only">Fila de tarefas da sessão</SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 flex flex-col bg-muted/5">
              {queueContent}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* MESH GRADIENT DECORATION */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-400/10 rounded-full blur-[160px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-400/10 rounded-full blur-[140px] animate-pulse"></div>
      </div>

      {/* ÁREA CENTRAL: MESA DE VOTAÇÃO */}
      <div className="bg-transparent h-dvh overflow-hidden flex flex-col flex-1 relative min-w-0 transition-all duration-300">
        {/*
          Modo apresentação: antes só trocava max-w-7xl por max-w-none e dava
          um scale de 1.02 — com a barra lateral já fechada, não mudava nada
          visível, daí a sensação de "não funciona". Agora a barra completa sai
          de cena e entra uma faixa mínima com o essencial e a saída explícita
          (Esc também sai).
        */}
        {isTheaterMode ? (
          <header className="sticky top-0 z-50 w-full shrink-0">
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-white/60 dark:border-slate-800/60 h-12 flex items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 text-[9px] font-black uppercase tracking-widest shrink-0">
                  Apresentação
                </span>
                <span className="text-xs font-black uppercase tracking-tighter text-slate-900 dark:text-slate-100 truncate">
                  {roomTitle || 'Scrum Poker'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {timer && (timer.initialDuration > 0 || timer.status !== 'stopped') && (
                  <div className="hidden sm:block">
                    <EliteTimer
                      timer={timer}
                      onStart={onStartTimer}
                      onPause={onPauseTimer}
                      onResume={onResumeTimer}
                      onReset={onResetTimer}
                      onSetDuration={onSetTimerDuration}
                      isSoundEnabled={isSoundEnabled}
                      onToggleSound={(enabled) => onSetIsSoundEnabled(enabled)}
                      isFacilitator={isCurrentUserFacilitator}
                      serverOffset={serverTimeOffset}
                      compact
                    />
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsTheaterMode(false)}
                  className="h-9 px-4 rounded-xl border-2 border-pink-400/50 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30 font-black uppercase text-[9px] tracking-widest gap-2"
                >
                  <X className="h-3.5 w-3.5" />
                  Sair <span className="hidden sm:inline">da apresentação</span>
                  <kbd className="hidden md:inline text-[8px] font-bold opacity-60 border border-current rounded px-1 ml-1">Esc</kbd>
                </Button>
              </div>
            </div>
          </header>
        ) : (
        <RoomHeader
          title={roomTitle || "Scrum Poker"}
          toolIcon={<LayoutGrid className="h-4 w-4" />}
          toolColorClass="text-blue-600 bg-blue-50"
          onOpenFeedback={onOpenFeedback}
          actions={
            /*
              A barra tinha 19 controles sempre visíveis e transbordava bem
              antes do mobile (a 768px pedia ~1080px, empurrando o perfil para
              fora e colando o botão de home no cronômetro). Agora só o que se
              usa a toda hora fica fixo — fila, participantes e o timer — e o
              resto vai para um menu "mais opções" abaixo de lg.
            */
            <div className="flex items-center gap-1.5 min-w-0">
              {timer && (timer.initialDuration > 0 || timer.status !== 'stopped') && (
                <div className="mr-1 hidden sm:block">
                  <EliteTimer
                    timer={timer}
                    onStart={onStartTimer}
                    onPause={onPauseTimer}
                    onResume={onResumeTimer}
                    onReset={onResetTimer}
                    onSetDuration={onSetTimerDuration}
                    isSoundEnabled={isSoundEnabled}
                    onToggleSound={(enabled) => onSetIsSoundEnabled(enabled)}
                    isFacilitator={isCurrentUserFacilitator}
                    serverOffset={serverTimeOffset}
                    compact
                  />
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsQueueOpen(!isQueueOpen)}
                className={cn("h-9 w-9 rounded-xl transition-all shrink-0", isQueueOpen ? "text-primary bg-primary/10 dark:text-primary dark:bg-primary/20" : "text-slate-400 dark:text-muted-foreground")}
                title="Fila de Tarefas"
              >
                <ListChecks className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
                className={cn("h-9 w-9 rounded-xl transition-all shrink-0", isParticipantsOpen ? "text-primary bg-primary/10 dark:text-primary dark:bg-primary/20" : "text-slate-400 dark:text-muted-foreground")}
                title="Participantes"
              >
                <Users className="h-4 w-4" />
              </Button>

              {/* Ações secundárias: soltas em telas largas, agrupadas abaixo de lg. */}
              <div className="hidden lg:flex items-center gap-1.5">
                {isCurrentUserFacilitator && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsTheaterMode(!isTheaterMode)}
                    className={cn("h-9 w-9 rounded-xl transition-all", isTheaterMode ? "text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-950/20" : "text-slate-400 dark:text-muted-foreground")}
                    title={isTheaterMode ? "Sair do Modo Apresentação" : "Modo Apresentação"}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}

                {isCurrentUserFacilitator && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFacilitatorSettingsOpen(!isFacilitatorSettingsOpen)}
                    className={cn("h-9 w-9 rounded-xl transition-all", isFacilitatorSettingsOpen ? "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/20" : "text-slate-400 dark:text-muted-foreground")}
                    title="Configurações da Cerimônia"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={cn("h-9 w-9 rounded-xl transition-all", isChatOpen ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20" : "text-slate-400 dark:text-muted-foreground")}
                  title="Base de Conhecimento"
                >
                  <BrainCircuit className="h-4 w-4" />
                </Button>

                <div className="w-px h-4 bg-slate-200 dark:bg-border mx-1" />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="h-9 px-3 rounded-xl border-slate-200 dark:border-border text-slate-600 dark:text-foreground font-bold uppercase text-[9px] tracking-widest gap-2 hover:bg-slate-50 dark:hover:bg-muted transition-all"
                >
                  <Copy className="h-3.5 w-3.5" /> Link
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsGuideOpen(true)}
                  className="h-8 w-8 p-0 font-bold text-[9px] uppercase tracking-widest border-slate-200 dark:border-border text-slate-500 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-muted rounded-lg"
                  title="GUIA DO POKER"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-9 w-9 rounded-xl text-slate-400 dark:text-muted-foreground shrink-0"
                    title="Mais opções"
                    aria-label="Mais opções da sala"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {isCurrentUserFacilitator && (
                    <DropdownMenuItem onClick={() => setIsTheaterMode(!isTheaterMode)} className="gap-2 text-xs font-bold">
                      <Eye className="h-4 w-4" />
                      {isTheaterMode ? 'Sair da apresentação' : 'Modo apresentação'}
                    </DropdownMenuItem>
                  )}
                  {isCurrentUserFacilitator && (
                    <DropdownMenuItem onClick={() => setIsFacilitatorSettingsOpen(!isFacilitatorSettingsOpen)} className="gap-2 text-xs font-bold">
                      <Settings className="h-4 w-4" />
                      Configurações da cerimônia
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setIsChatOpen(!isChatOpen)} className="gap-2 text-xs font-bold">
                    <BrainCircuit className="h-4 w-4" />
                    Base de conhecimento
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCopyLink} className="gap-2 text-xs font-bold">
                    <Copy className="h-4 w-4" />
                    Copiar link da sala
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsGuideOpen(true)} className="gap-2 text-xs font-bold">
                    <HelpCircle className="h-4 w-4" />
                    Guia do poker
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <PokerGuide open={isGuideOpen} onOpenChange={setIsGuideOpen} />
            </div>
          }
        />
        )}

        {/* ALERTA DE VOTOS NÃO SALVOS AO TROCAR TAREFA */}
        <AlertDialog open={!!pendingIssueId} onOpenChange={(open) => !open && setPendingIssueId(null)}>
          <AlertDialogContent className="rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl bg-white/90 dark:bg-card/90 backdrop-blur-xl max-w-md">
            <AlertDialogHeader>
              <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <AlertDialogTitle className="text-xl font-black uppercase tracking-tight text-center text-slate-900 dark:text-white">Votos em andamento!</AlertDialogTitle>
              <AlertDialogDescription className="text-center font-medium text-slate-500 dark:text-slate-400">
                Existem votos computados para a tarefa atual. Ao mudar de tarefa agora, esses votos serão <span className="text-destructive font-bold uppercase underline">descartados</span>.
                Deseja prosseguir mesmo assim?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <AlertDialogCancel className="rounded-2xl h-12 flex-1 font-bold uppercase tracking-widest text-[10px] border-slate-200">
                Voltar e Salvar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmIssueSwitch}
                className="rounded-2xl h-12 flex-1 font-black uppercase tracking-widest text-[10px] bg-destructive hover:bg-destructive/90 text-white shadow-lg shadow-destructive/20 transition-all"
              >
                Sim, descartar votos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>




        <div className="relative flex-1 flex flex-col p-3 sm:p-5 overflow-y-auto">

          <div className={cn(
            "mx-auto w-full space-y-6 transition-all duration-500",
            isTheaterMode ? "max-w-none px-6 lg:px-16 xl:px-24 text-[1.06rem]" : "max-w-7xl"
          )}>

            {/* Action Bar / Header Unificado */}
            {/*
              Empilha abaixo de sm: numa única linha o título disputava espaço
              com 3 botões e era espremido até quebrar letra por letra
              ("V O A G"), enquanto os botões vazavam da tela.
            */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full p-2.5 lg:p-3 bg-white/90 dark:bg-card/90 backdrop-blur-md rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] border border-white/60 dark:border-border/40 mb-2 gap-2 shrink-0 overflow-hidden">
              <div className="flex flex-1 min-w-0 overflow-hidden items-center gap-4">
                <TopicDisplay
                  topic={isSessionFinished ? "" : String(activeIssue?.title || currentTopic || "")}
                  jiraLink={isSessionFinished ? undefined : activeIssue?.jiraLink || undefined}
                  hasDetail={!isSessionFinished && !!(activeIssue?.jiraLink || activeIssue?.description || activeIssue?.acceptanceCriteria)}
                  onSetTopic={onSetTopic}
                  isFacilitator={isCurrentUserFacilitator}
                  isSessionFinished={isSessionFinished}
                  untouchedCount={isSessionFinished ? issuesQueue.filter(i => !i.skipped && i.status !== 'completed').length : 0}
                  isTheaterMode={isTheaterMode}
                  onShowDetail={() => setIsDetailOpen(true)}
                />


              </div>

              {isCurrentUserFacilitator && activeIssueId && (
                <div className="flex flex-row flex-wrap gap-2 shrink-0 items-center justify-end">
                  {!votesRevealed ? (
                    <>
                      <Button
                        size="sm"
                        onClick={handleReveal}
                        disabled={votesRevealed || votes.length === 0}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:opacity-100 font-black h-9 px-3 lg:h-11 lg:px-5 text-[9px] lg:text-xs shadow-md rounded-xl group transition-all active:scale-95 uppercase tracking-widest whitespace-nowrap"
                      >
                        <Eye className="mr-1.5 lg:mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4 transition-transform group-hover:scale-110" />
                        REVELAR VOTOS
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSkipNote(''); setIsSkipDialogOpen(true); }}
                        className="h-9 px-3 lg:h-11 lg:px-4 font-black text-[9px] lg:text-xs uppercase tracking-widest rounded-xl border-amber-400/40 dark:border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-400 transition-all whitespace-nowrap bg-white/50 dark:bg-slate-900/40"
                      >
                        <SkipForward className="mr-1.5 lg:mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
                        Pular
                      </Button>
                      {onParkIssue && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setParkNote(''); setIsParkDialogOpen(true); }}
                          title="Adiar — volta pro fim da fila para revisitar nesta sessão"
                          className="h-9 px-3 lg:h-11 lg:px-4 font-black text-[9px] lg:text-xs uppercase tracking-widest rounded-xl border-slate-300/60 dark:border-border text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all whitespace-nowrap bg-white/50 dark:bg-slate-900/40"
                        >
                          <Hourglass className="mr-1.5 lg:mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
                          Adiar
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex relative inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-850 transition-all shadow-sm overflow-hidden shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { onClear(); }}
                          className="font-black h-9 px-3 lg:h-11 lg:px-5 text-[9px] lg:text-xs text-slate-700 dark:text-slate-300 rounded-none rounded-l-xl focus:ring-0 uppercase tracking-widest whitespace-nowrap border-r border-slate-300/50 dark:border-slate-800 hover:bg-transparent"
                        >
                          <RotateCcw className="mr-1.5 lg:mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
                          <span className="hidden sm:inline">REVOTAR TODOS</span>
                          <span className="inline sm:hidden">REVOTAR</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="font-black h-9 w-8 lg:h-11 lg:w-10 text-slate-700 dark:text-slate-300 px-0 rounded-none rounded-r-xl focus:ring-0 hover:bg-slate-300 dark:hover:bg-slate-800 shrink-0"
                            >
                              <ChevronDown className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 font-medium rounded-xl p-2 border border-slate-200 dark:border-slate-850 shadow-xl bg-white dark:bg-slate-950">
                            <DropdownMenuLabel className="text-xs uppercase text-slate-400 font-bold tracking-widest px-2 py-1.5">
                              Revotar Parcial
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-850" />
                            {presentCategories.length === 0 && (
                              <div className="px-2 py-2 text-[11px] font-medium text-slate-400 italic">
                                Nenhum papel técnico presente
                              </div>
                            )}
                            {presentCategories.map(cat => {
                              const Icon = CATEGORY_ICON[cat] || Users;
                              return (
                                <DropdownMenuItem
                                  key={cat}
                                  onClick={() => onSelectiveRevote && onSelectiveRevote(cat)}
                                  className="rounded-lg cursor-pointer py-2 focus:bg-indigo-50 dark:focus:bg-indigo-950/40 focus:text-indigo-700 dark:focus:text-indigo-400 transition-colors group"
                                >
                                  <Icon className="mr-2 h-4 w-4 opacity-50 group-focus:opacity-100 group-focus:text-indigo-600" />
                                  <span className="font-bold">Apenas {cat}</span>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleCalculateAndComplete}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-9 px-3 lg:h-11 lg:px-6 text-[9px] lg:text-xs shadow-md rounded-xl transition-all active:scale-95 uppercase tracking-widest whitespace-nowrap"
                      >
                        <CheckCircle2 className="mr-1.5 lg:mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
                        {hasNextPending ? 'SALVAR E PRÓX.' : 'SALVAR FINAL'}
                      </Button>
                    </>
                  )}
                  {/*
                    Encerrar com fila cheia: o tempo estourou e o time só chegou
                    em parte dos itens. Fica fora do ternário de propósito — o
                    estouro de tempo pode acontecer tanto votando quanto com os
                    votos já revelados.
                  */}
                  {onFinishSession && sessionStartedAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsFinishDialogOpen(true)}
                      title="Encerrar a sessão e gerar o relatório — o que sobrar na fila entra como não abordado"
                      className="h-9 px-3 lg:h-11 lg:px-5 font-black text-[9px] lg:text-xs uppercase tracking-widest rounded-xl border-2 border-rose-400/50 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-500 hover:text-rose-700 dark:hover:text-rose-300 transition-all whitespace-nowrap bg-white/50 dark:bg-slate-900/40"
                    >
                      <Flag className="mr-1.5 lg:mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
                      <span className="hidden sm:inline">Encerrar Sessão</span>
                      <span className="inline sm:hidden">Encerrar</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Faixa de contexto: régua de referência + contador de rodadas
                (ambos opt-in). Fora do card de ações pra não competir com os
                botões nem cobrir o baralho. */}
            {((settings?.referenceStory && referenceBaseline && !votesRevealed) ||
              (settings?.roundNudge && activeIssueId && !isSessionFinished)) && (
              <div className="flex flex-wrap items-center gap-2 -mt-1 px-1 shrink-0">
                {settings?.referenceStory && referenceBaseline && !votesRevealed && (
                  <div className="flex items-center gap-2 max-w-full rounded-full border border-indigo-200/70 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 pl-3 pr-1.5 py-1">
                    <Pin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 shrink-0">Referência</span>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate min-w-0">
                      {referenceBaseline.key ? `${referenceBaseline.key} · ` : ''}{referenceBaseline.title}
                    </span>
                    <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 rounded-full px-2 py-0.5 shrink-0">
                      {referenceBaseline.display}
                    </span>
                    {isCurrentUserFacilitator && onSetReference && (
                      <button
                        type="button"
                        onClick={() => onSetReference(null)}
                        className="h-5 w-5 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                        title="Remover referência"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                {settings?.roundNudge && activeIssueId && !isSessionFinished && (
                  <div className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 shrink-0",
                    activeRoundCount >= maxRounds
                      ? "border-orange-300/70 dark:border-orange-900/50 bg-orange-50/60 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400"
                      : "border-slate-200/70 dark:border-border/50 bg-slate-50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400"
                  )}>
                    <RotateCw className="h-3 w-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Rodada {currentRoundNumber}/{maxRounds}</span>
                  </div>
                )}
              </div>
            )}

            {/*
              Início explícito da cerimônia. O relógio da sessão (e o tempo do
              primeiro item) passa a contar daqui — não da importação da fila,
              que costuma acontecer horas antes. Enquanto ninguém inicia, o
              primeiro voto ainda serve de rede de segurança.
            */}
            {activeIssueId && !sessionStartedAt && !isSessionFinished && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/20 px-5 py-4 mb-4 shrink-0">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
                      Refinamento ainda não iniciado
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {isCurrentUserFacilitator
                        ? 'Inicie quando o time estiver reunido — o tempo por tarefa conta a partir daí.'
                        : 'O facilitador vai iniciar a sessão em instantes.'}
                    </p>
                  </div>
                </div>
                {isCurrentUserFacilitator && onStartSession && (
                  <Button
                    onClick={onStartSession}
                    className="h-11 px-7 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/20 w-full sm:w-auto"
                  >
                    Iniciar Refinamento
                  </Button>
                )}
              </div>
            )}

            {isCurrentUserFacilitator && isFacilitatorSettingsOpen && (
              <Card className="border border-white/20 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-xl mb-4 px-2 py-1 shrink-0">
                <CardContent className="p-6">
                  <div className="animate-in fade-in slide-in-from-top-4 duration-300">
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
                      groupVotesByRole={settings?.groupVotesByRole}
                      referenceStory={settings?.referenceStory}
                      roundNudge={settings?.roundNudge}
                      maxRounds={settings?.maxRounds}
                      refinementNotes={settings?.refinementNotes}
                      parkTask={settings?.parkTask}
                      divergenceThresholds={settings?.divergenceThresholds}
                      onSetDeck={onSetDeck}
                      onSaveTemplate={handleSaveTemplate}
                      isEmbeddedInSheet={true} /* Re-using the simplified layout */
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {settings?.refinementNotes && isCurrentUserFacilitator && activeIssueId && !isSessionFinished && onUpdateRefinementNotes && (
              <div className="bg-white/60 dark:bg-card/60 backdrop-blur rounded-2xl border border-white/60 dark:border-border/40 p-4 shrink-0">
                <RefinementNotes
                  devNotes={activeIssue?.devNotes || ''}
                  qaNotes={activeIssue?.qaNotes || ''}
                  onUpdateNotes={onUpdateRefinementNotes}
                  activeIssueId={activeIssueId}
                  isTheaterMode={isTheaterMode}
                />
              </div>
            )}

            <div className="py-2 min-h-0 flex-1 overflow-visible">
              {isInitialState ? (
                <div className="flex flex-col items-center justify-center py-3 sm:py-5 text-center animate-in fade-in zoom-in-95 duration-700">
                  {isCurrentUserFacilitator ? (
                    <div className="w-full max-w-4xl space-y-5">
                      {/* HERO */}
                      <div className="flex items-center justify-center gap-3 sm:gap-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 rotate-3">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white leading-none">Sua sala está pronta</h2>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/50">
                              <WalletCards className="h-3 w-3" /> {WELCOME_DECK_LABELS[deck] || deck}
                            </span>
                            {roomTeam && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                {roomTeam}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 dark:text-muted-foreground/70 font-medium">Faltam só 2 passos para começar.</span>
                          </div>
                        </div>
                      </div>

                      {/* CHECKLIST DE ONBOARDING */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left items-start">
                        <div className="bg-white/90 dark:bg-card/80 backdrop-blur border border-slate-100 dark:border-border/60 rounded-2xl p-4 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.15)] flex flex-col gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-600 text-white text-[11px] font-black shrink-0">1</span>
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-foreground">Convide o time</h3>
                          </div>
                          {participants.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-3 shrink-0">
                                {participants.slice(0, 5).map(p => (
                                  <Avatar key={p.id} className={cn("h-8 w-8 border-2 border-white dark:border-card", !onlineIds.has(p.id) && "opacity-50")}>
                                    <AvatarFallback className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                                      {getInitials(p.nickname)}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {participants.length > 5 && (
                                  <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-card flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400">
                                    +{participants.length - 5}
                                  </div>
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-slate-500 dark:text-muted-foreground">
                                {participants.length} já {participants.length === 1 ? 'entrou' : 'entraram'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400 dark:text-muted-foreground/70 italic">Ninguém entrou ainda</span>
                          )}
                          <Button
                            size="sm"
                            onClick={handleCopyLink}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] h-9 rounded-xl w-full"
                          >
                            <Copy className="mr-2 h-3.5 w-3.5" /> Compartilhar Sala
                          </Button>
                        </div>

                        <div className="bg-white/90 dark:bg-card/80 backdrop-blur border border-slate-100 dark:border-border/60 rounded-2xl p-4 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.15)] flex flex-col gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-indigo-600 text-white text-[11px] font-black shrink-0">2</span>
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-foreground">Monte a fila</h3>
                          </div>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-muted-foreground leading-relaxed -mt-1">
                            Importe direto do Jira ou adicione tarefas manualmente.
                          </p>
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              onClick={() => { setIsQueueOpen(true); setJiraImportSignal(s => s + 1); }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] h-9 rounded-xl w-full"
                            >
                              <CloudDownload className="mr-2 h-3.5 w-3.5" /> Importar do Jira
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setIsQueueOpen(true); setAddFormSignal(s => s + 1); }}
                              className="font-black uppercase tracking-widest text-[10px] h-8 rounded-xl w-full border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                            >
                              <ListPlus className="mr-2 h-3.5 w-3.5" /> Adicionar Manualmente
                            </Button>
                          </div>
                        </div>

                        <div className="bg-slate-50/80 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-border/60 rounded-2xl p-4 flex flex-col gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-300 dark:bg-slate-700 text-white text-[11px] font-black shrink-0">3</span>
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-muted-foreground">Comece a votar</h3>
                          </div>
                          <p className="text-[11px] font-medium text-slate-400 dark:text-muted-foreground/70 leading-relaxed">
                            A primeira tarefa adicionada já cai na mesa — a votação começa automaticamente, sem passo extra.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-md space-y-7">
                      <div className="mx-auto w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-slate-400 shadow-inner relative">
                        <Hourglass className="w-12 h-12 animate-spin animate-duration-[3s]" />
                        <div className="absolute inset-0 rounded-[2.5rem] border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white leading-tight">Sala Pronta!</h2>
                        <p className="text-slate-500 dark:text-muted-foreground text-sm font-medium leading-relaxed">
                          O facilitador está preparando os motores. Relaxe um pouco, logo a primeira tarefa aparecerá aqui para votação.
                        </p>
                      </div>
                      {participants.length > 1 && (
                        <div className="flex items-center justify-center gap-2.5">
                          <div className="flex -space-x-3">
                            {participants.slice(0, 5).map(p => (
                              <Avatar key={p.id} className="h-8 w-8 border-2 border-white dark:border-card">
                                <AvatarFallback className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                                  {getInitials(p.nickname)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-muted-foreground">{participants.length} na sala</span>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-full w-fit mx-auto">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Aguardando Início...</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : isSessionFinished && stats ? (
                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
                  <div className="text-center space-y-3 mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 mb-2">
                      <Award className="h-4 w-4" />
                      Refinamento Finalizado
                    </div>
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-tight">Dashboard da Cerimônia</h2>
                    <p className="text-slate-500 text-sm font-medium">Resultados consolidados da rodada de hoje.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <StatCard
                      icon={Clock}
                      label="Tempo Gasto"
                      value={stats.durationStr}
                      sub={stats.idleMins > 0 ? `Tempo ativo (${stats.idleMins} min de pausa fora)` : 'Duração total'}
                      color="text-indigo-600 bg-indigo-500/10"
                    />
                    <StatCard
                      icon={ListChecks}
                      label="Tarefas Debatidas"
                      value={String(stats.breakdown.discussed)}
                      sub={`${stats.totalTopics} estimada${stats.totalTopics !== 1 ? 's' : ''} de ${stats.breakdown.total} na fila`}
                      color="text-violet-600 bg-violet-500/10"
                    />
                    <StatCard
                      icon={Target}
                      label={deck === 'hours' ? 'Total de Horas' : 'Total Story Points'}
                      value={String(stats.totalPoints)}
                      sub="Esforço estimado"
                      color="text-emerald-600 bg-emerald-500/10"
                    />
                    <StatCard
                      icon={TrendingUp}
                      label="Eficiência Média"
                      value={stats.avgTimePerTopic}
                      sub="Tempo por item"
                      color="text-amber-600 bg-amber-500/10"
                    />
                  </div>

                  {/* Leitura honesta do que aconteceu: debate ≠ fila. */}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                      {stats.breakdown.estimated} estimada{stats.breakdown.estimated !== 1 ? 's' : ''}
                    </span>
                    {stats.breakdown.skipped > 0 && (
                      <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-700 text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                        {stats.breakdown.skipped} pulada{stats.breakdown.skipped !== 1 ? 's' : ''}
                      </span>
                    )}
                    {stats.breakdown.parked > 0 && (
                      <span className="px-3 py-1.5 rounded-full bg-sky-500/10 text-sky-700 text-[10px] font-black uppercase tracking-widest border border-sky-500/20">
                        {stats.breakdown.parked} adiada{stats.breakdown.parked !== 1 ? 's' : ''}
                      </span>
                    )}
                    {stats.breakdown.untouched > 0 && (
                      <span className="px-3 py-1.5 rounded-full bg-slate-500/10 text-slate-600 text-[10px] font-black uppercase tracking-widest border border-slate-500/20">
                        {stats.breakdown.untouched} não abordada{stats.breakdown.untouched !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {deck === 'hours' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
                      <StatCard
                        icon={Code}
                        label="Esforço Dev"
                        value={`${stats.totalDevHours}h`}
                        sub="Total Desenvolvedores"
                        color="text-indigo-600 bg-indigo-500/10"
                      />
                      <StatCard
                        icon={Bug}
                        label="Esforço QA"
                        value={`${stats.totalQaHours}h`}
                        sub="Total Qualidade"
                        color="text-pink-600 bg-pink-500/10"
                      />
                    </div>
                  )}

                  {settings?.perTopicTime !== false && (
                    <div className="mt-6">
                      <TopicTiming rounds={votingRounds || []} issues={issuesQueue} sessionStartedAt={sessionStartedAt} />
                    </div>
                  )}

                  {settings?.showVelocity && (
                    <div className="mt-6">
                      <SessionVelocity currentRoomId={roomId} />
                    </div>
                  )}

                  {stats.skippedIssues && stats.skippedIssues.length > 0 && (
                    <div className="mt-12 space-y-5">
                      <div className="flex items-center gap-4 px-2">
                        <span className="text-[10px] font-black uppercase text-amber-600 tracking-[0.2em] whitespace-nowrap">Tarefas não Estimadas (Puladas)</span>
                        <Separator className="flex-1 opacity-10 bg-amber-500" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.skippedIssues.map(issue => (
                          <div key={issue.id} className="group bg-white/50 backdrop-blur-sm border border-amber-200/50 rounded-2xl p-5 flex flex-col justify-between hover:bg-white hover:border-amber-300 transition-all shadow-sm">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
                                  <SkipForward className="h-4 w-4" />
                                </div>
                                <span className="text-[10px] font-black text-amber-600/70 tracking-widest uppercase truncate">{issue.key || 'Tarefa'}</span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 leading-snug">{issue.title}</h4>
                            </div>
                            {issue.note && (
                              <p className="mt-4 p-3 bg-amber-50 rounded-xl text-[11px] text-amber-700/70 font-medium italic border border-amber-100/50">
                                "{issue.note}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.parkedIssues && stats.parkedIssues.length > 0 && (
                    <div className="mt-12 space-y-5">
                      <div className="flex items-center gap-4 px-2">
                        <span className="text-[10px] font-black uppercase text-sky-600 tracking-[0.2em] whitespace-nowrap">Tarefas Adiadas na Sessão</span>
                        <Separator className="flex-1 opacity-10 bg-sky-500" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.parkedIssues.map(issue => (
                          <div key={issue.id} className="bg-white/50 backdrop-blur-sm border border-sky-200/50 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-sky-100 rounded-lg text-sky-600">
                                  <Hourglass className="h-4 w-4" />
                                </div>
                                <span className="text-[10px] font-black text-sky-600/70 tracking-widest uppercase truncate">
                                  {issue.key || 'Tarefa'} · adiada {issue.parkCount || 1}x
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 leading-snug">{issue.title}</h4>
                              <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {issue.skipped ? 'Terminou pulada' : issue.status === 'completed' ? 'Retomada e estimada' : 'Ficou pendente'}
                              </p>
                            </div>
                            {issue.parkedNote && (
                              <p className="mt-4 p-3 bg-sky-50 rounded-xl text-[11px] text-sky-700/70 font-medium italic border border-sky-100/50">
                                "{issue.parkedNote}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.untouchedIssues && stats.untouchedIssues.length > 0 && (
                    <div className="mt-12 space-y-5">
                      <div className="flex items-center gap-4 px-2">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] whitespace-nowrap">Tarefas não Abordadas</span>
                        <Separator className="flex-1 opacity-10 bg-slate-500" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.untouchedIssues.map(issue => (
                          <div key={issue.id} className="bg-white/40 border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase truncate">{issue.key || 'Tarefa'}</span>
                            <h4 className="text-sm font-bold text-slate-700 leading-snug mt-2">{issue.title}</h4>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative group mt-12">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                    <Card className="relative bg-white/80 backdrop-blur-xl border-white border shadow-2xl rounded-[2.5rem] overflow-hidden">
                      <CardContent className="p-8 flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6 text-center lg:text-left">
                          <div className="p-5 bg-indigo-600 rounded-3xl text-white shadow-2xl shadow-indigo-600/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                            <CheckCircle2 className="h-8 w-8" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="font-black uppercase text-sm tracking-widest text-indigo-600">TUDO PRONTO! HISTÓRICO SALVO</h3>
                            <p className="text-xs text-slate-500 font-medium">Os resultados foram salvos automaticamente no seu workspace.</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-4 w-full lg:w-auto">
                          <Button
                            variant="outline"
                            onClick={handleExportTasksToWorkspace}
                            className="h-14 px-8 font-black uppercase tracking-widest text-[10px] border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all active:scale-95 flex-1 lg:flex-initial"
                          >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Atualizar Histórico
                          </Button>
                          <ExportDialog
                            roomTitle={roomTitle || "Scrum Poker"}
                            roomTeam={roomTeam}
                            issues={issuesQueue}
                            participants={participants}
                            deck={deck}
                            rounds={votingRounds || undefined}
                            sessionStartedAt={sessionStartedAt}
                            perTopicTime={settings?.perTopicTime !== false}
                            triggerNode={
                              <Button variant="default" className="h-14 px-10 font-black uppercase tracking-widest text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 rounded-2xl transition-all active:scale-95 flex-1 lg:flex-initial">
                                <Download className="mr-2 h-4 w-4" />
                                EXPORTAR RESULTADOS
                              </Button>
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : votesRevealed ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-6 duration-700">
                  <div className="bg-card/90 backdrop-blur-xl p-4 md:p-6 rounded-[2rem] border border-white/20 shadow-xl">
                    <Results votes={votes} participants={participants} deck={deck} allowManagementToVote={settings?.allowManagementToVote} tshirtEquivalents={settings?.tshirtEquivalents} />
                  </div>
                  {settings?.showDistribution && (
                    <VoteDistribution votes={votes} participants={participants} deck={deck} allowManagementToVote={settings?.allowManagementToVote} />
                  )}
                  {settings?.confidenceVote && (
                    <ConfidenceSummary votes={votes} participants={participants} allowManagementToVote={settings?.allowManagementToVote} />
                  )}
                  {settings?.suggestRevote && hasHighDivergence && (
                    <Card className="rounded-2xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/10">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-[11px] font-bold">Divergência crítica entre os votos — vale discutir e revotar.</span>
                        </div>
                        {isCurrentUserFacilitator && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onClear}
                            className="h-9 px-4 rounded-xl border-rose-400/50 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Revotar todos
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  {showRoundNudge && (
                    <Card className="rounded-2xl border border-orange-200/70 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/10">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                          <Layers className="h-4 w-4" />
                          <span className="text-[11px] font-bold">
                            {activeRoundCount} rodadas sem consenso — considere quebrar a história em partes menores ou adiá-la.
                          </span>
                        </div>
                        {isCurrentUserFacilitator && (
                          settings?.parkTask && onParkIssue ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setParkNote(''); setIsParkDialogOpen(true); }}
                              className="h-9 px-4 rounded-xl border-orange-400/50 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/40 font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
                            >
                              <Hourglass className="h-3.5 w-3.5 mr-1.5" /> Adiar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSkipNote(''); setIsSkipDialogOpen(true); }}
                              className="h-9 px-4 rounded-xl border-orange-400/50 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/40 font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
                            >
                              <SkipForward className="h-3.5 w-3.5 mr-1.5" /> Pular / Adiar
                            </Button>
                          )
                        )}
                      </CardContent>
                    </Card>
                  )}
                  {settings?.groomingFlag && votes.filter(v => v.value === '?').length > 0 && (
                    <Card className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10">
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <HelpCircle className="h-4 w-4" />
                          <span className="text-[11px] font-bold">
                            {votes.filter(v => v.value === '?').length} pessoa(s) pediram mais informação (voto "?").
                          </span>
                        </div>
                        {isCurrentUserFacilitator && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSkipIssue('Enviado para grooming — faltou informação para estimar.')}
                            className="h-9 px-4 rounded-xl border-amber-400/50 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 font-black uppercase text-[10px] tracking-widest whitespace-nowrap"
                          >
                            <SkipForward className="h-3.5 w-3.5 mr-1.5" /> Enviar para grooming
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  {settings?.decisionNotes && isCurrentUserFacilitator && onSetDecisionNote && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nota de decisão — por que essa estimativa?</label>
                      <Textarea
                        key={activeIssueId || 'none'}
                        defaultValue={activeIssue?.decisionNote || ''}
                        onBlur={(e) => onSetDecisionNote(e.target.value)}
                        placeholder="Ex: alto por depender de integração externa ainda instável..."
                        className="resize-none text-sm rounded-xl bg-slate-50 dark:bg-background/60 border-slate-200 dark:border-border min-h-[70px]"
                      />
                    </div>
                  )}
                  {/* Outlier expõe nomes; some no modo anônimo. */}
                  {settings?.outlierPrompt && !settings?.anonymousReveal && (
                    <OutlierPrompt votes={votes} participants={participants} deck={deck} tshirtEquivalents={settings?.tshirtEquivalents} />
                  )}
                  {settings?.anonymousReveal ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                      <EyeOff className="h-4 w-4 opacity-50" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Revelação anônima — só a distribuição é exibida</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 px-2">
                        <Separator className="flex-1 opacity-20" />
                        <h3 className="text-center text-[9px] font-black text-muted-foreground uppercase tracking-[0.4em]">Detalhamento de Votos</h3>
                        <Separator className="flex-1 opacity-20" />
                      </div>
                      <VotingArea participants={participants} votes={votes} votesRevealed={votesRevealed} divergences={divergences} groupByRole={!!settings?.groupVotesByRole} />
                    </div>
                  )}
                </div>
              ) : (
                <div className={cn(
                  "space-y-6 transition-all duration-500",
                  isTheaterMode && "scale-105"
                )}>
                  <VotingArea participants={participants} votes={votes} votesRevealed={votesRevealed} divergences={divergences} />
                </div>
              )}
            </div>

            <div className="pt-4 space-y-8 pb-12 shrink-0">
              {activeIssueId && currentUser.role !== 'spectator' ? (
                votesRevealed ? null : (
                <div className="relative">
                  <div className="absolute inset-x-0 -top-3 flex justify-center z-10 pointer-events-none">
                    <div className="px-4 py-0.5 bg-primary text-[9px] font-black text-primary-foreground rounded-full tracking-[0.2em] uppercase shadow-md border-2 border-background flex items-center justify-center gap-2">
                      <span>Seu Baralho</span>
                      {!votesRevealed && (
                        <>
                          <span className="opacity-50">•</span>
                          <span className="text-primary-foreground/90 whitespace-nowrap">
                            {votes.length === 0 ? "Aguardando Votos..." : `${votes.length} DE ${eligibleVoters.length} VOTARAM`}
                          </span>
                          {votes.length > 0 && pendingVoters > 0 && (
                            <>
                              <span className="opacity-50">•</span>
                              <span className="text-amber-200 whitespace-nowrap">FALTAM {pendingVoters}</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <Controls
                    deck={deck}
                    currentUserVote={currentUserVote}
                    onVote={onVote}
                    votesRevealed={votesRevealed}
                    currentUser={currentUser}
                    allowManagementToVote={settings?.allowManagementToVote}
                    selectiveRevotingRole={selectiveRevotingRole}
                    isTheaterMode={isTheaterMode}
                    isSessionNotStarted={!!activeIssueId && !sessionStartedAt && !isSessionFinished}
                    confidenceEnabled={!!settings?.confidenceVote}
                    onSetConfidence={onSetConfidence}
                    currentUserConfidence={currentUserConfidence}
                  />
                </div>
                )
              ) : (!isSessionFinished && !isInitialState) ? (
                <Card className="bg-muted/20 border-2 border-dashed border-muted-foreground/10 rounded-2xl">
                  <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                    <div className="p-3 bg-muted/50 rounded-full">
                      <Eye className="h-6 w-6 opacity-40" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      {!activeIssueId ? 'Sessão Finalizada' : 'Modo Espectador Ativo'}
                    </span>
                  </CardContent>
                </Card>
              ) : null}

              {votingRounds && votingRounds.length > 0 && (
                <History roomId={roomId} rounds={votingRounds} participants={participants} issues={issuesQueue} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BARRA LATERAL DIREITA: PARTICIPANTES */}
      <EliteSidebar
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        participantsCount={participants.length}
        onCopyLink={handleCopyLink}
        isTheaterMode={isTheaterMode}
      >
        {participantsPanel}
      </EliteSidebar>

      {/* DRAWER MOBILE: PARTICIPANTES (a EliteSidebar acima é md+) */}
      {participantsIsDrawer && (
        <Sheet open={isParticipantsOpen} onOpenChange={setIsParticipantsOpen}>
          <SheetContent side="right" className="w-[88vw] max-w-sm p-0 flex flex-col">
            <SheetHeader className="p-4 border-b shrink-0 text-left">
              <SheetTitle className="text-xs font-black tracking-widest uppercase flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-primary" /> Time Ativo
                <span className="bg-primary/10 text-primary text-[10px] px-2.5 py-0.5 rounded-full">{participants.length}</span>
              </SheetTitle>
              <SheetDescription className="sr-only">Participantes da sala</SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 flex flex-col bg-muted/5">
              {participantsPanel}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Skip Task Dialog */}
      <AlertDialog open={isSkipDialogOpen} onOpenChange={setIsSkipDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border border-slate-200 dark:border-border bg-white dark:bg-card shadow-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-amber-600 dark:text-amber-500 flex items-center gap-2">
              <SkipForward className="h-5 w-5" />
              Pular Tarefa
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-medium">
                  Por que esta tarefa não será estimada agora? <span className="opacity-60 text-xs">(Ex: Bloqueado, Falta Info, Fora do Escopo)</span>
                </p>
                <Textarea
                  value={skipNote}
                  onChange={(e) => setSkipNote(e.target.value)}
                  placeholder="Adicione uma anotação opcional..."
                  className="resize-none text-sm rounded-xl bg-slate-50 dark:bg-background/60 border-slate-200 dark:border-border focus:border-amber-400 dark:focus:border-amber-500 text-slate-900 dark:text-foreground min-h-[90px]"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onSkipIssue(skipNote); setIsSkipDialogOpen(false); }}
              className="bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-amber-500/20"
            >
              Confirmar e Avançar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Park Task Dialog */}
      <AlertDialog open={isParkDialogOpen} onOpenChange={setIsParkDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border border-slate-200 dark:border-border bg-white dark:bg-card shadow-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Hourglass className="h-5 w-5" />
              Adiar Tarefa
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-medium">
                  Volta pro fim da fila para revisitar ainda nesta sessão. <span className="opacity-60 text-xs">(Ex: aguardando alinhamento, quebrar antes)</span>
                </p>
                <Textarea
                  value={parkNote}
                  onChange={(e) => setParkNote(e.target.value)}
                  placeholder="Motivo opcional..."
                  className="resize-none text-sm rounded-xl bg-slate-50 dark:bg-background/60 border-slate-200 dark:border-border focus:border-indigo-400 dark:focus:border-indigo-500 text-slate-900 dark:text-foreground min-h-[90px]"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onParkIssue && onParkIssue(parkNote); setIsParkDialogOpen(false); }}
              className="bg-slate-700 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg"
            >
              Adiar e Avançar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish Session Dialog */}
      <AlertDialog open={isFinishDialogOpen} onOpenChange={setIsFinishDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border border-slate-200 dark:border-border bg-white dark:bg-card shadow-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tighter text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Encerrar Refinamento
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground font-medium">
                  Fecha a sessão agora e gera o relatório. {(() => {
                    const restantes = issuesQueue.filter(i => !i.skipped && i.status !== 'completed').length;
                    return restantes > 0
                      ? `${restantes} tarefa${restantes !== 1 ? 's' : ''} sem estimativa ${restantes !== 1 ? 'entram' : 'entra'} no relatório como não abordada${restantes !== 1 ? 's' : ''} — sem precisar pular uma a uma.`
                      : 'Todas as tarefas da fila já foram tratadas.';
                  })()}
                </p>
                <p className="text-xs text-muted-foreground/80">
                  O tempo contabilizado é só o das tarefas que foram votadas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onFinishSession && onFinishSession(); setIsFinishDialogOpen(false); }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg"
            >
              Encerrar e ver relatório
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FLOATING CHAT BUTTON */}
      <AnimatePresence>
        {!isChatOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-[60]"
          >
            <Button
              onClick={() => setIsChatOpen(true)}
              className="h-16 w-16 rounded-full bg-slate-900 hover:bg-black text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <BrainCircuit className="h-7 w-7 text-indigo-400 group-hover:scale-110 transition-transform" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REACTIONS OVERLAY (opt-in) */}
      {reactionsEnabled && onReact && (
        <ReactionOverlay reactions={reactions || []} onReact={onReact} />
      )}

      {/* POKER CHAT SIDEBAR */}
      <PokerChat
        roomId={roomId} 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        activeTopic={activeIssue?.title || currentTopic}
        activeIssue={activeIssue}
      />

      {/* ISSUE DETAIL OVERLAY */}
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
          acceptanceCriteria: activeIssue.acceptanceCriteria
        } : null}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      {/* SHARE / REFINEMENT EXPORT DIALOG */}
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

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-card">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div className={cn("p-2.5 rounded-xl w-fit", color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="text-2xl font-black tracking-tighter">{value}</p>
            <p className="text-[9px] font-bold text-muted-foreground/60 uppercase">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
