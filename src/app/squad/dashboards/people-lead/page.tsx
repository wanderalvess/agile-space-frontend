"use client";

import React from "react";
import { DashboardFilters } from "@/components/squad/dashboards/DashboardFilters";
import { DashboardNavTabs } from "@/components/squad/dashboards/DashboardNavTabs";
import { WidgetCard } from "@/components/squad/dashboards/WidgetCard";
import { KPICard } from "@/components/squad/dashboards/KPICard";
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
    const estimatedHours = taskCount * 8; // aproximação de esforço

    return {
      name: m.displayName || m.jiraAccountId,
      jiraHours: estimatedHours || 8,
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
            <span className="bg-primary/15 text-primary font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Gestão de Pessoas & Capacidade
            </span>
            <h1 className="text-xl md:text-2xl font-black italic tracking-wider text-foreground uppercase font-headline">
              PEOPLE LEAD MANAGEMENT DASHBOARD
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Capacidade nominal da squad, equilíbrio de distribuição de tarefas e bem-estar do time.
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
        <WidgetCard title="CARGA DE TRABALHO VS. CAPACIDADE" className="lg:col-span-2">
          <p className="text-[11px] text-muted-foreground mb-4">
            Comparação entre esforço alocado em tarefas do Jira e capacidade nominal semanal.
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData.length > 0 ? workloadData : [{ name: "Sem membros", jiraHours: 0, capacity: 40 }]}>
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
                <Bar dataKey="jiraHours" name="Horas Alocadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="capacity" name="Capacidade Semanal" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </WidgetCard>

        {/* Resumo de Membros */}
        <div className="flex flex-col gap-6">
          <KPICard
            title="TOTAL DE MEMBROS ATIVOS"
            value={members.length}
            icon={<Users2 className="h-5 w-5 text-primary" />}
            subtitle="Membros registrados na squad atual."
          />

          <WidgetCard title="DISTRIBUIÇÃO DE PAPÉIS NA SQUAD">
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
