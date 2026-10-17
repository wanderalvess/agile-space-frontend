'use client';

import type { ReactNode } from 'react';
import { Frown, Loader2, Meh, RefreshCw, Smile, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from '@/components/room-kit';
import type { AttentionLevel, HealthTone, ScaleOption } from '@/lib/health-check-rules';
import type { HealthCheckScaleType } from '@/lib/types';

/** Classes literais (o Tailwind só gera o que lê por inteiro). Cores de estado com par claro/escuro. */
export const TONE_SELECTED: Record<HealthTone, string> = {
  good: 'border-emerald-600 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400 dark:text-emerald-200',
  mid: 'border-amber-600 bg-amber-500/10 text-amber-800 dark:border-amber-400 dark:text-amber-200',
  bad: 'border-red-600 bg-red-500/10 text-red-800 dark:border-red-400 dark:text-red-200',
};

export const TONE_DOT: Record<HealthTone, string> = {
  good: 'bg-emerald-600 dark:bg-emerald-400',
  mid: 'bg-amber-500 dark:bg-amber-400',
  bad: 'bg-red-600 dark:bg-red-400',
};

/** Trecho de barra: texto com contraste suficiente sobre cada cor, nos dois modos. */
export const TONE_SEGMENT: Record<HealthTone, string> = {
  good: 'bg-emerald-700 text-white dark:bg-emerald-600',
  mid: 'bg-amber-400 text-amber-950',
  bad: 'bg-red-600 text-white dark:bg-red-600',
};

export const TONE_TEXT: Record<HealthTone, string> = {
  good: 'text-emerald-700 dark:text-emerald-300',
  mid: 'text-amber-700 dark:text-amber-300',
  bad: 'text-red-700 dark:text-red-300',
};

/** Tom do selo de situação da dimensão. */
export function levelTone(level: AttentionLevel): Tone {
  return level === 'critical' ? 'danger' : level === 'alert' ? 'warn' : level === 'strong' ? 'success' : 'neutral';
}

/** Cor da nota (0 a 10) no cartão de dimensão. */
export function levelText(level: AttentionLevel): string {
  return level === 'critical' ? TONE_TEXT.bad : level === 'alert' ? TONE_TEXT.mid : level === 'strong' ? TONE_TEXT.good : 'text-foreground';
}

/** Marca de cada valor da escala: bolinha no semáforo, rosto de linha na emocional, o número na de 1 a 5. */
export function ValueGlyph({ option, scale, className }: { option: ScaleOption; scale: HealthCheckScaleType | undefined; className?: string }) {
  if (scale === 'emojis') {
    const Face = option.tone === 'good' ? Smile : option.tone === 'mid' ? Meh : Frown;
    return <Face aria-hidden="true" className={cn('h-5 w-5', className)} strokeWidth={1.5} />;
  }
  if (scale === 'numbers_5') return null;
  return <span aria-hidden="true" className={cn('h-3 w-3 shrink-0 rounded-full', TONE_DOT[option.tone], className)} />;
}

/** Estado da conexão em tempo real da sala. */
export type HealthConnection = { state: 'connecting' | 'live' } | { state: 'reconnecting' | 'offline'; retryInSec: number };

/** Depois de quantas quedas seguidas a sala se diz "sem conexão". */
export const OFFLINE_AFTER_ATTEMPTS = 3;

const CHIP = 'inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap';

/** Chip de conexão: Ao vivo, Conectando, Reconectando (com o tempo da próxima tentativa) ou Sem conexão. */
export function ConnectionChip({ connection }: { connection: HealthConnection }): ReactNode {
  if (connection.state === 'live') {
    return (
      <span role="status" className={cn(CHIP, 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')} title="Conectado: as alterações chegam na hora">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> Ao vivo
      </span>
    );
  }
  if (connection.state === 'connecting') {
    return (
      <span role="status" className={cn(CHIP, 'bg-muted text-muted-foreground')}>
        <Loader2 className="h-3 w-3 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> Conectando…
      </span>
    );
  }
  if (connection.state === 'reconnecting') {
    return (
      <span role="status" className={cn(CHIP, 'bg-amber-500/10 text-amber-700 dark:text-amber-300')} title="A conexão caiu: a sala tenta de novo sozinha">
        <RefreshCw className="h-3 w-3 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> Reconectando… nova tentativa em {connection.retryInSec} s
      </span>
    );
  }
  return (
    <span role="status" className={cn(CHIP, 'bg-red-500/10 text-red-700 dark:text-red-300')} title="Sem conexão com a sala">
      <WifiOff className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Sem conexão: respostas novas não serão salvas
    </span>
  );
}

/** Estado de salvamento de um comentário. */
export type SaveState = 'saving' | 'saved' | 'error';
