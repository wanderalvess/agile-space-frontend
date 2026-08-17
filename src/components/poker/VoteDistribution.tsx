'use client';

import { useMemo } from 'react';
import type { Vote, Participant, DeckType } from '@/lib/types';
import { DECKS } from '@/lib/types';
import { getEligibleStatsVotes } from '@/lib/poker-utils';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoteDistributionProps {
  votes: Vote[];
  participants: Participant[];
  deck: DeckType;
  allowManagementToVote?: boolean;
}

/**
 * Histograma da distribuição dos votos (só os elegíveis, mesma base das
 * métricas). Ordena as barras pela ordem do baralho para leitura natural e
 * marca o(s) valor(es) mais votado(s). Revela bimodalidade que a média esconde.
 */
export function VoteDistribution({ votes, participants, deck, allowManagementToVote = false }: VoteDistributionProps) {
  const bars = useMemo(() => {
    const eligible = getEligibleStatsVotes(votes, participants, allowManagementToVote);
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
  }, [votes, participants, deck, allowManagementToVote]);

  if (bars.length === 0) return null;

  const topCount = Math.max(...bars.map(b => b.count));

  return (
    <Card className="border border-slate-200/60 dark:border-border/40 bg-white/60 dark:bg-card/40 rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-400">Distribuição dos votos</h3>
        </div>
        <div className="flex items-end justify-around gap-2 h-32 pt-2">
          {bars.map(b => {
            const isTop = b.count === topCount && topCount > 0;
            return (
              <div key={b.value} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400">{b.count}</span>
                <div className="w-full flex justify-center">
                  <div
                    className={cn(
                      "w-full max-w-[38px] rounded-t-lg transition-all",
                      isTop ? "bg-indigo-600" : "bg-indigo-400/50"
                    )}
                    style={{ height: `${Math.max(6, Math.round((b.count / b.max) * 96))}px` }}
                  />
                </div>
                <span className={cn(
                  "text-xs font-black tracking-tighter",
                  isTop ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-300"
                )}>{b.value}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
