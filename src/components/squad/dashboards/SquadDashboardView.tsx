"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useUser } from "@/context/UserContext";
import { useSquadDashboardData } from "@/hooks/useSquadDashboardData";
import {
  getAllowedDashboardTabs,
  getDashboardRouteForRole,
  isUserLeadershipOrAdmin,
} from "@/lib/dashboard-roles";
import { SquadRituals } from "@/components/squad/SquadRituals";
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
import { DashboardDataNotice, NoDataWidget } from "@/components/squad/dashboards/DashboardDataNotice";
import { isAssignedTo, isBugIssue, isDoneIssue, isInProgressIssue, percentOf } from "@/lib/squad-metrics";
import { statusLabelPt } from "@/lib/jira-status";

export function SquadDashboardView() {
  const { userProfile, isLeadership } = useUser();
  const { unit, unitLabel } = useProjectEstimationUnit();
  const {
    hasSquad,
    error,
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

  // ?? (e não ||): rollup com 0 itens é um 0 de verdade. Categoria do Jira, não texto do status.
  const total = rollup?.totalIssues ?? issues.length;
  const done = rollup?.doneIssues ?? issues.filter(isDoneIssue).length;
  const inProgress = rollup?.inProgressIssues ?? issues.filter(isInProgressIssue).length;
  const bugs = rollup?.bugIssues ?? issues.filter(isBugIssue).length;
  const hasData = !!rollup || issues.length > 0;
  const doneRate = percentOf(done, total);

  // 1. DADOS DEV / QA / UX (Membro) — só as tarefas da própria pessoa (nunca as do time no lugar das dela)
  const totalMyTasks = myIssues.length;
  const doneMyTasks = myIssues.filter(isDoneIssue).length;
  const myBugs = myIssues.filter((i) => isBugIssue(i) && !isDoneIssue(i)).length;
  const myProgressPercent = percentOf(doneMyTasks, totalMyTasks);

  const statusCounts = new Map<string, number>();
  myIssues.forEach((iss) => {
    const st = statusLabelPt(iss.status);
    statusCounts.set(st, (statusCounts.get(st) || 0) + 1);
  });
  const taskDistributionData = Array.from(statusCounts.entries()).map(
    ([name, value]) => ({ name, value })
  );
  const displayTasks = myIssues.slice(0, 6);

  // 2. DADOS PO
  const poSayDoRate = doneRate;
  const poTypeCounts = new Map<string, number>();
  issues.forEach((i) => {
    const t = i.type || "Sem tipo";
    poTypeCounts.set(t, (poTypeCounts.get(t) || 0) + 1);
  });
  const poIssueTypeData = Array.from(poTypeCounts.entries()).map(([name, value]) => ({
    name,
    value,
  }));
  const pendingIssues = issues.filter((i) => !isDoneIssue(i)).slice(0, 5);

  // 3. DADOS TECH LEAD
  const isTechDebt = (i: { title?: string }) => /debt|refactor|débito/i.test(i.title || "");
  const featuresCount = issues.filter((i) => !isBugIssue(i) && !isTechDebt(i)).length;
  const techDebtCount = issues.filter(isTechDebt).length;
  const effortData = [
    { name: "Funcionalidades", value: featuresCount, color: "hsl(var(--primary))" },
    { name: "Bugs", value: bugs, color: "hsl(var(--destructive))" },
    { name: "Débito técnico", value: techDebtCount, color: "hsl(var(--muted-foreground))" },
  ];

  // 4. DADOS PEOPLE LEAD
  const workloadData = members.map((m) => {
    // id do Jira ou nome completo igual (antes "contém": "Ana" pegava as tarefas de "Mariana")
    const assigned = issues.filter((iss) => isAssignedTo(iss, m));
    return {
      name: m.displayName || m.jiraAccountId,
      // Horas estimadas no Jira; sem estimativa fica 0 (antes: 8 h por tarefa e 8 h "de piso").
      jiraHours: Math.round(assigned.reduce((acc, iss) => acc + (iss.estimateSec || 0), 0) / 3600),
      capacity: m.capacityHoursPerDay ? m.capacityHoursPerDay * 5 : 0,
    };
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <DashboardDataNotice hasSquad={hasSquad} loading={loading} error={error} hasData={hasData} />

      {/* Top Banner do Dashboard */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 p-5 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary/10 text-primary font-semibold text-xs px-2.5 py-0.5 rounded-full">
              {userProfile?.role || "Membro da squad"}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-headline">
            Meu painel
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Os números da sprint que importam para o seu papel, vindos do Jira. Use as abas para ver o painel de outros papéis.
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
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
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
              Visão de liderança
            </span>
          )}
        </div>
      )}

      {/* ─── VISÃO 1: DEV / QA / UX (Membro) ─── */}
      {activeTab === "member" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {myProgressPercent === null ? (
            <NoDataWidget title="Meu progresso na sprint" message={hasData ? "Nenhuma tarefa está atribuída a você nesta sprint." : "Sem dados desta squad ainda."} />
          ) : (
            <GaugeChart
              title="Meu progresso na sprint"
              value={myProgressPercent}
              description={`${doneMyTasks} de ${totalMyTasks} tarefas concluídas`}
            />
          )}
          {taskDistributionData.length > 0 ? (
            <SimpleBarChart
              title="Minhas tarefas por status"
              data={taskDistributionData}
              defaultColor="hsl(var(--primary))"
            />
          ) : (
            <NoDataWidget title="Minhas tarefas por status" message="Sem tarefas suas nesta sprint." />
          )}
          <KPICard
            title="Bugs e impedimentos em aberto"
            value={totalMyTasks > 0 ? myBugs : "—"}
            icon={<Bug className="h-5 w-5 text-destructive" />}
            subtitle={totalMyTasks === 0 ? "Sem tarefas suas nesta sprint." : myBugs > 0 ? `${myBugs} bug(s) seus aguardando resolução.` : "Nenhum bug seu em aberto."}
          />
          <WidgetCard title="Minhas tarefas na sprint (Jira)" className="md:col-span-2">
            <div className="flex flex-col gap-2.5 mt-1">
              {displayTasks.length > 0 ? (
                displayTasks.map((t) => (
                  <div
                    key={t.jiraKey}
                    className="flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/40"
                  >
                    <div className="flex flex-col gap-0.5 max-w-[70%]">
                      <div className="flex items-center gap-2">
                        <span className="font-code text-xs font-bold text-primary">{t.jiraKey}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{t.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Tipo: {t.type || "Sem tipo"} | Responsável: {t.assigneeName || "Não atribuído"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20">
                      {statusLabelPt(t.status)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <ListTodo className="h-6 w-6 text-slate-400 opacity-50" />
                  <span>{hasData ? "Nenhuma tarefa está atribuída a você nesta sprint." : "Sem dados desta squad ainda."}</span>
                </div>
              )}
            </div>
          </WidgetCard>
          <WidgetCard title="Rituais da squad">
            <SquadRituals />
          </WidgetCard>
        </div>
      )}

      {/* ─── VISÃO 2: PRODUCT OWNER ─── */}
      {activeTab === "product-owner" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {poSayDoRate === null ? (
            <NoDataWidget title="Entrega do escopo combinado (Say/Do)" message="Ainda não há itens na sprint para medir a entrega." />
          ) : (
            <GaugeChart
              title="Entrega do escopo combinado (Say/Do)"
              value={poSayDoRate}
              description={`Concluídos: ${done} de ${total} itens da sprint.`}
            />
          )}
          {poIssueTypeData.length > 0 ? (
            <SimpleBarChart
              title="Escopo por tipo de issue"
              data={poIssueTypeData}
              defaultColor="hsl(var(--primary))"
            />
          ) : (
            <NoDataWidget title="Escopo por tipo de issue" />
          )}
          <KPICard
            title="Itens em andamento na sprint"
            value={hasData ? inProgress : "—"}
            icon={<ListTodo className="h-5 w-5 text-primary" />}
            subtitle={hasData ? `Total na sprint: ${total}. Concluídas: ${done}.` : "Sem dados desta squad ainda."}
          />
          <WidgetCard title="Itens pendentes (podem passar para a próxima sprint)">
            <div className="flex flex-col gap-2 mt-1">
              {pendingIssues.map((iss) => (
                <div key={iss.jiraKey} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2 text-xs">
                  <span className="font-code font-bold text-primary shrink-0 mr-2">{iss.jiraKey}</span>
                  <span className="text-slate-800 dark:text-slate-200 truncate font-medium flex-1">{iss.title || "Título ainda não sincronizado"}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md ml-2">{statusLabelPt(iss.status)}</span>
                </div>
              ))}
            </div>
          </WidgetCard>
        </div>
      )}

      {/* ─── VISÃO 3: AGILE MASTER ─── */}
      {activeTab === "agile-master" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {doneRate === null ? (
            <NoDataWidget title="Itens entregues na sprint" message="Ainda não há itens na sprint." />
          ) : (
            <GaugeChart
              title="Itens entregues na sprint"
              value={doneRate}
              description={`${done} de ${total} histórias/itens concluídos na sprint.`}
            />
          )}
          <KPICard
            title="Bugs na sprint"
            value={hasData ? bugs : "—"}
            icon={<AlertCircle className="h-5 w-5 text-destructive" />}
            subtitle={!hasData ? "Sem dados desta squad ainda." : bugs > 0 ? `${bugs} bug(s) reportados.` : "Nenhum bug na sprint."}
          />
        </div>
      )}

      {/* ─── VISÃO 4: TECH LEAD ─── */}
      {activeTab === "tech-lead" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WidgetCard title="Onde o esforço técnico está">
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
              <span className="text-primary">Funcionalidades ({featuresCount})</span>
              <span className="text-destructive">Bugs ({bugs})</span>
              <span className="text-slate-500 dark:text-slate-400" title="Contado pelas palavras debt, refactor ou débito no título da issue">Débito técnico ({techDebtCount})</span>
            </div>
          </WidgetCard>
          <KPICard
            title="Bugs na sprint"
            value={hasData ? bugs : "—"}
            icon={<ShieldAlert className="h-5 w-5 text-destructive" />}
            subtitle={hasData ? "Qualidade técnica e estabilidade da release." : "Sem dados desta squad ainda."}
          />
        </div>
      )}

      {/* ─── VISÃO 5: PEOPLE LEAD ─── */}
      {activeTab === "people-lead" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WidgetCard title="Carga de trabalho e capacidade">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Bar dataKey="jiraHours" name="Horas estimadas no Jira" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="capacity" name="Capacidade da semana" fill="#22C55E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </WidgetCard>
          <KPICard
            title="Pessoas ativas no time"
            value={members.length}
            icon={<Users2 className="h-5 w-5 text-primary" />}
            subtitle="Membros registrados na squad atual."
          />
        </div>
      )}

      {/* ─── VISÃO 6: TRIBE LEVEL ─── */}
      {activeTab === "tribe-level" && (
        <WidgetCard title="Visão da tribo">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              A comparação entre as squads, com previsibilidade e itens atrasados de cada uma, fica no painel da tribo.
            </p>
            <Link href="/squad/dashboards/tribe-level" className="self-start font-semibold text-primary hover:underline">
              Abrir o painel da tribo
            </Link>
          </div>
        </WidgetCard>
      )}

      {/* ─── SEÇÃO DE PAINÉIS JQL (CUSTOM) ─── */}
      {activeTab === "custom" && (
        <CustomJqlPanelsSection />
      )}
    </div>
  );
}
