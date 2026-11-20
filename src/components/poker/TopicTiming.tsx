'use client';

import { useMemo } from 'react';
import type { VotingRound, Issue } from '@/lib/types';
import { computeTopicTiming } from '@/lib/poker-utils';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopicTimingProps {
  rounds: VotingRound[];
  issues: Issue[];
  sessionStartedAt?: string;
}

/**
 * Tempo real gasto por tópico (visão ao vivo). Só é confiável agora que o
 * início da sessão é capturado de verdade. Mesma conta usada no relatório
 * exportado (computeTopicTiming, em poker-utils).
 */
export function TopicTiming({ rounds, issues, sessionStartedAt }: TopicTimingProps) {
  const rows = useMemo(
    () => computeTopicTiming(rounds, issues, sessionStartedAt),
    [rounds, issues, sessionStartedAt]
  );

  if (rows.length === 0) return null;
  const maxMins = Math.max(1, ...rows.map(r => r.mins));
  const totalMins = rows.reduce((sum, r) => sum + r.mins, 0);
  const idleMins = rows.reduce((sum, r) => sum + r.idleMins, 0);

  return (
    <section aria-label="Tempo por tópico" className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Tempo por tópico
        </h2>
        <span className="text-xs text-muted-foreground">tempo ativo de discussão e votação</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, idx) => (
          <div key={idx} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3">
            <span className="truncate text-xs text-muted-foreground" title={r.title}>
              {r.title}
              {r.skipped && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">(pulado)</span>}
            </span>
            <div className="h-[22px] overflow-hidden rounded-md bg-muted/60">
              <div
                className={cn('room-grow h-full rounded-md', r.skipped ? 'bg-amber-500/60' : r.mins >= maxMins ? 'bg-primary' : 'bg-primary/50')}
                style={{ width: `${Math.round((r.mins / maxMins) * 100)}%`, animationDelay: `${idx * 60}ms` }}
              />
            </div>
            <span className="text-right text-xs font-bold tabular-nums">{r.mins} min</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Tempo ativo</span>
        <span className="text-sm font-bold tabular-nums">{totalMins} min</span>
      </div>
      {idleMins > 0 && (
        // Sala aberta muito antes da cerimônia (ou pausa longa): o intervalo
        // é mostrado à parte em vez de inflar o tempo do primeiro tópico.
        <p className="m-0 text-xs text-muted-foreground">{idleMins} min de intervalo fora da discussão não foram contabilizados.</p>
      )}
    </section>
  );
}
