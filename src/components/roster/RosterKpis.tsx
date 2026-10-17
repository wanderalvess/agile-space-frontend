'use client';

import { Calculator, Clock, SlidersHorizontal, Users } from 'lucide-react';
import { KpiCard, KpiRow } from '@/components/page';
import { methodLabel, type RosterKpiValues } from '@/lib/roster/calc';
import { formatHours, plural } from '@/lib/roster/numbers';

/** Os quatro números do topo, somados sobre o time inteiro (não só sobre o que o filtro mostra). */
export function RosterKpis({ kpis, method }: { kpis: RosterKpiValues; method: string }) {
  return (
    <KpiRow>
      <KpiCard label="Total de integrantes" value={plural(kpis.count, 'pessoa', 'pessoas')} hint="Membros ativos na squad" icon={Users} />
      <KpiCard
        label="Capacidade total real"
        value={`${formatHours(kpis.totalRealPerDay, 1)}h / dia`}
        hint={`~${formatHours(kpis.totalRealPerWeek, 1)}h / semana total da squad`}
        icon={Clock}
      />
      <KpiCard
        label="Horas sugeridas (sistema)"
        value={`${formatHours(kpis.totalSuggestedPerDay, 1)}h / dia`}
        hint={`Regra ativa: ${methodLabel(method)}`}
        icon={Calculator}
      />
      <KpiCard label="Horas personalizadas" value={plural(kpis.customizedCount, 'pessoa', 'pessoas')} hint="Ajustadas manualmente pelo gestor" icon={SlidersHorizontal} />
    </KpiRow>
  );
}
