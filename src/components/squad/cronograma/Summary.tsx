'use client';

import { formatDay, type Pt } from '@/lib/cronograma/dates';
import { DEFAULT_PHASES } from '@/lib/cronograma/phases';
import type { Kpis } from '@/lib/cronograma/schedule';
import type { SquadWorkflowPhase } from '@/lib/types';
import { OK_TEXT, WARN_TEXT, phaseStyle } from './styles';

export function CronogramaKpis({ kpis }: { kpis: Kpis }) {
  const items: { v: string; l: string; tone: string }[] = [
    { v: String(kpis.phases), l: 'fases na sprint', tone: 'text-foreground' },
    { v: `${kpis.done} de ${kpis.phases}`, l: 'concluídas', tone: OK_TEXT },
    { v: String(kpis.inProgress), l: 'em andamento', tone: 'text-foreground' },
    { v: String(kpis.delayed), l: 'com atraso ou empurradas', tone: kpis.delayed ? WARN_TEXT : 'text-foreground' },
    { v: kpis.forecastEnd ? formatDay((kpis.forecastEnd as Pt).day) : '—', l: 'fim previsto da sprint', tone: 'text-foreground' },
  ];
  return (
    <section aria-label="Resumo do cronograma" className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((k) => (
        <div key={k.l} className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card px-4 py-3.5">
          <span className={`text-2xl font-bold tabular-nums ${k.tone}`}>{k.v}</span>
          <span className="text-sm text-muted-foreground">{k.l}</span>
        </div>
      ))}
    </section>
  );
}

/** Legenda das fases (a da squad, ou a padrão) e dos estilos de barra. */
export function CronogramaLegend({ phases }: { phases?: SquadWorkflowPhase[] }) {
  const items = phases && phases.length > 0
    ? phases.map((p) => ({ label: p.label, dot: phaseStyle({ configuredColor: p.color, kind: 'OUTRA' }).dot }))
    : DEFAULT_PHASES.map((p) => ({ label: p.label, dot: phaseStyle({ kind: p.kind }).dot }));
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Fases</span>
      {items.map((p) => (
        <span key={p.label} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded ${p.dot}`} aria-hidden="true" />
          {p.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border-2 border-dashed border-amber-600 text-amber-600 dark:border-amber-400" aria-hidden="true" />
        atraso
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border-2 border-dashed border-foreground/60 bg-muted" aria-hidden="true" />
        sugestão pelas horas
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-5 rounded border border-dashed border-muted-foreground" aria-hidden="true" />
        data aproximada
      </span>
    </div>
  );
}
