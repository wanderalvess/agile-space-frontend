'use client';

import { useMemo } from 'react';
import type { Vote, Participant, DeckType } from '@/lib/types';
import { DECKS } from '@/lib/types';
import { getEligibleStatsVotes } from '@/lib/poker-utils';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoteDistributionProps {
  votes: Vote[];
  participants: Participant[];
  deck: DeckType;
  votingCargos?: readonly string[];
}

/**
 * Histograma da distribuição dos votos (só os elegíveis, mesma base das
 * métricas). Ordena as barras pela ordem do baralho para leitura natural e
 * marca o(s) valor(es) mais votado(s). Revela bimodalidade que a média esconde.
 */
export function VoteDistribution({ votes, participants, deck, votingCargos }: VoteDistributionProps) {
  const bars = useMemo(() => {
    const eligible = getEligibleStatsVotes(votes, participants, votingCargos);
    if (eligible.length === 0) return [];

    const counts = new Map<string, number>();
    eligible.forEach(v => counts.set(v.value, (counts.get(v.value) || 0) + 1));

    const order = DECKS[deck] || [];
    // Valores na ordem do deck; qualquer valor fora do deck vai ao final.
    const known = order.filter(v => counts.has(v));
    const extra = [...counts.keys()].filter(v => !order.includes(v));
    const values = [...known, ...extra];

    const max = Math.max(...values.map(v => counts.get(v) || 0), 1);
    return values.map(v => ({ value: v, count: counts.get(v) || 0, max, total: eligible.length }));
  }, [votes, participants, deck, votingCargos]);

  if (bars.length === 0) return null;

  const topCount = Math.max(...bars.map(b => b.count));

  return (
    <section aria-label="Distribuição dos votos" className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-[18px] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <BarChart3 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        Distribuição dos votos
      </h2>
      <div className="flex h-32 items-end justify-around gap-2 pt-2">
        {bars.map(b => {
          const isTop = b.count === topCount && topCount > 0;
          return (
            <div key={b.value} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{b.count}</span>
              <div className="flex w-full justify-center">
                <div
                  className={cn('room-grow-y w-full max-w-[38px] rounded-t-lg', isTop ? 'bg-primary' : 'bg-primary/40')}
                  style={{ height: `${Math.max(6, Math.round((b.count / b.max) * 96))}px` }}
                />
              </div>
              <span className={cn('text-xs font-bold tabular-nums', isTop ? 'text-foreground' : 'text-muted-foreground')}>{b.value === '☕' ? 'café' : b.value}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
