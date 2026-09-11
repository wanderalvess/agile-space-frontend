'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlannerTaskCard } from './PlannerTaskCard';
import { PlannerSubtaskRow } from './PlannerSubtaskRow';
import type { PlannerTask, PlannerSubtask } from '../types';
import type { TeamMember } from './CapacityEngine';

interface PlannerTaskRowProps {
  task: PlannerTask;
  sprintMembers: TeamMember[];
  sprintStartDate: string;
  isReadOnly?: boolean;
  onEdit: (task: PlannerTask) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (taskId: string) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, updates: Partial<PlannerSubtask>) => void;
  onRemoveSubtask: (taskId: string, subtaskId: string) => void;
}

export function PlannerTaskRow({
  task,
  sprintMembers,
  sprintStartDate,
  isReadOnly = false,
  onEdit,
  onDelete,
  onAddSubtask,
  onUpdateSubtask,
  onRemoveSubtask,
}: PlannerTaskRowProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-[2rem] border border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 overflow-hidden">
      <PlannerTaskCard
        task={task}
        onClick={() => setExpanded(e => !e)}
        onEdit={onEdit}
        onDelete={onDelete}
        isReadOnly={isReadOnly}
      />

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {task.subtasks.map(st => (
            <PlannerSubtaskRow
              key={st.id}
              subtask={st}
              sprintMembers={sprintMembers}
              sprintStartDate={sprintStartDate}
              isReadOnly={isReadOnly}
              onUpdate={(updates) => onUpdateSubtask(task.id, st.id, updates)}
              onRemove={() => onRemoveSubtask(task.id, st.id)}
            />
          ))}
          {!isReadOnly && (
            <Button
              variant="outline"
              onClick={() => onAddSubtask(task.id)}
              className="w-full h-9 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-black uppercase text-[9px] tracking-widest hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-600 gap-2"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Subtarefa
            </Button>
          )}
          {sprintMembers.length === 0 && !isReadOnly && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">
              Adicione integrantes no modo "Por Pessoa" pra atribuir responsáveis.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
