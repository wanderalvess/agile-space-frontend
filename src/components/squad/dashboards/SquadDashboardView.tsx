"use client";

import React, { useState } from "react";
import { useUser } from "@/context/UserContext";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import {
  getAllowedDashboardTabs,
  getDashboardRouteForRole,
  isUserLeadershipOrAdmin,
} from "@/lib/dashboard-roles";
import { DashboardFilters, useProjectEstimationUnit } from "@/components/ui/DashboardFilters";
import { GaugeChart } from "@/components/ui/GaugeChart";
import { SimpleBarChart } from "@/components/ui/SimpleBarChart";
import { KPICard } from "@/components/ui/KPICard";
import { WidgetCard } from "@/components/ui/WidgetCard";
import { CustomJqlPanelsSection } from "./CustomJqlPanelsSection";
import {
  ListTodo,
  AlertTriangle,
  Bug,
  Code2,
  Users2,
  ShieldCheck,
  Smile,
  CheckCircle,
  XCircle,
  Cpu,
  ShieldAlert,
  AlertCircle,
  Layers,
  Code,
  TrendingUp,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

export function SquadDashboardView() {
  const { userProfile, isLeadership } = useUser();
  const { unit, unitLabel } = useProjectEstimationUnit();
  const {
    rollup,
    issues,
    members,
    myIssues,
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    loading,
  } = useSquadDashboardData();

  const isSuperUser = isLeadership || isUserLeadershipOrAdmin(userProfile?.role);
  const defaultTabId = getDashboardRouteForRole(userProfile?.role).replace(
    "/squad/dashboards/",
    ""
  );

  const [activeTab, setActiveTab] = useState<string>(defaultTabId || "member");

  const allowedTabs = getAllowedDashboardTabs(userProfile?.role, isSuperUser);

  const total = rollup?.totalIssues || issues.length || 0;
  const done =
    rollup?.doneIssues ||
    issues.filter((i) => i.status?.toLowerCase().includes("done")).length ||
    0;
  const inProgress =
    rollup?.inProgressIssues ||
    issues.filter((i) => i.status?.toLowerCase().includes("progress")).length ||
    0;
  const bugs =
    rollup?.bugIssues ||
    issues.filter((i) => i.type?.toLowerCase() === "bug").length ||
    0;

  // 1. DADOS DEV / QA / UX (Membro)
  const totalMyTasks = myIssues.length;
  const doneMyTasks = myIssues.filter(
    (i) =>
      i.status?.toLowerCase().includes("done") ||
      i.status?.toLowerCase().includes("concluído")
  ).length;
  const myBugs = myIssues.filter((i) => i.type?.toLowerCase() === "bug").length;
  const myProgressPercent =
    totalMyTasks > 0
      ? Math.round((doneMyTasks / totalMyTasks) * 100)
      : total > 0
      ? Math.round((done / total) * 100)
      : 0;

  const statusCounts = new Map<string, number>();
  (myIssues.length > 0 ? myIssues : issues.slice(0, 10)).forEach((iss) => {
    const st = iss.status || "To Do";
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
  });
  const taskDistributionData = Array.from(statusCounts.entries()).map(
    ([name, value]) => ({ name, value })
  );
  const displayTasks = (myIssues.length > 0 ? myIssues : issues).slice(0, 6);

  // 2. DADOS PO
  const poSayDoRate = total > 0 ? Math.round((done / total) * 100) : 85;
  const poTypeCounts = new Map<string, number>();
  issues.forEach((i) => {
    const t = i.type || "Story";
    poTypeCounts.set(t, (poTypeCounts.get(t) || 0) + 1);
  });
  const poIssueTypeData = Array.from(poTypeCounts.entries()).map(([name, value]) => ({
    name,
    value,
  }));
  const pendingIssues = issues
    .filter(
      (i) =>
        !i.status?.toLowerCase().includes("done") &&
        !i.status?.toLowerCase().includes("concluído")
    )
    .slice(0, 5);

  // 3. DADOS TECH LEAD
  const featuresCount =
    issues.filter(
      (i) => i.type?.toLowerCase() !== "bug" && !i.title?.toLowerCase().includes("debt")
    ).length || 1;
  const techDebtCount =
    issues.filter(
      (i) =>
        i.title?.toLowerCase().includes("debt") ||
        i.title?.toLowerCase().includes("refactor")
    ).length || 0;
  const effortData = [
    { name: "Features", value: featuresCount, color: "hsl(var(--primary))" },
    { name: "Bugs", value: bugs, color: "hsl(var(--destructive))" },
    { name: "Tech Debt", value: Math.max(1, techDebtCount), color: "hsl(var(--muted-foreground))" },
  ];

  // 4. DADOS PEOPLE LEAD
  const workloadData = members.map((m) => {
    const assigned = issues.filter(
      (iss) =>
        iss.assigneeId === m.jiraAccountId ||
        (m.displayName &&
          iss.assigneeName?.toLowerCase().includes(m.displayName.toLowerCase()))
    );
    return {
      name: m.displayName || m.jiraAccountId,
      jiraHours: assigned.length * 8 || 8,
      capacity: (m.capacityHoursPerDay || 8) * 5,
    };
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Top Banner do Dashboard */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary/10 text-primary font-bold text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {userProfile?.role || "Membro da Squad"}
            </span>
            <span className="text-xs text-slate-400 font-mono">Visão Analítica</span>
          </div>
          <h2 className="text-lg md:text-xl font-black italic tracking-tight text-slate-900 dark:text-white uppercase font-headline">
            Dashboards por Cargo & Governança
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Métricas em tempo real integradas com o Jira para acompanhamento e tomada de decisão.
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

      {/* Sub-Abas internas (mostra apenas as abas que o usuário tem acesso) */}
      {allowedTabs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
          {allowedTabs.map((tab) => {
            const tabKey = tab.href.replace("/squad/dashboards/", "");
            const isActive = activeTab === tabKey;
            const isJql = tab.id === "custom";

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tabKey)}
                className={cn(
                  "rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                    : "bg-white/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                )}
              >
                {isJql && <Code2 className="h-3.5 w-3.5" />}
                {tab.label}
              </button>
            );
          })}

          {isSuperUser && (
            <span className="ml-auto hidden md:inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/10 text-primary border border-primary/20">
              Visão Liderança
            </span>
          )}
        </div>
      )}

      {/* ─── VISÃO 1: DEV / QA / UX (Membro) ─── */}
      {activeTab === "member" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GaugeChart
            title="MEU PROGRESSO NA SPRINT"
            value={myProgressPercent}
            description={`${doneMyTasks} de ${totalMyTasks || displayTasks.length} tarefas concluídas`}
          />
          <SimpleBarChart
            title="MINHAS TAREFAS POR STATUS"
            data={taskDistributionData.length > 0 ? taskDistributionData : [{ name: "Sem itens", value: 0 }]}
            defaultColor="hsl(var(--primary))"
          />
          <KPICard
            title="BUGS & IMPEDIMENTOS ATIVOS"
            value={myBugs}
            icon={<Bug className="h-5 w-5 text-destructive" />}
            subtitle={myBugs > 0 ? `${myBugs} bug(s) vinculados a você.` : "Nenhum bug bloqueando suas entregas."}
          />
          <WidgetCard title="MINHAS TAREFAS NA SPRINT (JIRA)" className="md:col-span-2">
            <div className="flex flex-col gap-2.5 mt-1">
              {displayTasks.length > 0 ? (
                displayTasks.map((t) => (
                  <div
                    key={t.jiraKey}
                    className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40"
                  >
                    <div className="flex flex-col gap-0.5 max-w-[70%]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{t.jiraKey}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{t.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Tipo: {t.type || "Story"} | Responsável: {t.assigneeName || userProfile?.name || "Não atribuído"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20">
                      {t.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <ListTodo className="h-6 w-6 text-slate-400 opacity-50" />
                  <span>Nenhuma tarefa atribuída encontrada na sprint atual.</span>
                </div>
              )}
            </div>
          </WidgetCard>
          <WidgetCard title="RITUAIS DA SQUAD">
            <div className="flex flex-col gap-3">
              <div className="bg-slate-50/80 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Daily Stand-up</span>
                  <span className="text-[10px] text-slate-400">Diariamente às 09:30</span>
                </div>
                <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">Ativo</span>
              </div>
              <div className="bg-slate-50/80 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Scrum Poker - Refinamento</span>
                  <span className="text-[10px] text-slate-400">Quarta às 14:00</span>
                </div>
                <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg">Pendente</span>
              </div>
            </div>
          </WidgetCard>
        </div>
      )}

      {/* ─── VISÃO 2: PRODUCT OWNER ─── */}
      {activeTab === "product-owner" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GaugeChart
            title="SAY / DO RATIO (ENTREGA DE ESCOPO)"
            value={poSayDoRate}
            description={`Concluídos: ${done} de ${total} itens planejados na sprint.`}
          />
          <SimpleBarChart
            title="COMPOSIÇÃO DO ESCOPO POR TIPO"
            data={poIssueTypeData.length > 0 ? poIssueTypeData : [{ name: "Story", value: 0 }]}
            defaultColor="hsl(var(--primary))"
          />
          <KPICard
            title="ITENS EM PROGRESSO NA SPRINT"
            value={inProgress}
            icon={<ListTodo className="h-5 w-5 text-primary" />}
            subtitle={`Total na sprint: ${total}. Concluídas: ${done}.`}
          />
          <WidgetCard title="ITENS PENDENTES (RISCO DE CARRY-OVER)">
            <div className="flex flex-col gap-2 mt-1">
              {pendingIssues.map((iss) => (
                <div key={iss.jiraKey} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2 text-xs">
                  <span className="font-mono font-bold text-primary shrink-0 mr-2">{iss.jiraKey}</span>
                  <span className="text-slate-800 dark:text-slate-200 truncate font-medium flex-1">{iss.title}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md ml-2">{iss.status}</span>
                </div>
              ))}
            </div>
          </WidgetCard>
        </div>
      )}

      {/* ─── VISÃO 3: AGILE MASTER ─── */}
      {activeTab === "agile-master" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GaugeChart
            title="VAZÃO E CONCLUSÃO DA SPRINT"
            value={total > 0 ? Math.round((done / total) * 100) : 0}
            description={`${done} de ${total} histórias/itens concluídos na sprint.`}
          />
          <KPICard
            title="BUGS & BLOQUEIOS NA SPRINT"
            value={bugs}
            icon={<AlertCircle className="h-5 w-5 text-destructive" />}
            subtitle={bugs > 0 ? `${bugs} bug(s) reportados.` : "Nenhum bloqueio crítico ativo."}
          />
        </div>
      )}

      {/* ─── VISÃO 4: TECH LEAD ─── */}
      {activeTab === "tech-lead" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WidgetCard title="DISTRIBUIÇÃO DE ESFORÇO TÉCNICO">
            <div className="h-52 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={effortData} cx="50%" cy="50%" outerRadius={75} innerRadius={38} dataKey="value" stroke="none">
                    {effortData.map((e, idx) => (
                      <Cell key={idx} fill={e.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-around border-t border-slate-100 dark:border-slate-800/60 pt-3 text-[11px] font-bold">
              <span className="text-primary">Features ({featuresCount})</span>
              <span className="text-destructive">Bugs ({bugs})</span>
              <span className="text-slate-500 dark:text-slate-400">Tech Debt ({techDebtCount})</span>
            </div>
          </WidgetCard>
          <KPICard
            title="BUGS EM ABERTO"
            value={bugs}
            icon={<ShieldAlert className="h-5 w-5 text-destructive" />}
            subtitle="Qualidade técnica e estabilidade da release."
          />
        </div>
      )}

      {/* ─── VISÃO 5: PEOPLE LEAD ─── */}
      {activeTab === "people-lead" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WidgetCard title="CARGA DE TRABALHO VS. CAPACIDADE">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Bar dataKey="jiraHours" name="Horas Alocadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="capacity" name="Capacidade" fill="#22C55E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>
          <KPICard
            title="TOTAL DE MEMBROS ATIVOS"
            value={members.length}
            icon={<Users2 className="h-5 w-5 text-primary" />}
            subtitle="Membros registrados na squad atual."
          />
        </div>
      )}

      {/* ─── VISÃO 6: TRIBE LEVEL ─── */}
      {activeTab === "tribe-level" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="VELOCIDADE MÉDIA"
            value="415 SP"
            subtitle="Média ponderada por sprint da tribo."
            icon={<TrendingUp className="h-5 w-5 text-indigo-500" />}
          />
          <KPICard
            title="PREVISIBILIDADE"
            value="91%"
            subtitle="Histórico de Say/Do Ratio agregado."
            trend="up"
            trendValue="+4%"
            icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
          />
          <KPICard
            title="SAÚDE DO CLIMA"
            value="4.4"
            subtitle="Radar Health Check médio das squads."
            icon={<Smile className="h-5 w-5 text-emerald-500" />}
          />
          <KPICard
            title="RITUAIS EM DIA"
            value="95%"
            subtitle="Aderência às cerimônias ágeis contínuas."
            icon={<CheckCircle className="h-5 w-5 text-primary" />}
          />
        </div>
      )}

      {/* ─── SEÇÃO DE PAINÉIS JQL (CUSTOM) ─── */}
      {activeTab === "custom" && (
        <CustomJqlPanelsSection />
      )}
    </div>
  );
}
