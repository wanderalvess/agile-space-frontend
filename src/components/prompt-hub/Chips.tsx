import { Shield } from 'lucide-react';
import { StatusChip, type Tone } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { getImpactMeta, getStatusMeta, getTypeMeta, getVisibilityMeta } from '@/app/prompt-hub/constants';
import type { PromptItem } from '@/app/prompt-hub/types';

/** Tipo do item: o mesmo chip de marca para todos, só o ícone muda. */
export function TypeChip({ type, className }: { type?: string; className?: string }) {
  const meta = getTypeMeta(type);
  const Icon = meta.icon;
  return (
    <StatusChip tone="brand" className={cn('h-6 gap-1.5 px-2.5', className)}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      {meta.label}
    </StatusChip>
  );
}

const STATUS_TONE: Record<string, Tone> = { neutral: 'neutral', warn: 'warn', success: 'success', danger: 'danger' };

export function SituationChip({ status, className }: { status?: string; className?: string }) {
  const meta = getStatusMeta(status);
  return (
    <StatusChip tone={STATUS_TONE[meta.tone]} className={cn('h-6 px-2.5', className)}>
      {meta.label}
    </StatusChip>
  );
}

export function ImpactChip({ impact, className }: { impact?: string; className?: string }) {
  const meta = getImpactMeta(impact);
  return (
    <StatusChip tone={impact === 'alto' ? 'warn' : 'neutral'} className={cn('h-6 px-2.5', className)}>
      {meta.label}
    </StatusChip>
  );
}

export function VisibilityChip({ visibility, className }: { visibility?: string; className?: string }) {
  const meta = getVisibilityMeta(visibility);
  const Icon = meta.icon;
  return (
    <StatusChip tone={visibility === 'public' ? 'success' : 'neutral'} className={cn('h-6 gap-1.5 px-2.5', className)}>
      <Icon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
      {meta.label}
    </StatusChip>
  );
}

/** Selo de quem está mexendo no que é de outra pessoa por ser administradora. */
export function AdminSeal({ children = 'Admin', className }: { children?: React.ReactNode; className?: string }) {
  return (
    <StatusChip tone="brand" className={cn('h-6 gap-1.5 px-2.5', className)}>
      <Shield className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
      {children}
    </StatusChip>
  );
}

/** Etiqueta do item (24 px de altura, alvo de clique confortável). */
export function TagButton({
  tag,
  onClick,
  active = false,
  count,
  className,
}: {
  tag: string;
  onClick?: () => void;
  active?: boolean;
  count?: number;
  className?: string;
}) {
  const classes = cn(
    'inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors duration-fast',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'border-primary/50 bg-primary/10 font-semibold text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground'
      : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    className
  );
  if (!onClick) return <span className={classes}>{tag}</span>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={classes}>
      {tag}
      {count !== undefined && <span className="text-xs opacity-80">{count}</span>}
    </button>
  );
}

/** Texto curto sobre o que o item é, para leitores de tela e dicas. */
export function itemTitle(item: Pick<PromptItem, 'title' | 'description'>): string {
  return item.title?.trim() || item.description?.trim() || 'Item sem título';
}
