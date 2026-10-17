'use client';

import { Check, Radio } from 'lucide-react';
import { FOCUS_RING, TONES } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { ShowcasePresenter } from './types';

export interface PresenterChipProps {
  presenter: ShowcasePresenter;
  /** Estou acompanhando: o Teatro segue o card do apresentador. */
  following: boolean;
  onToggle: () => void;
  /** Onde aparece: na sala (tema do portal) ou sobre o fundo escolhido para a apresentação (escuro ou claro). */
  surface?: 'room' | 'stage-dark' | 'stage-light';
  className?: string;
}

const SURFACE = {
  room: { wrap: 'border-border bg-card text-foreground', name: 'text-foreground', icon: TONES.brand.text, idle: 'border-border bg-muted text-foreground hover:bg-accent', on: 'border-transparent bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' },
  'stage-dark': { wrap: 'border-white/10 bg-white/[0.06] text-white/80', name: 'text-white', icon: 'text-cyan-300', idle: 'border-white/10 bg-white/10 text-white hover:bg-white/20', on: 'border-transparent bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' },
  'stage-light': { wrap: 'border-slate-200 bg-slate-100 text-slate-700', name: 'text-slate-900', icon: 'text-slate-700', idle: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-200', on: 'border-transparent bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' },
} as const;

/** "Apresentando: Ana" com o botão Acompanhar (liga e desliga). Só para quando OUTRA pessoa apresenta. */
export function PresenterChip({ presenter, following, onToggle, surface = 'room', className }: PresenterChipProps) {
  const s = SURFACE[surface];
  return (
    <div className={cn('inline-flex min-h-9 max-w-full items-center gap-2 rounded-xl border py-1 pl-3 pr-1 text-xs font-semibold max-sm:min-h-11', s.wrap, className)} role="group" aria-label="Quem está apresentando">
      <Radio className={cn('h-3.5 w-3.5 shrink-0', s.icon)} strokeWidth={1.5} aria-hidden="true" />
      <span className="min-w-0 truncate">
        Apresentando: <span className={cn('font-bold', s.name)}>{presenter.displayName || 'Alguém'}</span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={following}
        className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors max-sm:h-9', following ? s.on : s.idle, FOCUS_RING)}
        title={following ? 'Parar de acompanhar: você volta a navegar sozinho' : 'O Teatro passa a seguir o card do apresentador'}
      >
        {following && <Check className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />}
        Acompanhar
      </button>
    </div>
  );
}
