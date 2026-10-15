'use client';

import React from 'react';
import {
  Eye,
  HelpCircle,
  Link2,
  ListChecks,
  MessageSquareText,
  MessagesSquare,
  Monitor,
  MoreHorizontal,
  SlidersHorizontal,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { TimerState } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton, PhaseStepper, POKER_PHASES, RoomTimer, StatusChip } from '@/components/room-kit';

export interface PokerRoomBarProps {
  roomTitle: string;
  /** "Squad · Sprint" acima do título. */
  roomTeam?: string;
  deckLabel: string;
  phase: 'discuss' | 'vote' | 'reveal' | 'decide';
  isFacilitator: boolean;
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
  onToggleQueue: () => void;
  isParticipantsOpen: boolean;
  onToggleParticipants: () => void;
  isTeamChatOpen: boolean;
  teamChatUnread: number;
  onToggleTeamChat: () => void;
  isKnowledgeOpen: boolean;
  onToggleKnowledge: () => void;
  // Ações
  onShare: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onTheater: () => void;
  onOpenRetro?: () => void;
  // Ação principal
  canReveal: boolean;
  showReveal: boolean;
  votedCount: number;
  voterTotal: number;
  onReveal: () => void;
}

/**
 * Barra da sala (abaixo do cabeçalho global): identidade, fase da rodada,
 * cronômetro, painéis, ações e a ação principal "Revelar votos". Abaixo de lg
 * o excedente vai para o menu "Mais".
 */
export function PokerRoomBar(p: PokerRoomBarProps) {
  const showTimer = !!p.timer && (p.timer.initialDuration > 0 || p.timer.status !== 'stopped');

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-card px-4 py-3 md:px-6">
      <div className="flex min-w-[200px] flex-col gap-0.5">
        {p.roomTeam && <span className="truncate text-xs text-muted-foreground">{p.roomTeam}</span>}
        <span className="flex items-center gap-2 text-base font-semibold">
          <span className="truncate">{p.roomTitle}</span>
          <StatusChip>{p.deckLabel}</StatusChip>
        </span>
      </div>

      <PhaseStepper className="mx-auto hidden md:flex" steps={POKER_PHASES} current={p.phase} label="Fases da rodada" />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {showTimer && p.timer && (
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
            className="hidden sm:flex"
          />
        )}

        <IconButton label="Fila de tarefas" icon={ListChecks} pressed={p.isQueueOpen} onClick={p.onToggleQueue} />
        <IconButton label="Participantes" icon={Users} pressed={p.isParticipantsOpen} onClick={p.onToggleParticipants} />
        <IconButton label="Chat da sala" icon={MessagesSquare} pressed={p.isTeamChatOpen} badge={p.isTeamChatOpen ? 0 : p.teamChatUnread} onClick={p.onToggleTeamChat} />
        <IconButton label="Compartilhar sala" icon={Link2} onClick={p.onShare} className="hidden sm:inline-flex" />
        {p.isFacilitator && <IconButton label="Configurações da cerimônia" icon={SlidersHorizontal} onClick={p.onOpenSettings} className="hidden sm:inline-flex" />}
        <IconButton label="Base de conhecimento" icon={Sparkles} pressed={p.isKnowledgeOpen} onClick={p.onToggleKnowledge} className="hidden lg:inline-flex" />
        {p.isFacilitator && <IconButton label="Modo apresentação" icon={Monitor} onClick={p.onTheater} className="hidden lg:inline-flex" />}
        <IconButton label="Guia do poker" icon={HelpCircle} onClick={p.onOpenGuide} className="hidden lg:inline-flex" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Mais opções da sala" icon={MoreHorizontal} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={p.onShare} className="gap-2 sm:hidden"><Link2 className="h-4 w-4" strokeWidth={1.5} /> Compartilhar sala</DropdownMenuItem>
            {p.isFacilitator && <DropdownMenuItem onClick={p.onOpenSettings} className="gap-2 sm:hidden"><SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} /> Configurações da cerimônia</DropdownMenuItem>}
            <DropdownMenuItem onClick={p.onToggleKnowledge} className="gap-2 lg:hidden"><Sparkles className="h-4 w-4" strokeWidth={1.5} /> Base de conhecimento</DropdownMenuItem>
            {p.isFacilitator && <DropdownMenuItem onClick={p.onTheater} className="gap-2 lg:hidden"><Eye className="h-4 w-4" strokeWidth={1.5} /> Modo apresentação</DropdownMenuItem>}
            <DropdownMenuItem onClick={p.onOpenGuide} className="gap-2 lg:hidden"><HelpCircle className="h-4 w-4" strokeWidth={1.5} /> Guia do poker</DropdownMenuItem>
            <DropdownMenuSeparator className="lg:hidden" />
            <DropdownMenuItem onClick={() => p.onSetIsSoundEnabled(!p.isSoundEnabled)} className="gap-2">
              {p.isSoundEnabled ? <Volume2 className="h-4 w-4" strokeWidth={1.5} /> : <VolumeX className="h-4 w-4" strokeWidth={1.5} />}
              {p.isSoundEnabled ? 'Desligar o som do timer' : 'Ligar o som do timer'}
            </DropdownMenuItem>
            {p.onOpenRetro && (
              <DropdownMenuItem onClick={p.onOpenRetro} className="gap-2"><MessageSquareText className="h-4 w-4" strokeWidth={1.5} /> Abrir retro desta sprint</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {p.isFacilitator && p.showReveal && (
          <button
            type="button"
            onClick={p.onReveal}
            disabled={!p.canReveal}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground room-glow transition-[background-color,opacity] duration-[140ms] hover:bg-primary/90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none'
            )}
          >
            <Eye className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />
            Revelar votos
            <span className="rounded bg-black/15 px-1.5 py-px text-xs tabular-nums dark:bg-white/20">{p.votedCount}/{p.voterTotal}</span>
          </button>
        )}
      </div>
    </div>
  );
}
