"use client";

import React from "react";
import { GaugeChart } from "@/components/ui/GaugeChart";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { KPICard } from "@/components/ui/KPICard";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { DashboardFilters, useProjectEstimationUnit } from "@/components/ui/DashboardFilters";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import { ListTodo, AlertTriangle, Layers, Target, CheckCircle2 } from "lucide-react";

export default function ProductOwnerDashboard() {
  const { unit, unitLabel } = useProjectEstimationUnit();
  const {
    rollup,
    issues,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    loading,
  } = useSquadDashboardData();

  const total = rollup?.totalIssues || issues.length || 0;
  const done = rollup?.doneIssues || issues.filter((i) => i.status?.toLowerCase().includes("done")).length || 0;
  const inProgress = rollup?.inProgressIssues || issues.filter((i) => i.status?.toLowerCase().includes("progress")).length || 0;
  const bugs = rollup?.bugIssues || issues.filter((i) => i.type?.toLowerCase() === "bug").length || 0;

  const sayDoRate = total > 0 ? Math.round((done / total) * 100) : 80;

  // Breakdown por tipo de issue real do Jira
  const typeCounts = new Map<string, number>();
  issues.forEach((i) => {
    const t = i.type || "Story";
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
  });

  const issueTypeData = Array.from(typeCounts.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  // Itens em aberto ou com risco de carry-over
  const pendingIssues = issues.filter(
    (i) => !i.status?.toLowerCase().includes("done") && !i.status?.toLowerCase().includes("concluído")
  ).slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

      {/* Top Banner & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Gestão de Produto & Valor
            </span>
            <h1 className="text-xl md:text-2xl font-black italic tracking-wider text-foreground uppercase font-headline">
              PRODUCT OWNER AGILE DASHBOARD
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Entregas de escopo, rácio Say/Do e saúde do backlog em <strong className="text-primary font-bold">{unitLabel}</strong>.
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

      {/* Grid de Widgets com Dados Reais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GaugeChart
          title="SAY / DO RATIO (ENTREGA DE ESCOPO)"
          value={sayDoRate}
          description={`Concluídos: ${done} de ${total} itens planejados na sprint atual.`}
        />

        <SimpleBarChart
          title="COMPOSIÇÃO DO ESCOPO POR TIPO (JIRA)"
          data={issueTypeData.length > 0 ? issueTypeData : [{ name: "Story", value: 0 }]}
          defaultColor="hsl(var(--primary))"
        />

        <KPICard
          title="ITENS EM PROGRESSO / BACKLOG DA SPRINT"
          value={inProgress}
          icon={<ListTodo className="h-5 w-5 text-primary" />}
          subtitle={`Total de Histórias na Sprint: ${total}. Concluídas: ${done}.`}
        />

        <WidgetCard
          title="ITENS PENDENTES (RISCO DE CARRY-OVER)"
          headerIcon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
        >
          <div className="flex flex-col gap-2.5 mt-1">
            {pendingIssues.length > 0 ? (
              pendingIssues.map((iss) => (
                <div
                  key={iss.jiraKey}
                  className="flex items-center justify-between border-b border-border/60 pb-2.5 text-xs"
                >
                  <div className="flex items-center gap-2 truncate max-w-[75%]">
                    <span className="font-mono font-bold text-primary shrink-0">{iss.jiraKey}</span>
                    <span className="text-foreground truncate font-medium">{iss.title}</span>
                  </div>
                  <span className="text-muted-foreground text-[11px] font-medium bg-muted px-2 py-0.5 rounded-md shrink-0">
                    {iss.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nenhum item pendente com risco de carry-over.
              </div>
            )}
          </div>
        </WidgetCard>
      </div>

      {/* Seção de Painéis Personalizados por JQL */}
      <CustomJqlPanelsSection />
    </div>
  );
}
