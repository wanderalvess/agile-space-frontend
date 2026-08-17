'use client';

import React, { useState } from 'react';
import { BrainstormingIdea, BrainstormingGroup } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Target, Zap, Rocket, Trash, MinusCircle, ChevronRight, AlertCircle, GripVertical } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface PrioritizationPhaseProps {
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  onUpdateQualifiers: (ideaId: string, qualifiers: { roi: number, effort: number }) => void;
  isAnonymous: boolean;
}

const COLUMNS = [
  { id: 'unclassified', title: 'A Classificar', icon: Target, color: 'bg-slate-100 text-slate-500 border-slate-200', activeColor: 'ring-slate-400', badge: 'bg-slate-200 text-slate-600' },
  { id: 'quick_wins', title: 'Quick Wins', icon: Zap, color: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeColor: 'ring-emerald-500', badge: 'bg-emerald-200 text-emerald-800', roi: 80, effort: 20 },
  { id: 'strategic', title: 'Estratégico', icon: Rocket, color: 'bg-amber-50 border-amber-200 text-amber-700', activeColor: 'ring-amber-500', badge: 'bg-amber-200 text-amber-800', roi: 80, effort: 80 },
  { id: 'secondary', title: 'Secundários', icon: MinusCircle, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', activeColor: 'ring-indigo-500', badge: 'bg-indigo-200 text-indigo-800', roi: 20, effort: 20 },
  { id: 'discard', title: 'Descartar', icon: Trash, color: 'bg-rose-50 border-rose-200 text-rose-700', activeColor: 'ring-rose-500', badge: 'bg-rose-200 text-rose-800', roi: 20, effort: 80 }
];

export function PrioritizationPhase({
  ideas,
  groups,
  onUpdateQualifiers,
  isAnonymous
}: PrioritizationPhaseProps) {
  const [draggedIdeaId, setDraggedIdeaId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  const getColumnId = (idea: BrainstormingIdea) => {
    const { roi = 50, effort = 50 } = idea.qualifiers || {};
    if (roi === 50 && effort === 50) return 'unclassified';
    if (roi > 50 && effort <= 50) return 'quick_wins';
    if (roi > 50 && effort > 50) return 'strategic';
    if (roi <= 50 && effort <= 50) return 'secondary';
    if (roi <= 50 && effort > 50) return 'discard';
    return 'unclassified';
  };

  const moveToColumn = (ideaId: string, colId: string) => {
    const col = COLUMNS.find(c => c.id === colId);
    if (!col) return;
    
    if (col.id === 'unclassified') {
      onUpdateQualifiers(ideaId, { roi: 50, effort: 50 });
      return;
    }

    if (col.roi !== undefined && col.effort !== undefined) {
      onUpdateQualifiers(ideaId, { roi: col.roi, effort: col.effort });
    }
  };

  const handleDragStart = (e: React.DragEvent, ideaId: string) => {
    e.dataTransfer.setData('text/plain', ideaId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIdeaId(ideaId);
    
    const dragImage = document.createElement('div');
    dragImage.className = 'w-4 h-4 rounded-full bg-amber-500';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 8, 8);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeColumnId !== colId) {
      setActiveColumnId(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setActiveColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setActiveColumnId(null);
    setDraggedIdeaId(null);
    const ideaId = e.dataTransfer.getData('text/plain');
    if (ideaId) {
      moveToColumn(ideaId, colId);
    }
  };

  const handleDragEnd = () => {
    setDraggedIdeaId(null);
    setActiveColumnId(null);
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="px-8 pt-8 pb-4 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Kanban de Triagem</h2>
          <p className="text-slate-500 text-sm">Arraste os cards para as colunas e priorize o que realmente importa.</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
           <AlertCircle className="h-4 w-4 text-amber-500" />
           <span className="text-xs font-bold text-amber-700">Dica: O foco principal do time deve ser nos Quick Wins!</span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-8 px-8 flex gap-6 scrollbar-thin scrollbar-thumb-slate-300">
        {COLUMNS.map((col) => {
          const colIdeas = ideas
            .filter(idea => getColumnId(idea) === col.id)
            .sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));
          const isOver = activeColumnId === col.id;

          return (
            <div 
              key={col.id} 
              className={cn(
                "flex-shrink-0 w-80 flex flex-col rounded-[2rem] border-2 transition-all duration-300 relative",
                col.color,
                isOver ? `ring-4 ${col.activeColor} ring-offset-2 scale-[1.02]` : ""
              )}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="p-5 flex items-center justify-between border-b border-black/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shadow-sm">
                    <col.icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-black text-[11px] uppercase tracking-widest">{col.title}</h3>
                </div>
                <span className={cn("px-2.5 py-1 rounded-full text-xs font-black", col.badge)}>
                  {colIdeas.length}
                </span>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="min-h-[100px] flex flex-col gap-3">
                  <AnimatePresence>
                    {colIdeas.map((idea) => {
                      const groupColor = groups.find(g => g.id === idea.groupId)?.color || '#94a3b8';
                      const isDragging = draggedIdeaId === idea.id;

                      return (
                        <motion.div
                          key={idea.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e as any, idea.id)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "bg-white rounded-xl p-3 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing transition-all hover:shadow-md",
                            isDragging && "opacity-50 scale-95"
                          )}
                        >
                          <div className="flex gap-3">
                            <div className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                               <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5">
                              <p className="text-[11px] font-semibold text-slate-700 leading-tight">
                                {idea.content}
                              </p>
                              
                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full shadow-sm" 
                                    style={{ backgroundColor: groupColor }} 
                                  />
                                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                    Votos: {idea.votes?.length || 0}
                                  </span>
                                </div>

                                <div className="flex gap-1">
                                  {col.id !== 'quick_wins' && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                      onClick={() => moveToColumn(idea.id, 'quick_wins')}
                                      title="Mover para Quick Wins"
                                    >
                                      <Zap className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {col.id !== 'discard' && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                      onClick={() => moveToColumn(idea.id, 'discard')}
                                      title="Mover para Descartar"
                                    >
                                      <Trash className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {colIdeas.length === 0 && (
                    <div className="h-full min-h-[120px] flex items-center justify-center border-2 border-dashed border-black/10 rounded-2xl mx-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-black/20">Solte aqui</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
