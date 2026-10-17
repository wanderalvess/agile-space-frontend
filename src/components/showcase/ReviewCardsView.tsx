'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { DataToolbar, EmptyState } from '@/components/page';
import { FOCUS_RING, ModalButton, SelectField, type SelectFieldOption } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import type { SessionMember, ShowcaseTask } from './types';
import {
  ALL,
  SORT_LABELS,
  activeFilterChips,
  filterOptions,
  isReviewSort,
  type FilterChip,
  type ReviewFilters,
  type ReviewSort,
} from './review-room-logic';

const PAGE_SIZE = 20;

export interface ReviewCardsViewProps {
  /** Todos os cards da Review (para as listas dos filtros e o contador). */
  allTasks: ShowcaseTask[];
  /** Cards depois da busca, dos filtros e da ordem. */
  filteredTasks: ShowcaseTask[];
  filters: ReviewFilters;
  sortBy: ReviewSort;
  /** Ordem inicial da Review (configurações); "limpar" volta para ela. */
  baseSort: ReviewSort;
  onFiltersChange: (filters: ReviewFilters) => void;
  onSortChange: (sort: ReviewSort) => void;
  onClearAll: () => void;
  onRemoveChip: (chip: FilterChip['id']) => void;
  members: SessionMember[];
  onUpdateTask: (taskId: string, updates: Partial<ShowcaseTask> | ((prev: ShowcaseTask) => ShowcaseTask)) => void | Promise<boolean>;
  onRemoveTask: (taskId: string) => void;
  sessionId?: string;
  onUploadFile?: (taskId: string, file: File) => Promise<void>;
  onDeleteFile?: (fileId: string) => Promise<void>;
  /** Quem registra veredito e feedback; quem não pode vê o feedback do PO só para leitura. */
  canDecide?: boolean;
}

/** Opções de um filtro: "Todos…" mais as do próprio conjunto de cards (o valor escolhido entra mesmo que tenha sumido). */
function withAll(allLabel: string, values: string[], current: string): SelectFieldOption[] {
  const base = values.map((v) => ({ value: v, label: v }));
  if (current !== ALL && !values.includes(current)) base.push({ value: current, label: current });
  return [{ value: ALL, label: allLabel }, ...base];
}

/** Lista de cards: busca, filtros (Dev, QA, Tipo), ordem, chips dos filtros ativos, cards e "Carregar mais". */
export function ReviewCardsView(p: ReviewCardsViewProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { filters, sortBy } = p;

  // Filtro, busca ou ordem mudou o recorte: volta para a primeira página.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filters.search, filters.dev, filters.qa, filters.type, sortBy]);

  const options = useMemo(() => filterOptions(p.allTasks), [p.allTasks]);
  const chips = activeFilterChips(filters, sortBy, p.baseSort);
  const visible = p.filteredTasks.slice(0, visibleCount);
  const sortOptions: SelectFieldOption[] = (Object.keys(SORT_LABELS) as ReviewSort[]).map((k) => ({ value: k, label: SORT_LABELS[k] }));

  return (
    <div className="flex flex-col gap-4 px-3 py-4 sm:px-4 xl:px-6">
      <div data-tour="search">
        <DataToolbar
          search={{ value: filters.search, onChange: (search) => p.onFiltersChange({ ...filters, search }), placeholder: 'Buscar por chave, título, dev ou QA' }}
          filters={
            <>
              <SelectField aria-label="Filtrar por desenvolvedor" value={filters.dev} onChange={(dev) => p.onFiltersChange({ ...filters, dev })} options={withAll('Todos os devs', options.devs, filters.dev)} className="h-[38px] w-[calc(50%-0.25rem)] sm:w-48 max-sm:h-11" />
              <SelectField aria-label="Filtrar por QA" value={filters.qa} onChange={(qa) => p.onFiltersChange({ ...filters, qa })} options={withAll('Todos os QAs', options.qas, filters.qa)} className="h-[38px] w-[calc(50%-0.25rem)] sm:w-48 max-sm:h-11" />
              <SelectField aria-label="Filtrar por tipo" value={filters.type} onChange={(type) => p.onFiltersChange({ ...filters, type })} options={withAll('Todos os tipos', options.types, filters.type)} className="h-[38px] w-[calc(50%-0.25rem)] sm:w-48 max-sm:h-11" />
              <SelectField aria-label="Ordenar os cards por" value={sortBy} onChange={(v) => isReviewSort(v) && p.onSortChange(v)} options={sortOptions} className="h-[38px] w-[calc(50%-0.25rem)] sm:w-48 max-sm:h-11" />
            </>
          }
          count={{ shown: p.filteredTasks.length, total: p.allTasks.length, noun: 'cards' }}
        />
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros ativos">
          <span className="text-xs font-semibold text-muted-foreground">Filtros ativos</span>
          {chips.map((c) => (
            <span key={c.id} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/10 pl-3 pr-1 text-xs font-semibold text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
              <span className="max-w-[16rem] truncate">{c.label}</span>
              <button
                type="button"
                onClick={() => p.onRemoveChip(c.id)}
                aria-label={`Remover o filtro: ${c.label}`}
                className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-primary/15 max-sm:h-6 max-sm:w-6', FOCUS_RING)}
              >
                <X className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </span>
          ))}
          <button type="button" onClick={p.onClearAll} className={cn('inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground max-sm:h-9', FOCUS_RING)}>
            Limpar tudo
          </button>
        </div>
      )}

      {p.filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {visible.map((task, idx) => (
            <TaskCard
              key={task.id}
              task={task}
              index={idx}
              members={p.members}
              onUpdateTask={p.onUpdateTask}
              onRemoveTask={p.onRemoveTask}
              sessionId={p.sessionId}
              onUploadFile={p.onUploadFile}
              onDeleteFile={p.onDeleteFile}
              canDecide={p.canDecide}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Filter}
          title="Nenhuma tarefa encontrada com esses filtros"
          description="Tente outra palavra ou tire algum filtro."
          actions={<ModalButton onClick={p.onClearAll}>Limpar filtros</ModalButton>}
        />
      )}

      {visibleCount < p.filteredTasks.length && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <ModalButton onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Carregar mais {Math.min(PAGE_SIZE, p.filteredTasks.length - visibleCount)} tarefas
          </ModalButton>
          <span className="text-xs tabular-nums text-muted-foreground">{visibleCount} de {p.filteredTasks.length}</span>
        </div>
      )}
      <div className="h-12" aria-hidden="true" />
    </div>
  );
}
