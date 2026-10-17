'use client';

import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { cn } from '@/lib/utils';
import type { ContributionSummary } from './retro-room-logic';

const MAX_CHIPS = 6;

/**
 * Faixa "ao vivo": quantos cartões a sala já tem e, quando a autoria chegou, quanto cada pessoa escreveu.
 * Enquanto os cartões estão ocultos o servidor não diz quem escreveu o quê — aí a faixa mostra o total, os
 * seus e os que ficaram sem autoria, sem chutar nomes.
 */
export function RetroLiveStrip({
  summary,
  currentUserId,
  authorsRevealed,
  className,
}: {
  summary: ContributionSummary;
  currentUserId: string;
  authorsRevealed: boolean;
  className?: string;
}) {
  const { total, byAuthor, anonymous } = summary;
  const visible = byAuthor.slice(0, MAX_CHIPS);
  const extra = byAuthor.length - visible.length;

  return (
    <div
      role="status"
      aria-label="Contribuições ao vivo"
      className={cn('flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-border bg-card px-3 py-2 sm:px-4 xl:px-6', className)}
    >
      <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
        <span aria-hidden="true" className="relative inline-flex h-2 w-2">
          <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
          <span className="absolute inset-0 rounded-full bg-emerald-500" />
        </span>
        {total} {total === 1 ? 'cartão' : 'cartões'}
      </span>

      {(visible.length > 0 || anonymous > 0) && <span aria-hidden="true" className="hidden h-[18px] w-px bg-border sm:block" />}

      {visible.map((a) => (
        <span key={a.id} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-0.5 pr-2.5 text-xs">
          <InitialsAvatar name={a.name} className="h-6 w-6 text-xs" />
          {a.id === currentUserId ? 'Você' : a.name}
          <span className="font-semibold tabular-nums">{a.count}</span>
        </span>
      ))}
      {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
      {anonymous > 0 && (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground">
          Sem autoria <span className="font-semibold tabular-nums text-foreground">{anonymous}</span>
        </span>
      )}

      <span className="flex-1" />
      <span className="text-xs text-muted-foreground">
        {authorsRevealed ? 'Autores visíveis para todos' : 'Cartões anônimos: só o servidor sabe quem escreveu'}
      </span>
    </div>
  );
}
