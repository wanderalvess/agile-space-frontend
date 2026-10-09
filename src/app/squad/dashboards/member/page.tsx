"use client";

import React, { useState } from "react";
import { DashboardFilters } from "@/components/ui/DashboardFilters";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { GaugeChart } from "@/components/ui/GaugeChart";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { KPICard } from "@/components/ui/KPICard";
import { SquadRituals } from "@/components/squad/SquadRituals";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import { useUser } from "@/context/UserContext";
import { DashboardDataNotice, NoDataWidget } from "@/components/squad/dashboards/DashboardDataNotice";
import { isBugIssue, isDoneIssue, isInProgressIssue, percentOf } from "@/lib/squad-metrics";
import { statusLabelPt } from "@/lib/jira-status";
import { CheckCircle2, Clock, Bug, Code, Sparkles, Layers, ListTodo } from "lucide-react";

export default function TeamMemberDashboard() {
  const { userProfile } = useUser();
  const {
    hasSquad,
    error,
    myIssues,
    issues: allIssues,
    rollup,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    loading,
  } = useSquadDashboardData();

  const userRole = userProfile?.role || "Desenvolvedor";
  const hasData = !!rollup || allIssues.length > 0;

  // Só as tarefas atribuídas a esta pessoa. Antes, sem tarefa própria, o painel mostrava as de TODO o time
  // (com o nome da pessoa como responsável) e o progresso da squad como se fosse o dela.
  const totalMyTasks = myIssues.length;
  const doneMyTasks = myIssues.filter(isDoneIssue).length;
  const myOpenBugs = myIssues.filter((i) => isBugIssue(i) && !isDoneIssue(i)).length;
  const progressPercent = percentOf(doneMyTasks, totalMyTasks);

  const statusCounts = new Map<string, number>();
  myIssues.forEach((iss) => {
    const st = statusLabelPt(iss.status);
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
  });
  const taskDistributionData = Array.from(statusCounts.entries()).map(([name, value]) => ({ name, value }));

  const displayTasks = myIssues.slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

      <DashboardDataNotice hasSquad={hasSquad} loading={loading} error={error} hasData={hasData} />

      {/* Top Banner & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Visão Operacional
            </span>
            <h1 className="text-xl md:text-2xl font-black italic tracking-wider text-foreground uppercase font-headline">
              MEU PAINEL DE EXECUÇÃO ({userRole})
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Minhas histórias da sprint, tarefas do Jira em andamento, impedimentos e rituais.
          </p>
        </div>

        <DashboardFilters
          filters={[
            {
              label: "Sprint Ativa",
              placeholder: "Selecione a Sprint",
              options: sprintOptions,
              value: selectedSprint,
              onChange: setSelectedSprint,
            },
          ]}
        />
      </div>

      {/* Grid de Widgets com Dados Reais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gauge: Meu Progresso */}
        {progressPercent === null ? (
          <NoDataWidget
            title="Meu progresso na sprint"
            message={hasData ? "Nenhuma tarefa está atribuída a você nesta sprint." : "Sem dados desta squad ainda."}
          />
        ) : (
          <GaugeChart
            title="Meu progresso na sprint"
            value={progressPercent}
            description={`${doneMyTasks} de ${totalMyTasks} tarefas concluídas`}
          />
        )}

        {/* Distribuição por Status */}
        {taskDistributionData.length > 0 ? (
          <SimpleBarChart
            title="Minhas tarefas por status"
            data={taskDistributionData}
            defaultColor="hsl(var(--primary))"
          />
        ) : (
          <NoDataWidget title="Minhas tarefas por status" message="Sem tarefas suas nesta sprint." />
        )}

        {/* Bugs & Retrabalho */}
        <KPICard
          title="Bugs e impedimentos em aberto"
          value={totalMyTasks > 0 ? myOpenBugs : "—"}
          icon={<Bug className="h-5 w-5 text-destructive" />}
          subtitle={totalMyTasks === 0 ? "Sem tarefas suas nesta sprint." : myOpenBugs > 0 ? `${myOpenBugs} ${myOpenBugs === 1 ? "bug seu está" : "bugs seus estão"} aguardando resolução.` : "Nenhum bug seu em aberto."}
        />

        {/* Minhas Tarefas Ativas do Jira */}
        <WidgetCard title="Minhas tarefas na sprint (Jira)" className="md:col-span-2">
          <div className="flex flex-col gap-2.5 mt-1">
            {displayTasks.length > 0 ? (
              displayTasks.map((t) => (
                <div
                  key={t.jiraKey}
                  className="flex items-center justify-between bg-muted/40 hover:bg-muted/70 transition-colors p-3 rounded-xl border border-border"
                >
                  <div className="flex flex-col gap-0.5 max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <span className="font-code text-xs font-bold text-primary">{t.jiraKey}</span>
                      <span className="text-xs font-bold text-foreground truncate">{t.title || "Título ainda não sincronizado"}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Tipo: {t.type || "Sem tipo"} | Responsável: {t.assigneeName || "Não atribuído"}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-3 py-1 rounded-lg border ${
                      isDoneIssue(t)
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        : isInProgressIssue(t)
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {statusLabelPt(t.status)}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                <ListTodo className="h-6 w-6 text-muted-foreground opacity-50" />
                <span>{hasData ? "Nenhuma tarefa está atribuída a você nesta sprint. Se esperava ver tarefas, confira se o seu nome na equipe bate com o do Jira." : "Sem dados desta squad ainda."}</span>
              </div>
            )}
          </div>
        </WidgetCard>

        {/* Próximos Rituais e Cerimônias */}
        <WidgetCard title="Rituais da squad">
          <SquadRituals />
        </WidgetCard>
      </div>

      <CustomJqlPanelsSection />
    </div>
  );
}
