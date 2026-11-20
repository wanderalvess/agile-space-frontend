'use client';

import { Check } from 'lucide-react';
import { formatMinutes, formatPt, minutesOfFrac } from '@/lib/cronograma/dates';
import type { DateOrigin, PlannedTask, StoryModel } from '@/lib/cronograma/schedule';
import { isDone } from '@/lib/cronograma/task';
import type { BarGeometry } from '@/lib/cronograma/view';
import { FOCUS, phaseStyle } from './styles';

export const ORIGIN_NOTE: Record<DateOrigin, string> = {
  jira: 'datas do Jira',
  sugestao: 'sugestão pelas horas',
  aproximada: 'data aproximada',
  nenhuma: 'sem datas',
};

/** Nome acessível da barra: chave, fase, responsável, datas com hora, origem e atraso. */
export function barAriaLabel(p: PlannedTask): string {
  const t = p.task;
  const who = t.assigneeName || 'sem responsável';
  const when = p.effective ? `de ${formatPt(p.effective.start)} a ${formatPt(p.effective.end)}` : 'sem datas';
  const slip = p.slip.shift > 0 ? `, atraso de ${p.slip.shift} dia(s) útil(eis)` : '';
  return `${t.key}, ${p.phase.label}, ${who}, ${when}, ${ORIGIN_NOTE[p.origin]}${slip}`;
}

export function storyAriaLabel(s: StoryModel): string {
  const when = s.effective ? `de ${formatPt(s.effective.start)} a ${formatPt(s.effective.end)}` : 'sem datas';
  const delay = s.delayDays > 0 ? `, prevê ${s.delayDays} dia(s) útil(eis) a mais` : '';
  return `${s.key}, história com ${s.tasks.length} fase(s), ${when}${delay}`;
}

interface TaskBarProps {
  ptask: PlannedTask;
  geom: BarGeometry;
  top: number;
  height: number;
  /** Mostra a chave junto do rótulo (visão por pessoa). */
  showKey?: boolean;
  selected?: boolean;
  rowIndex: number;
  onSelect: () => void;
}

export function TaskBar({ ptask, geom, top, height, showKey, selected, rowIndex, onSelect }: TaskBarProps) {
  const ps = phaseStyle(ptask.phase);
  const done = isDone(ptask.task);
  const eff = ptask.effective;
  let variant: string;
  if (done) variant = `${ps.soft} border ${ps.border}`;
  else if (ptask.origin === 'sugestao') variant = `${ps.soft} border-2 border-dashed ${ps.border}`;
  else if (ptask.origin === 'aproximada') variant = `${ps.soft} border border-dashed border-muted-foreground`;
  else variant = ps.solid;

  const label = showKey ? `${ptask.phase.label} · ${ptask.task.key}` : ptask.phase.label;
  const sameDay = eff && eff.start.day === eff.end.day;
  const times = eff && sameDay && geom.width >= 170
    ? `${formatMinutes(minutesOfFrac(eff.start.frac))} a ${formatMinutes(minutesOfFrac(eff.end.frac))}`
    : null;
  const showLabel = geom.width >= 56;
  const progress = !done && ptask.progress > 0 && ptask.progress < 100 ? ptask.progress : 0;
  const aria = barAriaLabel(ptask);

  return (
    <button
      type="button"
      data-gantt-bar=""
      data-row={rowIndex}
      aria-label={aria}
      title={aria}
      onClick={onSelect}
      className={`absolute flex items-center gap-1.5 overflow-hidden px-2 text-left text-xs font-bold motion-safe:transition-[filter,box-shadow] hover:brightness-110 ${FOCUS} ${variant} ${
        geom.clippedStart ? 'rounded-l-none' : 'rounded-l-lg'
      } ${geom.clippedEnd ? 'rounded-r-none' : 'rounded-r-lg'} ${selected ? 'ring-2 ring-ring ring-offset-1 ring-offset-background' : ''}`}
      style={{ left: geom.left + 1, width: Math.max(4, geom.width - 2), top, height }}
    >
      {done && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
      {showLabel && <span className="truncate">{label}</span>}
      {times && <span className="shrink-0 font-medium opacity-90 tabular-nums">{times}</span>}
      {progress > 0 && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-background/60" style={{ width: `${progress}%` }} />
      )}
    </button>
  );
}

/** Trecho de atraso: tracejado âmbar depois do fim planejado. Decorativo (o atraso está no nome da barra). */
export function SlipOverlay({ left, width, top, height, title }: { left: number; width: number; top: number; height: number; title: string }) {
  return (
    <span
      aria-hidden="true"
      title={title}
      className="absolute rounded-r-lg border-2 border-l-0 border-dashed border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400"
      style={{
        left, width: Math.max(4, width), top, height,
        backgroundImage: 'repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 9px)',
        backgroundSize: 'auto',
        opacity: 0.55,
      }}
    />
  );
}

interface StoryBarProps {
  story: StoryModel;
  geom: BarGeometry;
  top: number;
  height: number;
  rowIndex: number;
  selected?: boolean;
  onSelect: () => void;
}

export function StoryBar({ story, geom, top, height, rowIndex, selected, onSelect }: StoryBarProps) {
  const dashed = story.origin === 'aproximada' ? 'border-dashed border-muted-foreground' : story.origin === 'sugestao' ? 'border-dashed border-primary' : 'border-primary/60';
  const aria = storyAriaLabel(story);
  return (
    <button
      type="button"
      data-gantt-bar=""
      data-row={rowIndex}
      aria-label={aria}
      title={aria}
      onClick={onSelect}
      className={`absolute flex items-center overflow-hidden rounded-lg border bg-primary/15 px-2 text-left text-xs font-bold text-foreground motion-safe:transition-[filter] hover:brightness-110 ${FOCUS} ${dashed} ${
        selected ? 'ring-2 ring-ring ring-offset-1 ring-offset-background' : ''
      }`}
      style={{ left: geom.left + 1, width: Math.max(4, geom.width - 2), top, height }}
    >
      {geom.width >= 70 && <span className="truncate">{story.tasks.length > 0 ? `${story.tasks.length} ${story.tasks.length === 1 ? 'fase' : 'fases'}` : story.key}</span>}
    </button>
  );
}
