"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { useUserContext } from "@/context/UserContext";
import { useSquadConfig } from "@/hooks/useSquadConfig";
import { CEREMONY_DAY_LABEL } from "@/lib/ceremony-schedule";
import type { CeremonyDayOfWeek } from "@/lib/types";

const ORDER: CeremonyDayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function describeDays(days: CeremonyDayOfWeek[]): string {
  if (days.length === 5 && ORDER.slice(0, 5).every((d) => days.includes(d))) return "Seg a Sex";
  if (days.length === 7) return "Todos os dias";
  return ORDER.filter((d) => days.includes(d)).map((d) => CEREMONY_DAY_LABEL[d]).join(", ");
}

/**
 * Conteúdo do widget "Rituais da squad": lê o que a squad cadastrou (Painel > Próxima cerimônia).
 * Nada de horário inventado — sem cadastro, mostra como configurar.
 */
export function SquadRituals() {
  const { userProfile } = useUserContext();
  const { config, loading } = useSquadConfig(userProfile?.squadId);
  const ceremonies = config?.ceremonies ?? [];

  if (loading) return <p className="text-xs text-muted-foreground">Carregando…</p>;

  if (config?.ceremonyMode === "manual" && ceremonies.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        {ceremonies.map((c) => (
          <div key={c.id} className="bg-muted/40 p-3 rounded-xl border border-border flex items-center justify-between gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground truncate">{c.title}</span>
              <span className="text-[10px] text-muted-foreground">
                {describeDays(c.daysOfWeek)} às {c.startTime} · {c.durationMinutes} min
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const fromGoogle = config?.ceremonyMode !== "manual" && !!config;
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center text-xs text-muted-foreground">
      <CalendarClock className="h-6 w-6 opacity-50" />
      <span>
        {fromGoogle
          ? "Os rituais desta squad vêm da agenda do Google de cada pessoa."
          : "Nenhum ritual cadastrado para esta squad."}
      </span>
      <Link href="/painel" className="font-bold text-primary hover:underline">
        {fromGoogle ? "Ver próxima cerimônia no Painel" : "Configurar rituais no Painel"}
      </Link>
    </div>
  );
}
