'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ModuleKey } from './login-modules';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Miniaturas sóbrias dos módulos, só com tokens do tema (nada de cor fixa nem gradiente em cartas).
 * Com "reduzir movimento" ficam estáticas e já mostram o estado final (cartas viradas, notas no lugar).
 * As entradas usam classes motion-safe (CSS) para não divergir do HTML do servidor; só as cartas usam framer-motion.
 */

const ENTER = 'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:fill-mode-backwards motion-safe:duration-300';

const FRAME = 'flex h-[92px] items-center justify-center';

/** Planning Poker: três cartas que viram em ciclo e mostram as horas votadas. */
function PokerMini({ still }: { still: boolean }) {
  const votes = [
    { value: '8h', delay: 0 },
    { value: '6h', delay: 0.3 },
    { value: '8h', delay: 0.6 },
  ];
  return (
    <div className="flex gap-3" style={{ perspective: 400 }}>
      {votes.map((v) => (
        <motion.div
          key={v.delay}
          className="relative h-[70px] w-[50px]"
          style={{ transformStyle: 'preserve-3d' }}
          initial={false}
          animate={still ? { rotateY: 180 } : { rotateY: [0, 0, 180, 180, 360, 360] }}
          transition={still ? { duration: 0 } : { duration: 6, times: [0, 0.3, 0.45, 0.8, 0.95, 1], ease: 'easeInOut', repeat: Infinity, delay: v.delay }}
        >
          <div
            className="absolute inset-0 rounded-lg border border-primary/50 bg-primary/15 bg-[repeating-linear-gradient(45deg,hsl(var(--primary)/0.18)_0_4px,transparent_4px_8px)]"
            style={{ backfaceVisibility: 'hidden' }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center rounded-lg border border-border bg-card text-base font-bold tabular-nums text-foreground"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {v.value}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const RETRO_COLUMNS = [
  { bar: 'bg-emerald-500', note: 'bg-emerald-500/15', notes: [2, 1] },
  { bar: 'bg-amber-500', note: 'bg-amber-500/15', notes: [3, 0] },
  { bar: 'bg-primary', note: 'bg-primary/15', notes: [1] },
];

/** Retrospectiva: três colunas (correu bem, melhorar, ações) com notas e votos. */
function RetroMini() {
  let order = 0;
  return (
    <div className="grid grid-cols-3 gap-2">
      {RETRO_COLUMNS.map((col) => (
        <div key={col.bar} className="flex w-[78px] flex-col gap-[5px]">
          <span className={cn('h-1 rounded-sm', col.bar)} />
          {col.notes.map((votes, i) => {
            const delay = 0.15 * order++;
            return (
              <span
                key={i}
                className={cn('flex h-6 items-center justify-end gap-0.5 rounded-[5px] px-[5px]', ENTER, col.note)}
                style={{ animationDelay: `${delay}s` }}
              >
                {Array.from({ length: votes }).map((_, v) => (
                  <span key={v} className="h-[5px] w-[5px] rounded-full bg-foreground/60" />
                ))}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Radar de clima: pentágono com o polígono das respostas. */
function RadarMini({ still }: { still: boolean }) {
  const dots: [number, number][] = [[60, 14], [96, 41], [80, 80], [38, 76], [24, 40]];
  return (
    <svg width="120" height="92" viewBox="0 0 120 92" fill="none">
      <polygon points="60,6 106,38 88,88 32,88 14,38" className="stroke-border" strokeWidth="1" />
      <polygon points="60,26 86,44 76,72 44,72 34,44" className="stroke-border" strokeWidth="1" />
      <polygon
        points="60,14 96,41 80,80 38,76 24,40"
        className={cn('fill-primary/25 stroke-primary', !still && 'motion-safe:animate-pulse')}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" className="fill-primary" />
      ))}
    </svg>
  );
}

/** Showcase: slide da demonstração e o selo de decisão. */
function ShowcaseMini() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-[78px] w-[130px] flex-col gap-[5px] rounded-lg border border-border bg-card p-2 shadow-sm">
        <span className="h-1.5 w-3/5 rounded-sm bg-primary" />
        <span className="h-1 w-[90%] rounded-sm bg-border" />
        <span className="h-1 w-3/4 rounded-sm bg-border" />
        <span className="mt-auto flex gap-1">
          <span className="h-3.5 flex-1 rounded bg-emerald-500/20" />
          <span className="h-3.5 flex-1 rounded border border-border bg-muted/60" />
        </span>
      </div>
      <span
        className={cn('inline-flex h-6 items-center rounded-full bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400', ENTER)}
        style={{ animationDelay: '0.5s' }}
      >
        Aprovado
      </span>
    </div>
  );
}

/** Brainstorming: ideias ligadas a um tema central. */
function IdeasMini({ still }: { still: boolean }) {
  const links: [number, number][] = [[30, 20], [140, 18], [40, 78], [135, 76]];
  return (
    <svg width="170" height="92" viewBox="0 0 170 92" fill="none">
      {links.map(([x, y]) => (
        <line key={`${x}-${y}`} x1="85" y1="46" x2={x} y2={y} className="stroke-primary/50" strokeWidth="1" />
      ))}
      <line x1="30" y1="20" x2="40" y2="78" className="stroke-primary/25" strokeWidth="1" />
      <circle cx="85" cy="46" r="13" className={cn('fill-primary', !still && 'motion-safe:animate-pulse')} />
      <circle cx="30" cy="20" r="8" className="fill-primary/70" />
      <circle cx="140" cy="18" r="7" className="fill-primary/70" />
      <circle cx="40" cy="78" r="7" className="fill-primary/70" />
      <circle cx="135" cy="76" r="9" className="fill-primary/70" />
    </svg>
  );
}

export function ModuleMiniature({ module }: { module: ModuleKey }) {
  const reduce = usePrefersReducedMotion();
  return (
    <div
      aria-hidden="true"
      className={cn(FRAME, 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300')}
    >
      {module === 'poker' && <PokerMini still={reduce} />}
      {module === 'retro' && <RetroMini />}
      {module === 'health' && <RadarMini still={reduce} />}
      {module === 'showcase' && <ShowcaseMini />}
      {module === 'brainstorming' && <IdeasMini still={reduce} />}
    </div>
  );
}
