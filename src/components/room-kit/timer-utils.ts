import type { TimerState } from '@/lib/types';

/** Presets de duração (segundos): 1 a 5 minutos. */
export const TIMER_PRESETS = [60, 120, 180, 240, 300] as const;

/** Últimos segundos em que o timer fica âmbar. */
export const TIMER_WARN_SECONDS = 10;

/** 125 -> "02:05". */
export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export type TimerPhase = 'stopped' | 'running' | 'warning' | 'expired' | 'paused';

/** Fase visual do timer: normal, últimos 10 s (âmbar), zerou (pulso) ou pausado. */
export function timerPhase(timer: TimerState | undefined, remaining: number): TimerPhase {
  if (!timer || timer.status === 'stopped') return 'stopped';
  if (timer.status === 'paused') return 'paused';
  if (remaining <= 0) return 'expired';
  if (remaining <= TIMER_WARN_SECONDS) return 'warning';
  return 'running';
}

/** Fração (0..1) do tempo que ainda resta, para o anel. */
export function timerFraction(remaining: number, initialDuration: number): number {
  if (!initialDuration || initialDuration <= 0) return 0;
  return Math.min(1, Math.max(0, remaining / initialDuration));
}

/**
 * Segundos restantes de um timer do servidor. `endTime` é epoch de servidor,
 * então o "agora" leva o offset do relógio local (serverOffset, em ms).
 */
export function remainingSeconds(timer: TimerState | undefined, nowMs: number, serverOffset = 0): number {
  if (!timer) return 0;
  if (timer.status === 'paused') return timer.remainingOnPause;
  if (timer.status !== 'running' || !timer.endTime) return timer.initialDuration ?? 0;
  return Math.max(0, Math.round((timer.endTime - (nowMs + serverOffset)) / 1000));
}

/**
 * O fim do timer ficou para trás? `true` quando o relógio já passou do `endTime` por `graceMs` ou mais — quem
 * abre a sala bem depois do fim não deve ouvir o alarme nem disparar a automação de fim de tempo de novo.
 */
export function isLateExpiry(timer: TimerState | undefined, nowMs: number, graceMs: number, serverOffset = 0): boolean {
  if (!timer || timer.status !== 'running' || !timer.endTime) return false;
  return nowMs + serverOffset - timer.endTime >= graceMs;
}
