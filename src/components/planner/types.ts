export interface PlannerAssignment {
  id: string;
  assigneeId?: string;
  role?: 'dev' | 'qa';
  hours: number;
  startDate?: string;
  endDate?: string;
}

export interface PlannerSubtask extends PlannerAssignment {
  name: string;
  status?: string;
  link?: string;
}

export interface PlannerTask extends Partial<PlannerAssignment> {
  id: string;
  name: string;
  link?: string;
  description?: string;
  status?: string;
  subtasks: PlannerSubtask[];
}

export function getTaskAssignments(task: PlannerTask): PlannerAssignment[] {
  if (task.subtasks.length > 0) return task.subtasks;
  return [{
    id: task.id,
    assigneeId: task.assigneeId,
    role: task.role,
    hours: task.hours || 0,
    startDate: task.startDate,
    endDate: task.endDate,
  }];
}

export function getTaskDevHours(task: PlannerTask): number {
  return getTaskAssignments(task).filter(a => a.role === 'dev').reduce((acc, a) => acc + a.hours, 0);
}

export function getTaskQaHours(task: PlannerTask): number {
  return getTaskAssignments(task).filter(a => a.role === 'qa').reduce((acc, a) => acc + a.hours, 0);
}
