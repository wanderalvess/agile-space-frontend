'use client';

import React from 'react';
import { BRAND_TEXT, roleToneOf, ROLE_STYLES } from '@/components/room-kit';
import { formatNumber, formatPercent, type SessionReportData } from '@/lib/poker-report';
import { cn } from '@/lib/utils';
import { CARD } from './shared';

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

/** Identificação do documento: sessão, squad, data, duração, facilitador, participantes e baralho. */
export function ReportDocumentHeader({ report }: { report: SessionReportData }) {
  const h = report.header;
  const participants = h.participantsByRole.map((p) => `${p.count} ${p.label}`).join(' · ');
  return (
    <section aria-label="Identificação do relatório" className={cn(CARD, 'flex flex-col gap-4 px-5 py-4')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">Scrum Poker · Portal Tech V&amp;D</span>
          <h2 className="m-0 truncate text-xl font-bold leading-tight">{h.title}</h2>
        </div>
        {h.team && <span className="text-sm font-semibold text-muted-foreground">{h.team}</span>}
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3 xl:grid-cols-5">
        <Meta label="Data">
          {h.dateLong.charAt(0).toUpperCase() + h.dateLong.slice(1)}
        </Meta>
        <Meta label="Horário">{h.timeRange ?? '—'}</Meta>
        <Meta label="Duração ativa">
          {h.durationLabel}
          {h.idleMins > 0 && <span className="font-normal text-muted-foreground"> · {h.idleMins} min de pausa fora</span>}
        </Meta>
        <Meta label="Facilitador">{h.facilitators.length > 0 ? h.facilitators.join(', ') : '—'}</Meta>
        <Meta label="Baralho">{h.deckLabel}</Meta>
        <div className="col-span-2 md:col-span-3 xl:col-span-5">
          <Meta label={`Participantes (${h.participantsCount})`}>
            <span className="font-normal text-muted-foreground">{participants || '—'}</span>
          </Meta>
        </div>
      </dl>
    </section>
  );
}

function Kpi({
  label,
  value,
  unit,
  sub,
  emphasis = false,
  delay = 0,
  valueClassName,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: React.ReactNode;
  emphasis?: boolean;
  delay?: number;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(CARD, 'room-rise flex min-w-0 flex-col gap-1.5 p-4', emphasis && 'border-primary/40 bg-primary/5 dark:bg-primary/10')}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-[30px] font-bold leading-none tabular-nums', valueClassName)}>
        {value}
        {unit && <span className="text-[13px] font-semibold text-muted-foreground"> {unit}</span>}
      </span>
      {sub && <span className="text-xs leading-snug text-muted-foreground">{sub}</span>}
    </div>
  );
}

const GRID = 'grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]';

/** Resumo executivo em números: esforço (total e por papel) e qualidade do refinamento. */
export function ReportKpis({ report }: { report: SessionReportData }) {
  const { kpis: k, header: h } = report;
  const isHours = h.deck === 'hours';
  const outsideParts = [
    k.skipped > 0 && `${k.skipped} ${k.skipped === 1 ? 'pulada' : 'puladas'}`,
    k.parkedPending > 0 && `${k.parkedPending} ${k.parkedPending === 1 ? 'adiada' : 'adiadas'}`,
    k.cancelled > 0 && `${k.cancelled} ${k.cancelled === 1 ? 'cancelada' : 'canceladas'}`,
    k.untouched > 0 && `${k.untouched} ${k.untouched === 1 ? 'não abordada' : 'não abordadas'}`,
  ].filter(Boolean) as string[];

  const roleCount = k.roleTotals.length;

  return (
    <section aria-label="Resumo executivo" className="flex flex-col gap-3">
      <div className={GRID}>
        <Kpi label="Tarefas estimadas" value={String(k.estimated)} unit={`de ${k.agenda}`} sub={`${k.discussed} ${k.discussed === 1 ? 'debatida' : 'debatidas'} na sessão`} delay={0} />
        {k.total !== null ? (
          <Kpi
            emphasis
            label={isHours ? 'Total de horas' : h.deck === 'fibonacci' ? 'Total de pontos' : 'Total estimado'}
            value={formatNumber(k.total)}
            unit={isHours || h.deck === 'tshirt' ? 'h' : 'SP'}
            sub="Esforço estimado"
            valueClassName={BRAND_TEXT}
            delay={50}
          />
        ) : (
          k.distribution.length > 0 && (
            <Kpi emphasis label="Tamanhos estimados" value={k.distribution.map((d) => `${d.count}×${d.label}`).join(' ')} sub="Quantidade por tamanho" valueClassName="text-xl" delay={50} />
          )
        )}
        {k.roleTotals.map((t, i) => (
          <Kpi
            key={t.role}
            label={`Esforço ${t.label}`}
            value={formatNumber(t.hours)}
            unit="h"
            sub={`${t.tasks} ${t.tasks === 1 ? 'tarefa' : 'tarefas'} · média ${formatNumber(t.tasks > 0 ? t.hours / t.tasks : 0)}h`}
            valueClassName={ROLE_STYLES[roleToneOf(t.role)].text}
            delay={100 + i * 50}
          />
        ))}
      </div>
      <div className={GRID}>
        <Kpi
          label="Fechadas na 1ª rodada"
          value={k.firstRoundPct !== null ? formatPercent(k.firstRoundPct) : '—'}
          sub={k.withRounds > 0 ? `${k.firstRoundClosed} de ${k.withRounds} estimadas` : 'Sem rodadas registradas'}
          delay={(roleCount + 0) * 50}
        />
        <Kpi
          label="Média de rodadas"
          value={k.avgRounds !== null ? formatNumber(k.avgRounds) : '—'}
          unit={k.avgRounds !== null ? 'por tarefa' : undefined}
          sub={k.revoted > 0 ? `${k.revoted} ${k.revoted === 1 ? 'revotada' : 'revotadas'}` : 'Nenhuma revotação'}
          delay={(roleCount + 1) * 50}
        />
        <Kpi
          label="Divergência crítica"
          value={String(k.divergent)}
          sub={k.divergent > 0 ? 'Estimadas com votos distantes' : 'Nenhuma tarefa'}
          valueClassName={k.divergent > 0 ? 'text-red-700 dark:text-red-300' : undefined}
          delay={(roleCount + 2) * 50}
        />
        <Kpi
          label="Fora da estimativa"
          value={String(k.outside)}
          sub={outsideParts.length > 0 ? outsideParts.join(' · ') : 'Todas estimadas'}
          valueClassName={k.outside > 0 ? 'text-amber-700 dark:text-amber-300' : undefined}
          delay={(roleCount + 3) * 50}
        />
        {k.largest && (
          <Kpi
            label="Maior estimativa"
            value={k.largest.label}
            sub={<span className="block truncate" title={k.largest.task.title}>{k.largest.task.key ? `${k.largest.task.key} · ` : ''}{k.largest.task.title}</span>}
            delay={(roleCount + 4) * 50}
          />
        )}
        <Kpi
          label="Tempo gasto"
          value={h.durationLabel}
          sub={k.avgMinsPerTopic !== null ? `${formatNumber(k.avgMinsPerTopic)} min por tarefa debatida` : 'Sem registro de tempo'}
          delay={(roleCount + 5) * 50}
        />
      </div>
    </section>
  );
}
