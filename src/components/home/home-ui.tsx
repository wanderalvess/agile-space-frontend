import { RefreshCw, type LucideIcon } from 'lucide-react';
import type { RitualKey } from '@/hooks/home/types';
import { cn } from '@/lib/utils';
import { moduleIcon } from '@/lib/modules-registry';

/**
 * Peças visuais da Home. Só tokens semânticos (background, card, border, primary...), para o desenho valer
 * nos 7 temas em claro e escuro. Efeitos de brilho ficam fora do tema "leitura" (seletor de classe do <html>, sem JS).
 * Texto nunca leva degradê (regra da marca TOTVS).
 */

/** Texto sobre o tom da cor de destaque. No TOTVS claro (ciano) o primário não tem contraste: usa o texto padrão. */
export const TINT_TEXT = 'text-primary [.theme-totvs:not(.dark)_&]:text-foreground';
export const TINT_BG = 'bg-primary/10';

/** Ícone de linha de cada ritual. */
export const TOOL_ICON: Record<RitualKey, LucideIcon> = {
  poker: moduleIcon('poker'),
  retro: moduleIcon('retro'),
  showcase: moduleIcon('showcase'),
  health: moduleIcon('health'),
  brainstorming: moduleIcon('brainstorming'),
};

export const CARD = 'rounded-2xl border border-border bg-card text-card-foreground';

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Elevação sutil de hover; desligada com "reduzir movimento". */
export const LIFT = 'motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5';

/** Halo atrás do topo da página. Ausente no tema "leitura". */
export const HALO =
  'bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,hsl(var(--primary)/0.10),transparent_72%)] ' +
  'dark:bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,hsl(var(--primary)/0.14),transparent_72%)] [.theme-leitura_&]:hidden';

/** Orbe no canto dos cards grandes. Ausente no tema "leitura". */
export const ORB =
  'bg-[radial-gradient(circle,hsl(var(--primary)/0.08),transparent_70%)] dark:bg-[radial-gradient(circle,hsl(var(--primary)/0.12),transparent_70%)] [.theme-leitura_&]:hidden';

const TILE_SIZE = {
  sm: 'h-[34px] w-[34px] rounded-[9px] [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-10 w-10 rounded-[10px] [&_svg]:h-[18px] [&_svg]:w-[18px]',
  lg: 'h-[42px] w-[42px] rounded-[11px] [&_svg]:h-5 [&_svg]:w-5',
} as const;

export function IconTile({
  icon: Icon,
  size = 'md',
  muted = false,
  className,
}: {
  icon: LucideIcon;
  size?: keyof typeof TILE_SIZE;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center',
        TILE_SIZE[size],
        muted ? 'border border-border bg-muted/50 text-muted-foreground' : cn(TINT_BG, TINT_TEXT),
        className,
      )}
    >
      <Icon strokeWidth={1.5} />
    </span>
  );
}

export function SectionHeading({ id, children, aside }: { id: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2.5 text-lg font-bold">
        {children}
      </h2>
      {aside ? <span className="text-xs text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

/** Ponto verde pulsante de "ao vivo". O pulso para com "reduzir movimento". */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative inline-flex h-2.5 w-2.5', className)}>
      <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
      <span className="absolute inset-0 rounded-full bg-emerald-500" />
    </span>
  );
}

/** Chip de status de uma sessão. */
export function StatusChip({ tone, children }: { tone: 'live' | 'neutral' | 'done' | 'brand'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-bold uppercase tracking-wide',
        tone === 'live' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        tone === 'done' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        tone === 'brand' && cn(TINT_BG, TINT_TEXT),
        tone === 'neutral' && 'border border-border bg-muted/40 text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Botão secundário "Tentar de novo" dos avisos de falha. Enquanto `busy` fica desabilitado e o ícone gira
 * (parado com "reduzir movimento"); o texto não muda, para o leitor de tela não reanunciar.
 */
export function RetryButton({ onRetry, busy = false, className }: { onRetry: () => void; busy?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={busy}
      aria-busy={busy}
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-60',
        FOCUS_RING,
        className,
      )}
    >
      <RefreshCw aria-hidden="true" className={cn('h-3.5 w-3.5', busy && 'motion-safe:animate-spin')} strokeWidth={1.5} />
      Tentar de novo
    </button>
  );
}
