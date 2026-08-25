"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  const squadId = userProfile?.squadId || "";

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rawRollup, setRawRollup] = useState<SquadMetricsRollup | null>(null);
  const [allIssues, setAllIssues] = useState<SquadIssueSnapshot[]>([]);
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

      setRawRollup(fetchedRollup);
      setAllIssues(Array.isArray(fetchedIssues) ? fetchedIssues : []);
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

  // Identificar lista de sprints a partir das issues
  const sprintOptions = useMemo(() => {
    const sprintMap = new Map<string, string>();
    allIssues.forEach((iss) => {
      if (iss.sprintName) {
        sprintMap.set(iss.sprintId || iss.sprintName, iss.sprintName);
      }
    });

    const options: { label: string; value: string }[] = [];
    if (rawRollup?.sprintName) {
      options.push({
        label: `${rawRollup.sprintName} (Atual)`,
        value: rawRollup.sprintId || "current",
      });
    } else {
      options.push({ label: "Sprint Atual", value: "current" });
    }

    sprintMap.forEach((name, id) => {
      if (!options.some((opt) => opt.value === id)) {
        options.push({ label: name, value: id });
      }
    });

    return options;
  }, [allIssues, rawRollup]);

  // Filtragem dinâmica de issues por Sprint selecionada
  const activeIssues = useMemo(() => {
    if (!selectedSprint || selectedSprint === "current" || (rawRollup?.sprintId && selectedSprint === rawRollup.sprintId)) {
      return allIssues;
    }
    return allIssues.filter(
      (iss) => iss.sprintId === selectedSprint || iss.sprintName === selectedSprint
    );
  }, [allIssues, selectedSprint, rawRollup?.sprintId]);

  // Rollup recalculado dinamicamente para a sprint ativa
  const activeRollup = useMemo(() => {
    if (!selectedSprint || selectedSprint === "current" || (rawRollup?.sprintId && selectedSprint === rawRollup.sprintId)) {
      return rawRollup;
    }
    const totalIssues = activeIssues.length;
    const doneIssues = activeIssues.filter((i) => i.status?.toLowerCase().includes("done") || i.status?.toLowerCase().includes("concluído")).length;
    const inProgressIssues = activeIssues.filter((i) => i.status?.toLowerCase().includes("progress")).length;
    const bugIssues = activeIssues.filter((i) => i.type?.toLowerCase() === "bug").length;
    const totalPoints = activeIssues.reduce((acc, i) => acc + ((i as any).storyPoints || 0), 0);
    const completedPoints = activeIssues
      .filter((i) => i.status?.toLowerCase().includes("done") || i.status?.toLowerCase().includes("concluído"))
      .reduce((acc, i) => acc + ((i as any).storyPoints || 0), 0);

    return {
      squadId,
      sprintId: selectedSprint,
      sprintName: sprintOptions.find((o) => o.value === selectedSprint)?.label || selectedSprint,
      totalIssues,
      doneIssues,
      inProgressIssues,
      bugIssues,
      totalPoints,
      completedPoints,
      lastSyncAt: (rawRollup as any)?.lastSyncAt || new Date().toISOString(),
      ...(rawRollup || {})
    } as any;
  }, [selectedSprint, rawRollup, activeIssues, squadId, sprintOptions]);

  // Filtrar issues atribuídas ao usuário logado (por nome, email ou jiraAccountId)
  const currentUserName = userProfile?.name?.toLowerCase().trim() || "";
  const currentUserEmail = userProfile?.email?.toLowerCase().trim() || "";
  const currentJiraId = userProfile?.jiraAccountId || "";

  const myIssues = useMemo(() => {
    return activeIssues.filter((issue) => {
      const assignee = (issue.assigneeName || "").toLowerCase().trim();
      const assigneeId = issue.assigneeId || "";
      if (currentJiraId && assigneeId === currentJiraId) return true;
      if (currentUserName && assignee.includes(currentUserName)) return true;
      if (currentUserEmail && assignee.includes(currentUserEmail.split("@")[0])) return true;
      return false;
    });
  }, [activeIssues, currentJiraId, currentUserName, currentUserEmail]);

  return {
    squadId,
    loading,
    error,
    rollup: activeRollup,
    issues: activeIssues,
    members,
    myIssues,
    sprintName: activeRollup?.sprintName || "Sprint Atual",
    sprintOptions,
    selectedSprint,
    setSelectedSprint,
    refresh: fetchData,
  };
}
