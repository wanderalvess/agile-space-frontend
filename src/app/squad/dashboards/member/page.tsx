"use client";

import React, { useState } from "react";
import { DashboardFilters } from "@/components/ui/DashboardFilters";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { GaugeChart } from "@/components/ui/GaugeChart";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { KPICard } from "@/components/ui/KPICard";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import { useUser } from "@/context/UserContext";
import { CheckCircle2, Clock, Bug, Code, Sparkles, Layers, ListTodo } from "lucide-react";

export default function TeamMemberDashboard() {
  const { userProfile } = useUser();
  const {
    myIssues,
    issues: allIssues,
    rollup,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    loading,
  } = useSquadDashboardData();

  const userRole = userProfile?.role || "Desenvolvedor";

  // Calcular progresso real das tarefas do usuário
  const totalMyTasks = myIssues.length;
  const doneMyTasks = myIssues.filter(
    (i) => i.status?.toLowerCase() === "done" || i.status?.toLowerCase() === "concluído"
  ).length;
  const myBugs = myIssues.filter((i) => i.type?.toLowerCase() === "bug").length;

  const progressPercent =
    totalMyTasks > 0 ? Math.round((doneMyTasks / totalMyTasks) * 100) : rollup ? Math.round(((rollup.doneIssues || 0) / Math.max(1, rollup.totalIssues || 1)) * 100) : 0;

  // Worklogs ou distribuição de status das minhas tarefas
  const statusCounts = new Map<string, number>();
  (myIssues.length > 0 ? myIssues : allIssues.slice(0, 10)).forEach((iss) => {
    const st = iss.status || "To Do";
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
  });

  const taskDistributionData = Array.from(statusCounts.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  const displayTasks = (myIssues.length > 0 ? myIssues : allIssues).slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

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
        <GaugeChart
          title="MEU PROGRESSO NA SPRINT"
          value={progressPercent}
          description={`${doneMyTasks} de ${totalMyTasks || displayTasks.length} tarefas concluídas`}
        />

        {/* Distribuição por Status */}
        <SimpleBarChart
          title="MINHAS TAREFAS POR STATUS"
          data={taskDistributionData.length > 0 ? taskDistributionData : [{ name: "Sem itens", value: 0 }]}
          defaultColor="hsl(var(--primary))"
        />

        {/* Bugs & Retrabalho */}
        <KPICard
          title="BUGS & IMPEDIMENTOS ATIVOS"
          value={myBugs}
          icon={<Bug className="h-5 w-5 text-destructive" />}
          subtitle={myBugs > 0 ? `${myBugs} bug(s) vinculados a você aguardando resolução.` : "Nenhum bug crítico bloqueando suas entregas."}
        />

        {/* Minhas Tarefas Ativas do Jira */}
        <WidgetCard title="MINHAS TAREFAS NA SPRINT (JIRA)" className="md:col-span-2">
          <div className="flex flex-col gap-2.5 mt-1">
            {displayTasks.length > 0 ? (
              displayTasks.map((t) => (
                <div
                  key={t.jiraKey}
                  className="flex items-center justify-between bg-muted/40 hover:bg-muted/70 transition-colors p-3 rounded-xl border border-border"
                >
                  <div className="flex flex-col gap-0.5 max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{t.jiraKey}</span>
                      <span className="text-xs font-bold text-foreground truncate">{t.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Tipo: {t.type || "Story"} | Responsável: {t.assigneeName || userProfile?.name || "Não atribuído"}
                    </span>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-3 py-1 rounded-lg border ${
                      t.status?.toLowerCase().includes("done") || t.status?.toLowerCase().includes("concluído")
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        : t.status?.toLowerCase().includes("progress") || t.status?.toLowerCase().includes("andamento")
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
                <ListTodo className="h-6 w-6 text-muted-foreground opacity-50" />
                <span>Nenhuma tarefa atribuída encontrada na sprint atual.</span>
              </div>
            )}
          </div>
        </WidgetCard>

        {/* Próximos Rituais e Cerimônias */}
        <WidgetCard title="RITUAIS DA SQUAD">
          <div className="flex flex-col gap-3">
            <div className="bg-muted/40 p-3 rounded-xl border border-border flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">Daily Stand-up</span>
                <span className="text-[10px] text-muted-foreground">Diariamente às 09:30</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">Ativo</span>
            </div>

            <div className="bg-muted/40 p-3 rounded-xl border border-border flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">Scrum Poker - Refinamento</span>
                <span className="text-[10px] text-muted-foreground">Quarta às 14:00</span>
              </div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">Pendente</span>
            </div>

            <div className="bg-muted/40 p-3 rounded-xl border border-border flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground">Sprint Retro & Showcase</span>
                <span className="text-[10px] text-muted-foreground">Fim da Sprint</span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">Agendado</span>
            </div>
          </div>
        </WidgetCard>
      </div>

      <CustomJqlPanelsSection />
    </div>
  );
}
