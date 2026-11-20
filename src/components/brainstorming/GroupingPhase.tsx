'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  defaultDropAnimationSideEffects,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { FolderPlus, GripVertical, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog, FIELD, FOCUS_RING, IconButton, ModalButton } from '@/components/room-kit';
import type { BrainstormingGroup, BrainstormingIdea } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useIdeaView } from './brainstorm-context';
import { groupColorOf, NO_GROUP_COLOR } from './brainstorm-room-logic';
import { IdeaCard } from './IdeaCard';
import { MoveToMenu, type MoveToOption } from './MoveToMenu';

const UNASSIGNED = 'unassigned';

interface GroupingPhaseProps {
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  /** Devolve true quando o grupo foi criado; o campo só é limpo nesse caso. */
  onAddGroup: (title: string) => Promise<boolean> | boolean;
  onDeleteGroup: (id: string) => void;
  onMoveIdeaToGroup: (ideaId: string, groupId: string | null) => void;
  onVoteIdea: (id: string) => void;
}

function DraggableIdea({
  idea,
  options,
  onMove,
  onVote,
}: {
  idea: BrainstormingIdea;
  options: MoveToOption[];
  onMove: (groupId: string | null) => void;
  onVote: (id: string) => void;
}) {
  const { readOnly = false } = useIdeaView();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: idea.id, data: { idea }, disabled: readOnly });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  const current = idea.groupId ?? UNASSIGNED;
  const moveOptions = options.map((o) => ({ ...o, current: o.id === current }));

  return (
    <div ref={setNodeRef} style={style} className={cn('flex items-start gap-1', isDragging && 'opacity-0')}>
      {!readOnly && <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label="Arrastar a ideia para outro grupo"
          title="Arrastar a ideia para outro grupo"
          className={cn('flex h-8 w-7 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing max-sm:h-11 max-sm:w-9', FOCUS_RING)}
        >
          <GripVertical className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
        <MoveToMenu
          options={moveOptions}
          label="Mover a ideia para outro grupo"
          menuLabel="Mover para…"
          onSelect={(id) => onMove(id === UNASSIGNED ? null : id)}
          className="h-8 w-7"
        />
      </div>}
      <div className="min-w-0 flex-1">
        <IdeaCard idea={idea} onVote={onVote} />
      </div>
    </div>
  );
}

function GroupColumn({
  group,
  ideas,
  options,
  onMove,
  onVote,
  onDelete,
}: {
  group: BrainstormingGroup | null;
  ideas: BrainstormingIdea[];
  options: MoveToOption[];
  onMove: (ideaId: string, groupId: string | null) => void;
  onVote: (id: string) => void;
  onDelete?: (group: BrainstormingGroup, count: number) => void;
}) {
  const { readOnly = false } = useIdeaView();
  const { setNodeRef, isOver } = useDroppable({ id: group?.id ?? UNASSIGNED, disabled: readOnly });
  const title = group?.title ?? 'Sem grupo';

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        'flex min-h-[420px] w-[min(86vw,340px)] shrink-0 flex-col rounded-2xl border p-3 transition-colors duration-fast sm:w-[320px]',
        isOver ? 'border-dashed border-primary bg-primary/10 dark:bg-primary/15' : 'border-border bg-card/60'
      )}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group ? groupColorOf(group) : NO_GROUP_COLOR }} />
        <h3 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={title}>{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{ideas.length}</span>
        {group && onDelete && !readOnly && (
          <IconButton
            size="sm"
            label={`Apagar o grupo ${group.title}`}
            icon={Trash2}
            onClick={() => onDelete(group, ideas.length)}
            className="border-transparent text-muted-foreground hover:text-red-700 dark:hover:text-red-300 max-sm:h-11 max-sm:w-11"
          />
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {ideas.map((idea) => (
          <DraggableIdea key={idea.id} idea={idea} options={options} onMove={(groupId) => onMove(idea.id, groupId)} onVote={onVote} />
        ))}
        {ideas.length === 0 && (
          <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
            <Plus className="h-5 w-5 opacity-60" strokeWidth={1.5} aria-hidden="true" />
            {isOver ? 'Solte aqui para mover' : 'Arraste ideias aqui para classificar'}
          </div>
        )}
        {ideas.length > 0 && isOver && <div className="rounded-xl border border-dashed border-primary/60 py-3 text-center text-[13px] text-muted-foreground">Solte aqui para mover</div>}
      </div>
    </section>
  );
}

/**
 * Etapa 3, Grupos: colunas por grupo, com "Sem grupo" à esquerda. Criar grupo, arrastar a ideia pela alça (ou
 * escolher "Mover para…", que também serve ao toque e ao teclado) e apagar o grupo (as ideias voltam para "Sem grupo").
 */
export function GroupingPhase({ ideas, groups, onAddGroup, onDeleteGroup, onMoveIdeaToGroup, onVoteIdea }: GroupingPhaseProps) {
  const { readOnly = false } = useIdeaView();
  const [activeIdea, setActiveIdea] = useState<BrainstormingIdea | null>(null);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<{ group: BrainstormingGroup; count: number } | null>(null);

  const submitGroup = async () => {
    const title = newGroupTitle.trim();
    if (!title || creating || readOnly) return;
    setCreating(true);
    try {
      const saved = await onAddGroup(title);
      // só limpa se criou: se falhar, o nome digitado continua no campo
      if (saved !== false) setNewGroupTitle('');
    } finally {
      setCreating(false);
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  const handleDragStart = (event: DragStartEvent) => {
    const { idea } = event.active.data.current as { idea: BrainstormingIdea };
    setActiveIdea(idea);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIdea(null);
    if (over) onMoveIdeaToGroup(active.id as string, over.id === UNASSIGNED ? null : (over.id as string));
  };

  const options = useMemo<MoveToOption[]>(
    () => [{ id: UNASSIGNED, label: 'Sem grupo', color: NO_GROUP_COLOR }, ...groups.map((g) => ({ id: g.id, label: g.title, color: groupColorOf(g) }))],
    [groups]
  );

  const columns = [
    { group: null as BrainstormingGroup | null, ideas: ideas.filter((i) => !i.groupId) },
    ...groups.map((g) => ({ group: g as BrainstormingGroup | null, ideas: ideas.filter((i) => i.groupId === g.id) })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-foreground">Grupos</h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Organize as ideias em grupos lógicos. Arraste pela alça ou use &ldquo;Mover para&rdquo;.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitGroup();
          }}
          className="flex w-full items-center gap-2 sm:w-auto"
        >
          <input
            value={newGroupTitle}
            onChange={(e) => setNewGroupTitle(e.target.value)}
            placeholder="Nome do novo grupo"
            aria-label="Nome do novo grupo"
            maxLength={255}
            disabled={readOnly}
            className={cn(FIELD, 'h-11 min-w-0 flex-1 sm:w-64 sm:flex-none disabled:cursor-not-allowed')}
          />
          <ModalButton type="submit" variant="primary" className="h-11 shrink-0 gap-2" disabled={!newGroupTitle.trim() || creating || readOnly}>
            <FolderPlus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Criar grupo
          </ModalButton>
        </form>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex snap-x gap-4 overflow-x-auto pb-3 sm:snap-none">
          {columns.map(({ group, ideas: columnIdeas }) => (
            <GroupColumn
              key={group?.id ?? UNASSIGNED}
              group={group}
              ideas={columnIdeas}
              options={options}
              onMove={onMoveIdeaToGroup}
              onVote={onVoteIdea}
              onDelete={group ? (g, count) => setToDelete({ group: g, count }) : undefined}
            />
          ))}
        </div>
        {groups.length > 1 && <p className="m-0 text-center text-xs text-muted-foreground sm:hidden">Role para os lados para ver mais grupos.</p>}

        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeIdea ? (
            <div className="pointer-events-none w-[300px] rotate-2 opacity-90">
              <IdeaCard idea={activeIdea} className="border-primary shadow-2xl" />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(next) => { if (!next) setToDelete(null); }}
        tone="danger"
        icon={Trash2}
        title={`Apagar o grupo "${toDelete?.group.title ?? ''}"?`}
        description={toDelete && toDelete.count > 0 ? `${toDelete.count === 1 ? 'A ideia dele volta' : `As ${toDelete.count} ideias dele voltam`} para "Sem grupo".` : 'O grupo está vazio.'}
        cancelLabel="Cancelar"
        confirmLabel="Apagar grupo"
        onConfirm={() => {
          if (toDelete) onDeleteGroup(toDelete.group.id);
        }}
      />
    </div>
  );
}
