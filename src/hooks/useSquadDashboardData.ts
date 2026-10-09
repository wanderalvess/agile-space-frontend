"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@/context/UserContext";
import { squadApi } from "@/app/squad/api";
import { projectService } from "@/services/projectService";
import { isAssignedTo, isBugIssue, isDoneIssue, isInProgressIssue, issuesOfSprint } from "@/lib/squad-metrics";
import type {
  SquadMetricsRollup,
  SquadIssueSnapshot,
  SquadMember,
} from "@/lib/types";

export interface SquadDashboardData {
  squadId: string;
  /** false quando a pessoa ainda não está em nenhuma squad: os painéis dizem isso em vez de mostrar zeros. */
  hasSquad: boolean;
  loading: boolean;
  error: string | null;
  rollup: SquadMetricsRollup | null;
  issues: SquadIssueSnapshot[];
  members: SquadMember[];
  myIssues: SquadIssueSnapshot[];
  sprintName: string;
  sprintOptions: { label: string; value: string }[];
  selectedSprint: string;
  setSelectedSprint: (sprint: string) => void;
  refresh: () => Promise<void>;
}

const UNMAPPED = "UNMAPPED";

/** Placar calculado das issues da sprint, para sprint sem rollup gravado (usa a categoria do Jira, não o texto do status). */
function rollupFromIssues(squadId: string, sprintId: string, sprintName: string, issues: SquadIssueSnapshot[]): SquadMetricsRollup {
  return {
    squadId,
    sprintId,
    sprintName,
    totalIssues: issues.length,
    doneIssues: issues.filter(isDoneIssue).length,
    inProgressIssues: issues.filter(isInProgressIssue).length,
    bugIssues: issues.filter(isBugIssue).length,
  } as SquadMetricsRollup;
}

export function useSquadDashboardData(): SquadDashboardData {
  const { userProfile } = useUser();
  const rawSquadId = userProfile?.squadId || "";
  const hasSquad = !!rawSquadId && rawSquadId !== "Sem Time";
  const squadId = hasSquad ? rawSquadId : "";

  const [loading, setLoading] = useState<boolean>(hasSquad);
  const [error, setError] = useState<string | null>(null);
  const [rawRollup, setRawRollup] = useState<SquadMetricsRollup | null>(null);
  const [allIssues, setAllIssues] = useState<SquadIssueSnapshot[]>([]);
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<string>("current");
  const [pastRollup, setPastRollup] = useState<{ sprintId: string; rollup: SquadMetricsRollup | null } | null>(null);

  const fetchData = useCallback(async () => {
    if (!squadId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Sem Promise.all que engole tudo: se as issues falharem (sem permissão, servidor fora), a tela diz isso
    // em vez de mostrar uma squad "vazia".
    const [rollupRes, issuesRes, membersRes] = await Promise.allSettled([
      squadApi.getRollup(squadId),
      squadApi.getIssues(squadId),
      squadApi.getMembers(squadId),
    ]);

    if (issuesRes.status === "rejected") {
      setError(issuesRes.reason?.message || "Não foi possível carregar os dados da squad agora.");
    }
    setRawRollup(rollupRes.status === "fulfilled" ? rollupRes.value : null);
    setAllIssues(issuesRes.status === "fulfilled" && Array.isArray(issuesRes.value) ? issuesRes.value : []);

    let teamMembers: SquadMember[] = membersRes.status === "fulfilled" && Array.isArray(membersRes.value) ? membersRes.value : [];
    // Sem pessoas sincronizadas do Jira, usa o cadastro do projeto (mesma fonte do Painel) para os dashboards
    // não dizerem "0 pessoas" de um time que existe.
    if (teamMembers.length === 0) {
      const detail = await projectService.getProjectByKey(squadId).catch(() => null);
      teamMembers = (detail?.members || []).map((m) => ({
        dbId: m.id || `${squadId}_${m.email || m.displayName}`,
        squadId,
        jiraAccountId: m.jiraAccountId || m.email || m.displayName,
        displayName: m.displayName,
        email: m.email,
        role: m.roleName,
      }));
    }
    setMembers(teamMembers);
    setLoading(false);
  }, [squadId]);

  useEffect(() => {
    // Troca de squad: zera a sprint escolhida e o que sobrou da squad anterior.
    setSelectedSprint("current");
    setPastRollup(null);
    setRawRollup(null);
    setAllIssues([]);
    setMembers([]);
    fetchData();
  }, [fetchData]);

  const currentSprintId = rawRollup?.sprintId && rawRollup.sprintId !== UNMAPPED ? rawRollup.sprintId : "";
  const isCurrentSelected = !selectedSprint || selectedSprint === "current" || (!!currentSprintId && selectedSprint === currentSprintId);

  // Lista de sprints a partir das issues (a sprint "ainda sem sprint" do Jira não entra)
  const sprintOptions = useMemo(() => {
    const sprintMap = new Map<string, string>();
    allIssues.forEach((iss) => {
      if (iss.sprintName && iss.sprintId && iss.sprintId !== UNMAPPED) {
        sprintMap.set(iss.sprintId, iss.sprintName);
      }
    });

    const options: { label: string; value: string }[] = [];
    if (rawRollup?.sprintName) {
      options.push({ label: `${rawRollup.sprintName} (Atual)`, value: currentSprintId || "current" });
    } else {
      options.push({ label: "Sprint atual", value: "current" });
    }

    sprintMap.forEach((name, id) => {
      if (!options.some((opt) => opt.value === id)) {
        options.push({ label: name, value: id });
      }
    });

    return options;
  }, [allIssues, rawRollup, currentSprintId]);

  // Sprint escolhida que não é a atual: busca o placar gravado dela no servidor.
  useEffect(() => {
    if (!squadId || isCurrentSelected) return;
    let alive = true;
    squadApi.getRollup(squadId, selectedSprint)
      .then((r) => alive && setPastRollup({ sprintId: selectedSprint, rollup: r }))
      .catch(() => alive && setPastRollup({ sprintId: selectedSprint, rollup: null }));
    return () => { alive = false; };
  }, [squadId, selectedSprint, isCurrentSelected]);

  // Issues da sprint em foco. Antes "atual" trazia as issues de TODAS as sprints da squad.
  const activeIssues = useMemo(() => {
    const sprintId = isCurrentSelected ? currentSprintId : selectedSprint;
    return sprintId ? issuesOfSprint(allIssues, sprintId) : allIssues;
  }, [allIssues, isCurrentSelected, currentSprintId, selectedSprint]);

  const activeRollup = useMemo<SquadMetricsRollup | null>(() => {
    if (isCurrentSelected) return rawRollup;
    const label = sprintOptions.find((o) => o.value === selectedSprint)?.label || selectedSprint;
    if (pastRollup && pastRollup.sprintId === selectedSprint && pastRollup.rollup) return pastRollup.rollup;
    // Ainda carregando o placar gravado, ou a sprint não tem um: calcula das issues (sem copiar o da sprint atual por cima).
    return activeIssues.length > 0 ? rollupFromIssues(squadId, selectedSprint, label, activeIssues) : null;
  }, [isCurrentSelected, rawRollup, pastRollup, selectedSprint, sprintOptions, activeIssues, squadId]);

  // Issues da própria pessoa: id do Jira ou nome completo igual (nunca "contém").
  const myIssues = useMemo(
    () => activeIssues.filter((issue) => isAssignedTo(issue, { jiraAccountId: userProfile?.jiraAccountId, name: userProfile?.name })),
    [activeIssues, userProfile?.jiraAccountId, userProfile?.name],
  );

  return {
    squadId,
    hasSquad,
    loading,
    error,
    rollup: activeRollup,
    issues: activeIssues,
    members,
    myIssues,
    sprintName: activeRollup?.sprintName || "Sprint atual",
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    refresh: fetchData,
  };
}
