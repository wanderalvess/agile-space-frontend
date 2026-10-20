'use client';

import { AlertTriangle, Loader2, Plus, RotateCcw, X } from 'lucide-react';
import { BRAND_TEXT, FOCUS_RING, StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import type { BacklogParent } from '@/lib/sprint-planner/api';
import { formatHours } from '@/lib/sprint-planner/format';
import { noticesFromBacklog, parentHours, type TaskNoticeData } from '@/lib/sprint-planner/scope';

const ACTION =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-transparent text-foreground transition-colors hover:bg-accent disabled:opacity-50 max-sm:h-11 max-sm:w-11';

/** Horas DEV e QA da tarefa, no mesmo formato nas duas colunas. */
export function HoursChips({ dev, qa }: { dev: number; qa: number }) {
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
      <StatusChip tone="brand" className="tabular-nums">DEV {formatHours(dev)}</StatusChip>
      <StatusChip tone="success" className="tabular-nums">QA {formatHours(qa)}</StatusChip>
    </span>
  );
}

/**
 * Os avisos de uma tarefa (sobra, sem estimativa, divergência, tipos sem classificação). Servem à refinada
 * (`noticesFromBacklog`) e ao item do plano (`noticesFromItem`, com as flags do servidor).
 */
export function TaskNotices({ notices, onOpenTypes }: { notices: TaskNoticeData; onOpenTypes?: () => void }) {
  const { unclassified } = notices;
  return (
    <>
      {notices.carryOver && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-foreground" data-testid={`sobra-${notices.key}`}>
          <StatusChip tone="warn"><RotateCcw aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} /> Veio da sprint anterior</StatusChip>
          <span className="tabular-nums text-muted-foreground">
            Tempo Estimado {formatHours(notices.estimated)} · Tempo Restante <strong className="text-foreground">{formatHours(notices.remaining)}</strong>
          </span>
        </p>
      )}
      {notices.outOfBacklog && (
        <p className="text-[13px] text-muted-foreground">Saiu das refinadas no Jira; valem as horas de quando entrou no plano.</p>
      )}
      {notices.noEstimate && (
        <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">Sem estimativa: peça o refinamento no Poker ou preencha o título e as subtarefas no Jira.</p>
      )}
      {notices.noTitleHours && <p className="text-[13px] text-muted-foreground">Sem horas no título: valem as subtarefas.</p>}
      {notices.divergences.map((m) => (
        <p key={m} className="flex items-start gap-1.5 text-[13px] text-amber-800 dark:text-amber-300">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          <span>{m}; ajuste a subtarefa no Jira.</span>
        </p>
      ))}
      {unclassified > 0 && (
        <p className="text-[13px] text-muted-foreground">
          {unclassified === 1 ? '1 subtarefa de tipo sem classificação não entra no total.' : `${unclassified} subtarefas de tipos sem classificação não entram no total.`}{' '}
          {onOpenTypes && (
            <button type="button" onClick={onOpenTypes} className={cn('rounded font-semibold underline underline-offset-2', BRAND_TEXT, FOCUS_RING)}>
              Mapear tipos
            </button>
          )}
        </p>
      )}
    </>
  );
}

/** Tarefa refinada na coluna da esquerda, com o botão de adicionar (só liderança). */
export function BacklogCard({
  task,
  canEdit,
  adding,
  onAdd,
  onOpenTypes,
}: {
  task: BacklogParent;
  canEdit: boolean;
  adding: boolean;
  onAdd: (key: string) => void;
  onOpenTypes?: () => void;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[12px] border border-border bg-card p-3" data-testid={`refinada-${task.key}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="font-mono text-xs font-semibold text-muted-foreground">{task.key}</span>
          <HoursChips dev={parentHours(task, 'DEV')} qa={parentHours(task, 'QA')} />
        </div>
        <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{task.title ?? 'Sem título'}</p>
        <TaskNotices notices={noticesFromBacklog(task)} onOpenTypes={onOpenTypes} />
      </div>
      {canEdit && (
        <button type="button" className={cn(ACTION, FOCUS_RING)} onClick={() => onAdd(task.key)} disabled={adding} aria-label={`Adicionar ${task.key} ao escopo`}>
          {adding ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
        </button>
      )}
    </li>
  );
}
