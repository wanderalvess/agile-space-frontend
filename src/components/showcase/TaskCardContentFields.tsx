'use client';

import { Bug, Code2, FileText, CheckSquare } from 'lucide-react';
import { ShowcaseTask } from './types';
import { TextField } from './TaskCardFields';

interface TaskCardContentFieldsProps {
  task: ShowcaseTask;
  isMetricsCard: boolean;
  onUpdate: (updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => void;
}

export function TaskCardContentFields({ task, isMetricsCard, onUpdate }: TaskCardContentFieldsProps) {
  return (
    <>
      {isMetricsCard ? (
        <TextField
          id={`description-${task.id}`}
          label="Contexto — o que esse número representa"
          icon={FileText}
          value={task.description}
          onChange={(v) => onUpdate({ description: v })}
          placeholder="Ex: Economia gerada pela automação do processo X no trimestre..."
          multiline minRows={3}
          colorScheme={{ label: 'text-violet-500 dark:text-violet-400', focus: 'focus:border-violet-200 dark:focus:border-violet-900/40', ring: 'focus:ring-1 focus:ring-violet-200/50 dark:focus:ring-violet-900/20' }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id={`problem-${task.id}`}
            label="O Problema / Motivação"
            icon={Bug}
            value={task.evidence.problem}
            onChange={(v) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, problem: v } }))}
            placeholder="Erro ou necessidade do cliente..."
            multiline minRows={6}
            colorScheme={{ label: 'text-rose-500 dark:text-rose-400', focus: 'focus:border-rose-200 dark:focus:border-rose-900/40', ring: 'focus:ring-1 focus:ring-rose-200/50 dark:focus:ring-rose-900/20' }}
          />
          <TextField
            id={`solution-${task.id}`}
            label="A Solução Implementada"
            icon={Code2}
            value={task.evidence.solution}
            onChange={(v) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, solution: v } }))}
            placeholder="O que foi desenvolvido tecnicamente..."
            multiline minRows={6}
            colorScheme={{ label: 'text-emerald-600 dark:text-emerald-400', focus: 'focus:border-emerald-200 dark:focus:border-emerald-900/40', ring: 'focus:ring-1 focus:ring-emerald-200/50 dark:focus:ring-emerald-900/20' }}
          />
        </div>
      )}

      {!isMetricsCard && (
        <TextField
          id={`acceptance-criteria-${task.id}`}
          label="Critérios de Aceite"
          icon={CheckSquare}
          value={task.acceptanceCriteria}
          onChange={(v) => onUpdate({ acceptanceCriteria: v })}
          placeholder="O que precisa ser validado para considerar essa entrega aceita..."
          multiline minRows={3}
          colorScheme={{ label: 'text-violet-500 dark:text-violet-400', focus: 'focus:border-violet-200 dark:focus:border-violet-900/40', ring: 'focus:ring-1 focus:ring-violet-200/50 dark:focus:ring-violet-900/20' }}
        />
      )}
    </>
  );
}
