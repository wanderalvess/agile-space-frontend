/**
 * Tokens do kit de sala: movimento, tons semânticos e utilitários de classe.
 *
 * Tudo sai dos tokens do shadcn (`primary`, `card`, `muted`...) para valer nos
 * 7 temas x claro/escuro. Os tons de estado (sucesso, alerta, perigo) usam a
 * paleta do Tailwind com par claro/escuro, porque os temas não definem cores de
 * estado. Regras do tema "TOTVS" claro (azul-claro sobre branco não lê como
 * texto) e "Leitura confortável" (sem gradiente nem brilho) entram por variantes
 * arbitrárias do Tailwind, sem tocar nos blocos de tema do globals.css.
 *
 * ATENÇÃO: as classes abaixo são strings literais de propósito — o Tailwind só
 * gera o que encontra escrito por inteiro no código, então nada de montar nome
 * de classe por interpolação.
 */

/** Tokens de movimento (ms) — espelham as variáveis CSS --motion-* do globals.css. */
export const MOTION = {
  fast: 140,
  base: 220,
  slow: 320,
  land: 460,
  reveal: 520,
  /** Atraso entre uma carta e a próxima na revelação em cascata. */
  revealStep: 70,
} as const;

export type Tone = 'brand' | 'success' | 'warn' | 'danger' | 'neutral';

/** Texto "de marca" legível: no TOTVS claro o azul-claro vira o texto padrão. */
export const BRAND_TEXT = 'text-primary [.theme-totvs:not(.dark)_&]:text-foreground';

/** Fundo suave de marca (placas, chips ativos, linha selecionada). */
export const BRAND_TINT = 'bg-primary/10 dark:bg-primary/15';

interface ToneStyle {
  /** Placa do ícone (quadrado arredondado). */
  tile: string;
  /** Texto e ícone do tom. */
  text: string;
  /** Chip/etiqueta pequena do tom. */
  chip: string;
  /** Filete de 2 px no topo do modal. */
  hairline: string;
}

export const TONES: Record<Tone, ToneStyle> = {
  brand: {
    tile: 'bg-primary/10 dark:bg-primary/15 text-primary [.theme-totvs:not(.dark)_&]:text-foreground ring-1 ring-inset ring-primary/25',
    text: BRAND_TEXT,
    chip: 'bg-primary/10 dark:bg-primary/15 text-primary [.theme-totvs:not(.dark)_&]:text-foreground',
    hairline:
      'bg-gradient-to-r from-primary to-primary/40 [.theme-totvs_&]:bg-none [.theme-totvs_&]:bg-primary [.theme-leitura_&]:bg-none [.theme-leitura_&]:bg-primary',
  },
  success: {
    tile: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    hairline: 'bg-gradient-to-r from-emerald-500 to-emerald-300',
  },
  warn: {
    tile: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    hairline: 'bg-gradient-to-r from-amber-500 to-amber-300',
  },
  danger: {
    tile: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-500/30',
    text: 'text-red-700 dark:text-red-300',
    chip: 'bg-red-500/10 text-red-700 dark:text-red-300',
    hairline: 'bg-gradient-to-r from-red-600 to-red-400',
  },
  neutral: {
    tile: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
    text: 'text-muted-foreground',
    chip: 'bg-muted text-muted-foreground',
    hairline: 'bg-border',
  },
};

/** Botão principal cheio com brilho do tema. */
export const PRIMARY_BUTTON = 'bg-primary text-primary-foreground hover:bg-primary/90 room-glow';
/** Botão de perigo (vermelho só em excluir e encerrar). */
export const DANGER_BUTTON = 'bg-red-600 text-white hover:bg-red-700 dark:hover:bg-red-500';
/** Botão secundário com contorno. */
export const OUTLINE_BUTTON = 'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground';
/** Foco visível padrão para controles que não são <Button>. */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
/** Campo de texto do kit (input, textarea, select nativo). */
export const FIELD =
  'w-full rounded-[10px] border border-border bg-muted/40 px-3 text-sm text-foreground placeholder:text-muted-foreground ' +
  'transition-colors duration-fast focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
/** Sombra de cartão do design (suave no claro, funda no escuro). */
export const CARD_SHADOW = 'shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]';

export type RoleTone = 'dev' | 'qa' | 'ux' | 'design' | 'other';

/** Cores por papel (chips, textos e barras). Papéis desconhecidos caem em "other". */
export const ROLE_STYLES: Record<RoleTone, { chip: string; text: string; bar: string }> = {
  dev: { chip: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' },
  qa: { chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  ux: { chip: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300', text: 'text-fuchsia-700 dark:text-fuchsia-300', bar: 'bg-fuchsia-500' },
  design: { chip: 'bg-violet-500/10 text-violet-700 dark:text-violet-300', text: 'text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
  other: { chip: 'bg-muted text-muted-foreground', text: 'text-muted-foreground', bar: 'bg-muted-foreground/60' },
};

/** Categoria técnica (Developer, QA, UX, Designer, Management...) -> tom de papel. */
export function roleToneOf(category?: string | null): RoleTone {
  switch ((category || '').toLowerCase()) {
    case 'developer':
    case 'dev':
      return 'dev';
    case 'qa':
      return 'qa';
    case 'ux':
      return 'ux';
    case 'designer':
    case 'design':
      return 'design';
    default:
      return 'other';
  }
}
