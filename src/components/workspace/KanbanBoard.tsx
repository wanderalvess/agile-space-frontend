'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { AlertCircle, CalendarClock, Clock, ExternalLink, Plus } from 'lucide-react';
import { ModalButton, IconButton } from '@/components/room-kit';
import { ErrorState } from '@/components/page';
import { PAGE_CARD } from '@/components/page/styles';
import { cn } from '@/lib/utils';
import type { KanbanCardData, KanbanPriority, KanbanStatus } from './types';
import {
  KANBAN_FILTERS,
  KANBAN_FILTER_LABELS,
  KANBAN_PRIORITY_LABELS,
  KANBAN_STATUS_LABELS,
  describeDue,
  filterKanbanCards,
  type DueTone,
  type KanbanFilter,
} from './kanban-utils';
import { SubTabs, WorkspaceSectionHeader } from './workspace-ui';

const STATUSES: KanbanStatus[] = ['todo', 'doing', 'done'];

const STATUS_DOT: Record<KanbanStatus, string> = {
  todo: 'bg-muted-foreground/60',
  doing: 'bg-primary',
  done: 'bg-emerald-600 dark:bg-emerald-400',
};

const PRIORITY_BAR: Record<KanbanPriority, string> = {
  baixa: 'bg-muted-foreground/50',
  media: 'bg-sky-500',
  alta: 'bg-amber-500',
  critica: 'bg-red-500',
};

const DUE_CHIP: Record<DueTone, string> = {
  overdue: 'bg-red-500/10 text-red-700 dark:text-red-300',
  soon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  normal: 'bg-muted text-muted-foreground',
};

/** Alvo do arrasto: a coluna sob o ponteiro; com o teclado (sem ponteiro) vale a que mais cobre o cartão. */
const collisionDetection: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  return byPointer.length > 0 ? byPointer : rectIntersection(args);
};

/** Teclado: Espaço pega o cartão, ← e → trocam de coluna, Espaço solta, Esc cancela. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context: { active, droppableRects, droppableContainers, collisionRect } }) => {
  if (!active || !collisionRect) return undefined;
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return undefined;
  event.preventDefault();
  const columns = droppableContainers
    .getEnabled()
    .map((c) => ({ rect: droppableRects.get(c.id) }))
    .filter((c): c is { rect: NonNullable<typeof c.rect> } => !!c.rect)
    .sort((a, b) => a.rect.left - b.rect.left);
  if (columns.length === 0) return undefined;
  const center = collisionRect.left + collisionRect.width / 2;
  const current = Math.max(0, columns.findIndex((c) => center >= c.rect.left && center <= c.rect.right));
  const next = columns[Math.max(0, Math.min(columns.length - 1, current + (event.code === 'ArrowRight' ? 1 : -1)))];
  return { x: next.rect.left + (next.rect.width - collisionRect.width) / 2, y: collisionRect.top };
};

interface KanbanBoardProps {
  cards: KanbanCardData[];
  isLoading: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  onUpdateStatus: (id: string, newStatus: KanbanStatus) => void;
  onEditCard: (card: KanbanCardData) => void;
  onAddTask: (status: KanbanStatus) => void;
}

export function KanbanBoard({ cards, isLoading, loadError, onRetry, onUpdateStatus, onEditCard, onAddTask }: KanbanBoardProps) {
  const [filter, setFilter] = useState<KanbanFilter>('todas');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnKeyboardCoordinates,
      // Enter abre a tarefa; só Espaço pega o cartão.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const filtered = useMemo(() => filterKanbanCards(cards, filter), [cards, filter]);

  const statusOf = (id: UniqueIdentifier | undefined | null): KanbanStatus | null => {
    const key = id === undefined || id === null ? '' : String(id);
    return (STATUSES as string[]).includes(key) ? (key as KanbanStatus) : null;
  };

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  // O servidor é avisado uma vez, ao soltar numa coluna diferente da de origem.
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const card = cards.find((c) => c.id === String(event.active.id));
    const target = statusOf(event.over?.id);
    if (card && target && target !== card.status) onUpdateStatus(card.id, target);
  };

  const activeCard = activeId ? cards.find((c) => c.id === activeId) ?? null : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Quadro Kanban"
        subtitle="Seu fluxo de trabalho pessoal"
        action={
          <ModalButton variant="primary" onClick={() => onAddTask('todo')}>
            <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Nova tarefa
          </ModalButton>
        }
      />

      {loadError ? (
        <ErrorState title="Não foi possível carregar as tarefas" description="Verifique a conexão e tente de novo." onRetry={onRetry} />
      ) : (
        <>
          <SubTabs
            role="group"
            label="Filtro"
            value={filter}
            onChange={setFilter}
            items={KANBAN_FILTERS.map((id) => ({ id, label: KANBAN_FILTER_LABELS[id] }))}
          />
          <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
            <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
              {STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  cards={filtered.filter((c) => c.status === status)}
                  filtered={filter !== 'todas'}
                  isLoading={isLoading}
                  dragging={!!activeCard}
                  onAddTask={() => onAddTask(status)}
                  onEditCard={onEditCard}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
              {activeCard ? <KanbanCard card={activeCard} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  cards,
  filtered,
  isLoading,
  dragging,
  onAddTask,
  onEditCard,
}: {
  status: KanbanStatus;
  cards: KanbanCardData[];
  filtered: boolean;
  isLoading: boolean;
  dragging: boolean;
  onAddTask: () => void;
  onEditCard: (card: KanbanCardData) => void;
}) {
  const title = KANBAN_STATUS_LABELS[status];
  // A coluna inteira recebe o cartão, inclusive quando está vazia.
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        PAGE_CARD,
        'flex min-h-[420px] w-[85vw] shrink-0 snap-center flex-col rounded-[20px] p-4 transition-colors duration-fast md:w-auto',
        dragging && 'border-dashed',
        isOver && 'border-primary/70 bg-primary/5',
      )}
    >
      <header className="mb-3 flex shrink-0 items-center gap-3">
        <span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_DOT[status])} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="text-sm font-bold leading-tight text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {isLoading ? '…' : cards.length} {cards.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
        <IconButton label={`Adicionar tarefa em ${title}`} icon={Plus} onClick={onAddTask} />
      </header>

      <div className="flex flex-1 flex-col gap-2.5" aria-busy={isLoading || undefined}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl border border-border bg-muted/40 motion-safe:animate-pulse" />)
        ) : (
          cards.map((card) => <DraggableCard key={card.id} card={card} onClick={() => onEditCard(card)} />)
        )}

        {!isLoading && cards.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-3 py-10 text-center text-muted-foreground">
            <Clock className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-[13px] font-semibold">{filtered ? 'Nenhuma tarefa neste filtro' : 'Sem tarefas aqui'}</p>
            {!filtered && (
              <ModalButton variant="ghost" className="h-9 px-3 text-[13px] text-primary [.theme-totvs:not(.dark)_&]:text-foreground" onClick={onAddTask}>
                <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Criar tarefa
              </ModalButton>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ card, onClick }: { card: KanbanCardData; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        (listeners as { onKeyDown?: (ev: React.KeyboardEvent) => void } | undefined)?.onKeyDown?.(e);
        if (e.key === 'Enter' && !isDragging) onClick();
      }}
      aria-label={`Tarefa: ${card.title}. Enter abre, Espaço move`}
      className={cn('relative rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', isDragging ? 'opacity-30' : 'opacity-100')}
    >
      <KanbanCard card={card} onClick={onClick} />
    </div>
  );
}

function KanbanCard({ card, onClick, isOverlay }: { card: KanbanCardData; onClick?: () => void; isOverlay?: boolean }) {
  const priority: KanbanPriority = card.priority in KANBAN_PRIORITY_LABELS ? card.priority : 'media';
  const due = describeDue(card.dueDate, { done: card.status === 'done' });
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative cursor-grab overflow-hidden rounded-2xl border border-border bg-card text-card-foreground transition-[border-color,box-shadow] duration-fast active:cursor-grabbing',
        'hover:border-primary/40 hover:shadow-md',
        isOverlay && 'pointer-events-none rotate-1 cursor-grabbing border-primary shadow-xl',
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', PRIORITY_BAR[priority])} />
      <div className="flex flex-col gap-2 py-3.5 pl-4 pr-3.5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="flex-1 text-sm font-semibold leading-snug text-foreground">{card.title}</h4>
          <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', PRIORITY_BAR[priority])} title={`Prioridade: ${KANBAN_PRIORITY_LABELS[priority]}`} />
          <span className="sr-only">Prioridade {KANBAN_PRIORITY_LABELS[priority]}</span>
        </div>
        {card.description && <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{card.description}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          {card.tag && <span className="inline-flex h-[22px] items-center rounded-md border border-border bg-muted/60 px-2 text-xs font-semibold text-muted-foreground">{card.tag}</span>}
          {priority === 'critica' && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-300">
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Urgente
            </span>
          )}
          {due && (
            <span className={cn('inline-flex h-[22px] items-center gap-1 rounded-md px-2 text-xs font-semibold', DUE_CHIP[due.tone])}>
              <CalendarClock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> {due.label}
            </span>
          )}
          <span className="flex-1" />
          {card.originLink && (
            <span title="Vem de uma cerimônia" className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">Vem de uma cerimônia</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
