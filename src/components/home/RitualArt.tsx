'use client';

import { motion, type Variants } from 'framer-motion';
import type { RitualKey } from '@/hooks/home/types';
import { cn } from '@/lib/utils';

/**
 * Miniaturas de cada ritual (decorativas). Reagem ao hover do cartão pai (`whileHover="hover"`),
 * como as do desenho anterior da Home, mas só com tokens do tema: valem nos 7 temas, claro e escuro.
 * Sem movimento quando o sistema pede "reduzir movimento" (framer respeita o prefers-reduced-motion
 * via MotionConfig do app; aqui as variantes só existem no hover e são curtas).
 */

const SPRING = { type: 'spring', stiffness: 220, damping: 14 } as const;

const PAPER = 'border border-border bg-card shadow-md';

function PokerArt() {
  return (
    <>
      <motion.span
        variants={{ hover: { rotate: -16, x: -34, y: -4, scale: 1.04 } }}
        transition={SPRING}
        className={cn('absolute flex h-[76px] w-[54px] items-center justify-center rounded-xl text-xl font-bold text-muted-foreground', PAPER)}
      >
        ?
      </motion.span>
      <motion.span
        variants={{ hover: { rotate: 16, x: 34, y: -4, scale: 1.04 } }}
        transition={SPRING}
        className={cn('absolute flex h-[76px] w-[54px] items-center justify-center rounded-xl text-xl font-bold text-muted-foreground', PAPER)}
      >
        8
      </motion.span>
      <motion.span
        variants={{ hover: { scale: 1.1, y: -8 } }}
        transition={SPRING}
        className="absolute z-10 flex h-[84px] w-[58px] flex-col items-center justify-between rounded-xl border border-primary/40 bg-primary p-2 text-2xl font-bold text-primary-foreground shadow-xl shadow-primary/25 [.theme-totvs:not(.dark)_&]:text-foreground"
      >
        <span className="self-start text-[9px] leading-none opacity-80">5</span>
        <span className="leading-none">5</span>
        <span className="rotate-180 self-end text-[9px] leading-none opacity-80">5</span>
      </motion.span>
    </>
  );
}

function Sticky({ label, text, tone, className, variants }: { label: string; text: string; tone: string; className?: string; variants: Variants }) {
  return (
    <motion.span
      variants={variants}
      transition={SPRING}
      className={cn('absolute flex h-[76px] w-[84px] flex-col justify-between rounded-xl border p-2 shadow-sm', tone, className)}
    >
      <span className="text-[8px] font-bold uppercase leading-none tracking-wider">{label}</span>
      <span className="text-[9px] font-semibold leading-tight">{text}</span>
    </motion.span>
  );
}

function RetroArt() {
  return (
    <>
      <Sticky
        label="Melhorar"
        text="Contexto nas issues"
        tone="border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300"
        variants={{ hover: { rotate: -16, x: -38, y: 2, scale: 1.04 } }}
      />
      <Sticky
        label="Ação"
        text="Refinar o DoD"
        tone="border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        variants={{ hover: { rotate: 16, x: 38, y: 6, scale: 1.04 } }}
      />
      <Sticky
        label="Correu bem"
        text="Apoio técnico da squad"
        tone="z-10 h-[84px] w-[92px] border-emerald-500/35 bg-emerald-500/15 text-emerald-700 shadow-md dark:text-emerald-300"
        variants={{ hover: { scale: 1.1, y: -8 } }}
      />
    </>
  );
}

function ShowcaseArt() {
  return (
    <motion.span
      variants={{ hover: { scale: 1.05, y: -4 } }}
      transition={SPRING}
      className="absolute flex w-[190px] flex-col gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3 shadow-sm"
    >
      <span className="flex items-start justify-between">
        <span className="flex flex-col">
          <span className="text-[8px] font-bold uppercase leading-none tracking-widest text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Review da sprint</span>
          <span className="mt-1 text-[11px] font-bold uppercase leading-none tracking-tight text-foreground">Entregas</span>
        </span>
        <span className="flex gap-0.5" aria-hidden="true">
          <span className="h-3 w-3 rounded-sm bg-primary/30" />
          <span className="h-3 w-3 rounded-sm bg-primary/50" />
          <span className="h-3 w-3 rounded-sm bg-primary/80" />
        </span>
      </span>
      <span className="flex items-end justify-between border-t border-border pt-2">
        <span className="h-1.5 w-16 rounded-full bg-muted" />
        <span className="rounded-full bg-primary px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground">Teatro</span>
      </span>
    </motion.span>
  );
}

function HealthArt() {
  const bars = [78, 54, 90, 66];
  return (
    <motion.span variants={{ hover: { scale: 1.05, y: -4 } }} transition={SPRING} className={cn('absolute flex w-[190px] flex-col gap-2 rounded-2xl p-3', PAPER)}>
      {bars.map((w, i) => (
        <span key={w} className="flex items-center gap-2">
          <span className="h-1.5 w-8 rounded-full bg-muted" />
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.span
              variants={{ hover: { width: `${Math.min(100, w + 12)}%` } }}
              transition={{ ...SPRING, delay: i * 0.04 }}
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{ width: `${w}%` }}
            />
          </span>
        </span>
      ))}
    </motion.span>
  );
}

function BrainArt() {
  return (
    <>
      <motion.span
        variants={{ hover: { rotate: -10, x: -40, y: -2 } }}
        transition={SPRING}
        className={cn('absolute flex h-9 w-[88px] items-center rounded-full px-3 text-[10px] font-semibold text-muted-foreground', PAPER)}
      >
        Ideia A
      </motion.span>
      <motion.span
        variants={{ hover: { rotate: 8, x: 42, y: 14 } }}
        transition={SPRING}
        className={cn('absolute flex h-9 w-[88px] items-center rounded-full px-3 text-[10px] font-semibold text-muted-foreground', PAPER)}
      >
        Ideia B
      </motion.span>
      <motion.span
        variants={{ hover: { scale: 1.1, y: -10 } }}
        transition={SPRING}
        className="absolute z-10 flex h-10 w-[104px] items-center justify-center rounded-full border border-primary/40 bg-primary px-3 text-[11px] font-bold text-primary-foreground shadow-lg shadow-primary/25 [.theme-totvs:not(.dark)_&]:text-foreground"
      >
        Mais votada
      </motion.span>
    </>
  );
}

const ART: Record<RitualKey, () => React.JSX.Element> = {
  poker: PokerArt,
  retro: RetroArt,
  showcase: ShowcaseArt,
  health: HealthArt,
  brainstorming: BrainArt,
};

export function RitualArt({ ritual }: { ritual: RitualKey }) {
  const Art = ART[ritual];
  return (
    <span aria-hidden="true" className="relative my-1 flex h-[96px] w-full items-center justify-center">
      <Art />
    </span>
  );
}
