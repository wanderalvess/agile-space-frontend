'use client';

import * as React from 'react';
import { ChevronDown, Pause, Play, RotateCcw, Timer as TimerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TimerState } from '@/lib/types';
import { FOCUS_RING } from './tokens';
import { TIMER_PRESETS, formatTimer, remainingSeconds, timerFraction, timerPhase, type TimerPhase } from './timer-utils';

export interface RoomTimerProps {
  timer: TimerState | undefined;
  isFacilitator: boolean;
  onStart: (duration: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSetDuration: (duration: number) => void;
  isSoundEnabled: boolean;
  /** Relógio do servidor menos o local (ms) — `endTime` é epoch de servidor. */
  serverOffset?: number;
  /** 'compact' vive no cabeçalho; 'large' é o anel do modo apresentação. */
  variant?: 'compact' | 'large';
  className?: string;
}

const ALARM_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

const PHASE_TEXT: Record<TimerPhase, string> = {
  stopped: 'text-muted-foreground',
  paused: 'text-muted-foreground',
  running: 'text-foreground',
  warning: 'text-amber-700 dark:text-amber-400',
  expired: 'text-red-600 dark:text-red-400',
};

/**
 * Contagem regressiva da sala. Presets de 1 a 5 min, âmbar nos últimos 10 s e
 * pulso no zero. O alarme sonoro continua opt-in (`isSoundEnabled`) e toca uma
 * vez por `endTime`. Substitui as cópias do EliteTimer nas salas ao vivo.
 */
export function RoomTimer({
  timer,
  isFacilitator,
  onStart,
  onPause,
  onResume,
  onReset,
  onSetDuration,
  isSoundEnabled,
  serverOffset = 0,
  variant = 'compact',
  className,
}: RoomTimerProps) {
  const [remaining, setRemaining] = React.useState(() => remainingSeconds(timer, Date.now(), serverOffset));
  // Guarda o endTime que já tocou o alarme: trocar a referência de `timer` sem
  // mudar o endTime não pode repetir o som.
  const alertedEndRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const tick = () => {
      const next = remainingSeconds(timer, Date.now(), serverOffset);
      setRemaining(next);
      if (timer?.status === 'running' && timer.endTime && next <= 0 && alertedEndRef.current !== timer.endTime && isSoundEnabled) {
        alertedEndRef.current = timer.endTime;
        try {
          new Audio(ALARM_URL).play().catch(() => {});
        } catch {
          /* sem áudio disponível */
        }
      }
    };
    tick();
    if (timer?.status !== 'running') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer, isSoundEnabled, serverOffset]);

  const phase = timerPhase(timer, remaining);
  const initial = timer?.initialDuration ?? 120;
  const isStopped = !timer || timer.status === 'stopped';
  const isRunning = timer?.status === 'running';
  const isPaused = timer?.status === 'paused';

  const controls = isFacilitator && (
    <div className="flex items-center gap-1">
      {isStopped && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              aria-label="Duração do timer"
              className={cn('h-8 gap-1 px-2 text-xs font-medium tabular-nums text-muted-foreground', FOCUS_RING)}
            >
              {initial / 60} min
              <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[8rem]">
            {TIMER_PRESETS.map((d) => (
              <DropdownMenuItem
                key={d}
                onClick={() => onSetDuration(d)}
                className={cn('text-sm tabular-nums', initial === d && 'font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground')}
              >
                {d / 60} {d === 60 ? 'minuto' : 'minutos'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {isStopped && (
        <Button size="icon" variant="ghost" aria-label="Iniciar timer" className="h-8 w-8" onClick={() => onStart(initial)}>
          <Play className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      )}
      {isRunning && (
        <Button size="icon" variant="ghost" aria-label="Pausar timer" className="h-8 w-8" onClick={onPause}>
          <Pause className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      )}
      {isPaused && (
        <Button size="icon" variant="ghost" aria-label="Retomar timer" className="h-8 w-8" onClick={onResume}>
          <Play className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      )}
      <Button size="icon" variant="ghost" aria-label="Reiniciar timer" className="h-8 w-8 text-muted-foreground" onClick={onReset} disabled={isStopped}>
        <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </div>
  );

  if (variant === 'large') {
    const R = 48;
    const C = 2 * Math.PI * R;
    const offset = C * (1 - timerFraction(remaining, initial));
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <div className={cn('relative h-28 w-28 shrink-0 rounded-full', phase === 'expired' && 'room-alarm')} role="timer" aria-label={`Tempo restante ${formatTimer(remaining)}`}>
          <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="56" cy="56" r={R} fill="none" strokeWidth="8" className="stroke-border" />
            <circle
              cx="56"
              cy="56"
              r={R}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              className={cn(
                'transition-[stroke-dashoffset,stroke] duration-1000 ease-linear',
                phase === 'warning' ? 'stroke-amber-500' : phase === 'expired' ? 'stroke-red-500' : 'stroke-primary'
              )}
            />
          </svg>
          <span className={cn('absolute inset-0 flex items-center justify-center text-2xl font-semibold tabular-nums', PHASE_TEXT[phase])}>
            {formatTimer(remaining)}
          </span>
        </div>
        {controls}
      </div>
    );
  }

  return (
    <div className={cn('flex h-9 items-center gap-1 rounded-lg border border-border pl-3 pr-1', phase === 'expired' && 'room-alarm', className)}>
      <TimerIcon aria-hidden="true" className={cn('h-4 w-4', PHASE_TEXT[phase], phase === 'stopped' ? 'opacity-60' : '')} strokeWidth={1.5} />
      <span role="timer" aria-label={`Tempo restante ${formatTimer(remaining)}`} className={cn('min-w-[3.25rem] text-sm font-semibold tabular-nums', PHASE_TEXT[phase])}>
        {formatTimer(remaining)}
      </span>
      {controls}
    </div>
  );
}
