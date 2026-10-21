/**
 * Filtros, período e linhas do Gantt: tudo o que a tela decide mostrar a partir do modelo já calculado.
 * Os filtros só escondem linhas; a cascata e a sugestão sempre são calculadas com a história inteira.
 */
import {
  dayFromYmd, parseDay, ptNum, shiftPt, todayDay, ymdOfDay, type Pt,
} from './dates';
import type { PlannedTask, StoryModel } from './schedule';
import { isDone, isInProgress, personKeyOf, type CronoTask } from './task';

export const ALL = 'ALL';

export type QuickFilter = 'ALL' | 'LATE' | 'MAY_LATE' | 'DOING' | 'MINE';

export interface Filters {
  /** Atalho: Todas, Atrasadas (confirmadas), Podem atrasar, Em andamento, Minhas. */
  quick: QuickFilter;
  search: string;
  status: string;
  type: string;
  assignee: string;
}

export const EMPTY_FILTERS: Filters = { quick: 'ALL', search: '', status: ALL, type: ALL, assignee: ALL };

export const hasActiveFilters = (f: Filters): boolean =>
  f.quick !== 'ALL' || f.search.trim() !== '' || f.status !== ALL || f.type !== ALL || f.assignee !== ALL;

const lower = (s: string) => s.toLowerCase();

export function matchesSearch(t: CronoTask, search: string): boolean {
  const q = lower(search.trim());
  if (!q) return true;
  return lower(t.key).includes(q) || lower(t.title).includes(q) || lower(t.assigneeName).includes(q) || lower(t.parentKey).includes(q);
}

function matchesFacets(t: CronoTask, f: Filters): boolean {
  if (f.status !== ALL && lower(t.status) !== lower(f.status)) return false;
  if (f.type !== ALL && lower(t.type) !== lower(f.type)) return false;
  if (f.assignee !== ALL && t.assigneeName !== f.assignee) return false;
  return true;
}

export interface VisibleStory {
  story: StoryModel;
  tasks: PlannedTask[];
}

/** Histórias e fases que passam nos filtros. Buscar a chave ou o título da história mostra as fases dela inteiras. */
export interface FilterContext {
  /** Id do Jira de quem está logado (para "Minhas"). */
  myAccountId?: string;
  /** Esconde fases fechadas sem datas e sem horas. */
  hideEmptyClosed?: boolean;
}

/** Fase fechada (concluída ou cancelada) que não tem datas nem horas: só faz ruído no Gantt. */
export function isEmptyClosed(p: PlannedTask): boolean {
  const t = p.task;
  return isDone(t) && p.planned === null && t.estimateSec === 0 && t.remainingSec === 0;
}

export function quickMatches(p: PlannedTask, q: QuickFilter, ctx: FilterContext): boolean {
  switch (q) {
    case 'LATE': return p.slip.shift > 0;
    case 'MAY_LATE': return p.slip.presumedDays > 0;
    case 'DOING': return isInProgress(p.task);
    case 'MINE': return !!ctx.myAccountId && p.task.assigneeId === ctx.myAccountId;
    default: return true;
  }
}

export function quickCounts(stories: StoryModel[], ctx: FilterContext) {
  const c = { late: 0, mayLate: 0, doing: 0, mine: 0 };
  for (const s of stories) {
    for (const p of s.tasks) {
      if (quickMatches(p, 'LATE', ctx)) c.late += 1;
      if (p.slip.presumedDays > 0 && p.slip.shift === 0) c.mayLate += 1;
      if (quickMatches(p, 'DOING', ctx)) c.doing += 1;
      if (quickMatches(p, 'MINE', ctx)) c.mine += 1;
    }
  }
  return c;
}

/** Quantas fases fechadas sem dados existem (ficam escondidas por padrão). */
export function countEmptyClosed(stories: StoryModel[]): number {
  let n = 0;
  for (const s of stories) for (const p of s.tasks) if (isEmptyClosed(p)) n += 1;
  return n;
}

export function filterStories(stories: StoryModel[], f: Filters, ctx: FilterContext = {}): VisibleStory[] {
  const hide = ctx.hideEmptyClosed === true;
  const active = hasActiveFilters(f);
  if (!active && !hide) return stories.map((story) => ({ story, tasks: story.tasks }));
  const out: VisibleStory[] = [];
  for (const story of stories) {
    if (hide && !active) {
      const tasks = story.tasks.filter((p) => !isEmptyClosed(p));
      if (tasks.length > 0 || story.tasks.length === 0) out.push({ story, tasks });
      continue;
    }
    const storyHit = !!story.story && matchesSearch(story.story, f.search);
    const keyHit = story.key.toLowerCase().includes(f.search.trim().toLowerCase()) && f.search.trim() !== '';
    const tasks = story.tasks.filter((r) => matchesFacets(r.task, f) && quickMatches(r, f.quick, ctx) && !(hide && isEmptyClosed(r)) && (storyHit || keyHit || matchesSearch(r.task, f.search)));
    if (tasks.length > 0) {
      out.push({ story, tasks });
    } else if (f.quick === 'ALL' && story.tasks.length === 0 && story.story && matchesFacets(story.story, f) && matchesSearch(story.story, f.search)) {
      out.push({ story, tasks: [] });
    }
  }
  return out;
}

export function uniqueValues(tasks: CronoTask[], pick: (t: CronoTask) => string): string[] {
  const set = new Set<string>();
  for (const t of tasks) {
    const v = pick(t);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ---------- Período ----------

export type PeriodPreset = 'SPRINT_CURRENT' | 'NEXT_14_DAYS' | 'CURRENT_MONTH' | 'CUSTOM';
export interface DayRange { start: number; end: number }

/** Janela da sprint a partir do rollup; sem datas, cai nos próximos 14 dias. */
export function sprintRange(startRaw: string | undefined, endRaw: string | undefined, nowMs: number): DayRange {
  // Só a data como veio escrita: a sprint "13/10" não pode virar 12/10 por causa do fuso do horário.
  const s = parseDay(startRaw?.slice(0, 10));
  const e = parseDay(endRaw?.slice(0, 10));
  if (s !== null && e !== null && e >= s) return { start: s, end: e };
  const t = todayDay(nowMs);
  return { start: t, end: t + 13 };
}

export function presetRange(preset: PeriodPreset, sprint: DayRange, nowMs: number): DayRange {
  const t = todayDay(nowMs);
  if (preset === 'NEXT_14_DAYS') return { start: t, end: t + 14 };
  if (preset === 'CURRENT_MONTH') {
    const { y, m } = ymdOfDay(t);
    return { start: dayFromYmd(y, m, 1), end: dayFromYmd(y, m + 1, 1) - 1 };
  }
  return sprint;
}

/** Lista de dias do eixo (limite de segurança para datas livres muito distantes). */
export const MAX_AXIS_DAYS = 62;

export function axisDays(range: DayRange): number[] {
  if (range.end < range.start) return [];
  const days: number[] = [];
  for (let d = range.start; d <= range.end && days.length < MAX_AXIS_DAYS; d += 1) days.push(d);
  return days;
}

// ---------- Linhas ----------

export type HierarchyLevel = 'story-to-subtask' | 'subtask-only' | 'story-only';
export type Grouping = 'story' | 'person';

export type GanttRow =
  | { kind: 'story'; id: string; visible: VisibleStory; open: boolean; expandable: boolean }
  | { kind: 'task'; id: string; story: StoryModel; ptask: PlannedTask }
  | { kind: 'person'; id: string; person: string; name: string; entries: { ptask: PlannedTask; story: StoryModel; lane: number }[]; lanes: number; overlap: boolean; remainingHours: number; count: number };

export interface RowOptions {
  grouping: Grouping;
  level: HierarchyLevel;
  collapsed: Record<string, boolean>;
}

export function buildRows(visible: VisibleStory[], opts: RowOptions): GanttRow[] {
  if (opts.grouping === 'person') return buildPersonRows(visible);
  const rows: GanttRow[] = [];
  for (const v of visible) {
    const showStory = opts.level !== 'subtask-only';
    const open = opts.level === 'story-only' ? false : opts.level === 'subtask-only' ? true : !opts.collapsed[v.story.key];
    if (showStory) {
      rows.push({ kind: 'story', id: `s:${v.story.key}`, visible: v, open, expandable: opts.level === 'story-to-subtask' && v.tasks.length > 0 });
    }
    if (open) {
      for (const ptask of v.tasks) rows.push({ kind: 'task', id: `t:${ptask.task.key}`, story: v.story, ptask });
    }
  }
  return rows;
}

function buildPersonRows(visible: VisibleStory[]): GanttRow[] {
  const byPerson = new Map<string, { name: string; items: { ptask: PlannedTask; story: StoryModel }[] }>();
  for (const v of visible) {
    for (const ptask of v.tasks) {
      const p = personKeyOf(ptask.task) ?? '__sem__';
      let g = byPerson.get(p);
      if (!g) { g = { name: ptask.task.assigneeName || 'Sem responsável', items: [] }; byPerson.set(p, g); }
      g.items.push({ ptask, story: v.story });
    }
  }
  const rows: GanttRow[] = [];
  const sorted = [...byPerson.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR'));
  for (const [person, g] of sorted) {
    const dated = g.items
      .filter((i) => i.ptask.effective)
      .sort((a, b) => ptNum(a.ptask.effective!.start) - ptNum(b.ptask.effective!.start));
    const laneEnds: number[] = [];
    const entries = dated.map((i) => {
      const s = ptNum(i.ptask.effective!.start);
      let lane = laneEnds.findIndex((end) => end <= s + 1e-9);
      if (lane < 0) { laneEnds.push(ptNum(i.ptask.effective!.end)); lane = laneEnds.length - 1; } else laneEnds[lane] = ptNum(i.ptask.effective!.end);
      return { ...i, lane };
    });
    const remainingHours = g.items.reduce((acc, i) => acc + (i.ptask.task.statusCategory === 'done' ? 0 : (i.ptask.task.remainingSec || i.ptask.task.estimateSec) / 3600), 0);
    rows.push({
      kind: 'person', id: `p:${person}`, person, name: g.name, entries, lanes: Math.max(1, laneEnds.length),
      overlap: laneEnds.length > 1, remainingHours, count: g.items.length,
    });
  }
  return rows;
}

// ---------- Geometria ----------

export interface BarGeometry { left: number; width: number; clippedStart: boolean; clippedEnd: boolean }

/** Posição de uma barra em pixels; null quando está toda fora do eixo. `axisStart`/`axisEnd` são números de dia. */
export function barGeometry(span: { start: Pt; end: Pt }, axisStart: number, axisEnd: number, dayWidth: number, minWidth = 8): BarGeometry | null {
  const s = ptNum(span.start);
  const e = ptNum(span.end);
  const lo = axisStart;
  const hi = axisEnd + 1;
  if (e <= lo || s >= hi) return null;
  const cs = Math.max(s, lo);
  const ce = Math.min(e, hi);
  const left = (cs - lo) * dayWidth;
  const width = Math.max(minWidth, (ce - cs) * dayWidth);
  return { left, width, clippedStart: s < lo, clippedEnd: e > hi };
}

export interface TaskSpans {
  /** Parte "normal" da barra: início efetivo até o fim planejado (já empurrado por fases anteriores). */
  solid: { start: Pt; end: Pt };
  /** Atraso próprio: do fim planejado até o fim previsto. */
  slip: { start: Pt; end: Pt } | null;
}

export function taskSpans(p: PlannedTask): TaskSpans | null {
  if (!p.planned || !p.effective) return null;
  if (p.slip.own <= 0) return { solid: p.effective, slip: null };
  const solidEnd = shiftPt(p.planned.end, p.slip.pushed);
  return { solid: { start: p.effective.start, end: solidEnd }, slip: { start: solidEnd, end: p.effective.end } };
}
