"use client";

import SquadPanelsTab from "@/components/squad/panels/SquadPanelsTab";

/**
 * Compatibilidade: o hub (app/squad/page.tsx) ainda importa este nome. O painel mora em
 * components/squad/panels/SquadPanelsTab. Apagar quando o hub passar a montar SquadPanelsTab direto.
 */
export function SquadDashboardView() {
  return <SquadPanelsTab />;
}
