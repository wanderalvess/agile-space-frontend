'use client';

import { useState } from 'react';
import { Eye, EyeOff, RefreshCw, RotateCcw, SquareCheck, Vote } from 'lucide-react';
import {
  ConfirmDialog,
  ModalButton,
  RoomTimer,
  Segmented,
  SelectField,
  StatusChip,
} from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { RetroBoard, TimerState } from '@/lib/types';
import { TIMER_LATE_GRACE_MS, retroPhase, voteLimitOptions, type RetroPhase } from './retro-room-logic';

export type RetroLayoutMode = 'board' | 'focus';

export interface RetroPhaseActionsProps {
  boardData: Pick<RetroBoard, 'isCardsRevealed' | 'votingStatus'>;
  onToggleCardsRevealed: () => void;
  onSetVotingStatus: (status: 'disabled' | 'active' | 'finished') => void;
  className?: string;
}

/**
 * Ações do facilitador que levam a retro de uma fase à próxima: revelar, abrir a votação, encerrá-la e zerar.
 * Zerar apaga os votos de verdade e por isso pede confirmação. Usado na barra de controles e na de apresentação.
 */
export function RetroPhaseActions({ boardData, onToggleCardsRevealed, onSetVotingStatus, className }: RetroPhaseActionsProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const phase: RetroPhase = retroPhase(boardData);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {phase === 'write' && (
        <ModalButton variant="primary" className="gap-2" onClick={onToggleCardsRevealed}>
          <Eye className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Revelar cartões
        </ModalButton>
      )}

      {phase === 'reveal' && (
        <>
          <ModalButton variant="primary" className="gap-2" onClick={() => onSetVotingStatus('active')}>
            <Vote className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Iniciar votação
          </ModalButton>
          <ModalButton className="gap-2" onClick={onToggleCardsRevealed}>
            <EyeOff className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Ocultar cartões
          </ModalButton>
        </>
      )}

      {phase === 'vote' && (
        <>
          <ModalButton variant="primary" className="gap-2" onClick={() => onSetVotingStatus('finished')}>
            <SquareCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Encerrar votação
          </ModalButton>
          <ModalButton className="gap-2" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Zerar votos
          </ModalButton>
        </>
      )}

      {phase === 'act' && (
        <ModalButton className="gap-2" onClick={() => setConfirmReset(true)}>
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Zerar votos
        </ModalButton>
      )}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        tone="warn"
        icon={RotateCcw}
        title="Zerar a votação?"
        description="Todos os votos desta rodada são apagados e a votação volta ao início. Os cartões continuam como estão."
        cancelLabel="Manter votos"
        confirmLabel="Zerar votos"
        onConfirm={() => onSetVotingStatus('disabled')}
      />
    </div>
  );
}

const STATUS_COPY: Record<RetroPhase, { label: string; live?: boolean }> = {
  write: { label: 'Escrevendo · cartões ocultos' },
  reveal: { label: 'Cartões revelados' },
  vote: { label: 'Votação aberta', live: true },
  act: { label: 'Votação encerrada' },
};

export interface RetroControlBarProps {
  boardData: RetroBoard;
  isFacilitator: boolean;
  timer: TimerState;
  isSoundEnabled: boolean;
  onToggleCardsRevealed: () => void;
  onSetVotingStatus: (status: 'disabled' | 'active' | 'finished') => void;
  onSetMaxVotesPerParticipant: (max: number) => void;
  onStartTimer: (duration: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onSetTimerDuration: (duration: number) => void;
  /** O tempo zerou com a tela aberta (todos recebem; quem age é o facilitador). */
  onTimerExpire: (info: { late: boolean }) => void;
  layoutMode: RetroLayoutMode;
  onLayoutModeChange: (mode: RetroLayoutMode) => void;
  onPresent: () => void;
}

const LAYOUT_OPTIONS = [
  { id: 'board', label: 'Quadro' },
  { id: 'focus', label: 'Foco' },
  { id: 'present', label: 'Apresentar' },
] as const;

/**
 * Barra de controles abaixo do cabeçalho: o facilitador conduz as fases e o limite de votos; todos veem o
 * estado da votação, o cronômetro quando há um e escolhem a visão (quadro, foco ou apresentação).
 */
export function RetroControlBar({
  boardData,
  isFacilitator,
  timer,
  isSoundEnabled,
  onToggleCardsRevealed,
  onSetVotingStatus,
  onSetMaxVotesPerParticipant,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onSetTimerDuration,
  onTimerExpire,
  layoutMode,
  onLayoutModeChange,
  onPresent,
}: RetroControlBarProps) {
  const phase = retroPhase(boardData);
  const maxVotes = boardData.maxVotesPerParticipant || 0;
  const showTimer = isFacilitator || timer.status !== 'stopped';
  const status = STATUS_COPY[phase];

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background px-3 py-2 sm:px-4 xl:px-6">
      {isFacilitator ? (
        <RetroPhaseActions boardData={boardData} onToggleCardsRevealed={onToggleCardsRevealed} onSetVotingStatus={onSetVotingStatus} />
      ) : (
        <StatusChip tone={status.live ? 'success' : 'neutral'} dot={status.live} className="h-8 px-3 text-[13px]">{status.label}</StatusChip>
      )}

      {isFacilitator ? (
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="max-sm:hidden">Votos por painel</span>
          <span className="sm:hidden">Votos</span>
          <SelectField
            aria-label="Votos por painel"
            value={String(maxVotes)}
            onChange={(v) => onSetMaxVotesPerParticipant(Number(v))}
            options={voteLimitOptions(maxVotes)}
            className="h-9 w-[7.5rem] max-sm:w-[6.5rem]"
          />
        </label>
      ) : (
        phase !== 'write' && (
          <span className="text-[13px] text-muted-foreground" title="Cada painel é uma votação separada">
            Votos por painel: <strong className="font-semibold text-foreground">{maxVotes > 0 ? maxVotes : 'sem limite'}</strong>
          </span>
        )
      )}

      {showTimer && (
        <RoomTimer
          timer={timer}
          isFacilitator={isFacilitator}
          onStart={onStartTimer}
          onPause={onPauseTimer}
          onResume={onResumeTimer}
          onReset={onResetTimer}
          onSetDuration={onSetTimerDuration}
          isSoundEnabled={isSoundEnabled}
          onExpire={onTimerExpire}
          lateGraceMs={TIMER_LATE_GRACE_MS}
        />
      )}

      <span className="flex-1" />

      <div className="max-sm:w-full max-sm:[&>div]:flex max-sm:[&>div]:w-full max-sm:[&_button]:flex-1">
        <Segmented
          label="Visualização"
          options={LAYOUT_OPTIONS}
          value={layoutMode}
          onChange={(id) => (id === 'present' ? onPresent() : onLayoutModeChange(id))}
        />
      </div>
    </div>
  );
}
