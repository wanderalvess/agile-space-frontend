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
import { isDoneStatus, statusLabelPt } from "@/lib/jira-status";
import { ListTodo, AlertTriangle, Layers, Target, CheckCircle2 } from "lucide-react";

export default function ProductOwnerDashboard() {
  const { unitLabel, isConfigured } = useProjectEstimationUnit();
  const {
    rollup,
    issues,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    loading,
  } = useSquadDashboardData();

  const total = rollup?.totalIssues || issues.length || 0;
  const done = rollup?.doneIssues || issues.filter((i) => isDoneStatus(i.status)).length || 0;
  const inProgress = rollup?.inProgressIssues || issues.filter((i) => i.status?.toLowerCase().includes("progress")).length || 0;
  const bugs = rollup?.bugIssues || issues.filter((i) => i.type?.toLowerCase() === "bug").length || 0;

  const sayDoRate = total > 0 ? Math.round((done / total) * 100) : 0;

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
  const pendingIssues = issues.filter((i) => !isDoneStatus(i.status)).slice(0, 5);
  const toDo = Math.max(0, total - done - inProgress);

  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

      {/* Top Banner & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary font-semibold text-xs px-2.5 py-0.5 rounded-full">
              Produto e valor
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-headline">
              Painel do Product Owner
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Quanto do escopo combinado foi entregue (Say/Do) e como está o backlog{isConfigured ? <>, em <strong className="text-primary font-bold">{unitLabel}</strong></> : ""}.
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
          title="Entrega do escopo combinado (Say/Do)"
          value={sayDoRate}
          description={`Concluídos: ${done} de ${total} itens planejados na sprint atual.`}
        />

        <SimpleBarChart
          title="Escopo por tipo de issue (Jira)"
          data={issueTypeData.length > 0 ? issueTypeData : [{ name: "Story", value: 0 }]}
          defaultColor="hsl(var(--primary))"
        />

        <KPICard
          title="Itens em andamento"
          value={inProgress}
          icon={<ListTodo className="h-5 w-5 text-primary" />}
          subtitle={`${toDo} a fazer e ${done} concluídos, de ${total} itens na sprint.`}
        />

        <WidgetCard
          title="Itens pendentes (podem passar para a próxima sprint)"
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
                    <span className="font-code font-bold text-primary shrink-0">{iss.jiraKey}</span>
                    {iss.title ? (
                      <span className="text-foreground truncate font-medium">{iss.title}</span>
                    ) : (
                      <span className="text-muted-foreground truncate italic">Título ainda não sincronizado</span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-[11px] font-medium bg-muted px-2 py-0.5 rounded-md shrink-0">
                    {statusLabelPt(iss.status)}
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
