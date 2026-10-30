'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';

/** Estrela de favorita: no cartão do hub e na casca da ferramenta. */
export function StarButton({
  on, name, onToggle, size = 'md', className,
}: {
  on: boolean;
  name: string;
  onToggle: () => void;
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={`${on ? 'Tirar das favoritas' : 'Favoritar'}: ${name}`}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[10px] transition-colors duration-fast hover:bg-accent',
        FOCUS_RING,
        size === 'lg' ? 'h-10 w-10 border border-border' : 'relative z-[2] h-[34px] w-[34px]',
        on ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
        className,
      )}
    >
      <Star className={size === 'lg' ? 'h-[18px] w-[18px]' : 'h-[18px] w-[18px]'} strokeWidth={1.5} fill={on ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}
