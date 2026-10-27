'use client';

import { moduleIcon } from '@/lib/modules-registry';
import React from 'react';
import {
  Eye,
  HelpCircle,
  History,
  Link2,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  Monitor,
  Trash2,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { TimerState } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  POKER_PHASES,
  RoomTimer,
  RoomTopBar,
  type RoomTopBarAction,
  type RoomTopBarChip,
  type RoomTopBarMenuItem,
  type RoomTopBarStatus,
  type TopBarPerson,
} from '@/components/room-kit';

export interface PokerRoomBarProps {
  roomTitle: string;
  /** "Squad · Sprint". */
  roomTeam?: string;
  deckLabel: string;
  /** Fase da rodada; null com a cerimônia concluída (não há rodada em andamento). */
  phase: 'discuss' | 'vote' | 'reveal' | 'decide' | null;
  /** Ao vivo (sessão iniciada), aguardando ou encerrada. */
  status: RoomTopBarStatus;
  isFacilitator: boolean;
  // Presença
  people: TopBarPerson[];
  // Cronômetro
  timer?: TimerState;
  serverTimeOffset: number;
  isSoundEnabled: boolean;
  onSetIsSoundEnabled: (enabled: boolean) => void;
  onStartTimer: (duration: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onSetTimerDuration: (duration: number) => void;
  // Painéis
  isQueueOpen: boolean;
  /** Tarefas ainda na fila (selo do botão). */
  queueCount: number;
  onToggleQueue: () => void;
  isParticipantsOpen: boolean;
  onToggleParticipants: () => void;
  isTeamChatOpen: boolean;
  teamChatUnread: number;
  onToggleTeamChat: () => void;
  isKnowledgeOpen: boolean;
  onToggleKnowledge: () => void;
  isHistoryOpen: boolean;
  historyCount: number;
  onToggleHistory: () => void;
  // Ações
  onShare: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onTheater: () => void;
  onOpenRetro?: () => void;
  /** Só para quem criou a sala (ou admin): abre a confirmação de excluir a sala. */
  onDeleteRoom?: () => void;
  onOpenFeedback?: () => void;
  // Ação principal
  canReveal: boolean;
  showReveal: boolean;
  votedCount: number;
  voterTotal: number;
  onReveal: () => void;
}

/**
 * Cabeçalho único da sala do Scrum Poker: monta o `RoomTopBar` do kit com o que é
 * do Poker (baralho, fases da rodada, painéis, "Revelar votos").
 */
export function PokerRoomBar(p: PokerRoomBarProps) {
  const showTimer = !!p.timer && (p.timer.initialDuration > 0 || p.timer.status !== 'stopped');

  const chips: RoomTopBarChip[] = [
    ...(p.roomTeam ? [{ id: 'team', label: p.roomTeam, secondary: true }] : []),
    { id: 'deck', label: p.deckLabel, tone: 'brand' as const },
  ];

  const actions: RoomTopBarAction[] = [
    { id: 'queue', label: 'Fila de tarefas', icon: ListChecks, pressed: p.isQueueOpen, badge: p.queueCount, onClick: p.onToggleQueue },
    ...(p.historyCount > 0
      ? [{ id: 'history', label: 'Histórico da sessão', icon: History, pressed: p.isHistoryOpen, tier: 'mid' as const, onClick: p.onToggleHistory }]
      : []),
    { id: 'chat', label: 'Chat da sala', icon: MessagesSquare, pressed: p.isTeamChatOpen, badge: p.isTeamChatOpen ? 0 : p.teamChatUnread, onClick: p.onToggleTeamChat },
    { id: 'share', label: 'Compartilhar sala', icon: Link2, onClick: p.onShare },
    ...(p.isFacilitator
      ? [{ id: 'settings', label: 'Configurações da cerimônia', text: 'Configurações', icon: SlidersHorizontal, onClick: p.onOpenSettings }]
      : []),
    { id: 'knowledge', label: 'Base de conhecimento', icon: Sparkles, pressed: p.isKnowledgeOpen, tier: 'wide', onClick: p.onToggleKnowledge },
    ...(p.isFacilitator
      ? [{ id: 'theater', label: 'Modo apresentação', text: 'Apresentar', icon: Monitor, onClick: p.onTheater }]
      : []),
    { id: 'guide', label: 'Guia do poker', icon: HelpCircle, tier: 'wide', onClick: p.onOpenGuide },
  ];

  const menuItems: RoomTopBarMenuItem[] = [
    {
      id: 'sound',
      label: p.isSoundEnabled ? 'Desligar o som do timer' : 'Ligar o som do timer',
      icon: p.isSoundEnabled ? Volume2 : VolumeX,
      onClick: () => p.onSetIsSoundEnabled(!p.isSoundEnabled),
    },
    ...(p.onOpenRetro ? [{ id: 'retro', label: 'Abrir retro desta sprint', icon: MessageSquareText, onClick: p.onOpenRetro }] : []),
    ...(p.onDeleteRoom ? [{ id: 'delete-room', label: 'Excluir sala', icon: Trash2, onClick: p.onDeleteRoom }] : []),
  ];

  return (
    <RoomTopBar
      toolName="Scrum Poker"
      toolIcon={moduleIcon('poker')}
      title={p.roomTitle}
      status={p.status}
      chips={chips}
      phases={p.phase ? { steps: POKER_PHASES, current: p.phase, label: 'Fases da rodada' } : undefined}
      timer={
        showTimer && p.timer ? (
          <RoomTimer
            timer={p.timer}
            isFacilitator={p.isFacilitator}
            onStart={p.onStartTimer}
            onPause={p.onPauseTimer}
            onResume={p.onResumeTimer}
            onReset={p.onResetTimer}
            onSetDuration={p.onSetTimerDuration}
            isSoundEnabled={p.isSoundEnabled}
            serverOffset={p.serverTimeOffset}
          />
        ) : undefined
      }
      primaryAction={
        p.isFacilitator && p.showReveal ? (
          <button
            type="button"
            onClick={p.onReveal}
            disabled={!p.canReveal}
            className={cn(
              'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground room-glow transition-[background-color,opacity] duration-fast hover:bg-primary/90 max-sm:h-11',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none'
            )}
          >
            <Eye className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />
            Revelar votos
            <span className="rounded bg-primary-foreground/20 px-1.5 py-px text-xs tabular-nums">{p.votedCount}/{p.voterTotal}</span>
          </button>
        ) : undefined
      }
      presence={{ people: p.people, open: p.isParticipantsOpen, onClick: p.onToggleParticipants }}
      actions={actions}
      menuItems={menuItems}
      onOpenFeedback={p.onOpenFeedback}
    />
  );
}
