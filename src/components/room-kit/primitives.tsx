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
        'inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-semibold',
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
        'inline-flex h-[22px] items-center rounded-md px-2 text-[11px] font-bold tabular-nums',
        ROLE_STYLES[tone].chip,
        className
      )}
    >
      {label}
    </span>
  );
}
