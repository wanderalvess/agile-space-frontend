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
import { statusLabelPt } from "@/lib/jira-status";
import { DashboardDataNotice, NoDataWidget } from "@/components/squad/dashboards/DashboardDataNotice";
import { isBugIssue, isDoneIssue, isInProgressIssue, percentOf } from "@/lib/squad-metrics";
import { ListTodo, AlertTriangle, Layers, Target, CheckCircle2 } from "lucide-react";

export default function ProductOwnerDashboard() {
  const { unitLabel, isConfigured } = useProjectEstimationUnit();
  const {
    hasSquad,
    error,
    rollup,
    issues,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    loading,
  } = useSquadDashboardData();

  // ?? (e não ||): rollup com 0 itens é um 0 de verdade, não "sem rollup".
  const total = rollup?.totalIssues ?? issues.length;
  const done = rollup?.doneIssues ?? issues.filter(isDoneIssue).length;
  const inProgress = rollup?.inProgressIssues ?? issues.filter(isInProgressIssue).length;
  const hasData = !!rollup || issues.length > 0;

  // null = ainda não há escopo (o gauge vira "sem dados" em vez de 0%)
  const sayDoRate = percentOf(done, total);

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
  const pendingIssues = issues.filter((i) => !isDoneIssue(i)).slice(0, 5);
  const toDo = Math.max(0, total - done - inProgress);

  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

      <DashboardDataNotice hasSquad={hasSquad} loading={loading} error={error} hasData={hasData} />

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
        {sayDoRate === null ? (
          <NoDataWidget title="Entrega do escopo combinado (Say/Do)" message="Ainda não há itens na sprint para medir a entrega." />
        ) : (
          <GaugeChart
            title="Entrega do escopo combinado (Say/Do)"
            value={sayDoRate}
            description={`Concluídos: ${done} de ${total} itens da sprint (inclui o que entrou depois do planejamento).`}
          />
        )}

        {issueTypeData.length > 0 ? (
          <SimpleBarChart
            title="Escopo por tipo de issue (Jira)"
            data={issueTypeData}
            defaultColor="hsl(var(--primary))"
          />
        ) : (
          <NoDataWidget title="Escopo por tipo de issue (Jira)" />
        )}

        <KPICard
          title="Itens em andamento"
          value={hasData ? inProgress : "—"}
          icon={<ListTodo className="h-5 w-5 text-primary" />}
          subtitle={hasData ? `${toDo} a fazer e ${done} concluídos, de ${total} itens na sprint.` : "Sem dados desta squad ainda."}
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
                {hasData ? "Nenhum item pendente com risco de carry-over." : "Sem dados desta squad ainda."}
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
