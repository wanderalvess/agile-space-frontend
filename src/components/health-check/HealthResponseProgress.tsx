'use client';

import { UserRound, Users } from 'lucide-react';
import { respondedLabel, respondedPercent, type PendingPerson, type ResponseCounts } from '@/lib/health-check-progress';
import { cn } from '@/lib/utils';

/**
 * "N de M já responderam" da sala, do lobby e do resultado. Só contagens: ninguém vê o voto de ninguém. Para o
 * facilitador (`pending` vindo do servidor) acrescenta "Ainda não votaram", só com nomes.
 */
export function ResponseProgress({
  counts,
  pending,
  className,
}: {
  counts: ResponseCounts;
  /** Lista de quem não votou (só criador/ADMIN). `null`/ausente = não mostra o bloco. */
  pending?: PendingPerson[] | null;
  className?: string;
}) {
  const percent = respondedPercent(counts);
  const allIn = counts.participants > 0 && counts.responded >= counts.participants;
  return (
    <section aria-label="Andamento das respostas" className={cn('flex flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4', className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold">
            <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span data-testid="responded-label">{respondedLabel(counts)}</span>
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Quem já respondeu">
          <div className={cn('h-full rounded-full transition-[width] duration-slow motion-reduce:transition-none', allIn ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-primary')} style={{ width: `${percent}%` }} />
        </div>
        {counts.completed !== null && counts.responded > 0 && (
          <span className="text-xs text-muted-foreground">{counts.completed} {counts.completed === 1 ? 'respondeu' : 'responderam'} todas as dimensões</span>
        )}
      </div>

      {pending && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="m-0 text-xs font-bold text-muted-foreground">Ainda não votaram{pending.length > 0 ? ` (${pending.length})` : ''}</h3>
          {pending.length === 0 ? (
            <p className="m-0 text-[13px] text-muted-foreground">Todas as pessoas da sala já votaram.</p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {pending.map((p) => (
                <li key={p.id} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 text-xs font-semibold">
                  <UserRound className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 text-xs text-muted-foreground">Você vê quem ainda não votou, nunca o que cada pessoa votou.</p>
        </div>
      )}
    </section>
  );
}
