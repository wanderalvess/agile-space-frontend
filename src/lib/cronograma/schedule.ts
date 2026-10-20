/**
 * Monta o modelo do Cronograma: histórias com suas fases, a data usada em cada barra (Jira, aproximada ou
 * sugestão pelas horas), o atraso (detectado ou simulado) e a cascata. Puro: sem React, sem `new Date()` em laço.
 */
import type { SquadWorkflowPhase } from '@/lib/types';
import { cascadeStory } from './cascade';
import {
  businessDaysBetween, nowPt, ptNum, stampEndPt, stampStartPt, todayDay, type Pt,
} from './dates';
import { resolveWorkflowPhase, type WorkflowPhase } from './phases';
import { inferSlip, type SlipReason } from './slip';
import {
  hoursForSuggestion, suggestSchedule, type ResolvedCapacityFn, type Suggestion, type SuggestTask,
} from './suggest';
import {
  computeParentProgress, computeTaskProgress, hasRealDates, isDone, isInProgress, personKeyOf, type CronoTask,
} from './task';

export type DateOrigin = 'jira' | 'aproximada' | 'sugestao' | 'nenhuma';
/** Fonte escolhida pela pessoa: datas do Jira ou sugestão pelas horas. */
export type DateSource = 'jira' | 'horas';

export interface Span { start: Pt; end: Pt }

export interface TaskSlip {
  own: number;
  pushed: number;
  shift: number;
  reason: SlipReason;
  confidence: 'observed' | 'presumed';
  manual: boolean;
}

export interface PlannedTask {
  task: CronoTask;
  phase: WorkflowPhase;
  progress: number;
  origin: DateOrigin;
  suggestion: Suggestion | null;
  capacity: { hours: number; source: 'pessoa' | 'squad' | 'padrao' };
  planned: Span | null;
  effective: Span | null;
  slip: TaskSlip;
}

export interface StoryModel {
  key: string;
  title: string;
  /** A issue pai, ou null quando ela está fora da sprint. */
  story: CronoTask | null;
  tasks: PlannedTask[];
  planned: Span | null;
  effective: Span | null;
  origin: DateOrigin;
  /** Dias úteis que o fim da história passa do planejado. */
  delayDays: number;
  progress: number;
  doneCount: number;
}

export interface StoryGroup {
  key: string;
  story: CronoTask | null;
  title: string;
  children: CronoTask[];
}

export interface BuildContext {
  phases?: SquadWorkflowPhase[];
  nowMs: number;
  source: DateSource;
  sprintStartDay?: number | null;
  capacityOf: ResolvedCapacityFn;
}

export interface Simulation { key: string; days: number }

/** Agrupa as issues em histórias (issue sem pai) e subtarefas. Pai fora da sprint vira história virtual. */
export function groupStories(tasks: CronoTask[]): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();
  for (const t of tasks) {
    if (!t.parentKey) groups.set(t.key, { key: t.key, story: t, title: t.title, children: [] });
  }
  for (const t of tasks) {
    if (!t.parentKey) continue;
    let g = groups.get(t.parentKey);
    if (!g) {
      g = { key: t.parentKey, story: null, title: t.parentTitle || 'Issue pai fora desta sprint', children: [] };
      groups.set(t.parentKey, g);
    }
    g.children.push(t);
  }
  return [...groups.values()];
}

/** Sugestão pelas horas para todas as subtarefas da sprint (as filas por pessoa atravessam as histórias). */
export function computeSuggestions(groups: StoryGroup[], ctx: BuildContext): Map<string, Suggestion> {
  const list: SuggestTask[] = [];
  for (const g of groups) {
    for (const t of g.children) {
      const phase = resolveWorkflowPhase(t, ctx.phases);
      const done = isDone(t);
      const inProgress = isInProgress(t);
      let doneEnd: Pt | null = null;
      if (done) {
        const e = hasRealDates(t) ? t.end : t.resolvedAt;
        doneEnd = e ? stampEndPt(e) : null;
      }
      list.push({
        key: t.key,
        storyKey: g.key,
        order: phase.order,
        tie: t.orderIndex,
        person: personKeyOf(t),
        hours: hoursForSuggestion({ inProgress, estimateSec: t.estimateSec, remainingSec: t.remainingSec }),
        inProgress,
        done,
        doneEnd,
      });
    }
  }
  const caps = new Map<string, number>();
  for (const g of groups) for (const t of g.children) {
    const p = personKeyOf(t);
    if (p && !caps.has(p)) caps.set(p, ctx.capacityOf(t.assigneeId, t.assigneeName).hours);
  }
  return suggestSchedule(list, {
    now: nowPt(ctx.nowMs),
    sprintStartDay: ctx.sprintStartDay,
    capacityOf: (p) => (p ? caps.get(p) : undefined) ?? ctx.capacityOf('', '').hours,
  });
}

function spanOfStamps(t: CronoTask): Span | null {
  const a = t.start ?? t.end;
  const b = t.end ?? t.start;
  if (!a || !b) return null;
  let start = stampStartPt(a);
  let end = stampEndPt(b);
  if (ptNum(end) < ptNum(start)) end = { day: start.day, frac: 1 };
  return { start, end };
}

function envelope(spans: Span[]): Span | null {
  if (spans.length === 0) return null;
  let start = spans[0].start;
  let end = spans[0].end;
  for (const s of spans) {
    if (ptNum(s.start) < ptNum(start)) start = s.start;
    if (ptNum(s.end) > ptNum(end)) end = s.end;
  }
  return { start, end };
}

export function buildStory(
  g: StoryGroup,
  ctx: BuildContext,
  suggestions: Map<string, Suggestion>,
  sim?: Simulation | null,
): StoryModel {
  const today = todayDay(ctx.nowMs);
  const rows: PlannedTask[] = g.children.map((task) => {
    const phase = resolveWorkflowPhase(task, ctx.phases);
    const suggestion = suggestions.get(task.key) ?? null;
    const capacity = ctx.capacityOf(task.assigneeId, task.assigneeName);
    const real = hasRealDates(task);
    const approx = task.start || task.end ? spanOfStamps(task) : null;
    let origin: DateOrigin = 'nenhuma';
    let planned: Span | null = null;
    if (suggestion && !isDone(task) && (ctx.source === 'horas' || (!real && !approx))) {
      origin = 'sugestao';
      planned = { start: suggestion.start, end: suggestion.end };
    } else if (real) {
      origin = 'jira';
      planned = spanOfStamps(task);
    } else if (approx) {
      origin = 'aproximada';
      planned = approx;
    }
    const manual = !!sim && sim.key === task.key && sim.days > 0;
    const auto = origin === 'jira' ? inferSlip(task, today, capacity.hours) : null;
    return {
      task, phase, progress: computeTaskProgress(task), origin, suggestion, capacity, planned, effective: planned,
      slip: {
        own: manual ? sim!.days : auto?.days ?? 0,
        pushed: 0,
        shift: 0,
        reason: manual ? 'none' : auto?.reason ?? 'none',
        confidence: manual ? 'observed' : auto?.confidence ?? 'observed',
        manual,
      },
    };
  });

  rows.sort((a, b) => a.phase.order - b.phase.order || a.task.orderIndex - b.task.orderIndex);

  const casc = cascadeStory(
    rows.filter((r) => r.planned).map((r) => ({
      key: r.task.key, order: r.phase.order, tie: r.task.orderIndex, start: r.planned!.start, end: r.planned!.end, ownSlip: r.slip.own,
    })),
  );
  for (const r of rows) {
    const c = casc.get(r.task.key);
    if (!c) continue;
    r.effective = { start: c.start, end: c.end };
    r.slip.pushed = c.pushed;
    r.slip.shift = c.shift;
  }

  const plannedSpans = rows.filter((r) => r.planned).map((r) => r.planned!);
  const effectiveSpans = rows.filter((r) => r.effective).map((r) => r.effective!);
  let planned = envelope(plannedSpans);
  let effective = envelope(effectiveSpans);
  let origin: DateOrigin = rows.find((r) => r.planned)?.origin ?? 'nenhuma';
  if (!planned && g.story) {
    const own = spanOfStamps(g.story);
    planned = own;
    effective = own;
    if (own) origin = hasRealDates(g.story) ? 'jira' : 'aproximada';
  }
  const delayDays = planned && effective && ptNum(effective.end) > ptNum(planned.end)
    ? Math.max(0, businessDaysBetween(planned.end.day, effective.end.day))
    : 0;

  const parentLike = g.story ?? { status: '', statusCategory: 'unknown' as const };
  return {
    key: g.key,
    title: g.title,
    story: g.story,
    tasks: rows,
    planned,
    effective,
    origin,
    delayDays,
    progress: computeParentProgress(parentLike, g.children),
    doneCount: g.children.filter(isDone).length,
  };
}

export function buildModel(tasks: CronoTask[], ctx: BuildContext, sim?: Simulation | null): StoryModel[] {
  const groups = groupStories(tasks);
  const suggestions = computeSuggestions(groups, ctx);
  return groups.map((g) => buildStory(g, ctx, suggestions, sim));
}

export interface Kpis {
  phases: number;
  done: number;
  inProgress: number;
  delayed: number;
  /** Maior fim previsto entre fases com data confiável (Jira ou sugestão); null se não houver. */
  forecastEnd: Pt | null;
}

export function computeKpis(stories: StoryModel[]): Kpis {
  let phases = 0, done = 0, inProgress = 0, delayed = 0;
  let forecastEnd: Pt | null = null;
  for (const s of stories) {
    for (const r of s.tasks) {
      phases += 1;
      if (isDone(r.task)) done += 1;
      else if (isInProgress(r.task)) inProgress += 1;
      if (r.slip.shift > 0) delayed += 1;
      if (r.effective && (r.origin === 'jira' || r.origin === 'sugestao') && (!forecastEnd || ptNum(r.effective.end) > ptNum(forecastEnd))) {
        forecastEnd = r.effective.end;
      }
    }
  }
  return { phases, done, inProgress, delayed, forecastEnd };
}

/** Mostrar a faixa "datas aproximadas": alguma subtarefa visível sem datas reais do Jira. */
export function inferredSubtasks(tasks: Pick<CronoTask, 'parentKey' | 'datesAreInferred'>[]): { inferred: number; total: number } {
  let inferred = 0, total = 0;
  for (const t of tasks) {
    if (!t.parentKey) continue;
    total += 1;
    if (t.datesAreInferred !== false) inferred += 1;
  }
  return { inferred, total };
}
