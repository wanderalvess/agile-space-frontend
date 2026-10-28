'use client';

import { useMemo } from 'react';
import type { Vote, Participant } from '@/lib/types';
import { getEligibleStatsVotes } from '@/lib/poker-utils';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfidenceSummaryProps {
  votes: Vote[];
  participants: Participant[];
  votingCargos?: readonly string[];
}

const LEVELS = [
  { key: 'high', label: 'Alta', weight: 1, color: 'bg-emerald-500' },
  { key: 'medium', label: 'Média', weight: 0.5, color: 'bg-amber-500' },
  { key: 'low', label: 'Baixa', weight: 0, color: 'bg-red-500' },
] as const;

/**
 * Resumo de confiança do time ao revelar. Considera só votos elegíveis que
 * informaram confiança. Mostra a proporção por nível e um índice agregado
 * (alta=1, média=0.5, baixa=0). Sinaliza item arriscado quando o índice é baixo.
 */
export function ConfidenceSummary({ votes, participants, votingCargos }: ConfidenceSummaryProps) {
  const summary = useMemo(() => {
    const eligible = getEligibleStatsVotes(votes, participants, votingCargos);
    const withConf = eligible.filter(v => v.confidence);
    if (withConf.length === 0) return null;

    const counts = { high: 0, medium: 0, low: 0 };
    withConf.forEach(v => { counts[v.confidence as keyof typeof counts]++; });
    const total = withConf.length;
    const score = LEVELS.reduce((acc, l) => acc + counts[l.key] * l.weight, 0) / total; // 0..1
    return { counts, total, score };
  }, [votes, participants, votingCargos]);

  if (!summary) return null;

  const pct = Math.round(summary.score * 100);
  const risky = summary.score < 0.5;

  return (
    <section
      aria-label="Confiança do time"
      className={cn(
        'room-rise flex flex-col gap-3 rounded-[14px] border bg-card p-[18px]',
        risky ? 'border-red-500/40' : 'border-border'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          {risky
            ? <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-300" strokeWidth={1.5} aria-hidden="true" />
            : <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" strokeWidth={1.5} aria-hidden="true" />}
          Confiança do time
        </h2>
        <span className={cn('text-lg font-bold tabular-nums', risky ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300')}>{pct}%</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {LEVELS.map(l => {
          const w = Math.round((summary.counts[l.key] / summary.total) * 100);
          if (w === 0) return null;
          return <div key={l.key} className={l.color} style={{ width: `${w}%` }} title={`${l.label}: ${summary.counts[l.key]}`} />;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {LEVELS.map(l => (
          <span key={l.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', l.color)} />
            {l.label} <span className="tabular-nums">{summary.counts[l.key]}</span>
          </span>
        ))}
        {risky && <span className="ml-auto text-xs font-semibold text-red-700 dark:text-red-300">Item arriscado, vale revisar</span>}
      </div>
    </section>
  );
}
