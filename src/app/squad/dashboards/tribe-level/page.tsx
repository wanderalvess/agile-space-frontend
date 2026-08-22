"use client";

import React, { useState, useEffect } from "react";
import { DashboardFilters } from "@/components/squad/dashboards/DashboardFilters";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { WidgetCard } from "@/components/squad/dashboards/WidgetCard";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import { projectService, ProjectDetail } from "@/services/projectService";
import { Smile, CheckCircle, XCircle, Layers, TrendingUp, ShieldCheck } from "lucide-react";

export default function TribeLevelDashboard() {
  const {
    rollup,
    issues,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
  } = useSquadDashboardData();

  const [projects, setProjects] = useState<ProjectDetail[]>([]);

  useEffect(() => {
    projectService.getAllProjects().then(setProjects).catch(() => {});
  }, []);

  const total = rollup?.totalIssues || issues.length || 0;
  const done = rollup?.doneIssues || issues.filter((i) => i.status?.toLowerCase().includes("done")).length || 0;
  const predictabilityRate = total > 0 ? Math.round((done / total) * 100) : 100;

  const squadMatrix = projects.length > 0
    ? projects.map((p) => ({
        name: p.name && p.name !== p.id ? `${p.id} - ${p.name}` : `Squad ${p.id}`,
        velocity: `${(p.devTeamSize || 1) * 25} SP`,
        predictability: predictabilityRate,
        climate: "4.8/5",
        rituals: [true, true, true, true],
      }))
    : [
        {
          name: "Squad Ativa",
          velocity: `${total > 0 ? total * 3 : 0} SP`,
          predictability: predictabilityRate,
          climate: "5.0/5",
          rituals: [true, true, true, true],
        },
      ];

  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

      {/* Top Banner & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Visão Executiva Multi-Squad
            </span>
            <h1 className="text-xl md:text-2xl font-black italic tracking-wider text-foreground uppercase font-headline">
              PAINEL DA TRIBO MULTI-SQUAD
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Visão consolidada da tribo: previsibilidade de entregas, rituais e maturidade das squads.
          </p>
        </div>

        <DashboardFilters
          filters={[
            {
              label: "Sprint",
              placeholder: "Selecione a Sprint",
              options: sprintOptions,
              value: selectedSprint,
              onChange: setSelectedSprint,
            },
          ]}
        />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Velocidade Média da Tribo</span>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-2xl font-black text-foreground font-headline">415 SP / Sprint</span>
            <span className="text-xs font-bold text-emerald-500">(+6%)</span>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Previsibilidade Média</span>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-2xl font-black text-foreground font-headline">{predictabilityRate}%</span>
            <span className="text-xs font-bold text-muted-foreground">(Meta: 90%)</span>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Saúde do Clima (NPS)</span>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-2xl font-black text-emerald-500 font-headline">4.4 / 5.0</span>
            <span className="text-xs font-bold text-emerald-500">(Excelente)</span>
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col justify-between shadow-lg">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Conformidade de Rituais</span>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-2xl font-black text-primary font-headline">95%</span>
            <span className="text-xs font-bold text-emerald-500">(Em Dia)</span>
          </div>
        </div>
      </div>

      {/* Matriz Comparativa Multi-Squad */}
      <WidgetCard title="MATRIZ COMPARATIVA MULTI-SQUAD">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                <th className="pb-3 px-3">Squad</th>
                <th className="pb-3 px-3">Velocidade</th>
                <th className="pb-3 px-3">Previsibilidade</th>
                <th className="pb-3 px-3">Saúde do Clima</th>
                <th className="pb-3 px-3">Rituais (Daily, Poker, Retro, Showcase)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {squadMatrix.map((sq, i) => (
                <tr key={i} className="hover:bg-muted/40 transition-colors">
                  <td className="py-4 px-3 font-bold text-foreground">{sq.name}</td>
                  <td className="py-4 px-3 text-muted-foreground font-mono">{sq.velocity}</td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-3">
                      <span className="text-foreground font-mono w-8">{sq.predictability}%</span>
                      <div className="w-28 bg-muted h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sq.predictability >= 90
                              ? "bg-emerald-500"
                              : sq.predictability >= 80
                              ? "bg-primary"
                              : "bg-destructive"
                          }`}
                          style={{ width: `${sq.predictability}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-foreground font-bold flex items-center gap-1.5">
                    <Smile className="h-4 w-4 text-emerald-500" />
                    {sq.climate}
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-2">
                      {sq.rituals.map((r, idx) =>
                        r ? (
                          <CheckCircle key={idx} className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle key={idx} className="h-4 w-4 text-destructive" />
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      <CustomJqlPanelsSection />
    </div>
  );
}
