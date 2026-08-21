"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/UserContext";
import { squadApi } from "@/app/squad/api";
import type {
  SquadMetricsRollup,
  SquadIssueSnapshot,
  SquadMember,
} from "@/lib/types";

export interface SquadDashboardData {
  squadId: string;
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

export function useSquadDashboardData(): SquadDashboardData {
  const { userProfile } = useUser();
  const squadId = userProfile?.squadId || "DDWMISSI";

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rollup, setRollup] = useState<SquadMetricsRollup | null>(null);
  const [issues, setIssues] = useState<SquadIssueSnapshot[]>([]);
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<string>("current");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Busca paralela de Rollup, Issues da Squad e Membros
      const [fetchedRollup, fetchedIssues, fetchedMembers] = await Promise.all([
        squadApi.getRollup(squadId).catch(() => null),
        squadApi.getIssues(squadId).catch(() => []),
        squadApi.getMembers(squadId).catch(() => []),
      ]);

      setRollup(fetchedRollup);
      setIssues(Array.isArray(fetchedIssues) ? fetchedIssues : []);
      setMembers(Array.isArray(fetchedMembers) ? fetchedMembers : []);
    } catch (err: any) {
      console.warn("Erro ao buscar dados reais do dashboard:", err);
      setError(err?.message || "Erro ao conectar com o serviço de métricas");
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtrar issues atribuídas ao usuário logado (por nome, email ou jiraAccountId)
  const currentUserName = userProfile?.name?.toLowerCase().trim() || "";
  const currentUserEmail = userProfile?.email?.toLowerCase().trim() || "";
  const currentJiraId = userProfile?.jiraAccountId || "";

  const myIssues = issues.filter((issue) => {
    const assignee = (issue.assigneeName || "").toLowerCase().trim();
    const assigneeId = issue.assigneeId || "";
    if (currentJiraId && assigneeId === currentJiraId) return true;
    if (currentUserName && assignee.includes(currentUserName)) return true;
    if (currentUserEmail && assignee.includes(currentUserEmail.split("@")[0])) return true;
    return false;
  });

  // Identificar lista de sprints a partir das issues
  const sprintMap = new Map<string, string>();
  issues.forEach((iss) => {
    if (iss.sprintName) {
      sprintMap.set(iss.sprintId || iss.sprintName, iss.sprintName);
    }
  });

  const sprintOptions: { label: string; value: string }[] = [];
  if (rollup?.sprintName) {
    sprintOptions.push({
      label: `${rollup.sprintName} (Atual)`,
      value: rollup.sprintId || "current",
    });
  } else {
    sprintOptions.push({ label: "Sprint Atual", value: "current" });
  }

  sprintMap.forEach((name, id) => {
    if (!sprintOptions.some((opt) => opt.value === id)) {
      sprintOptions.push({ label: name, value: id });
    }
  });

  return {
    squadId,
    loading,
    error,
    rollup,
    issues,
    members,
    myIssues,
    sprintName: rollup?.sprintName || "Sprint Atual",
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    refresh: fetchData,
  };
}
