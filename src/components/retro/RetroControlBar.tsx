'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, Flag, Info, RefreshCw, RotateCcw, SquareCheck, Timer, Unlock, Vote } from 'lucide-react';
import {
  FOCUS_RING,
  ConfirmDialog,
  ModalButton,
  RoomTimer,
  Segmented,
  SelectField,
  StatusChip,
} from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { RetroBoard, TimerState } from '@/lib/types';
import { RETRO_READ_ONLY_NOTICE } from '@/lib/retro-lifecycle';
import { RETRO_PHASES, TIMER_LATE_GRACE_MS, retroPhase, voteLimitOptions, type RetroPhase } from './retro-room-logic';

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
  /** Retro encerrada (backend novo). */
  isFinished?: boolean;
  /** Só com o backend novo: sem `onFinishRetro` os botões de encerrar e reabrir não existem. */
  onFinishRetro?: () => void | Promise<void>;
  onReopenRetro?: () => void | Promise<void>;
  /** Encerrando ou reabrindo agora. */
  lifecycleBusy?: boolean;
  /** Encerrada e sem permissão para escrever: mostra o aviso de somente leitura. */
  readOnly?: boolean;
  /** Minutos que o formato sugere para a fase atual; o facilitador aplica ao timer com um clique. Ausente = sem sugestão. */
  suggestedMinutes?: number | null;
}

/** Chip do tempo que o formato sugere para a fase: informativo, com um clique para aplicar ao timer (nada muda sem a ação). */
function SuggestedTime({ minutes, phaseLabel, current, onApply }: { minutes: number; phaseLabel: string; current?: number; onApply: (duration: number) => void }) {
  const applied = current === minutes * 60;
  return (
    <button
      type="button"
      disabled={applied}
      aria-label={applied ? `Timer no tempo sugerido para ${phaseLabel}: ${minutes} minutos` : `Aplicar ao timer: ${minutes} minutos, sugeridos para ${phaseLabel}`}
      onClick={() => onApply(minutes * 60)}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[13px] text-muted-foreground transition-colors duration-fast hover:bg-accent/40 hover:text-foreground disabled:pointer-events-none',
        FOCUS_RING
      )}
    >
      {applied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> : <Timer className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
      {applied ? (
        <span>Timer no tempo sugerido: <strong className="font-semibold text-foreground">{minutes} min</strong></span>
      ) : (
        <>
          <span>Sugerido<span className="max-2xl:hidden"> para {phaseLabel}</span>: <strong className="font-semibold text-foreground">{minutes} min</strong></span>
          <span className="font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Aplicar ao timer</span>
        </>
      )}
    </button>
  );
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
  isFinished = false,
  onFinishRetro,
  onReopenRetro,
  lifecycleBusy = false,
  readOnly = false,
  suggestedMinutes = null,
}: RetroControlBarProps) {
  const [confirm, setConfirm] = useState<'finish' | 'reopen' | null>(null);
  const phase = retroPhase(boardData);
  const maxVotes = boardData.maxVotesPerParticipant || 0;
  const showTimer = isFacilitator || timer.status !== 'stopped';
  const status = STATUS_COPY[phase];

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background px-3 py-2 sm:px-4 xl:px-6">
      {isFacilitator ? (
        <RetroPhaseActions boardData={boardData} onToggleCardsRevealed={onToggleCardsRevealed} onSetVotingStatus={onSetVotingStatus} />
      ) : (
        <StatusChip tone={status.live && !isFinished ? 'success' : 'neutral'} dot={status.live && !isFinished} className="h-8 px-3 text-[13px]">{status.label}</StatusChip>
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

      {isFacilitator && !isFinished && !readOnly && timer.status === 'stopped' && suggestedMinutes != null && (
        <SuggestedTime minutes={suggestedMinutes} phaseLabel={RETRO_PHASES.find((p) => p.id === phase)?.label ?? ''} current={timer.initialDuration} onApply={onSetTimerDuration} />
      )}

      {isFinished && <StatusChip tone="neutral" className="h-8 px-3 text-[13px]">Encerrada</StatusChip>}

      {isFacilitator && onFinishRetro && onReopenRetro && (
        isFinished ? (
          <ModalButton className="gap-2" disabled={lifecycleBusy} onClick={() => setConfirm('reopen')}>
            <Unlock className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Reabrir
          </ModalButton>
        ) : (
          <ModalButton className="gap-2" disabled={lifecycleBusy} onClick={() => setConfirm('finish')}>
            <Flag className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Encerrar retro
          </ModalButton>
        )
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

      {readOnly && (
        <p role="status" className="m-0 flex basis-full items-start gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-[13px] leading-snug text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          {RETRO_READ_ONLY_NOTICE}
        </p>
      )}

      <ConfirmDialog
        open={confirm === 'finish'}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        tone="warn"
        icon={Flag}
        title="Encerrar a retro?"
        description="As outras pessoas continuam vendo o quadro, mas não escrevem, votam nem movem cartões. Você segue podendo tudo e pode reabrir quando quiser."
        cancelLabel="Continuar a retro"
        confirmLabel="Encerrar retro"
        onConfirm={() => void onFinishRetro?.()}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        tone="warn"
        icon={Unlock}
        title="Reabrir a retro?"
        description="Todas as pessoas voltam a poder escrever, votar e mover cartões."
        cancelLabel="Manter encerrada"
        confirmLabel="Reabrir retro"
        onConfirm={() => void onReopenRetro?.()}
      />
    </div>
  );
}
