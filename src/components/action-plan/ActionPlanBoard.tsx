'use client';

import React, { useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, CircleDashed, CircleDot, FilterX, ListChecks, Pencil, Plus, RefreshCw } from 'lucide-react';
import { actionPlanApi } from '@/app/action-plan/api';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { DataTable, DataToolbar, EmptyState, KpiCard, KpiRow, PAGE_CARD, type DataColumn } from '@/components/page';
import { IconButton, ModalButton, SelectField, StatusChip, type Tone } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import {
  FILTER_ALL,
  FILTER_UNASSIGNED,
  NO_FILTERS,
  STATUS_LABEL,
  TASK_STATUSES,
  filterTasks,
  formatAgo,
  formatClock,
  hasActiveFilters,
  nextStatus,
  normalizeStatus,
  numberTasks,
  responsibleOptions,
  summarizeTasks,
  type PlanPerson,
  type TaskFilters,
} from '@/lib/action-plan';
import {
  DUE_FILTER_OPTIONS,
  dueDateOf,
  hasOriginContract,
  isOverdue,
  matchesDueFilter,
  sortByDue,
  type DueFilter,
  type TaskSort,
} from '@/lib/action-plan-origin';
import { errorMessage } from '@/lib/ceremony-api';
import type { ActionPlanBoard as IActionPlanBoard, ActionPlanTask } from '@/lib/types';
import { ActionPlanCell } from './ActionPlanCell';
import { ActionTaskDialog } from './ActionTaskDialog';
import { DueDateCell } from './DueDateCell';

/** Situação da releitura automática das ações (o plano não tem WebSocket). */
export interface RefreshStatus {
  phase: 'idle' | 'loading' | 'error';
  /** Quando a última leitura deu certo (ms). */
  lastOkAt: number | null;
}

interface ActionPlanBoardProps {
  board: IActionPlanBoard;
  tasks: ActionPlanTask[];
  onRefresh?: () => void;
  /** Pessoas da squad do plano (campo "Quem"). */
  people?: readonly PlanPerson[];
  refreshStatus?: RefreshStatus;
  /** "Tentar agora" na faixa de atualização. */
  onRefreshNow?: () => void;
  /** Hora atual (ms) para o texto "Atualizado há N s"; a página repõe a cada poucos segundos. */
  now?: number;
}

const STATUS_TONE: Record<ActionPlanTask['status'], Tone> = {
  todo: 'neutral',
  doing: 'brand',
  done: 'success',
  blocked: 'danger',
};

const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: 'plan', label: 'Ordem do plano' },
  { value: 'due', label: 'Prazo mais próximo' },
];

const STATUS_FILTER_OPTIONS = [
  { value: FILTER_ALL, label: 'Todos os status' },
  ...TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];

/** Resumo por status, busca e filtros, e a tabela 5W2H editável no lugar (cartões abaixo de 1280 px). */
export function ActionPlanBoard({ board, tasks, onRefresh, people = [], refreshStatus, onRefreshNow, now }: ActionPlanBoardProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ActionPlanTask | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [due, setDue] = useState<DueFilter>('all');
  const [sort, setSort] = useState<TaskSort>('plan');
  // Hora de referência do "Atrasada" quando a página não repõe `now` (testes e usos soltos).
  const [mountedAt] = useState(() => Date.now());
  const clock = now ?? mountedAt;
  // O prazo como data só existe num servidor que conhece a origem/prazo (V78); no antigo o "Quando" segue texto livre.
  const dueDates = hasOriginContract(board);

  const summary = useMemo(() => summarizeTasks(tasks), [tasks]);
  const numbers = useMemo(() => numberTasks(tasks), [tasks]);
  const visible = useMemo(() => {
    const byFilters = filterTasks(tasks, filters).filter((t) => matchesDueFilter(t, dueDates ? due : 'all', clock));
    return dueDates && sort === 'due' ? sortByDue(byFilters) : byFilters;
  }, [tasks, filters, due, sort, dueDates, clock]);
  const overdueCount = useMemo(() => (dueDates ? tasks.filter((t) => isOverdue(t, clock)).length : 0), [tasks, dueDates, clock]);
  const dueOptions = useMemo(
    () => DUE_FILTER_OPTIONS.map((o) => (o.value === 'overdue' && overdueCount > 0 ? { ...o, label: `${o.label} (${overdueCount})` } : o)),
    [overdueCount],
  );
  const who = useMemo(() => responsibleOptions(tasks), [tasks]);
  const whoOptions = useMemo(
    () => [
      { value: FILTER_ALL, label: 'Todos os responsáveis' },
      ...who.names.map((n) => ({ value: n, label: n })),
      ...(who.hasUnassigned ? [{ value: FILTER_UNASSIGNED, label: 'Sem responsável' }] : []),
    ],
    [who],
  );
  const filtering = hasActiveFilters(filters) || (dueDates && due !== 'all');

  const handleOpenNew = () => {
    setEditingTask(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (task: ActionPlanTask) => {
    setEditingTask(task);
    setIsDialogOpen(true);
  };

  /** Grava só o campo editado. Devolve a mensagem do servidor quando falha, para a célula mostrá-la. */
  const handleUpdateField = async (taskId: string, field: string, value: string): Promise<true | string> => {
    try {
      await actionPlanApi.updateTask(taskId, { [field]: value });
      onRefresh?.();
      return true;
    } catch (e) {
      console.error('Erro ao salvar o campo da ação', e);
      return errorMessage(e, 'Não foi possível salvar. O texto continua na célula.');
    }
  };

  /** Grava o prazo da ação (`''` limpa, com `clearDueDate`). Devolve `false` quando falha, para o campo voltar. */
  const handleUpdateDue = async (taskId: string, value: string): Promise<boolean> => {
    try {
      await actionPlanApi.updateTask(taskId, value ? { dueDate: value } : { clearDueDate: true });
      onRefresh?.();
      return true;
    } catch (e) {
      console.error('Erro ao salvar o prazo da ação', e);
      toast({ title: 'Não foi possível salvar o prazo', description: errorMessage(e, 'Tente novamente.'), variant: 'destructive' });
      return false;
    }
  };

  const handleUpdateStatus = async (task: ActionPlanTask) => {
    try {
      await actionPlanApi.updateTask(task.id, { status: nextStatus(task.status) });
      onRefresh?.();
    } catch (e) {
      console.error('Erro ao mudar o status da ação', e);
      toast({ title: 'Não foi possível mudar o status', description: errorMessage(e, 'Tente novamente.'), variant: 'destructive' });
    }
  };

  const columns: DataColumn<ActionPlanTask>[] = [
    {
      id: 'what',
      header: 'O quê',
      width: 'minmax(0,1.5fr)',
      primary: true,
      cell: (t) => (
        <div className="flex min-w-0 items-start gap-2">
          <span aria-label={`Ação ${numbers.get(t.id)}`} className="w-5 shrink-0 pt-1 text-[13px] font-semibold tabular-nums text-muted-foreground">{numbers.get(t.id)}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ActionPlanCell value={t.what} onSave={(v) => handleUpdateField(t.id, 'what', v)} placeholder="O que será feito?" className="font-semibold" />
            {t.howMuch && <span className="px-1.5 text-xs font-medium text-muted-foreground">Custo: {t.howMuch}</span>}
            {t.sourceLabel && <span className="px-1.5 text-xs text-muted-foreground">de: {t.sourceLabel}</span>}
          </div>
        </div>
      ),
    },
    {
      id: 'why',
      header: 'Por quê',
      width: 'minmax(0,1.1fr)',
      cell: (t) => <ActionPlanCell value={t.why} onSave={(v) => handleUpdateField(t.id, 'why', v)} placeholder="Por quê?" />,
    },
    {
      id: 'how',
      header: 'Como',
      width: 'minmax(0,1.1fr)',
      cell: (t) => <ActionPlanCell value={t.how} onSave={(v) => handleUpdateField(t.id, 'how', v)} placeholder="Como?" />,
    },
    {
      id: 'where',
      header: 'Onde',
      width: 'minmax(0,0.8fr)',
      cell: (t) => <ActionPlanCell value={t.where} onSave={(v) => handleUpdateField(t.id, 'where', v)} placeholder="Onde?" />,
    },
    {
      id: 'when',
      header: 'Quando',
      width: dueDates ? 'minmax(0,1.1fr)' : 'minmax(0,0.8fr)',
      cell: (t) =>
        dueDates ? (
          <div className="flex min-w-0 flex-col gap-1">
            <DueDateCell value={dueDateOf(t)} number={numbers.get(t.id)} overdue={isOverdue(t, clock)} onSave={(v) => handleUpdateDue(t.id, v)} />
            <ActionPlanCell value={t.when} onSave={(v) => handleUpdateField(t.id, 'when', v)} placeholder="Observação do prazo" />
          </div>
        ) : (
          <ActionPlanCell value={t.when} onSave={(v) => handleUpdateField(t.id, 'when', v)} placeholder="Quando?" />
        ),
    },
    {
      id: 'who',
      header: 'Quem',
      width: 'minmax(0,1fr)',
      cell: (t) => (
        <div className="flex min-w-0 items-start gap-1.5">
          {t.who ? (
            <InitialsAvatar name={t.who} className="mt-0.5 h-6 w-6 shrink-0 text-xs" />
          ) : (
            <span aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-muted" />
          )}
          <ActionPlanCell value={t.who} onSave={(v) => handleUpdateField(t.id, 'who', v)} placeholder="Sem responsável" className="flex-1" />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: '172px',
      cell: (t) => {
        const status = normalizeStatus(t.status);
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleUpdateStatus(t)}
              aria-label={`Status: ${STATUS_LABEL[status]}. Clique para avançar para o próximo status`}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-xl:min-h-11 max-xl:items-center max-xl:inline-flex"
            >
              <StatusChip tone={STATUS_TONE[status]} className="h-7 cursor-pointer px-3 text-[13px] transition-opacity hover:opacity-80">
                {STATUS_LABEL[status]}
              </StatusChip>
            </button>
            <IconButton
              size="sm"
              icon={Pencil}
              label={`Editar detalhes da ação ${numbers.get(t.id)}`}
              onClick={() => handleEdit(t)}
              className="max-xl:h-11 max-xl:w-11"
            />
          </div>
        );
      },
    },
  ];

  const status = refreshStatus ?? { phase: 'idle' as const, lastOkAt: null };
  const refreshText = (() => {
    if (status.phase === 'loading') return 'Atualizando…';
    if (status.phase === 'error') return status.lastOkAt ? `Sem atualizar desde ${formatClock(status.lastOkAt)}` : 'Sem atualizar';
    if (status.lastOkAt) return `Atualizado ${formatAgo((now ?? status.lastOkAt) - status.lastOkAt)}`;
    return null;
  })();

  return (
    <div className="flex flex-col gap-4 max-md:pb-20">
      <KpiRow className="grid-cols-2">
        {(
          [
            ['todo', summary.todo, CircleDashed, 'neutral'],
            ['doing', summary.doing, CircleDot, 'brand'],
            ['done', summary.done, CircleCheck, 'success'],
            ['blocked', summary.blocked, CircleAlert, 'danger'],
          ] as const
        ).map(([key, value, icon, tone]) => (
          <KpiCard key={key} label={STATUS_LABEL[key]} value={value} icon={icon} tone={tone} />
        ))}
      </KpiRow>

      <DataToolbar
        search={{
          value: filters.query,
          onChange: (query) => setFilters((f) => ({ ...f, query })),
          placeholder: 'Buscar nas ações',
        }}
        filters={
          <>
            <SelectField
              aria-label="Filtrar por status"
              value={filters.status}
              onChange={(status) => setFilters((f) => ({ ...f, status: status as TaskFilters['status'] }))}
              options={STATUS_FILTER_OPTIONS}
              className="h-[38px] w-full sm:w-[180px] max-sm:h-11"
            />
            <SelectField
              aria-label="Filtrar por responsável"
              value={filters.who}
              onChange={(who) => setFilters((f) => ({ ...f, who }))}
              options={whoOptions}
              className="h-[38px] w-full sm:w-[210px] max-sm:h-11"
            />
            {dueDates && (
              <>
                <SelectField
                  aria-label="Filtrar por prazo"
                  value={due}
                  onChange={(v) => setDue(v as DueFilter)}
                  options={dueOptions}
                  className="h-[38px] w-full sm:w-[190px] max-sm:h-11"
                />
                <SelectField
                  aria-label="Ordenar as ações"
                  value={sort}
                  onChange={(v) => setSort(v as TaskSort)}
                  options={SORT_OPTIONS}
                  className="h-[38px] w-full sm:w-[190px] max-sm:h-11"
                />
              </>
            )}
          </>
        }
        count={{ shown: visible.length, total: tasks.length, noun: tasks.length === 1 ? 'ação' : 'ações' }}
        actions={
          <>
            {refreshText && (
              <span
                role={status.phase === 'error' ? 'status' : undefined}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                {status.phase === 'error' && onRefreshNow && (
                  <button
                    type="button"
                    onClick={onRefreshNow}
                    className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Tentar agora
                  </button>
                )}
                {refreshText}
              </span>
            )}
            <ModalButton variant="primary" className="hidden gap-2 md:inline-flex" onClick={handleOpenNew}>
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Nova ação
            </ModalButton>
          </>
        }
      />

      {tasks.length === 0 ? (
        <div className={PAGE_CARD}>
          <EmptyState
            embedded
            icon={ListChecks}
            title="Nenhuma ação definida ainda"
            description="Comece pelo primeiro item do plano: o que será feito e quem faz. O resto do 5W2H vocês completam na própria tabela."
            actions={
              <ModalButton variant="primary" className="gap-2" onClick={handleOpenNew}>
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Nova ação
              </ModalButton>
            }
          />
        </div>
      ) : (
        <DataTable
          ariaLabel="Ações do plano (5W2H)"
          columns={columns}
          rows={visible}
          getRowId={(t) => t.id}
          empty={
            <EmptyState
              embedded
              icon={FilterX}
              title="Nenhuma ação neste filtro"
              description="Tente outro texto ou limpe os filtros para ver as ações todas."
              actions={
                filtering ? (
                  <ModalButton className="gap-2" onClick={() => { setFilters(NO_FILTERS); setDue('all'); }}>
                    <FilterX className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Limpar filtros
                  </ModalButton>
                ) : undefined
              }
            />
          }
        />
      )}

      {/* Celular: Nova ação fixa no pé */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <ModalButton variant="primary" className="h-12 w-full gap-2 text-base" onClick={handleOpenNew}>
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Nova ação
        </ModalButton>
      </div>

      {isDialogOpen && (
        <ActionTaskDialog
          boardId={board.id}
          task={editingTask}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          totalTasks={tasks.length}
          onSaveSuccess={onRefresh}
          people={people}
          dueDates={dueDates}
        />
      )}
    </div>
  );
}
