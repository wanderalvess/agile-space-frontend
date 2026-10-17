'use client';

import { ArrowRight, CheckSquare, Paperclip, User } from 'lucide-react';
import { ShowcaseTask } from './types';
import { getEvidenceUrls } from './utils';

function truncate(text: string, n: number) {
  if (!text) return '';
  return text.length > n ? text.slice(0, n).trim() + '…' : text;
}

interface TaskCardSummaryProps {
  task: ShowcaseTask;
  isMetricsCard: boolean;
  onExpand: () => void;
}

/** Linha do card recolhido: o essencial para conferir sem abrir (texto, critérios, evidência e dev). */
export function TaskCardSummary({ task, isMetricsCard, onExpand }: TaskCardSummaryProps) {
  const problem = (isMetricsCard ? task.description : task.evidence.problem)?.trim();
  const solution = task.evidence.solution?.trim();
  const hasEvidence = getEvidenceUrls(task.evidence).length > 0 || (task.attachments?.length ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={onExpand}
      title="Expandir card"
      className="-mx-1 flex w-full items-center gap-3 rounded-xl bg-muted/50 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-muted-foreground">
        {problem || solution ? (
          <>
            <span className="truncate">{truncate(problem || '', 60) || 'Sem problema descrito'}</span>
            {!isMetricsCard && (
              <>
                <ArrowRight className="h-3 w-3 shrink-0 opacity-60" strokeWidth={1.5} aria-hidden="true" />
                <span className="truncate">{truncate(solution || '', 60) || 'Sem solução descrita'}</span>
              </>
            )}
          </>
        ) : (
          <span className="italic">Problema e solução ainda não preenchidos</span>
        )}
      </span>
      {!isMetricsCard && task.acceptanceCriteria && (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
          <CheckSquare className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Critérios
        </span>
      )}
      {hasEvidence && (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
          <Paperclip className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Evidência
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
        <User className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> {task.evidence.dev || 'sem dev'}
      </span>
    </button>
  );
}
