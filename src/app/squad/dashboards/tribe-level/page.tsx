"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";
import { projectService } from "@/services/projectService";
import { squadApi, SquadApiError } from "@/app/squad/api";
import { percentOf } from "@/lib/squad-metrics";
import type { SquadMetricsRollup } from "@/lib/types";

type SquadRow = {
  id: string;
  name: string;
  rollup: SquadMetricsRollup | null;
  /** true quando o servidor negou a leitura desta squad (fora da tribo de quem consulta) */
  restricted?: boolean;
};

function predictability(r: SquadMetricsRollup | null): number | null {
  if (!r) return null;
  return percentOf(r.doneIssues ?? 0, r.totalIssues);
}

/**
 * Visão da tribo: o resumo de cada squad vem do que foi sincronizado do Jira. Squad sem sincronização aparece como
 * "Sem dados". Velocidade, clima e rituais por squad ainda não têm fonte aqui e não são mostrados (antes eram números fixos).
 */
export default function TribeLevelDashboard() {
  const [rows, setRows] = useState<SquadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    projectService
      .getAllProjects()
      .then((projects) =>
        Promise.all(
          projects.map(async (p): Promise<SquadRow> => {
            let restricted = false;
            const rollup = await squadApi.getRollup(p.id).catch((e) => {
              restricted = e instanceof SquadApiError && e.status === 403;
              return null;
            });
            return { id: p.id, name: p.name && p.name !== p.id ? `${p.id} · ${p.name}` : p.id, rollup, restricted };
          })
        )
      )
      // Squads com dados primeiro; as demais em ordem alfabética.
      .then((result) => alive && setRows([...result].sort((a, b) => Number(!!b.rollup?.totalIssues) - Number(!!a.rollup?.totalIssues) || a.id.localeCompare(b.id))))
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        setLoadError(e?.message || "Não foi possível carregar as squads agora.");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => {
    const withData = rows.filter((r) => r.rollup && r.rollup.totalIssues > 0);
    const preds = withData.map((r) => predictability(r.rollup)!).filter((n) => Number.isFinite(n));
    return {
      squads: rows.length,
      withData: withData.length,
      avgPredictability: preds.length ? Math.round(preds.reduce((a, b) => a + b, 0) / preds.length) : null,
      done: withData.reduce((a, r) => a + (r.rollup?.doneIssues ?? 0), 0),
      total: withData.reduce((a, r) => a + (r.rollup?.totalIssues ?? 0), 0),
      overdue: withData.reduce((a, r) => a + (r.rollup?.overdueIssues ?? 0), 0),
    };
  }, [rows]);

  const card = "bg-card border border-border p-5 rounded-2xl flex flex-col justify-between shadow-lg";
  const label = "text-sm font-semibold text-muted-foreground";

  return (
    <div className="flex flex-col gap-6">
      <DashboardNavTabs />

      <div className="bg-card p-6 rounded-2xl border border-border shadow-lg">
        <div className="flex items-center gap-2">
          <span className="bg-primary/15 text-primary font-semibold text-xs px-2.5 py-0.5 rounded-full">Visão da tribo</span>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-headline">Painel da tribo</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1.5">
          Como está a sprint de cada squad, com base no que foi sincronizado do Jira. Squads que ainda não sincronizaram aparecem como &quot;Sem dados&quot;.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={card}>
          <span className={label}>Squads com dados</span>
          <span className="mt-3 text-3xl font-black text-foreground font-headline">
            {loading ? "…" : `${summary.withData} de ${summary.squads}`}
          </span>
        </div>
        <div className={card}>
          <span className={label}>Previsibilidade média</span>
          <span className="mt-3 text-3xl font-black text-foreground font-headline">
            {loading ? "…" : summary.avgPredictability === null ? "—" : `${summary.avgPredictability}%`}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">Média das squads com dados.</span>
        </div>
        <div className={card}>
          <span className={label}>Itens concluídos</span>
          <span className="mt-3 text-3xl font-black text-foreground font-headline">
            {loading ? "…" : summary.total === 0 ? "—" : `${summary.done} de ${summary.total}`}
          </span>
        </div>
        <div className={card}>
          <span className={label}>Itens atrasados</span>
          <span className={`mt-3 text-3xl font-black font-headline ${summary.overdue > 0 ? "text-rose-500" : "text-foreground"}`}>
            {loading ? "…" : summary.total === 0 ? "—" : summary.overdue}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">Prazo vencido e ainda não concluídos.</span>
        </div>
      </div>

      <WidgetCard title="Comparação entre squads">
        <p className="text-sm text-muted-foreground mb-4">
          Previsibilidade é a parte dos itens da sprint que já foi concluída.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold">
                <th className="pb-3 px-3">Squad</th>
                <th className="pb-3 px-3">Sprint</th>
                <th className="pb-3 px-3">Concluídos</th>
                <th className="pb-3 px-3">Previsibilidade</th>
                <th className="pb-3 px-3">Atrasados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {rows.map((sq) => {
                const pred = predictability(sq.rollup);
                return (
                  <tr key={sq.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-4 px-3 font-bold text-foreground">{sq.name}</td>
                    {pred === null ? (
                      <td colSpan={4} className="py-4 px-3 text-muted-foreground">
                        {sq.restricted ? "Sem acesso a esta squad (fora da sua tribo)" : "Sem dados desta squad ainda"}
                      </td>
                    ) : (
                      <>
                        <td className="py-4 px-3 text-muted-foreground">{sq.rollup?.sprintName || "—"}</td>
                        <td className="py-4 px-3 text-foreground font-code">{sq.rollup?.doneIssues} de {sq.rollup?.totalIssues}</td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-3">
                            <span className="text-foreground font-code w-10">{pred}%</span>
                            <div className="w-28 bg-muted h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pred >= 90 ? "bg-emerald-500" : pred >= 80 ? "bg-primary" : "bg-destructive"}`}
                                style={{ width: `${pred}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className={`py-4 px-3 font-code ${(sq.rollup?.overdueIssues ?? 0) > 0 ? "text-rose-500 font-bold" : "text-muted-foreground"}`}>
                          {sq.rollup?.overdueIssues ?? 0}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 px-3 text-muted-foreground">{loadError ? `Não foi possível carregar as squads: ${loadError}` : "Nenhuma squad encontrada."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Clima do time e participação nos rituais por squad ainda não aparecem aqui. Para o clima, use o Health Check de cada squad.
        </p>
      </WidgetCard>

      <CustomJqlPanelsSection />
    </div>
  );
}
