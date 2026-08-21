'use client';

import React, { useState } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Plus, 
  ExternalLink, 
  Clock, 
  AlertCircle,
  MoreVertical,
  Target as TodoIcon,
  Zap as DoingIcon,
  CheckCircle2 as DoneIcon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { KanbanCardData, KanbanStatus, KanbanPriority } from './types';
import { motion, AnimatePresence } from 'framer-motion';

interface KanbanBoardProps {
  cards: KanbanCardData[];
  isLoading: boolean;
  onUpdateStatus: (id: string, newStatus: KanbanStatus) => void;
  onEditCard: (card: KanbanCardData) => void;
  onAddTask: (status: KanbanStatus) => void;
}

export function KanbanBoard({ cards, isLoading, onUpdateStatus, onEditCard, onAddTask }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCard = cards.find(c => c.id === activeId);
    if (!activeCard) return;

    // Check if over a column or another card
    const isOverAColumn = ['todo', 'doing', 'done'].includes(overId);
    const overCard = cards.find(c => c.id === overId);

    if (isOverAColumn) {
      if (activeCard.status !== overId) {
        onUpdateStatus(activeId, overId as KanbanStatus);
      }
    } else if (overCard) {
      if (activeCard.status !== overCard.status) {
        onUpdateStatus(activeId, overCard.status);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
  };

  const activeCard = activeId ? cards.find(c => c.id === activeId) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 min-h-0 overflow-x-auto no-scrollbar pb-6 px-1">
          <div className="flex flex-row gap-6 h-full min-w-max md:min-w-0 md:grid md:grid-cols-3">
            <KanbanColumn 
              id="todo"
              title="A Fazer" 
              color="bg-rose-500" 
              icon={<TodoIcon className="h-4 w-4 text-rose-500" />}
              cards={cards.filter(c => c.status === 'todo')} 
              onAddTask={() => onAddTask('todo')}
              onEditCard={onEditCard}
              isLoading={isLoading}
              className="w-[85vw] md:w-auto"
            />
            <KanbanColumn 
              id="doing"
              title="Em Andamento" 
              color="bg-amber-500" 
              icon={<DoingIcon className="h-4 w-4 text-amber-500" />}
              cards={cards.filter(c => c.status === 'doing')} 
              onAddTask={() => onAddTask('doing')}
              onEditCard={onEditCard}
              isLoading={isLoading}
              className="w-[85vw] md:w-auto"
            />
            <KanbanColumn 
              id="done"
              title="Concluído" 
              color="bg-emerald-500" 
              icon={<DoneIcon className="h-4 w-4 text-emerald-500" />}
              cards={cards.filter(c => c.status === 'done')} 
              onAddTask={() => onAddTask('done')}
              onEditCard={onEditCard}
              isLoading={isLoading}
              className="w-[85vw] md:w-auto"
            />
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
          {activeCard ? (
            <KanbanCard card={activeCard} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface ColumnProps {
  id: string;
  title: string;
  color: string;
  icon: React.ReactNode;
  cards: KanbanCardData[];
  onAddTask: () => void;
  onEditCard: (card: KanbanCardData) => void;
  isLoading: boolean;
  className?: string;
}

function KanbanColumn({ id, title, color, icon, cards, onAddTask, onEditCard, isLoading, className }: ColumnProps) {
  return (
    <div 
      className={cn(
        "flex flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-5 min-h-[500px] border border-slate-200 dark:border-slate-800 shadow-sm group/col transition-all duration-300",
        className
      )}
    >
      <div className="flex items-center justify-between px-1 shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl bg-slate-50 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700")}>
            {icon}
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-black font-headline uppercase tracking-tight italic text-slate-900 dark:text-slate-100 leading-none">{title}</h3>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">{cards.length} Itens</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all active:scale-95" 
          onClick={onAddTask}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext id={id} items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <ScrollArea className="flex-1 -mr-2 pr-2">
          <div className="flex flex-col gap-3 pb-4 px-0.5">
            <AnimatePresence initial={false}>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-slate-100/50 dark:bg-slate-800/50 animate-pulse rounded-2xl border border-slate-100 dark:border-slate-800" />
                ))
              ) : (
                cards.map((card) => (
                  <SortableCard 
                    key={card.id} 
                    card={card} 
                    onClick={() => onEditCard(card)} 
                  />
                ))
              )}
            </AnimatePresence>
            
            {cards.length === 0 && !isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 opacity-30 text-center space-y-2"
              >
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                   <Clock className="h-5 w-5 text-slate-400" />
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest">Sem tarefas</p>
              </motion.div>
            )}
          </div>
        </ScrollArea>
      </SortableContext>
    </div>
  );
}

function SortableCard({ card, onClick }: { card: KanbanCardData; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "relative transition-opacity",
        isDragging ? "opacity-30" : "opacity-100"
      )}
    >
      <KanbanCard card={card} onClick={onClick} />
    </div>
  );
}

function KanbanCard({ card, onClick, isOverlay }: { card: KanbanCardData; onClick?: () => void; isOverlay?: boolean }) {
  const priorityConfig: Record<KanbanPriority, { dot: string; label: string; bg: string; text: string; gradient: string }> = {
    baixa: { dot: 'bg-slate-300 dark:bg-slate-600', label: 'Baixa', bg: 'bg-slate-50', text: 'text-slate-500', gradient: 'from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600' },
    media: { dot: 'bg-sky-400', label: 'Média', bg: 'bg-sky-50/30', text: 'text-sky-600', gradient: 'from-sky-400 to-blue-500' },
    alta: { dot: 'bg-amber-500', label: 'Alta', bg: 'bg-amber-50/30', text: 'text-amber-600', gradient: 'from-amber-400 to-orange-500' },
    critica: { dot: 'bg-rose-500', label: 'Crítica', bg: 'bg-rose-50/30', text: 'text-rose-600', gradient: 'from-rose-500 to-red-600' }
  };
  
  const p = priorityConfig[card.priority] || priorityConfig.media;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "cursor-grab active:cursor-grabbing transform transition-all duration-200 hover:-translate-y-1 group",
        isOverlay && "scale-105 rotate-2 cursor-grabbing shadow-xl z-50 pointer-events-none"
      )}
    >
      <Card className={cn(
        "relative border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl bg-white dark:bg-slate-900 overflow-hidden transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-md",
        isOverlay && "border-primary shadow-xl"
      )}>
        {/* Accent Bar */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b opacity-80", p.gradient)} />
        
        {/* Glowing Background on Critical */}
        {card.priority === 'critica' && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2" />
        )}

        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-xs font-bold leading-snug text-slate-900 dark:text-slate-100 flex-1 tracking-tight group-hover:text-primary transition-colors">
              {card.title}
            </h4>
            <div className={cn("w-2 h-2 rounded-full shrink-0 mt-0.5 shadow-sm transition-all group-hover:scale-125", p.dot)} />
          </div>
          
          {card.description && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">
              {card.description}
            </p>
          )}
          
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
               <div className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
                  <div className={cn("w-1 h-1 rounded-full", p.dot)} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{card.tag}</span>
               </div>
               
               {card.priority === 'critica' && (
                 <div className="flex items-center gap-1 text-[8px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest animate-pulse">
                    <AlertCircle className="h-3 w-3" />
                    <span>Urgente</span>
                 </div>
               )}
            </div>
            
            {card.originLink && (
              <div className="h-6 w-6 rounded-lg bg-primary/5 text-primary/60 flex items-center justify-center transition-all group-hover:bg-primary group-hover:text-white">
                <ExternalLink className="h-3 w-3" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
