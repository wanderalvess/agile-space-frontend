"use client";

import React from "react";
import { DashboardFilters } from "@/components/ui/DashboardFilters";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { KPICard } from "@/components/ui/KPICard";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import { Cpu, GitPullRequest, ShieldAlert, Bug, CheckCircle2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function TechLeadDashboard() {
  const {
    rollup,
    issues,
    members,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
  } = useSquadDashboardData();

  const total = rollup?.totalIssues || issues.length || 0;
  const bugs = rollup?.bugIssues || issues.filter((i) => i.type?.toLowerCase() === "bug").length || 0;
  const inProgress = rollup?.inProgressIssues || issues.filter((i) => i.status?.toLowerCase().includes("progress")).length || 0;

  // Distribuição de esforço baseada em tipos reais de issues
  const featuresCount = issues.filter((i) => i.type?.toLowerCase() !== "bug" && !i.title?.toLowerCase().includes("debt")).length || 1;
  const techDebtCount = issues.filter((i) => i.title?.toLowerCase().includes("debt") || i.title?.toLowerCase().includes("refactor")).length || 0;

  const effortData = [
    { name: "Features", value: featuresCount, color: "hsl(var(--primary))" },
    { name: "Bugs", value: bugs, color: "hsl(var(--destructive))" },
    { name: "Tech Debt", value: Math.max(1, techDebtCount), color: "hsl(var(--muted-foreground))" },
  ];

  // Contribuição por membro da Squad
  const memberCounts = new Map<string, number>();
  issues.forEach((iss) => {
    const name = iss.assigneeName || "Não Atribuído";
    memberCounts.set(name, (memberCounts.get(name) || 0) + 1);
  });

  const contributors = Array.from(memberCounts.entries())
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      score: `${count} tarefas`,
      percent: Math.min(100, Math.round((count / Math.max(1, total)) * 100)),
    }));

  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

      {/* Top Banner & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Engenharia & Qualidade
            </span>
            <h1 className="text-xl md:text-2xl font-black italic tracking-wider text-foreground uppercase font-headline">
              TECH LEAD ENGINEERING DASHBOARD
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Qualidade técnica do código, bugs em aberto, fluxo de Code Review e débitos técnicos.
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

      {/* Grid de Métricas de Engenharia */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Distribuição de Esforço */}
        <WidgetCard title="DISTRIBUIÇÃO DE ESFORÇO" className="lg:col-span-1">
          <div className="h-52 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={effortData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={38}
                  dataKey="value"
                  stroke="none"
                >
                  {effortData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-around border-t border-border/60 pt-3 text-[11px] font-bold">
            <span className="text-primary">Features ({featuresCount})</span>
            <span className="text-destructive">Bugs ({bugs})</span>
            <span className="text-muted-foreground">Tech Debt ({techDebtCount})</span>
          </div>
        </WidgetCard>

        {/* Fila de Code Review & Homologação */}
        <WidgetCard title="GARGALOS DO PIPELINE DE ENTREGA" className="lg:col-span-2">
          <div className="flex flex-col justify-center gap-4 h-full py-2">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 bg-muted/40 p-4 rounded-xl border border-border w-full">
                <span className="text-xs font-bold text-muted-foreground block mb-1">Code Review</span>
                <span className="text-lg font-black text-foreground">
                  {issues.filter((i) => i.status?.toLowerCase().includes("review")).length} Tarefas
                </span>
                <div className="mt-2 h-2 bg-primary/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-[60%]" />
                </div>
              </div>

              <span className="text-muted-foreground font-bold text-lg hidden sm:inline">➔</span>

              <div className="flex-1 bg-muted/40 p-4 rounded-xl border border-border w-full">
                <span className="text-xs font-bold text-muted-foreground block mb-1">QA Testing / Homologação</span>
                <span className="text-lg font-black text-foreground">
                  {issues.filter((i) => i.status?.toLowerCase().includes("qa") || i.status?.toLowerCase().includes("test")).length} Tarefas
                </span>
                <div className="mt-2 h-2 bg-primary/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-[80%]" />
                </div>
              </div>
            </div>
          </div>
        </WidgetCard>

        {/* Bug KPI */}
        <KPICard
          title="INCIDÊNCIA DE BUGS NA SPRINT"
          value={bugs}
          icon={<ShieldAlert className="h-5 w-5 text-destructive" />}
          subtitle={bugs > 0 ? `${bugs} bug(s) reportados na sprint atual.` : "Zero bugs críticos em aberto."}
        />

        {/* Carga por Desenvolvedor / Contribuição */}
        <WidgetCard title="CARGA DE TRABALHO POR MEMBRO" className="lg:col-span-2">
          <div className="flex flex-col gap-3">
            {contributors.length > 0 ? (
              contributors.map((c, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-foreground font-medium">{c.name}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">{c.score}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${c.percent}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nenhum membro com tarefas atribuídas na sprint atual.
              </div>
            )}
          </div>
        </WidgetCard>
      </div>

      <CustomJqlPanelsSection />
    </div>
  );
}
