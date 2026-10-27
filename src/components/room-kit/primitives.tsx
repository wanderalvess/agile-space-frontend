'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_STYLES, TONES, roleToneOf, type Tone } from './tokens';

/** Placa quadrada arredondada com o ícone do tom (cabeçalho de modal, painel, cartão). */
export function IconTile({
  icon: Icon,
  tone = 'brand',
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-11 w-11 rounded-xl' : 'h-10 w-10 rounded-[10px]';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center', box, TONES[tone].tile, className)}
    >
      <Icon className={icon} strokeWidth={1.5} />
    </span>
  );
}

/** Etiqueta pequena arredondada (estado, contagem, modo). */
export function StatusChip({
  tone = 'brand',
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  /** Ponto pulsante à esquerda ("votando agora"). */
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-semibold',
        TONES[tone].chip,
        className
      )}
    >
      {dot && <span aria-hidden="true" className="room-breathe h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Chip do papel (DEV, QA, UX...). `category` é a categoria técnica; `label` o texto exibido. */
export function RoleChip({
  category,
  label,
  className,
}: {
  category?: string | null;
  label: string;
  className?: string;
}) {
  const tone = roleToneOf(category);
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md px-2 text-xs font-bold tabular-nums',
        ROLE_STYLES[tone].chip,
        className
      )}
    >
      {label}
    </span>
  );
}

/** Botão só com ícone (cabeçalho da sala, cartões): 36 px, contorno, estado pressionado e selo de contagem. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  {
    label: string;
    icon: LucideIcon;
    pressed?: boolean;
    badge?: number;
    size?: 'sm' | 'md';
    /** Texto curto ao lado do ícone (a partir de 1280 px); abaixo disso fica só o ícone, com o `label` como nome. */
    text?: string;
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>
>(({ label, icon: Icon, pressed, badge, size = 'md', text, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    className={cn(
      'relative inline-flex shrink-0 items-center justify-center rounded-lg border transition-[background-color,border-color,color,box-shadow] duration-fast',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
      size === 'sm' ? 'h-8 w-8' : 'h-9 w-9 max-sm:h-11 max-sm:w-11',
      text && 'xl:w-auto xl:gap-2 xl:px-3',
      pressed
        ? 'border-primary/60 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground'
        : 'border-border bg-transparent text-foreground hover:bg-accent',
      className
    )}
    {...props}
  >
    <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
    {text && <span aria-hidden="true" className="hidden text-sm font-medium xl:inline">{text}</span>}
    {!!badge && badge > 0 && (
      <span
        aria-hidden="true"
        className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-primary px-1 text-xs font-semibold text-primary-foreground"
      >
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
));
IconButton.displayName = 'IconButton';
