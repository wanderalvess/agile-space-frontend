'use client';

import { AlertTriangle } from 'lucide-react';
import { StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { Thermometer } from '@/lib/sprint-planner/api';
import { formatHours, formatPct } from '@/lib/sprint-planner/format';
import { CLASSES, type Cls } from '@/lib/sprint-planner/scope';
import { ZONE_BAR } from './CapacityThermometer';

/** "DEV 96/90 h · 107% · coberto pela reserva (12%)" e "QA 70/75 h · 93%". */
export function barSummary(label: Cls, t: Thermometer | undefined): string {
  const alloc = Math.round((t?.allocatedHours ?? 0) * 10) / 10;
  const cap = Math.round((t?.capacityHours ?? 0) * 10) / 10;
  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  let text = `${label} ${fmt(alloc)}/${fmt(cap)} h`;
  if (!t || t.state === 'SEM_CAPACIDADE' || t.pct == null) return `${text} · sem capacidade`;
  text += ` · ${formatPct(t.pct)}`;
  if (t.state === 'COBERTO_PELA_RESERVA') text += ` · coberto pela reserva (${formatPct(t.reservePct)})`;
  if (t.state === 'ACIMA_DA_RESERVA') text += ` · acima da reserva (${formatPct(t.reservePct)})`;
  return text;
}

function Bar({ label, t, estimated }: { label: Cls; t: Thermometer | undefined; estimated: boolean }) {
  const zone = t?.zone ?? 'SEM_CAPACIDADE';
  const pct = t?.pct ?? null;
  const reserve = t?.reservePct ?? 0;
  // A escala vai até o maior entre 120%, o limite da reserva e a carga, para o marcador de 100% sempre aparecer.
  const scale = Math.max(120, 100 + reserve + 5, pct ?? 0);
  const fill = pct == null ? 0 : Math.min(100, (pct / scale) * 100);
  const mark100 = (100 / scale) * 100;
  const markReserve = ((100 + reserve) / scale) * 100;
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-testid={`escopo-barra-${label}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold tabular-nums text-foreground" data-testid={`escopo-resumo-${label}`}>{barSummary(label, t)}</p>
        {estimated && <StatusChip tone="neutral">Calculando</StatusChip>}
      </div>
      <div
        role="meter"
        aria-label={`Carga ${label}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(scale)}
        aria-valuenow={pct == null ? 0 : Math.round(pct)}
        aria-valuetext={barSummary(label, t)}
        className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn('h-full rounded-full transition-[width] duration-base', ZONE_BAR[zone])} style={{ width: `${fill}%` }} />
        <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${mark100}%` }} />
        {reserve > 0 && <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-foreground/30" style={{ left: `${markReserve}%` }} />}
      </div>
    </div>
  );
}

/**
 * Barras DEV e QA do escopo. Os números vêm do termômetro do backend; `estimated` indica que são provisórios
 * (a tela estimou ao adicionar/remover e espera a resposta). Acima da reserva aparece o alerta forte, sem bloquear.
 */
export function ScopeBars({ thermometer, estimated = false, className }: { thermometer: Record<string, Thermometer>; estimated?: boolean; className?: string }) {
  const above = CLASSES.filter((c) => thermometer?.[c]?.state === 'ACIMA_DA_RESERVA');
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        {CLASSES.map((c) => <Bar key={c} label={c} t={thermometer?.[c]} estimated={estimated} />)}
      </div>
      <p className="text-xs text-muted-foreground">
        Verde abaixo de 85% · amarelo de 85% a 95% · vermelho acima de 95%. A linha forte marca 100% da capacidade e a clara, o limite da reserva.
      </p>
      {above.map((c) => {
        const t = thermometer[c];
        const over = Math.max(0, t.allocatedHours - t.reserveLimitHours);
        return (
          <div key={c} role="alert" className="flex items-start gap-2 rounded-[10px] border border-red-700/40 bg-red-500/10 px-4 py-3 text-[13px] text-foreground" data-testid={`escopo-alerta-${c}`}>
            <AlertTriangle aria-hidden="true" className={'mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-400'} strokeWidth={1.5} />
            <span>
              <strong>{c} passou do limite da reserva</strong>: {formatHours(t.allocatedHours)} para um limite de {formatHours(t.reserveLimitHours)} ({formatHours(over)} a mais).
              Considere tirar uma tarefa. Isso não impede de avançar.
            </span>
          </div>
        );
      })}
    </div>
  );
}
