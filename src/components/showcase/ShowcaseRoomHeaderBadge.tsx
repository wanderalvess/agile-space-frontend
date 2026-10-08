'use client';

import { ChevronDown, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ShowcaseTask, PREPARATION_STATUS } from './types';

interface ReadinessRow {
  task: ShowcaseTask;
  contentComplete: boolean;
  mismatch: boolean;
}

interface ShowcaseRoomHeaderBadgeProps {
  hoursSpent: string;
  hoursOriginal: string;
  total: number;
  readyCount: number;
  mismatchCount: number;
  readinessTasks: ReadinessRow[];
  /** true quando a lista está filtrada: os números acima são só dos cards visíveis. */
  isFiltered?: boolean;
  /** Total de cards da sessão, para o aviso "X de Y" quando há filtro. */
  sessionTotal?: number;
  onToggleTaskStatus: (taskId: string, markAsDone: boolean) => void;
}

export function ShowcaseRoomHeaderBadge({
  hoursSpent, hoursOriginal, total, readyCount, mismatchCount, readinessTasks, isFiltered, sessionTotal, onToggleTaskStatus,
}: ShowcaseRoomHeaderBadgeProps) {
  return (
    <div className="hidden xl:flex items-center gap-6 px-2">
      <div className="flex flex-col items-start">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase leading-none mb-1 tracking-wide whitespace-nowrap">Esforço total</span>
        <div className="flex items-center gap-1 text-xs font-bold text-violet-600 whitespace-nowrap">
          {hoursSpent || '0h'}
          <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>
          {hoursOriginal || '0h'}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex flex-col items-start outline-none group">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase leading-none mb-1 tracking-wide flex items-center gap-1">
              Prontidão
              {isFiltered && <Filter className="h-2.5 w-2.5 text-violet-500" aria-label="Filtrado" />}
              <ChevronDown className="h-2.5 w-2.5 text-slate-300 dark:text-slate-600 transition-transform group-data-[state=open]:rotate-180" />
            </span>
            <div className={cn(
              "flex items-center gap-1.5 text-xs font-bold whitespace-nowrap",
              readyCount === total && total > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"
            )}>
              {readyCount}
              <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>
              {total}
              {mismatchCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title={`${mismatchCount} task(s) com status manual divergente`} />}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[420px] rounded-2xl p-0 border-slate-200 dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Prontidão da Sessão</h3>
              <span className={cn("text-[10px] font-black", readyCount === total && total > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100")}>
                {readyCount}/{total} prontas
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                style={{ width: `${total ? Math.round((readyCount / total) * 100) : 0}%` }}
              />
            </div>
            {isFiltered && (
              <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 mt-2 flex items-center gap-1.5">
                <Filter className="h-3 w-3 shrink-0" />
                Filtro da lista ativo: mostrando {total} de {sessionTotal ?? total} cards.
              </p>
            )}
            {mismatchCount > 0 && (
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Status manual e conteúdo real divergem em {mismatchCount} {mismatchCount > 1 ? 'tasks' : 'task'} — veja abaixo.
              </p>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {readinessTasks.length === 0 && (
              <p className="px-4 py-6 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{isFiltered ? 'Nenhum card neste filtro' : 'Nenhuma task ainda'}</p>
            )}
            {readinessTasks.map(({ task: t, contentComplete, mismatch }) => {
              const meta = PREPARATION_STATUS[t.preparationStatus || 'todo'];
              return (
                <div key={t.id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                  <span
                    className={cn("w-2 h-2 rounded-full shrink-0", contentComplete ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700")}
                    title={contentComplete ? 'Conteúdo completo' : 'Conteúdo incompleto'}
                  />
                  <span className="bg-violet-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0">{t.key}</span>
                  <span className="flex-1 min-w-0 text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">{t.title || 'Sem título'}</span>
                  <span className={cn("text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shrink-0", meta.cls)}>{meta.label}</span>
                  {mismatch && (
                    <button
                      type="button"
                      title={t.preparationStatus === 'done' ? 'Marcada como pronta, mas falta conteúdo — clique pra corrigir o status' : 'Conteúdo completo — clique pra marcar como pronta'}
                      onClick={() => onToggleTaskStatus(t.id, contentComplete)}
                      className="w-5 h-5 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
