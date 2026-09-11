import type { PlannerTask, PlannerSubtask } from '../types';

function makeSubtask(name: string, role: 'dev' | 'qa', hours: number, base: any, suffix: string): PlannerSubtask {
  return {
    id: `${base.id}-${suffix}`,
    name,
    role,
    hours,
    assigneeId: undefined,
    startDate: undefined,
    endDate: undefined,
    link: base.link,
  };
}

/**
 * Migrates a raw stored task into the current PlannerTask shape.
 * Legacy tasks only had flat devHours/qaHours with no subtasks array —
 * each non-zero role becomes its own subtask so no historical data is lost.
 */
export function normalizePlannerTask(raw: any): PlannerTask {
  if (Array.isArray(raw.subtasks)) {
    return {
      id: raw.id,
      name: raw.name || 'Tarefa',
      link: raw.link,
      description: raw.description,
      status: raw.status,
      subtasks: raw.subtasks.map((s: any) => ({
        id: s.id,
        name: s.name || 'Subtarefa',
        role: s.role === 'qa' ? 'qa' : 'dev',
        hours: Number(s.hours) || 0,
        assigneeId: s.assigneeId,
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status,
        link: s.link,
      })),
    };
  }

  const devHours = Number(raw.devHours) || 0;
  const qaHours = Number(raw.qaHours) || 0;
  const subtasks: PlannerSubtask[] = [];
  if (devHours > 0) subtasks.push(makeSubtask(`${raw.name} (Dev)`, 'dev', devHours, raw, 'dev'));
  if (qaHours > 0) subtasks.push(makeSubtask(`${raw.name} (QA)`, 'qa', qaHours, raw, 'qa'));
  if (subtasks.length === 0) {
    subtasks.push(makeSubtask(raw.name || 'Subtarefa', 'dev', 0, raw, 'dev'));
  }

  return {
    id: raw.id,
    name: raw.name || 'Tarefa',
    link: raw.link,
    description: raw.description,
    status: raw.status,
    subtasks,
  };
}
