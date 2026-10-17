'use client';

import { Bug, Code2, FileText, CheckSquare } from 'lucide-react';
import { BRAND_TEXT } from '@/components/room-kit/tokens';
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
          label="Contexto: o que esse número representa"
          icon={FileText}
          value={task.description}
          onChange={(v) => onUpdate({ description: v })}
          placeholder="Ex.: economia gerada pela automação do processo X no trimestre..."
          multiline minRows={3}
          labelColor={BRAND_TEXT}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <TextField
            id={`problem-${task.id}`}
            label="O problema / a motivação"
            icon={Bug}
            value={task.evidence.problem}
            onChange={(v) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, problem: v } }))}
            placeholder="Erro ou necessidade do cliente..."
            multiline minRows={6}
            labelColor="text-red-700 dark:text-red-300"
          />
          <TextField
            id={`solution-${task.id}`}
            label="A solução implementada"
            icon={Code2}
            value={task.evidence.solution}
            onChange={(v) => onUpdate(prev => ({ ...prev, evidence: { ...prev.evidence, solution: v } }))}
            placeholder="O que foi desenvolvido tecnicamente..."
            multiline minRows={6}
            labelColor="text-emerald-700 dark:text-emerald-300"
          />
        </div>
      )}

      {!isMetricsCard && (
        <TextField
          id={`acceptance-criteria-${task.id}`}
          label="Critérios de aceite"
          icon={CheckSquare}
          value={task.acceptanceCriteria}
          onChange={(v) => onUpdate({ acceptanceCriteria: v })}
          placeholder="O que precisa ser validado para considerar essa entrega aceita..."
          multiline minRows={3}
          labelColor={BRAND_TEXT}
        />
      )}
    </>
  );
}
