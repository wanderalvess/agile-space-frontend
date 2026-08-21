"use client";

import React from "react";
import { DashboardFilters } from "@/components/squad/dashboards/DashboardFilters";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { GaugeChart } from "@/components/squad/dashboards/GaugeChart";
import { KPICard } from "@/components/squad/dashboards/KPICard";
import { WidgetCard } from "@/components/squad/dashboards/WidgetCard";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import { ShieldCheck, CheckCircle2, Clock, Flame, AlertCircle } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function AgileMasterDashboard() {
  const {
    rollup,
    issues,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
  } = useSquadDashboardData();

  const total = rollup?.totalIssues || issues.length || 0;
  const done = rollup?.doneIssues || issues.filter((i) => i.status?.toLowerCase().includes("done")).length || 0;
  const inProgress = rollup?.inProgressIssues || issues.filter((i) => i.status?.toLowerCase().includes("progress")).length || 0;
  const bugs = rollup?.bugIssues || issues.filter((i) => i.type?.toLowerCase() === "bug").length || 0;

  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const statusDistribution = [
    { name: "Concluído", value: done, color: "#22C55E" },
    { name: "Em Andamento", value: inProgress, color: "hsl(var(--primary))" },
    { name: "A Fazer / Backlog", value: Math.max(0, total - done - inProgress), color: "hsl(var(--muted-foreground))" },
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
              Governança & Rituais
            </span>
            <h1 className="text-xl md:text-2xl font-black italic tracking-wider text-foreground uppercase font-headline">
              AGILE MASTER GOVERNANCE DASHBOARD
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Aderência a cerimônias ágeis, resolução de impedimentos e vazão da squad.
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

      {/* Grid de Métricas Ágeis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Saúde da Sprint / Conclusão */}
        <GaugeChart
          title="VAZÃO E CONCLUSÃO DA SPRINT"
          value={completionRate}
          description={`${done} de ${total} histórias/itens concluídos na sprint.`}
        />

        {/* Distribuição do Fluxo de Trabalho */}
        <WidgetCard title="STATUS DAS HISTÓRIAS (JIRA)">
          <div className="h-44 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "10px",
                    color: "hsl(var(--card-foreground))",
                    fontSize: "12px",
                  }}
                />
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={68}
                  dataKey="value"
                  stroke="none"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-extrabold text-foreground">{completionRate}%</span>
              <span className="text-[10px] text-muted-foreground">Entregue</span>
            </div>
          </div>
        </WidgetCard>

        {/* Impedimentos & Bugs */}
        <KPICard
          title="BUGS E IMPEDIMENTOS IDENTIFICADOS"
          value={bugs}
          icon={<AlertCircle className="h-5 w-5 text-destructive" />}
          subtitle={bugs > 0 ? `${bugs} bug(s) reportados na sprint atual.` : "Nenhum bloqueio ou bug crítico reportado."}
        />

        {/* Aderência a Planos de Ação e Retros */}
        <WidgetCard title="PLANO DE AÇÃO DAS RETROSPECTIVAS">
          <div className="flex flex-col gap-2.5 mt-1 text-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-foreground font-medium truncate max-w-[70%]">
                Reduzir tempo de alinhamento na Daily
              </span>
              <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md">
                Concluído
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-foreground font-medium truncate max-w-[70%]">
                Melhorar critérios de aceitação no Refinamento
              </span>
              <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md">
                Em Andamento
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-foreground font-medium truncate max-w-[70%]">
                Aumentar cobertura de testes automatizados
              </span>
              <span className="text-muted-foreground font-bold bg-muted px-2 py-0.5 rounded-md">
                Planejado
              </span>
            </div>
          </div>
        </WidgetCard>
      </div>

      <CustomJqlPanelsSection />
    </div>
  );
}
