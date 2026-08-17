'use client';

import { useMemo } from 'react';
import type { Vote, Participant } from '@/lib/types';
import { getEligibleStatsVotes } from '@/lib/poker-utils';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfidenceSummaryProps {
  votes: Vote[];
  participants: Participant[];
  allowManagementToVote?: boolean;
}

const LEVELS = [
  { key: 'high', label: 'Alta', weight: 1, color: 'bg-emerald-500', text: 'text-emerald-600' },
  { key: 'medium', label: 'Média', weight: 0.5, color: 'bg-amber-500', text: 'text-amber-600' },
  { key: 'low', label: 'Baixa', weight: 0, color: 'bg-rose-500', text: 'text-rose-600' },
] as const;

/**
 * Resumo de confiança do time ao revelar. Considera só votos elegíveis que
 * informaram confiança. Mostra a proporção por nível e um índice agregado
 * (alta=1, média=0.5, baixa=0). Sinaliza item arriscado quando o índice é baixo.
 */
export function ConfidenceSummary({ votes, participants, allowManagementToVote = false }: ConfidenceSummaryProps) {
  const summary = useMemo(() => {
    const eligible = getEligibleStatsVotes(votes, participants, allowManagementToVote);
    const withConf = eligible.filter(v => v.confidence);
    if (withConf.length === 0) return null;

    const counts = { high: 0, medium: 0, low: 0 };
    withConf.forEach(v => { counts[v.confidence as keyof typeof counts]++; });
    const total = withConf.length;
    const score = LEVELS.reduce((acc, l) => acc + counts[l.key] * l.weight, 0) / total; // 0..1
    return { counts, total, score };
  }, [votes, participants, allowManagementToVote]);

  if (!summary) return null;

  const pct = Math.round(summary.score * 100);
  const risky = summary.score < 0.5;

  return (
    <Card className={cn(
      "rounded-2xl border",
      risky ? "border-rose-200/70 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/10" : "border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/10"
    )}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {risky ? <ShieldAlert className="h-4 w-4 text-rose-600" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
            <h3 className={cn("text-[10px] font-black uppercase tracking-[0.2em]", risky ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400")}>
              Confiança do time
            </h3>
          </div>
          <span className={cn("text-lg font-black tracking-tighter italic", risky ? "text-rose-600" : "text-emerald-600")}>{pct}%</span>
        </div>
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-900">
          {LEVELS.map(l => {
            const w = Math.round((summary.counts[l.key] / summary.total) * 100);
            if (w === 0) return null;
            return <div key={l.key} className={l.color} style={{ width: `${w}%` }} title={`${l.label}: ${summary.counts[l.key]}`} />;
          })}
        </div>
        <div className="flex items-center gap-4">
          {LEVELS.map(l => (
            <div key={l.key} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", l.color)} />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{l.label} {summary.counts[l.key]}</span>
            </div>
          ))}
          {risky && <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest ml-auto">Item arriscado — revisar</span>}
        </div>
      </CardContent>
    </Card>
  );
}
