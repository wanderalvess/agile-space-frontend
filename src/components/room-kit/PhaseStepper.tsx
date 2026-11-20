'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PhaseStep {
  id: string;
  label: string;
}

/**
 * Fases do ritual (Poker: Discutir, Votar, Revelar, Decidir). As anteriores à
 * atual aparecem concluídas; a atual leva o número em destaque. Cada sala passa
 * as suas fases — o componente só mostra em que etapa se está.
 */
/**
 * Classes literais (o Tailwind só gera o que lê por inteiro) para recolher o texto das fases que não são a
 * atual abaixo de um breakpoint: sobra só o número/check, e o nome continua para leitor de tela.
 */
const COLLAPSE_LABEL = {
  lg: 'max-lg:sr-only',
  xl: 'max-xl:sr-only',
  xxl: 'max-xxl:sr-only',
  '3xl': 'max-3xl:sr-only',
} as const;
const COLLAPSE_PAD = {
  lg: 'max-lg:gap-0 max-lg:px-2',
  xl: 'max-xl:gap-0 max-xl:px-2',
  xxl: 'max-xxl:gap-0 max-xxl:px-2',
  '3xl': 'max-3xl:gap-0 max-3xl:px-2',
} as const;

export function PhaseStepper({
  steps,
  current,
  label = 'Fases',
  className,
  collapseBelow,
}: {
  steps: readonly PhaseStep[];
  /** id da fase atual. */
  current: string;
  label?: string;
  className?: string;
  /** Abaixo deste breakpoint só a fase atual mostra o nome (cabeçalho apertado). */
  collapseBelow?: keyof typeof COLLAPSE_LABEL;
}) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === current));
  return (
    <ol
      aria-label={label}
      className={cn('m-0 flex list-none items-center gap-1 rounded-[10px] border border-border bg-muted/50 p-1', className)}
    >
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li
            key={step.id}
            aria-current={active ? 'step' : undefined}
            title={collapseBelow ? step.label : undefined}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-[7px] px-3 py-1.5 text-[13px] transition-[background-color,box-shadow,color] duration-base',
              active && 'bg-card font-semibold text-foreground shadow-[0_0_0_1px_hsl(var(--border))] dark:shadow-[0_0_0_1px_hsl(var(--border)),0_0_18px_hsl(var(--primary)/0.25)] [.theme-leitura_&]:shadow-[0_0_0_1px_hsl(var(--border))]',
              done && 'text-emerald-700 dark:text-emerald-300',
              !done && !active && 'text-muted-foreground',
              collapseBelow && !active && COLLAPSE_PAD[collapseBelow]
            )}
          >
            {done ? (
              <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-[18px] w-[18px] items-center justify-center rounded-full text-xs tabular-nums',
                  active ? 'bg-primary text-primary-foreground' : 'border border-border'
                )}
              >
                {i + 1}
              </span>
            )}
            <span className={cn(collapseBelow && !active && COLLAPSE_LABEL[collapseBelow])}>{step.label}</span>
            {done && <span className="sr-only"> (concluída)</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Fases do Scrum Poker. */
export const POKER_PHASES: readonly PhaseStep[] = [
  { id: 'discuss', label: 'Discutir' },
  { id: 'vote', label: 'Votar' },
  { id: 'reveal', label: 'Revelar' },
  { id: 'decide', label: 'Decidir' },
];

/**
 * Fase atual da rodada a partir do estado da sala: sem tarefa na mesa ou com a
 * sessão ainda por iniciar -> Discutir; votando -> Votar; revelado -> Decidir
 * ("Revelar" é o instante da virada das cartas, por isso aparece sempre como
 * concluída quando se chega em Decidir).
 */
export function pokerPhase(state: { hasActiveIssue: boolean; sessionStarted: boolean; revealed: boolean }): 'discuss' | 'vote' | 'reveal' | 'decide' {
  if (!state.hasActiveIssue || !state.sessionStarted) return 'discuss';
  return state.revealed ? 'decide' : 'vote';
}
