'use client';

import { Calculator, Clock, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react';
import { IconTile } from '@/components/room-kit';
import { methodLabel, type RosterKpiValues } from '@/lib/roster/calc';
import { formatHours, plural } from '@/lib/roster/numbers';
import { cn } from '@/lib/utils';
import { ROSTER_CARD } from './styles';

function Kpi({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: LucideIcon }) {
  return (
    <div className={cn(ROSTER_CARD, 'flex items-start justify-between gap-2.5 rounded-[14px] px-[18px] py-4')}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
        <span className="text-[28px] font-bold leading-tight tabular-nums text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      <IconTile icon={icon} size="md" />
    </div>
  );
}

/** Os quatro números do topo, somados sobre o time inteiro (não só sobre o que o filtro mostra). */
export function RosterKpis({ kpis, method }: { kpis: RosterKpiValues; method: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Total de integrantes" value={plural(kpis.count, 'pessoa', 'pessoas')} sub="Membros ativos na squad" icon={Users} />
      <Kpi
        label="Capacidade total real"
        value={`${formatHours(kpis.totalRealPerDay, 1)}h / dia`}
        sub={`~${formatHours(kpis.totalRealPerWeek, 1)}h / semana total da squad`}
        icon={Clock}
      />
      <Kpi
        label="Horas sugeridas (sistema)"
        value={`${formatHours(kpis.totalSuggestedPerDay, 1)}h / dia`}
        sub={`Regra ativa: ${methodLabel(method)}`}
        icon={Calculator}
      />
      <Kpi label="Horas personalizadas" value={plural(kpis.customizedCount, 'pessoa', 'pessoas')} sub="Ajustadas manualmente pelo gestor" icon={SlidersHorizontal} />
    </div>
  );
}
