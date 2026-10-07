"use client";

import React from "react";
import { DashboardFilters } from "@/components/ui/DashboardFilters";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { KPICard } from "@/components/ui/KPICard";
import { CustomJqlPanelsSection } from "@/components/squad/dashboards/CustomJqlPanelsSection";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import { Users2, Heart, ShieldCheck, UserCheck, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function PeopleLeadDashboard() {
  const {
    members,
    issues,
    rollup,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
  } = useSquadDashboardData();

  // Calcular carga real de cada membro com base nas issues da squad
  const workloadData = members.map((m) => {
    const assignedIssues = issues.filter(
      (iss) =>
        iss.assigneeId === m.jiraAccountId ||
        (m.displayName && iss.assigneeName?.toLowerCase().includes(m.displayName.toLowerCase()))
    );

    const taskCount = assignedIssues.length;
    const capacity = (m.capacityHoursPerDay || 8) * 5; // capacidade semanal padrão
    // Horas estimadas no Jira para as tarefas da pessoa; sem estimativa fica 0 (antes: 8 h por tarefa e 8 h "de piso").
    const estimatedHours = Math.round(assignedIssues.reduce((acc, iss) => acc + (iss.estimateSec || 0), 0) / 3600);

    return {
      name: m.displayName || m.jiraAccountId,
      jiraHours: estimatedHours,
      capacity: capacity,
      role: m.role || "Membro",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Abas com controle de acesso por Cargo */}
      <DashboardNavTabs />

      {/* Top Banner & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/15 text-primary font-semibold text-xs px-2.5 py-0.5 rounded-full">
              Pessoas e capacidade
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-headline">
              Painel do People Lead
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5">
            Quantas pessoas há no time, que papel cada uma tem e como a carga de tarefas se compara à capacidade semanal.
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

      {/* Grid de Métricas de Pessoas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equilíbrio de Carga Nominal */}
        <WidgetCard title="Carga de trabalho e capacidade" className="lg:col-span-2">
          <p className="text-[11px] text-muted-foreground mb-4">
            Horas estimadas no Jira para as tarefas de cada pessoa, ao lado da capacidade da semana (horas por dia × 5). Tarefas sem estimativa no Jira não entram na conta.
          </p>
          {workloadData.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma pessoa no time ainda. Cadastre as pessoas em Pessoas do time.</p>
          )}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData.length > 0 ? workloadData : []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "10px",
                    color: "hsl(var(--card-foreground))",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="jiraHours" name="Horas estimadas no Jira" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="capacity" name="Capacidade da semana" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>

        {/* Resumo de Membros */}
        <div className="flex flex-col gap-6">
          <KPICard
            title="Pessoas ativas no time"
            value={members.length}
            icon={<Users2 className="h-5 w-5 text-primary" />}
            subtitle="Membros registrados na squad atual."
          />

          <WidgetCard title="Papéis do time">
            <div className="flex flex-col gap-2 mt-1">
              {members.slice(0, 5).map((m) => (
                <div
                  key={m.jiraAccountId}
                  className="flex items-center justify-between border-b border-border/60 pb-2 text-xs"
                >
                  <span className="text-foreground font-medium truncate max-w-[60%]">
                    {m.displayName || m.jiraAccountId}
                  </span>
                  <span className="text-primary font-bold text-[10px] bg-primary/10 px-2 py-0.5 rounded-full">
                    {m.role || "Membro"}
                  </span>
                </div>
              ))}
            </div>
          </WidgetCard>
        </div>
      </div>

      <CustomJqlPanelsSection />
    </div>
  );
}
