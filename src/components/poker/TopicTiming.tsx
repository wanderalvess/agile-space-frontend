'use client';

import { useMemo } from 'react';
import type { VotingRound, Issue } from '@/lib/types';
import { computeTopicTiming } from '@/lib/poker-utils';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card className="border border-slate-200/60 dark:border-border/40 bg-white/60 dark:bg-card/40 rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-600" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-400">Tempo por tópico</h3>
        </div>
        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-32 shrink-0 truncate text-[11px] font-bold text-slate-600 dark:text-slate-300" title={r.title}>
                {r.title}
                {r.skipped && <span className="ml-1 text-amber-600 font-black">(pulado)</span>}
              </div>
              <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", r.skipped ? "bg-amber-400/70" : r.mins >= maxMins ? "bg-indigo-600" : "bg-indigo-400/60")} style={{ width: `${Math.round((r.mins / maxMins) * 100)}%` }} />
              </div>
              <div className="w-14 shrink-0 text-right text-[11px] font-black text-slate-800 dark:text-slate-100">{r.mins} min</div>
            </div>
          ))}
        </div>
        <div className="pt-3 mt-1 border-t border-slate-200/60 dark:border-border/40 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Tempo ativo</span>
          <span className="text-[13px] font-black text-indigo-700 dark:text-indigo-400">{totalMins} min</span>
        </div>
        {idleMins > 0 && (
          // Sala aberta muito antes da cerimônia (ou pausa longa): o intervalo
          // é mostrado à parte em vez de inflar o tempo do primeiro tópico.
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            {idleMins} min de intervalo fora da discussão não foram contabilizados.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
