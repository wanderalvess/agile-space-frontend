'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SquadIssueSnapshot, SquadMember, SquadWorkflowPhase } from '@/lib/types';
import {
  buildStory, computeSuggestions, groupStories, type DateSource, type Simulation, type StoryModel,
} from '@/lib/cronograma/schedule';
import { buildCapacityResolver } from '@/lib/cronograma/suggest';
import { toCronoTask } from '@/lib/cronograma/task';

const REFRESH_MS = 5 * 60_000;

/** "Agora" que se renova sozinho a cada 5 minutos: a sugestão pelas horas acompanha o relógio sem recalcular a cada render. */
export function useNowMs(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

interface Input {
  issues: SquadIssueSnapshot[];
  phases?: SquadWorkflowPhase[];
  members: SquadMember[];
  squadDefaultHours?: number;
  source: DateSource;
  sprintStartDay: number | null;
  sprintEndDay: number | null;
  sim: Simulation | null;
  nowMs: number;
}

/**
 * Modelo do Cronograma com memoização por etapa: tarefas e histórias só mudam com as issues; a sugestão só com
 * horas/pessoas/relógio; a simulação recalcula UMA história, não a sprint inteira.
 */
export function useCronogramaModel({ issues, phases, members, squadDefaultHours, source, sprintStartDay, sprintEndDay, sim, nowMs }: Input) {
  const tasks = useMemo(() => issues.map(toCronoTask), [issues]);
  const groups = useMemo(() => groupStories(tasks), [tasks]);
  const capacityOf = useMemo(() => buildCapacityResolver(members, squadDefaultHours), [members, squadDefaultHours]);

  const suggestions = useMemo(
    () => computeSuggestions(groups, { phases, nowMs, source: 'jira', sprintStartDay, capacityOf }),
    [groups, phases, nowMs, sprintStartDay, capacityOf],
  );

  const base = useMemo<StoryModel[]>(
    () => groups.map((g) => buildStory(g, { phases, nowMs, source, sprintStartDay, sprintEndDay, capacityOf }, suggestions, null)),
    [groups, phases, nowMs, source, sprintStartDay, sprintEndDay, capacityOf, suggestions],
  );

  const simulated = useMemo<StoryModel | null>(() => {
    if (!sim || sim.days <= 0) return null;
    const g = groups.find((x) => x.children.some((c) => c.key === sim.key));
    return g ? buildStory(g, { phases, nowMs, source, sprintStartDay, sprintEndDay, capacityOf }, suggestions, sim) : null;
  }, [sim, groups, phases, nowMs, source, sprintStartDay, sprintEndDay, capacityOf, suggestions]);

  const stories = useMemo(
    () => (simulated ? base.map((s) => (s.key === simulated.key ? simulated : s)) : base),
    [base, simulated],
  );

  return { tasks, stories, capacityOf };
}
