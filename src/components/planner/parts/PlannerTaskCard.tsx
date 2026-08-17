'use client';

import React from 'react';
import { AgileCard } from '@/components/shared/EliteCard';
import { CheckCircle2 } from 'lucide-react';

export interface PlannerTask {
  id: string;
  name: string;
  devHours: number;
  qaHours: number;
  link?: string;
  description?: string;
  status?: string;
}

interface PlannerTaskCardProps {
  task: PlannerTask;
  onClick: (task: PlannerTask) => void;
  onEdit: (task: PlannerTask) => void;
  onDelete: (id: string) => void;
  isReadOnly?: boolean;
}

export function PlannerTaskCard({
  task,
  onClick,
  onEdit,
  onDelete,
  isReadOnly = false,
}: PlannerTaskCardProps) {
  return (
    <AgileCard
      id={task.id}
      variant="planner"
      content={task.name}
      theme="indigo"
      devHours={task.devHours}
      qaHours={task.qaHours}
      link={task.link}
      onEdit={!isReadOnly ? () => onEdit(task) : undefined}
      onDelete={!isReadOnly ? () => onDelete(task.id) : undefined}
      onClick={() => onClick(task)}
      className="group"
      // Author and other elite props can be defaults for planner
    >
      <div className="absolute top-1/2 -translate-y-1/2 right-6 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none">
          <CheckCircle2 className="h-12 w-12 text-indigo-600" />
      </div>
    </AgileCard>
  );
}
