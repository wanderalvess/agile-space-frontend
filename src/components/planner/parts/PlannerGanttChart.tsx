'use client';

import React, { useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlannerTask } from '../types';

interface PlannerGanttChartProps {
  tasks: PlannerTask[];
  sprintStartDate: string;
  workingDays: number;
}

const DAY_WIDTH = 40;
const ROW_HEIGHT = 36;

export function PlannerGanttChart({ tasks, sprintStartDate, workingDays }: PlannerGanttChartProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const start = parseISO(sprintStartDate);
  const days = useMemo(
    () => Array.from({ length: Math.max(workingDays, 1) }, (_, i) => addDays(start, i)),
    [sprintStartDate, workingDays]
  );

  const toggle = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const dayIndex = (iso?: string) => {
    if (!iso) return null;
    const idx = differenceInCalendarDays(parseISO(iso), start);
    return idx;
  };

  const barStyle = (startIso?: string, endIso?: string) => {
    const startIdx = dayIndex(startIso);
    if (startIdx === null) return null;
    const endIdx = dayIndex(endIso) ?? startIdx;
    const clampedStart = Math.max(startIdx, 0);
    const clampedEnd = Math.min(Math.max(endIdx, startIdx), days.length - 1);
    if (clampedStart > days.length - 1 || clampedEnd < 0) return null;
    return {
      left: clampedStart * DAY_WIDTH,
      width: Math.max((clampedEnd - clampedStart + 1) * DAY_WIDTH - 6, DAY_WIDTH - 6),
    };
  };

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold uppercase tracking-widest">
        Sem tarefas pra exibir na timeline.
      </div>
    );
  }

  return (
    <div className="inline-flex max-w-full max-h-full overflow-hidden rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40">
      {/* Left: task/subtask names */}
      <div className="w-[240px] shrink-0 border-r border-slate-100 dark:border-slate-800 overflow-y-auto custom-scrollbar max-h-[60vh]">
        <div style={{ height: ROW_HEIGHT }} className="flex items-center px-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 sticky top-0 z-10">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tarefa</span>
        </div>
        {tasks.map(task => {
          const isCollapsed = collapsed.has(task.id);
          return (
            <div key={task.id}>
              <button
                onClick={() => toggle(task.id)}
                style={{ height: ROW_HEIGHT }}
                className="w-full flex items-center gap-1.5 px-3 border-b border-slate-50 dark:border-slate-800/60 text-left hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors"
              >
                {isCollapsed ? <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" /> : <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />}
                <span className="text-[10px] font-black uppercase tracking-tight text-slate-700 dark:text-slate-200 truncate">{task.name}</span>
              </button>
              {!isCollapsed && task.subtasks.map(st => (
                <div key={st.id} style={{ height: ROW_HEIGHT }} className="flex items-center pl-8 pr-3 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 truncate">{st.name}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Right: day grid + bars */}
      <div className="overflow-x-auto overflow-y-auto custom-scrollbar max-h-[60vh]">
        <div style={{ width: days.length * DAY_WIDTH }}>
          <div style={{ height: ROW_HEIGHT }} className="flex sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
            {days.map((d, i) => (
              <div key={i} style={{ width: DAY_WIDTH }} className="flex flex-col items-center justify-center border-r border-slate-100/60 dark:border-slate-800/60 shrink-0">
                <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">{format(d, 'EEEEEE', { locale: ptBR })}</span>
                <span className="text-[9px] font-black text-slate-500 dark:text-slate-400">{format(d, 'dd/MM')}</span>
              </div>
            ))}
          </div>

          {tasks.map(task => {
            const isCollapsed = collapsed.has(task.id);
            const taskBar = barStyle(
              task.subtasks.map(s => s.startDate).find(Boolean),
              [...task.subtasks].reverse().map(s => s.endDate).find(Boolean)
            );
            return (
              <div key={task.id}>
                <div style={{ height: ROW_HEIGHT }} className="relative border-b border-slate-50 dark:border-slate-800/60">
                  {taskBar && (
                    <div
                      className="absolute top-1.5 h-6 rounded-lg bg-violet-200/60 dark:bg-violet-800/30 border border-violet-300/50 dark:border-violet-700/40"
                      style={{ left: taskBar.left, width: taskBar.width }}
                    />
                  )}
                </div>
                {!isCollapsed && task.subtasks.map(st => {
                  const bar = barStyle(st.startDate, st.endDate);
                  return (
                    <div key={st.id} style={{ height: ROW_HEIGHT }} className="relative border-b border-slate-50 dark:border-slate-800/60">
                      {bar ? (
                        <div
                          className={cn(
                            'absolute top-1.5 h-6 rounded-lg flex items-center px-2 shadow-sm',
                            st.role === 'qa' ? 'bg-fuchsia-500/80 border border-fuchsia-600/40' : 'bg-violet-600/80 border border-violet-700/40'
                          )}
                          style={{ left: bar.left, width: bar.width }}
                        >
                          <span className="text-[8px] font-black text-white truncate">{st.hours}h</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
