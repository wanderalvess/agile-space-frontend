'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, CalendarRange, Clock, FileDown, Info, Target, TrendingUp, UsersRound } from 'lucide-react';
import { adminApi } from '@/app/admin/api';
import { toast } from '@/hooks/use-toast';
import { ErrorState, KpiCard, KpiRow, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { IconTile, ModalButton } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import { barPercent, computeGrowth, formatDecimal, formatDuration, formatInt, type GrowthMetrics } from './admin-platform-utils';
import { exportGrowthPdf } from './growth-pdf';

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
      <span className="text-[13px] text-muted-foreground">{subtitle}</span>
    </div>
  );
}

export function GrowthDashboard() {
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getStats();
      setMetrics(computeGrowth(data));
    } catch (e) {
      console.warn('GrowthDashboard: erro ao carregar as estatísticas:', e);
      setError((e as Error)?.message || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const maxCount = useMemo(() => Math.max(0, ...(metrics?.modules.map((m) => m.count) ?? [])), [metrics]);

  const handleExport = () => {
    if (!metrics) return;
    try {
      exportGrowthPdf(metrics);
    } catch (e) {
      console.error('Erro ao gerar o PDF de métricas:', e);
      toast({ variant: 'destructive', title: 'Não foi possível gerar o PDF', description: 'Tente de novo em instantes.' });
    }
  };

  if (loading) return <LoadingSkeleton variant="page" rows={4} label="Compilando as métricas de crescimento" />;
  if (error || !metrics) {
    return <ErrorState title="Não foi possível carregar as estatísticas de administração" description={error ?? undefined} onRetry={load} />;
  }

  const g = metrics;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <ModalButton variant="secondary" onClick={handleExport}>
          <FileDown className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Exportar PDF
        </ModalButton>
      </div>

      <section className="flex flex-col gap-3" aria-label="Resumo">
        <SectionTitle title="Resumo" subtitle="Visão geral do uso da plataforma" />
        <KpiRow columns={3}>
          <KpiCard label="Total de interações" value={formatInt(g.interactions)} hint="Sessões de todas as ferramentas" icon={Activity} />
          <KpiCard
            label="Taxa de feedback"
            value={`${formatDecimal(g.feedbackRate)}%`}
            hint={`${formatInt(g.feedbacks)} feedbacks ÷ ${formatInt(g.users)} usuários cadastrados`}
            icon={Target}
          />
          <KpiCard
            label="Média por usuário"
            value={formatDecimal(g.perUser)}
            hint={`${formatInt(g.interactions)} interações ÷ ${formatInt(g.users)} usuários cadastrados`}
            icon={BarChart3}
          />
        </KpiRow>
      </section>

      <section className="flex flex-col gap-3" aria-label="Uso do sistema">
        <SectionTitle title="Uso do sistema" subtitle="Visão executiva" />
        <KpiRow columns={3}>
          <KpiCard label="Total de sessões" value={formatInt(g.sessions)} hint="Cerimônias em grupo realizadas" icon={CalendarRange} />
          <KpiCard label="Total de participações *" value={formatInt(g.participations)} hint="Soma de participantes por sessão" icon={UsersRound} />
          {g.avgDurationMinutes != null ? (
            <KpiCard
              label="Tempo de uso médio"
              value={formatDuration(g.avgDurationMinutes)}
              hint={`Retro e Sprint Review · ${g.durationSampleSize} ${g.durationSampleSize === 1 ? 'sessão' : 'sessões'}`}
              icon={Clock}
            />
          ) : (
            <div className="flex items-start justify-between gap-2.5 rounded-[14px] border-2 border-dashed border-border bg-muted/40 px-[18px] py-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-muted-foreground">Tempo de uso</span>
                <span className="text-[28px] font-bold leading-tight text-muted-foreground">Em breve</span>
                <span className="text-xs text-muted-foreground">Aparece depois da próxima sessão finalizada</span>
              </div>
              <IconTile icon={Clock} tone="neutral" size="md" />
            </div>
          )}
        </KpiRow>
        <p className="text-xs text-muted-foreground">
          * Retrospectivas ainda não registram participantes e não entram nesse total. O tempo de uso considera só Retro e Sprint Review.
        </p>
      </section>

      <section className={cn(PAGE_CARD, 'overflow-clip')} aria-label="Adoção por módulo">
        <header className="flex items-center gap-3.5 border-b border-border px-6 py-4">
          <IconTile icon={TrendingUp} />
          <div className="flex min-w-0 flex-col">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Adoção por módulo</h2>
            <p className="text-[13px] text-muted-foreground">Ranking de utilização real, em sessões</p>
          </div>
        </header>
        <ol className="flex flex-col gap-5 p-6">
          {g.modules.map((m, idx) => {
            const Icon = moduleIcon(m.module);
            return (
              <li key={m.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-7 text-[13px] font-semibold tabular-nums text-muted-foreground">#{String(idx + 1).padStart(2, '0')}</span>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="truncate text-sm font-semibold text-foreground">{m.label}</span>
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                    {formatInt(m.count)} {m.count === 1 ? 'sessão' : 'sessões'}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${m.label}: ${m.count} sessões`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(maxCount, 1)}
                  aria-valuenow={m.count}
                  className="h-2.5 w-full overflow-hidden rounded-full border border-border bg-muted"
                >
                  <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-slow" style={{ width: `${barPercent(m.count, maxCount)}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
        {g.noActivity && (
          <div className="mx-6 mb-6 flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-[13px] text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            Nenhuma sessão registrada ainda. As barras ficam vazias.
          </div>
        )}
      </section>
    </div>
  );
}
