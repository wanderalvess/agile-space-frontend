'use client';

import { MotionConfig, motion } from 'framer-motion';
import type { RitualKey } from '@/hooks/home/types';
import { cn } from '@/lib/utils';

/**
 * Miniaturas de cada ritual (decorativas). Reagem ao hover do cartão pai (`whileHover="hover"`), só com tokens
 * do tema: valem nos 7 temas, claro e escuro. Ficam contidas na própria área (`overflow-hidden`), nada escapa da
 * borda do cartão, e o movimento é curto, sem quique e só no hover. Quem usa "reduzir movimento" não vê nenhum:
 * o `MotionConfig reducedMotion="user"` está em `RitualArt`.
 * Peças que se sobrepõem têm fundo opaco (`bg-card`); só o que nunca se encosta usa tinta translúcida.
 */

const SOFT = { type: 'spring', stiffness: 260, damping: 26 } as const;

const PAPER = 'border border-border bg-card shadow-md';

function PokerArt() {
  return (
    <>
      <motion.span
        variants={{ hover: { rotate: -9, x: -30, y: -2 } }}
        transition={SOFT}
        className={cn('absolute flex h-[76px] w-[54px] items-center justify-center rounded-xl text-xl font-bold text-muted-foreground', PAPER)}
      >
        ?
      </motion.span>
      <motion.span
        variants={{ hover: { rotate: 9, x: 30, y: -2 } }}
        transition={SOFT}
        className={cn('absolute flex h-[76px] w-[54px] items-center justify-center rounded-xl text-xl font-bold text-muted-foreground', PAPER)}
      >
        8
      </motion.span>
      <motion.span
        variants={{ hover: { y: -4 } }}
        transition={SOFT}
        className="absolute z-10 flex h-[84px] w-[58px] flex-col items-center justify-between rounded-xl border border-primary/40 bg-primary p-2 text-2xl font-bold text-primary-foreground shadow-xl shadow-primary/25 [.theme-totvs:not(.dark)_&]:text-foreground"
      >
        <span className="self-start text-xs leading-none opacity-80">5</span>
        <span className="leading-none">5</span>
        <span className="rotate-180 self-end text-xs leading-none opacity-80">5</span>
      </motion.span>
    </>
  );
}

/** Mini quadro de retro: três colunas lado a lado, cada uma com um post-it. Nada se sobrepõe. */
const RETRO_COLUMNS = [
  { label: 'Bom', note: 'Deploy ok', tone: 'text-emerald-700 dark:text-emerald-300', noteTone: 'border-emerald-500/30 bg-emerald-500/10' },
  { label: 'Melhorar', note: 'Contexto', tone: 'text-rose-600 dark:text-rose-300', noteTone: 'border-rose-500/30 bg-rose-500/10' },
  { label: 'Ação', note: 'Revisar DoD', tone: 'text-amber-700 dark:text-amber-300', noteTone: 'border-amber-500/30 bg-amber-500/10' },
] as const;

function RetroArt() {
  return (
    <span className="flex min-h-[92px] w-full max-w-[240px] gap-1.5">
      {RETRO_COLUMNS.map((c, i) => (
        <span key={c.label} className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-1.5">
          <span className={cn('truncate text-xs font-bold leading-none', c.tone)}>{c.label}</span>
          <motion.span
            variants={{ hover: { y: -3 } }}
            transition={{ ...SOFT, delay: i * 0.04 }}
            className={cn('break-words rounded-md border px-1 py-1 text-xs font-semibold leading-tight text-foreground shadow-sm', c.noteTone)}
          >
            {c.note}
          </motion.span>
          <span className="mt-auto h-1 w-3/4 rounded-full bg-muted" />
        </span>
      ))}
    </span>
  );
}

function ShowcaseArt() {
  return (
    <motion.span
      variants={{ hover: { y: -3 } }}
      transition={SOFT}
      className="absolute flex w-[190px] max-w-full flex-col gap-2 rounded-2xl border border-dashed border-primary/40 bg-card p-3 shadow-sm"
    >
      <span className="flex items-start justify-between">
        <span className="flex flex-col">
          <span className="text-xs font-bold uppercase leading-none tracking-wide text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Review da sprint</span>
          <span className="mt-1 text-xs font-bold uppercase leading-none tracking-tight text-foreground">Entregas</span>
        </span>
        <span className="flex gap-0.5" aria-hidden="true">
          <span className="h-3 w-3 rounded-sm bg-primary/30" />
          <span className="h-3 w-3 rounded-sm bg-primary/50" />
          <span className="h-3 w-3 rounded-sm bg-primary/80" />
        </span>
      </span>
      <span className="flex items-end justify-between border-t border-border pt-2">
        <span className="h-1.5 w-16 rounded-full bg-muted" />
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground">Teatro</span>
      </span>
    </motion.span>
  );
}

function HealthArt() {
  const bars = [78, 54, 90, 66];
  return (
    <motion.span variants={{ hover: { y: -3 } }} transition={SOFT} className={cn('absolute flex w-[190px] max-w-full flex-col gap-2 rounded-2xl p-3', PAPER)}>
      {bars.map((w, i) => (
        <span key={w} className="flex items-center gap-2">
          <span className="h-1.5 w-8 rounded-full bg-muted" />
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.span
              variants={{ hover: { width: `${Math.min(100, w + 10)}%` } }}
              transition={{ ...SOFT, delay: i * 0.04 }}
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
        variants={{ hover: { rotate: -6, x: -34, y: -2 } }}
        transition={SOFT}
        className={cn('absolute flex h-9 w-[88px] items-center rounded-full px-3 text-xs font-semibold text-muted-foreground', PAPER)}
      >
        Ideia A
      </motion.span>
      <motion.span
        variants={{ hover: { rotate: 6, x: 34, y: 12 } }}
        transition={SOFT}
        className={cn('absolute flex h-9 w-[88px] items-center rounded-full px-3 text-xs font-semibold text-muted-foreground', PAPER)}
      >
        Ideia B
      </motion.span>
      <motion.span
        variants={{ hover: { y: -5 } }}
        transition={SOFT}
        className="absolute z-10 flex h-10 w-[116px] items-center justify-center rounded-full border border-primary/40 bg-primary px-3 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25 [.theme-totvs:not(.dark)_&]:text-foreground"
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
    <span aria-hidden="true" className="relative my-1 flex h-[108px] w-full items-center justify-center overflow-hidden">
      <MotionConfig reducedMotion="user">
        <Art />
      </MotionConfig>
    </span>
  );
}
