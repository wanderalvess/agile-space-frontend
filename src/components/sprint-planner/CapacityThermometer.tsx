'use client';

import { StatusChip, TONES } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { Thermometer } from '@/lib/sprint-planner/api';
import { ZONE_TONE, formatHours, formatPct, thermometerLabel } from '@/lib/sprint-planner/format';

const BAR: Record<Thermometer['zone'], string> = {
  VERDE: 'bg-emerald-500',
  AMARELO: 'bg-amber-500',
  VERMELHO: 'bg-red-500',
  SEM_CAPACIDADE: 'bg-muted-foreground/40',
};

/** Uma linha do termômetro (DEV ou QA). Zona e estado vêm prontos do backend. */
export function ThermometerRow({ label, t }: { label: string; t: Thermometer | undefined }) {
  const zone = t?.zone ?? 'SEM_CAPACIDADE';
  const pct = t?.pct ?? null;
  const width = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  const tone = ZONE_TONE[zone];
  return (
    <div className="flex flex-col gap-1.5" data-testid={`termometro-${label}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-foreground">{label}</span>
        <StatusChip tone={tone}>{thermometerLabel(t)}</StatusChip>
      </div>
      <div
        role="meter"
        aria-label={`Carga ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct == null ? 0 : Math.round(pct)}
        aria-valuetext={`${formatPct(pct)}: ${thermometerLabel(t)}`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn('h-full rounded-full transition-[width] duration-base', BAR[zone])} style={{ width: `${width}%` }} />
      </div>
      <p className="text-[13px] tabular-nums text-muted-foreground">
        <span className={cn('font-semibold', TONES[tone].text)}>{formatPct(pct)}</span>
        {' · '}
        {formatHours(t?.allocatedHours)} de {formatHours(t?.capacityHours)}
        {t && t.reservePct > 0 && <> · reserva até {formatHours(t.reserveLimitHours)}</>}
      </p>
    </div>
  );
}

export function CapacityThermometer({ thermometer }: { thermometer: Record<string, Thermometer> }) {
  return (
    <div className="flex flex-col gap-4">
      <ThermometerRow label="DEV" t={thermometer?.DEV} />
      <ThermometerRow label="QA" t={thermometer?.QA} />
      <p className="text-xs text-muted-foreground">
        Abaixo de 85%: folga · 85% a 95%: perto · acima de 95%: no limite. As horas alocadas entram quando o escopo for montado.
      </p>
    </div>
  );
}
