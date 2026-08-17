'use client';

import React, { useState } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  useDraggable, 
  useDroppable, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { BrainstormingIdea, BrainstormingGroup } from '@/lib/types';
import { IdeaCard } from './IdeaCard';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, FolderPlus, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface GroupingPhaseProps {
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  onAddGroup: (title: string) => void;
  onDeleteGroup: (id: string) => void;
  onMoveIdeaToGroup: (ideaId: string, groupId: string | null) => void;
  isAnonymous: boolean;
  onVoteIdea: (id: string) => void;
}

// --- Draggable Idea Item ---
function DraggableIdea({ idea, isAnonymous, onVote }: { idea: BrainstormingIdea, isAnonymous: boolean, onVote: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: idea.id,
    data: { idea }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "relative group transition-opacity",
        isDragging && "opacity-0"
      )}
    >
      <div 
        {...listeners} {...attributes} 
        className="absolute left-2 top-2 z-10 p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 bg-white/50 backdrop-blur-sm rounded-md transition-all"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <IdeaCard 
        idea={idea} 
        isAnonymous={isAnonymous} 
        onVote={onVote} 
        className="scale-95 origin-top-left"
      />
    </div>
  );
}

// --- Droppable Column ---
function GroupColumn({ 
  group, 
  ideas, 
  isAnonymous, 
  onVote, 
  onDelete 
}: { 
  group: BrainstormingGroup | null, 
  ideas: BrainstormingIdea[], 
  isAnonymous: boolean,
  onVote: (id: string) => void,
  onDelete?: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: group?.id || 'unassigned',
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[350px] min-h-[500px] rounded-[2.5rem] p-4 transition-all duration-300",
        isOver ? "bg-amber-100/50 scale-[1.02] border-2 border-dashed border-amber-300" : "bg-white/40 border border-slate-200"
      )}
    >
      <div className="flex items-center justify-between mb-6 px-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            group ? "bg-amber-500" : "bg-slate-300"
          )} />
          <h3 className="font-black text-slate-700 uppercase tracking-widest text-[11px]">
            {group?.title || 'Sem Grupo'} 
            <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-[10px] text-slate-500 font-bold">
              {ideas.length}
            </span>
          </h3>
        </div>
        {group && onDelete && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50"
            onClick={() => onDelete(group.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto scrollbar-thin px-1">
        <AnimatePresence>
          {ideas.map((idea) => (
            <motion.div
              key={idea.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              layout
            >
              <DraggableIdea idea={idea} isAnonymous={isAnonymous} onVote={onVote} />
            </motion.div>
          ))}
          {ideas.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200/50 rounded-[2rem] min-h-[150px] text-slate-300 text-[10px] font-black uppercase tracking-widest italic text-center p-6">
               <Plus className="h-6 w-6 mb-2 opacity-20" />
               Arraste ideias aqui para classificar
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function GroupingPhase({
  ideas,
  groups,
  onAddGroup,
  onDeleteGroup,
  onMoveIdeaToGroup,
  isAnonymous,
  onVoteIdea
}: GroupingPhaseProps) {
  const [activeIdea, setActiveIdea] = useState<BrainstormingIdea | null>(null);
  const [newGroupTitle, setNewGroupTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { idea } = event.active.data.current as { idea: BrainstormingIdea };
    setActiveIdea(idea);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIdea(null);

    if (over) {
      const ideaId = active.id as string;
      const groupId = over.id === 'unassigned' ? null : over.id as string;
      onMoveIdeaToGroup(ideaId, groupId);
    }
  };

  const currentGroups = [
    { id: 'unassigned', title: 'Sem Grupo', ideas: ideas.filter(i => !i.groupId) },
    ...groups.map(g => ({
      ...g,
      ideas: ideas.filter(i => i.groupId === g.id)
    }))
  ];

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header Bar */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Classificação</h2>
          <p className="text-slate-500 text-sm">Organize as ideias em grupos lógicos.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-opacity" />
            <div className="relative flex gap-2 p-1 bg-white rounded-2xl shadow-sm border border-slate-100">
               <Input 
                placeholder="Nome da categoria..."
                value={newGroupTitle}
                onChange={(e) => setNewGroupTitle(e.target.value)}
                className="w-64 border-none focus-visible:ring-0 shadow-none bg-transparent font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGroupTitle.trim()) {
                    onAddGroup(newGroupTitle);
                    setNewGroupTitle('');
                  }
                }}
              />
              <Button 
                size="sm"
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold h-9"
                onClick={() => {
                  if (newGroupTitle.trim()) {
                    onAddGroup(newGroupTitle);
                    setNewGroupTitle('');
                  }
                }}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                Criar Grupo
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DndContext 
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 pb-8 pt-4">
          <div className="flex gap-8 h-full min-w-max pb-4">
            {currentGroups.map((group) => (
              <GroupColumn 
                key={group.id}
                group={group.id === 'unassigned' ? null : group as BrainstormingGroup}
                ideas={group.ideas}
                isAnonymous={isAnonymous}
                onVote={onVoteIdea}
                onDelete={group.id !== 'unassigned' ? onDeleteGroup : undefined}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{
           sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeIdea ? (
            <div className="opacity-90 scale-105 pointer-events-none rotate-3">
              <IdeaCard 
                idea={activeIdea} 
                isAnonymous={isAnonymous} 
                onVote={() => {}} 
                className="shadow-3xl border-2 border-amber-400"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
