'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PAGE_CARD } from '@/components/page';
import { hubHref } from '@/lib/squad-hub';
import { percentOf, sprintTimeProgress } from '@/lib/squad-metrics';
import type { SprintStats } from '@/lib/squad-summary';
import type { SquadMetricsRollup } from '@/lib/types';
import { cn } from '@/lib/utils';

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

function Bar({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn('h-full rounded-full transition-[width] motion-reduce:transition-none', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Cartão Sprint do Resumo: quanto falta, quanto já foi entregue e o que pede atenção, tudo do que o Jira sincronizou. */
export function SprintCard({
  sprintName,
  rollup,
  stats,
  lastSync,
}: {
  sprintName: string;
  rollup: SquadMetricsRollup | null;
  stats: SprintStats;
  lastSync: string;
}) {
  // Tempo a partir das datas reais da sprint; o servidor nunca grava "dias úteis restantes".
  const time = sprintTimeProgress(
    rollup?.extraMetrics?.activeSprintStart as string | undefined,
    rollup?.extraMetrics?.activeSprintEnd as string | undefined,
  );
  const loggedH = Math.round((rollup?.loggedTotalSec ?? 0) / 3600);
  const estimateH = Math.round((rollup?.estimateTotalSec ?? 0) / 3600);
  const workPct = percentOf(stats.done, stats.total);
  const title = time
    ? `Faltam ${time.remaining} ${time.remaining === 1 ? 'dia útil' : 'dias úteis'}`
    : typeof rollup?.workdaysRemaining === 'number'
      ? `Faltam ${rollup.workdaysRemaining} dias úteis`
      : `${stats.total} itens na sprint`;

  return (
    <section className={cn(PAGE_CARD, 'p-5 sm:p-6')} aria-label="Sprint">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-muted-foreground">{sprintName}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold leading-none tabular-nums text-emerald-700 dark:text-emerald-400">{stats.pct}%</div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            {stats.done} de {stats.total} itens
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Bar label="Trabalho concluído" pct={workPct ?? 0} tone="bg-emerald-500" />
        {time && <Bar label="Tempo da sprint" pct={time.pct} tone="bg-primary" />}
      </div>
      {time && workPct !== null && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {workPct + 5 < time.pct
            ? 'O trabalho concluído está abaixo do tempo que já passou. Vale olhar o que está atrasado ou parado.'
            : 'O trabalho concluído acompanha o tempo da sprint.'}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground">
        <span>{stats.inProgress} em andamento</span>
        <span>{stats.todo} a fazer</span>
        {!!rollup?.staleIssues && (
          <Link href={hubHref('metricas')} className="font-semibold text-amber-700 hover:underline dark:text-amber-400">
            {rollup.staleIssues} parados
          </Link>
        )}
        {!!rollup?.overdueIssues && (
          <Link href={hubHref('cronograma')} className="font-semibold text-rose-700 hover:underline dark:text-rose-400">
            {rollup.overdueIssues} atrasados
          </Link>
        )}
        {loggedH > 0 && (
          <span>{estimateH > 0 ? `${loggedH} h registradas de ${estimateH} h estimadas` : `${loggedH} h registradas`}</span>
        )}
        {!!lastSync && (
          <span className="inline-flex items-center gap-1.5 sm:ml-auto">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> sincronizado {timeAgo(lastSync)}
          </span>
        )}
      </div>
    </section>
  );
}
