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
  const hasEvidence = getEvidenceUrls(task.evidence).length > 0;

  return (
    <button
      type="button"
      onClick={onExpand}
      title="Expandir card"
      className="w-full flex items-center gap-3 text-left rounded-xl px-3 py-2 -mx-1 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
    >
      <span className="flex-1 min-w-0 flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
        {problem || solution ? (
          <>
            <span className="truncate">{truncate(problem || '', 60) || 'Sem problema descrito'}</span>
            {!isMetricsCard && (
              <>
                <ArrowRight className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
                <span className="truncate">{truncate(solution || '', 60) || 'Sem solução descrita'}</span>
              </>
            )}
          </>
        ) : (
          <span className="italic text-slate-400 dark:text-slate-500">Problema e solução ainda não preenchidos</span>
        )}
      </span>
      {!isMetricsCard && task.acceptanceCriteria && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-violet-500 dark:text-violet-400 shrink-0">
          <CheckSquare className="h-3 w-3" /> Critérios
        </span>
      )}
      {hasEvidence && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
          <Paperclip className="h-3 w-3" /> Evidência
        </span>
      )}
      <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
        <User className="h-3 w-3" /> {task.evidence.dev || 'sem dev'}
      </span>
    </button>
  );
}
