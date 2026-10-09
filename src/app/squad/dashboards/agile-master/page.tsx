"use client";

import React from "react";
import Link from "next/link";
import { DashboardFilters } from "@/components/ui/DashboardFilters";
import { DashboardDataNotice, NoDataWidget } from "@/components/squad/dashboards/DashboardDataNotice";
import { isBugIssue, isDoneIssue, isInProgressIssue, percentOf } from "@/lib/squad-metrics";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { GaugeChart } from "@/components/ui/GaugeChart";
import { KPICard } from "@/components/ui/KPICard";
import { WidgetCard } from "@/components/ui/WidgetCard";
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
    hasSquad,
    loading,
    error,
    rollup,
    issues,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
  } = useSquadDashboardData();

  const total = rollup?.totalIssues ?? issues.length;
  const done = rollup?.doneIssues ?? issues.filter(isDoneIssue).length;
  const inProgress = rollup?.inProgressIssues ?? issues.filter(isInProgressIssue).length;
  const bugs = rollup?.bugIssues ?? issues.filter(isBugIssue).length;
  const hasData = !!rollup || issues.length > 0;

  // null = sem escopo ainda (mostra "sem dados" em vez de 0%)
  const completionRate = percentOf(done, total);

  const statusDistribution = [
    { name: "Concluído", value: done, color: "#22C55E" },
    { name: "Em Andamento", value: inProgress, color: "hsl(var(--primary))" },
    { name: "A Fazer / Backlog", value: Math.max(0, total - done - inProgress), color: "hsl(var(--muted-foreground))" },
  ];

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
              Rituais e fluxo
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-headline">
              Painel do Agile Master
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Andamento da sprint, bugs e impedimentos, e as ações combinadas nas retrospectivas.
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
        {completionRate === null ? (
          <NoDataWidget title="Itens entregues na sprint" message="Ainda não há itens na sprint." />
        ) : (
          <GaugeChart
            title="Itens entregues na sprint"
            value={completionRate}
            description={`${done} de ${total} histórias/itens concluídos na sprint.`}
          />
        )}

        {/* Distribuição do Fluxo de Trabalho */}
        <WidgetCard title="Status das histórias (Jira)">
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
              <span className="text-3xl font-extrabold text-foreground">{completionRate === null ? "—" : `${completionRate}%`}</span>
              <span className="text-[10px] text-muted-foreground">Entregue</span>
            </div>
          </div>
        </WidgetCard>

        {/* Impedimentos & Bugs */}
        <KPICard
          title="Bugs e impedimentos"
          value={hasData ? bugs : "—"}
          icon={<AlertCircle className="h-5 w-5 text-destructive" />}
          subtitle={!hasData ? "Sem dados desta squad ainda." : bugs > 0 ? `${bugs} ${bugs === 1 ? "bug reportado" : "bugs reportados"} na sprint.` : "Nenhum bug na sprint. (Impedimentos não são lidos do Jira por aqui.)"}
        />

        {/* Aderência a Planos de Ação e Retros */}
        <WidgetCard title="Plano de ação das retrospectivas">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              As ações combinadas nas retrospectivas ficam no Plano de ação, cada uma com responsável e prazo.
            </p>
            <Link href="/action-plan" className="self-start font-semibold text-primary hover:underline">Abrir o Plano de ação</Link>
          </div>
        </WidgetCard>
      </div>

      <CustomJqlPanelsSection />
    </div>
  );
}
