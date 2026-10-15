'use client';

import * as React from 'react';
import { Coffee, Crown, HelpCircle, Lightbulb, StepForward, ThumbsUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING, ROLE_STYLES, roleToneOf } from './tokens';
import { PersonAvatar } from './PresenceList';

/** Carta virada para baixo: verso da cor do tema, com listras. */
const CARD_BACK =
  'border border-primary/70 bg-primary text-primary-foreground ' +
  'bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.1)_0_5px,transparent_5px_10px)] ' +
  'shadow-[inset_0_0_0_3px_rgba(255,255,255,0.12),0_10px_26px_hsl(var(--primary)/0.35)] [.theme-leitura_&]:shadow-[inset_0_0_0_3px_rgba(255,255,255,0.12)]';

const CARD_PLAIN = 'border border-border bg-card text-card-foreground shadow-[0_6px_16px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.35)]';
const CARD_MODE =
  'border border-primary bg-primary text-primary-foreground shadow-[0_12px_30px_hsl(var(--primary)/0.4)] [.theme-leitura_&]:shadow-none';
const CARD_WARN = 'border-[1.5px] border-amber-500/70 bg-amber-500/10 text-amber-800 dark:text-amber-200 shadow-[0_0_18px_rgba(245,158,11,0.18)]';
const CARD_CRITICAL = 'border-[1.5px] border-red-500/70 bg-red-500/10 text-red-800 dark:text-red-200 shadow-[0_0_18px_rgba(239,68,68,0.2)]';

export type VoteCardTone = 'plain' | 'mode' | 'warn' | 'critical';

export const CONFIDENCE_LABEL = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const;

const SIZE: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'h-[68px] w-[50px] rounded-lg text-lg',
  md: 'h-20 w-[58px] rounded-[9px] text-xl',
  lg: 'h-[104px] w-[76px] rounded-xl text-3xl',
  xl: 'h-32 w-24 rounded-2xl text-4xl',
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
  observerLabel = 'não vota',
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

  if (state === 'observer') {
    return (
      <span
        aria-label={label ?? observerLabel}
        className={cn(base, 'flex-col gap-1 border border-dashed border-border text-[10px] font-medium text-muted-foreground', className)}
      >
        <Crown aria-hidden="true" className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
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
        <span className="room-dot-1 h-[5px] w-[5px] rounded-full bg-primary" />
        <span className="room-dot-2 h-[5px] w-[5px] rounded-full bg-primary" />
        <span className="room-dot-3 h-[5px] w-[5px] rounded-full bg-primary" />
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
      {!isCoffee && value && <span aria-hidden="true" className="absolute left-1.5 top-1 text-[9px] font-semibold leading-none opacity-70">{value}</span>}
      {confidence && (
        <span
          title={`Confiança ${CONFIDENCE_LABEL[confidence].toLowerCase()}`}
          className={cn('absolute right-1 top-1 h-2 w-2 rounded-full ring-1 ring-card', confidence === 'high' ? 'bg-emerald-500' : confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500')}
        >
          <span className="sr-only">Confiança {CONFIDENCE_LABEL[confidence].toLowerCase()}</span>
        </span>
      )}
      {isCoffee ? (
        <Coffee className="h-1/3 w-1/3" strokeWidth={1.5} aria-label="Pausa" />
      ) : (
        <span>
          {value}
          {unit && value && /^\d+([.,]\d+)?$/.test(value) && <span className="text-[0.6em] opacity-80">{unit}</span>}
        </span>
      )}
    </span>
  );
}

/** Lugar à mesa: carta + avatar + nome + papel. `flipped` põe a carta do lado de baixo da mesa. */
export function VoteSeat({
  name,
  roleLabel,
  roleCategory,
  flipped = false,
  isYou = false,
  isHost = false,
  children,
}: {
  isHost?: boolean;
  name: string;
  roleLabel: string;
  roleCategory?: string | null;
  flipped?: boolean;
  isYou?: boolean;
  /** A carta (VoteCard) do assento. */
  children: React.ReactNode;
}) {
  return (
    <li className={cn('flex min-w-0 flex-col items-center gap-2', flipped && 'flex-col-reverse')}>
      {children}
      <span className="flex max-w-full items-center gap-2">
        <PersonAvatar name={name} size="sm" highlight={isYou} />
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
            <span className="truncate">{name}</span>
            {isHost && <Crown aria-label="Organizador" className="h-3 w-3 shrink-0 text-amber-500" strokeWidth={1.5} />}
          </span>
          <span className={cn('truncate text-[11px] font-bold', ROLE_STYLES[roleToneOf(roleCategory)].text)}>{roleLabel}</span>
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
 * Carta do baralho do usuário. Segue a lógica do design: escolher sobe a carta
 * (8-14 px), hover sobe 4-6 px em 140 ms. As cartas especiais (? e pausa) levam ícone.
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
  /** Baralhos grandes (Horas, 22 cartas): cartas menores. */
  dense?: boolean;
}) {
  const isCoffee = value === '☕';
  const isUnknown = value === '?';
  const aria = isCoffee ? 'Preciso de uma pausa' : isUnknown ? 'Não sei estimar' : `Votar ${value}`;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={aria}
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center rounded-[10px] font-bold tabular-nums',
        'transition-[transform,box-shadow,background-color,border-color] duration-fast ease-room motion-reduce:transition-none',
        dense ? 'h-[58px] w-[42px] text-base sm:h-[66px] sm:w-[46px]' : 'h-[68px] w-[50px] text-xl sm:h-[90px] sm:w-16 sm:text-2xl',
        FOCUS_RING,
        disabled && 'pointer-events-none opacity-40',
        selected
          ? '-translate-y-3.5 border border-primary bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_16px_36px_hsl(var(--primary)/0.5)] [.theme-leitura_&]:shadow-none'
          : cn(CARD_PLAIN, 'hover:-translate-y-1.5 hover:border-primary/60')
      )}
    >
      {!isCoffee && (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute left-[7px] top-[5px] hidden text-[10px] leading-none opacity-70 sm:block">{value}</span>
          <span aria-hidden="true" className="pointer-events-none absolute bottom-[5px] right-[7px] hidden rotate-180 text-[10px] leading-none opacity-70 sm:block">{value}</span>
        </>
      )}
      {isCoffee ? <Coffee className="h-6 w-6" strokeWidth={1.5} /> : <span>{value}</span>}
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
