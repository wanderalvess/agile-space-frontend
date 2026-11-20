/**
 * Estilos do Cronograma num só lugar. Estrutura usa só tokens semânticos (bg-card, border-border, text-foreground...)
 * para valer nos 7 temas claro/escuro. Exceções permitidas: cores das FASES (identidade de fase, com texto branco
 * a 4,5:1 ou mais sobre a barra) e cores de ESTADO (âmbar de atraso, verde de concluído) com variante escura.
 */
import type { WorkflowPhase } from '@/lib/cronograma/phases';
import type { StatusTone } from '@/lib/cronograma/status';

export interface PhaseStyle {
  /** Barra cheia (texto branco, 4,5:1 ou mais). */
  solid: string;
  /** Barra vazada: fundo suave e texto do tema. */
  soft: string;
  /** Contorno na cor da fase. */
  border: string;
  /** Bolinha da legenda e da lista. */
  dot: string;
}

const P = (solid: string, soft: string, border: string): PhaseStyle => ({ solid, soft, border, dot: solid.split(' ')[0] });

const BLUE = P('bg-blue-700 text-white', 'bg-blue-700/20 text-foreground', 'border-blue-700 dark:border-blue-400');
const TEAL = P('bg-teal-700 text-white', 'bg-teal-700/20 text-foreground', 'border-teal-700 dark:border-teal-400');
const PURPLE = P('bg-purple-700 text-white', 'bg-purple-700/20 text-foreground', 'border-purple-700 dark:border-purple-400');
const AMBER = P('bg-amber-700 text-white', 'bg-amber-700/20 text-foreground', 'border-amber-700 dark:border-amber-400');
const CYAN = P('bg-cyan-800 text-white', 'bg-cyan-800/20 text-foreground', 'border-cyan-800 dark:border-cyan-400');
const ROSE = P('bg-rose-700 text-white', 'bg-rose-700/20 text-foreground', 'border-rose-700 dark:border-rose-400');
const EMERALD = P('bg-emerald-700 text-white', 'bg-emerald-700/20 text-foreground', 'border-emerald-700 dark:border-emerald-400');
const ORANGE = P('bg-orange-700 text-white', 'bg-orange-700/20 text-foreground', 'border-orange-700 dark:border-orange-400');
const FUCHSIA = P('bg-fuchsia-700 text-white', 'bg-fuchsia-700/20 text-foreground', 'border-fuchsia-700 dark:border-fuchsia-400');
const LIME = P('bg-lime-700 text-white', 'bg-lime-700/20 text-foreground', 'border-lime-700 dark:border-lime-400');
const NEUTRAL = P('bg-muted-foreground text-background', 'bg-muted text-foreground', 'border-muted-foreground');
const PRIMARY = P('bg-primary text-primary-foreground', 'bg-primary/20 text-foreground', 'border-primary');

const BY_KIND: Record<string, PhaseStyle> = { DEV: BLUE, Auto: TEAL, Review: PURPLE, QA: AMBER, TI: CYAN, OUTRA: NEUTRAL };
const BY_COLOR_NAME: Record<string, PhaseStyle> = {
  blue: BLUE, teal: TEAL, purple: PURPLE, amber: AMBER, cyan: CYAN, rose: ROSE, emerald: EMERALD, orange: ORANGE,
  fuchsia: FUCHSIA, lime: LIME, slate: NEUTRAL,
};

/**
 * Estilo de uma fase. A cor configurada pela squad guarda classes como 'bg-purple-600 dark:bg-purple-500'; aqui
 * o NOME da cor vira a versão 700, que mantém o texto branco legível.
 */
export function phaseStyle(phase: Pick<WorkflowPhase, 'configuredColor' | 'kind'>): PhaseStyle {
  const c = phase.configuredColor;
  if (c) {
    if (/\bbg-primary\b/.test(c)) return PRIMARY;
    const m = /\bbg-([a-z]+)-\d{3}\b/.exec(c);
    if (m && BY_COLOR_NAME[m[1]]) return BY_COLOR_NAME[m[1]];
  }
  return BY_KIND[phase.kind] ?? NEUTRAL;
}

/** Estilos de estado: âmbar de atraso e verde de concluído, sempre com variante escura. */
export const WARN_TEXT = 'text-amber-700 dark:text-amber-400';
export const WARN_BOX = 'border border-amber-300 bg-amber-50 text-foreground dark:border-amber-500/40 dark:bg-amber-500/10';
export const WARN_CHIP = 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300';
export const OK_TEXT = 'text-emerald-700 dark:text-emerald-400';
export const OK_CHIP = 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300';
export const BRAND_CHIP = 'bg-primary/10 text-foreground';
export const MUTE_CHIP = 'bg-muted text-muted-foreground';

export const STATUS_CHIP: Record<StatusTone, string> = {
  done: OK_CHIP,
  review: 'bg-purple-100 text-purple-900 dark:bg-purple-500/15 dark:text-purple-300',
  progress: BRAND_CHIP,
  neutral: MUTE_CHIP,
};

/** Alturas das linhas em pixels (a coluna da esquerda e a grade usam as mesmas). */
export const ROW_H = { story: 56, task: 48, laneTop: 8, lane: 40, laneBar: 32 } as const;
export const DAY_W = { min: 32, max: 96, step: 8, initial: 56 } as const;
export const LEFT_W = { min: 200, max: 560, initial: 340 } as const;
export const HEADER_H = 52;

/** Foco visível padrão (teclado). */
export const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background';
export const FIELD = `h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground motion-safe:transition-colors ${FOCUS}`;
