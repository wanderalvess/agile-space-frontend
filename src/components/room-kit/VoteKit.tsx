'use client';

import * as React from 'react';
import { Coffee, Crown, Eye, HelpCircle, Lightbulb, StepForward, ThumbsUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING, ROLE_STYLES, roleToneOf } from './tokens';
import { PersonAvatar } from './PresenceList';

/** Carta virada para baixo: verso da cor do tema, com listras. */
const CARD_BACK =
  'border border-primary/70 bg-primary text-primary-foreground ' +
  'bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.1)_0_5px,transparent_5px_10px)] ' +
  'shadow-[inset_0_0_0_3px_rgba(255,255,255,0.12),0_10px_26px_hsl(var(--primary)/0.35)] [.theme-leitura_&]:shadow-[inset_0_0_0_3px_rgba(255,255,255,0.12)]';

const CARD_PLAIN = 'border-2 border-foreground/20 bg-card text-card-foreground shadow-[0_6px_16px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.35)]';
const CARD_MODE =
  'border border-primary bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground shadow-[0_12px_30px_hsl(var(--primary)/0.4)] [.theme-leitura_&]:shadow-none';
const CARD_WARN = 'border-2 border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-100 shadow-[0_0_18px_rgba(245,158,11,0.25)]';
const CARD_CRITICAL = 'border-2 border-red-500 bg-red-500/15 text-red-800 dark:text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.28)]';

export type VoteCardTone = 'plain' | 'mode' | 'warn' | 'critical';

export const CONFIDENCE_LABEL = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const;

/** Cartas da mesa, na proporção 3:4 do baralho antigo (72 x 96). `md` é a carta compacta da lista da sessão assíncrona. */
const SIZE: Record<'xs' | 'sm' | 'md' | 'mid' | 'lg' | 'xl', string> = {
  xs: 'h-14 w-[42px] rounded-md',
  sm: 'h-[72px] w-[54px] rounded-lg',
  md: 'h-14 w-10 rounded-[7px] sm:h-20 sm:w-[58px] sm:rounded-[9px]',
  mid: 'h-[88px] w-[66px] rounded-[10px]',
  lg: 'h-28 w-[84px] rounded-xl',
  xl: 'h-36 w-[108px] rounded-2xl',
};

/** Tamanho do valor na carta virada: número grande e em negrito, para ler de longe (valores de 3 caracteres ou mais, como "100", descem um degrau). */
const GLYPH: Record<keyof typeof SIZE, readonly [string, string]> = {
  xs: ['text-xl', 'text-base'],
  sm: ['text-2xl', 'text-lg'],
  md: ['text-xl sm:text-2xl', 'text-base sm:text-lg'],
  mid: ['text-3xl', 'text-xl'],
  lg: ['text-5xl', 'text-3xl'],
  xl: ['text-6xl', 'text-4xl'],
};

export type VoteCardSize = keyof typeof SIZE;

/**
 * Carta de um voto na mesa. `state` define a aparência:
 * - hidden: voto dado, valor oculto (verso do tema, "cai" na mesa);
 * - thinking: ainda não votou (pontilhado com as três bolinhas);
 * - revealed: valor visível, vira em cascata (`delay` em ms);
 * - observer: quem não vota (organizador, espectador).
 */
export function VoteCard({
  state,
  value,
  unit,
  tone = 'plain',
  size = 'md',
  delay = 0,
  highlight = false,
  label,
  observerLabel = 'observando',
  confidence,
  className,
}: {
  state: 'hidden' | 'thinking' | 'revealed' | 'observer';
  /** Confiança declarada com o voto (opt-in na sala). */
  confidence?: 'low' | 'medium' | 'high' | null;
  value?: string | null;
  /** Sufixo do valor ("h"). */
  unit?: string;
  tone?: VoteCardTone;
  size?: VoteCardSize;
  delay?: number;
  /** Anel de destaque (a própria carta). */
  highlight?: boolean;
  label?: string;
  observerLabel?: string;
  className?: string;
}) {
  const base = cn('relative box-border flex shrink-0 items-center justify-center font-bold tabular-nums', SIZE[size]);
  const showCorner = size === 'md' || size === 'mid' || size === 'lg' || size === 'xl';

  if (state === 'observer') {
    return (
      <span
        aria-label={label ?? observerLabel}
        className={cn(base, 'flex-col gap-1 border border-dashed border-border text-xs font-medium text-muted-foreground', className)}
      >
        <Eye aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        {observerLabel}
      </span>
    );
  }

  if (state === 'thinking') {
    return (
      <span
        role="img"
        aria-label={label ?? 'Pensando'}
        className={cn(base, 'gap-[3px] border-[1.5px] border-dashed border-border bg-muted/50', className)}
      >
        <span className="room-dot-1 h-[5px] w-[5px] rounded-full bg-foreground/60" />
        <span className="room-dot-2 h-[5px] w-[5px] rounded-full bg-foreground/60" />
        <span className="room-dot-3 h-[5px] w-[5px] rounded-full bg-foreground/60" />
      </span>
    );
  }

  if (state === 'hidden') {
    return (
      <span
        role="img"
        aria-label={label ?? 'Votou'}
        className={cn(base, 'room-land', CARD_BACK, highlight && 'outline outline-2 outline-offset-[3px] outline-ring', className)}
      />
    );
  }

  const isCoffee = value === '☕';
  const toneCls = tone === 'mode' ? CARD_MODE : tone === 'warn' ? CARD_WARN : tone === 'critical' ? CARD_CRITICAL : CARD_PLAIN;
  return (
    <span
      className={cn(base, 'room-flip', toneCls, highlight && 'outline outline-2 outline-offset-[3px] outline-ring', className)}
      style={{ animationDelay: `${delay}ms` }}
      aria-label={label}
    >
      {showCorner && !isCoffee && value && <span aria-hidden="true" className="absolute left-1.5 top-1 text-xs font-semibold leading-none opacity-70">{value}</span>}
      {confidence && (
        <span
          title={`Confiança ${CONFIDENCE_LABEL[confidence].toLowerCase()}`}
          className={cn('absolute right-1 top-1 h-2 w-2 rounded-full ring-1 ring-card', confidence === 'high' ? 'bg-emerald-500' : confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500')}
        >
          <span className="sr-only">Confiança {CONFIDENCE_LABEL[confidence].toLowerCase()}</span>
        </span>
      )}
      {isCoffee ? (
        <Coffee className="h-[38%] w-[38%]" strokeWidth={1.75} aria-label="Pausa" />
      ) : (
        <span className={cn('font-bold leading-none tracking-tighter', GLYPH[size][(value?.length ?? 0) > 2 ? 1 : 0])}>
          {value}
          {unit && value && /^\d+([.,]\d+)?$/.test(value) && <span className="ml-px text-[0.5em] font-bold opacity-80">{unit}</span>}
        </span>
      )}
    </span>
  );
}

/** Nome curto para o assento: "Gabriel Alves Mendes" vira "Gabriel M."; nomes curtos ficam como estão. O nome inteiro vai no title e no leitor de tela. */
export function shortSeatName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (name.trim().length <= 14 || parts.length < 2) return name.trim();
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * Lugar à mesa: carta + avatar + nome + papel. `flipped` põe a carta do lado de
 * baixo (assentos da metade de cima da mesa ficam com o nome para fora e a carta
 * voltada para o centro). Sem `children` e com `observer`, é o lugar de quem
 * acompanha sem votar: sem carta, avatar maior com o olho e o aviso "Observando".
 */
export function VoteSeat({
  name,
  roleLabel,
  roleCategory,
  flipped = false,
  isYou = false,
  isHost = false,
  observer = false,
  observerHint,
  compact = false,
  absent = false,
  seatId,
  className,
  style,
  children,
}: {
  isHost?: boolean;
  name: string;
  roleLabel: string;
  roleCategory?: string | null;
  flipped?: boolean;
  isYou?: boolean;
  /** Acompanha sem votar (gestão, espectador): desenha sem carta. */
  observer?: boolean;
  /** Por que não vota ("cargo não vota nesta sala"): vai na dica e no texto para leitor de tela do assento. */
  observerHint?: string;
  /** Assento pequeno (mesa apertada): avatar menor no lugar de quem observa. */
  compact?: boolean;
  /** Fora da sala (sem sinal de presença): avatar esmaecido. */
  absent?: boolean;
  /** Identifica o assento no DOM (`data-seat`): a mesa usa para animar a entrada de cada pessoa. */
  seatId?: string;
  className?: string;
  style?: React.CSSProperties;
  /** A carta (VoteCard) do assento. */
  children?: React.ReactNode;
}) {
  const nameLine = (
    <span className="flex max-w-full items-center justify-center gap-1 text-[13px] font-semibold leading-tight text-foreground">
      <span className="truncate" title={name} aria-hidden="true">{shortSeatName(name)}</span>
      <span className="sr-only">{name}</span>
      {isYou && <span className="sr-only">(você)</span>}
      {isHost && <Crown aria-label="Organizador" className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={1.5} />}
    </span>
  );
  const roleLine = <span className={cn('max-w-full truncate text-xs font-bold leading-tight', ROLE_STYLES[roleToneOf(roleCategory)].text)}>{roleLabel}</span>;

  if (observer) {
    return (
      <li data-seat={seatId} className={cn('flex min-w-0 flex-col items-center gap-1', className)} style={style} aria-label={`${name}, ${roleLabel}, observando${observerHint ? `: ${observerHint}` : ''}`}>
        <span className="relative">
          <PersonAvatar name={name} size="lg" highlight={isYou} className={cn(compact ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm', absent && 'opacity-50')} />
          <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            <Eye className="h-3 w-3" strokeWidth={1.5} />
          </span>
        </span>
        {nameLine}
        {roleLine}
        <span className="text-xs font-medium leading-tight text-muted-foreground" title={observerHint}>Observando</span>
      </li>
    );
  }

  return (
    <li data-seat={seatId} className={cn('flex min-w-0 flex-col items-center gap-1.5', flipped && 'flex-col-reverse', className)} style={style}>
      {children}
      <span className="flex max-w-full items-center gap-1.5">
        <PersonAvatar name={name} size="sm" highlight={isYou} className={cn(absent && 'opacity-50')} />
        <span className="flex min-w-0 flex-col items-start">
          {nameLine}
          {roleLine}
        </span>
      </span>
    </li>
  );
}

/** Anel de progresso (votos dados / votantes). */
export function ProgressRing({ value, total, size = 56, label }: { value: number; total: number; size?: number; label?: React.ReactNode }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${value} de ${total} votaram`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" className="stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="stroke-primary transition-[stroke-dashoffset] duration-ring ease-room [filter:drop-shadow(0_0_4px_hsl(var(--primary)/0.6))] [.theme-leitura_&]:[filter:none]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">{label ?? `${value}/${total}`}</span>
    </div>
  );
}

/**
 * Carta do baralho do usuário, no modelo clássico: carta de baralho de verdade,
 * número grande em itálico no centro e o valor nos cantos (superior esquerdo e
 * inferior direito, invertido). Passar o mouse levanta e inclina a carta; a
 * escolhida sobe, ganha a cor do tema e um halo. As especiais (? e pausa) têm
 * cor própria (violeta e âmbar) e dispensam os cantos.
 *
 * Tamanho fixo, o mesmo do baralho antigo (nunca encolhe para caber): 72 x 96 px
 * (celular 50 x 64); no baralho grande (`dense`, Horas) 56 x 72 (celular 42 x 56).
 * Quem usa decide o que fazer com a sobra: quebrar em fileiras ou rolar de lado.
 */
export function DeckCard({
  value,
  selected,
  onSelect,
  disabled = false,
  dense = false,
}: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /** Baralhos grandes (Horas, 24 cartas): cartas menores, sem os cantos. */
  dense?: boolean;
}) {
  const isCoffee = value === '☕';
  const isUnknown = value === '?';
  const special = isCoffee || isUnknown;
  const aria = isCoffee ? 'Preciso de uma pausa' : isUnknown ? 'Não sei estimar' : `Votar ${value}`;
  const showPips = !isCoffee && !dense;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={aria}
      className={cn(
        'group/card relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-xl border-2 sm:rounded-2xl',
        dense ? 'h-14 w-[2.6rem] sm:h-[4.5rem] sm:w-14' : 'h-16 w-[3.1rem] sm:h-24 sm:w-[4.5rem]',
        'transition-[transform,box-shadow,border-color,color] duration-base ease-room motion-reduce:transition-none',
        FOCUS_RING,
        disabled && 'pointer-events-none opacity-40 grayscale',
        selected
          ? cn(
              'z-10 border-primary-foreground/30 bg-gradient-to-br from-primary via-primary to-primary/75 text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground',
              'shadow-xl shadow-primary/45 ring-4 ring-primary/25 motion-safe:-translate-y-5 motion-safe:scale-110',
              '[.theme-leitura_&]:bg-none [.theme-leitura_&]:bg-primary [.theme-leitura_&]:shadow-none [.theme-leitura_&]:ring-0'
            )
          : special
            ? isCoffee
              ? 'border-amber-300/90 bg-gradient-to-b from-card to-amber-500/15 text-amber-700 shadow-sm hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/20 dark:border-amber-700/60 dark:text-amber-400 motion-safe:hover:-translate-y-4 motion-safe:hover:scale-105'
              : 'border-violet-300/90 bg-gradient-to-b from-card to-violet-500/15 text-violet-700 shadow-sm hover:border-violet-500 hover:shadow-xl hover:shadow-violet-500/20 dark:border-violet-700/60 dark:text-violet-300 motion-safe:hover:-translate-y-4 motion-safe:hover:scale-105'
            : cn(
                'border-foreground/25 bg-gradient-to-b from-card to-muted text-foreground shadow-sm',
                'hover:border-primary hover:shadow-xl hover:shadow-primary/25',
                'motion-safe:hover:-translate-y-4 motion-safe:hover:rotate-2 motion-safe:hover:scale-105'
              )
      )}
    >
      {showPips && (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute left-1.5 top-1 hidden text-xs font-bold leading-none opacity-60 sm:block">{value}</span>
          <span aria-hidden="true" className="pointer-events-none absolute bottom-1 right-1.5 hidden rotate-180 text-xs font-bold leading-none opacity-60 sm:block">{value}</span>
        </>
      )}
      {selected && <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 opacity-70 [.theme-leitura_&]:hidden" />}
      {isCoffee ? (
        <Coffee className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={1.75} />
      ) : (
        <span className={cn('font-bold leading-none tracking-tighter drop-shadow-sm', isUnknown ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-3xl')}>{value}</span>
      )}
    </button>
  );
}

/** Seletor segmentado (Baixa · Média · Alta, escalas, modos). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly { id: T; label: string }[];
  value: T | null | undefined;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('inline-flex gap-[3px] rounded-[10px] border border-border bg-muted/50 p-[3px]', className)}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cn(
              'h-[34px] rounded-[7px] px-3.5 text-[13px] transition-[background-color,box-shadow,color] duration-base',
              FOCUS_RING,
              on
                ? 'bg-card font-semibold text-foreground shadow-[0_0_0_1px_hsl(var(--border)),0_0_14px_hsl(var(--primary)/0.25)] [.theme-leitura_&]:shadow-[0_0_0_1px_hsl(var(--border))]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reações
// ---------------------------------------------------------------------------

export interface ReactionKind {
  /** Valor enviado ao servidor (campo `emoji`, até 16 caracteres). */
  id: string;
  label: string;
  icon: LucideIcon;
  /** Classe de cor do ícone e do fundo da bolha. */
  tone: string;
}

export const REACTION_KINDS: readonly ReactionKind[] = [
  { id: 'agree', label: 'Concordo', icon: ThumbsUp, tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { id: 'doubt', label: 'Tenho dúvida', icon: HelpCircle, tone: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { id: 'speedup', label: 'Vamos acelerar', icon: StepForward, tone: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  { id: 'pause', label: 'Pausa', icon: Coffee, tone: 'bg-muted text-muted-foreground' },
  { id: 'idea', label: 'Boa ideia', icon: Lightbulb, tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
];

/** Reações antigas (emoji) viram o tipo equivalente; desconhecidas caem em "Concordo". */
const LEGACY_REACTIONS: Record<string, string> = {
  '👍': 'agree',
  '❤️': 'agree',
  '🎉': 'idea',
  '🔥': 'speedup',
  '🤔': 'doubt',
  '😮': 'doubt',
};

export function reactionKindOf(raw: string): ReactionKind {
  const id = LEGACY_REACTIONS[raw] ?? raw;
  return REACTION_KINDS.find((k) => k.id === id) ?? REACTION_KINDS[0];
}
