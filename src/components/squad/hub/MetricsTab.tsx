'use client';

/**
 * Aba Métricas do hub: "Sprint atual" (placar, quadro por status, produtividade diária) e "Desempenho do time".
 * Quem está no time e as horas por dia moram em Pessoas (/squad/roster): não se repetem aqui.
 */

import dynamic from 'next/dynamic';
import { AlertTriangle, Bug, CalendarRange, Gauge, LayoutGrid, ListChecks, TrendingUp } from 'lucide-react';
import { KpiCard, KpiRow, PAGE_CARD } from '@/components/page';
import { SquadDataState, deriveSquadDataState } from '@/components/squad/SquadDataState';
import { dailyDeltas, formatShortDate } from '@/lib/squad-metrics';
import { barPercent, orderKpis } from '@/lib/squad-summary';
import type { MetricsView } from '@/lib/squad-hub';
import type { SquadConfig, SquadDailySnapshot, SquadMetricsRollup } from '@/lib/types';
import type { Tone } from '@/components/room-kit';
import { cn } from '@/lib/utils';

const SquadPerformanceView = dynamic(() => import('@/components/squad/SquadPerformanceView').then((m) => m.SquadPerformanceView), { ssr: false });

const VIEWS: { id: MetricsView; label: string }[] = [
  { id: 'sprint', label: 'Sprint atual' },
  { id: 'desempenho', label: 'Desempenho do time' },
];

export interface MetricsTabProps {
  view: MetricsView;
  onViewChange: (view: MetricsView) => void;
  /** Placar da sprint em foco (a atual ou a escolhida no cabeçalho). */
  displayRollup: SquadMetricsRollup | null;
  /** Placar da sprint atual: sem ele a squad ainda não sincronizou. */
  currentRollup: SquadMetricsRollup | null;
  config: SquadConfig | null;
  dailySnapshots: SquadDailySnapshot[];
  role?: string;
  isLoading: boolean;
  isSyncing: boolean;
  jiraConnected: boolean;
  onOpenSettings: () => void;
  onSync: () => void;
}

function BarRow({ label, pct, value, extra, tone = 'bg-primary', labelWidth = 'w-36' }: { label: string; pct: number; value: string; extra?: string; tone?: string; labelWidth?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={cn('shrink-0 truncate font-medium text-foreground', labelWidth)}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-[13px] font-semibold tabular-nums text-muted-foreground">{value}</span>
      {extra && <span className="w-20 shrink-0 text-right text-[13px] tabular-nums text-muted-foreground">{extra}</span>}
    </div>
  );
}

export function MetricsTab({
  view,
  onViewChange,
  displayRollup,
  currentRollup,
  config,
  dailySnapshots,
  role,
  isLoading,
  isSyncing,
  jiraConnected,
  onOpenSettings,
  onSync,
}: MetricsTabProps) {
  const hoursLogged = displayRollup?.loggedTotalSec ? (displayRollup.loggedTotalSec / 3600).toFixed(1) : '0';
  const hoursEstimate = displayRollup?.estimateTotalSec ? (displayRollup.estimateTotalSec / 3600).toFixed(0) : '0';
  const hoursRemaining = displayRollup?.remainingTotalSec ? (displayRollup.remainingTotalSec / 3600).toFixed(0) : '0';
  const bugs = displayRollup?.bugIssues ?? 0;
  const stale = displayRollup?.staleIssues ?? 0;

  const kpis = orderKpis<{ key: string; label: string; value: string; hint: string; icon: typeof ListChecks; tone: Tone }>(
    [
      { key: 'done', label: 'Concluído', value: `${displayRollup?.doneIssues ?? 0} / ${displayRollup?.totalIssues ?? 0}`, hint: 'issues finalizadas', icon: ListChecks, tone: 'success' },
      { key: 'hours', label: 'Horas na sprint', value: `${hoursLogged}h`, hint: `estimado ${hoursEstimate}h · resta ${hoursRemaining}h`, icon: Gauge, tone: 'brand' },
      { key: 'bugs', label: 'Bugs no escopo', value: String(bugs), hint: 'defeitos em resolução', icon: Bug, tone: bugs > 0 ? 'danger' : 'neutral' },
      { key: 'stale', label: 'Itens parados', value: String(stale), hint: 'sem update há mais de 3 dias', icon: AlertTriangle, tone: stale > 0 ? 'warn' : 'neutral' },
    ],
    role
  );

  const byStatus = ((displayRollup?.extraMetrics as { byStatus?: Record<string, number> } | undefined)?.byStatus) || {};
  const statusEntries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusEntries.map((e) => e[1]));
  const totalCount = displayRollup?.totalIssues ?? 0;

  // Horas registradas por dia: o snapshot guarda o acumulado, o dia é a diferença para o anterior.
  const days = [...dailyDeltas(dailySnapshots).entries()].map(([date, d]) => ({ date, hours: d.loggedHours, done: d.done }));
  const maxDay = Math.max(...days.map((d) => d.hours), 0);

  const periodStart = displayRollup?.extraMetrics?.activeSprintStart as string | undefined;
  const periodEnd = displayRollup?.extraMetrics?.activeSprintEnd as string | undefined;

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="O que mostrar nas métricas" className="inline-flex self-start overflow-hidden rounded-[10px] border border-border">
        {VIEWS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => onViewChange(v.id)}
            className={cn(
              'h-10 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              i > 0 && 'border-l border-border',
              view === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'desempenho' ? (
        <SquadPerformanceView />
      ) : (
        <div className="flex flex-col gap-5">
          <section className={cn(PAGE_CARD, 'flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6')}>
            <div>
              <p className="text-[13px] font-semibold text-muted-foreground">{displayRollup?.sprintName || config?.activeSprintId || 'Sprint'}</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Métricas da sprint</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Quantos itens foram entregues, quantas horas foram registradas e o que está parado, a partir do que o Jira mostra.
              </p>
            </div>
            {periodStart && periodEnd && (
              <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
                <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <p className="text-[13px] text-muted-foreground">Período da sprint</p>
                  <p className="text-[13px] font-semibold text-foreground">
                    {formatShortDate(periodStart)} → {formatShortDate(periodEnd)}
                    {!!displayRollup?.workdaysTotal && <span className="ml-1 font-normal text-muted-foreground">({displayRollup.workdaysTotal} dias úteis)</span>}
                  </p>
                </div>
              </div>
            )}
          </section>

          {!isLoading && !currentRollup && (
            <SquadDataState
              kind={deriveSquadDataState({ jiraConnected, lastSyncAt: config?.lastSyncAt, lastSyncStatus: config?.lastSyncStatus })}
              subject="as métricas"
              isSyncing={isSyncing}
              errorMessage={config?.lastSyncError}
              onConnect={onOpenSettings}
              onSync={onSync}
            />
          )}

          {displayRollup && (
            <KpiRow>
              {kpis.map((k) => (
                <KpiCard key={k.key} label={k.label} value={k.value} hint={k.hint} icon={k.icon} tone={k.tone} />
              ))}
            </KpiRow>
          )}

          {displayRollup && statusEntries.length > 0 && (
            <section className={cn(PAGE_CARD, 'p-5')}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Quadro da sprint
                </h2>
                <span className="text-[13px] text-muted-foreground">{totalCount} issues no escopo</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {statusEntries.map(([status, count]) => (
                  <BarRow key={status} label={status} pct={barPercent(count, maxStatus)} value={String(count)} />
                ))}
              </div>
            </section>
          )}

          {currentRollup && (
            <section className={cn(PAGE_CARD, 'p-5')}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Produtividade diária
                </h2>
                <span className="text-[13px] text-muted-foreground">horas registradas por dia</span>
              </div>
              {days.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda sem histórico suficiente — aparece a partir do segundo dia com sincronização.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {days.map((d) => (
                    <BarRow
                      key={d.date}
                      label={formatShortDate(d.date)}
                      labelWidth="w-16"
                      pct={barPercent(d.hours, maxDay)}
                      value={`${d.hours.toFixed(1)}h`}
                      extra={`${d.done} concl.`}
                      tone="bg-emerald-500"
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
