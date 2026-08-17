'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RetroCard as RetroCardType, RetroParticipant, RetroColumnTheme } from '@/lib/types';
import {
  Pencil,
  Trash2,
  ThumbsUp,
  UserPlus,
  Calendar,
  GitMerge,
  Clock,
  Ghost,
  User as UserIcon,
  Lock,
  ExternalLink,
  CheckCircle2,
  CornerUpLeft
} from 'lucide-react';
import { AgileCard } from '@/components/shared/EliteCard';
import { AgileBaseCard } from '@/components/shared/EliteBaseCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { User } from 'firebase/auth';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RetroCardProps {
  card: RetroCardType;
  isCardsRevealed: boolean;
  isAuthor: boolean;
  isCreator: boolean;
  onDelete: (cardId: string) => void;
  onUpdate: (cardId: string, newContent: string, assignee?: string, dueDate?: string) => void;
  onToggleVote: (cardId: string, currentVotes: string[]) => void;
  onToggleDone: (cardId: string, isDone: boolean) => void;
  currentUser: User;
  votingStatus: 'disabled' | 'active' | 'finished';
  participants: RetroParticipant[];
  isAuthorsRevealed: boolean;
  mergingSourceId: string | null;
  onStartMerge: (cardId: string | null) => void;
  onExecuteMerge: (targetId: string) => void;
  theme?: RetroColumnTheme;
}

export function RetroCard({
  card, 
  isCardsRevealed, 
  isAuthor, 
  isCreator, 
  onDelete, 
  onUpdate,
  onToggleVote,
  onToggleDone,
  currentUser,
  votingStatus,
  participants,
  isAuthorsRevealed,
  mergingSourceId,
  onStartMerge,
  onExecuteMerge,
  theme,
}: RetroCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(card.content);
  const [editedAssignee, setEditedAssignee] = useState(card.assignee || '');
  const [editedDueDate, setEditedDueDate] = useState(card.dueDate || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Sync state with props to ensure merged content appears when editing starts
  useEffect(() => {
    if (!isEditing) {
      setEditedContent(card.content);
      setEditedAssignee(card.assignee || '');
      setEditedDueDate(card.dueDate || '');
    }
  }, [card.content, card.assignee, card.dueDate, isEditing]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const isActionPlan = theme === 'action' || card.columnKey === 'actionItems';
  const showRealContent = isCardsRevealed || isAuthor || isActionPlan;
  const showAuthorInfo = isAuthorsRevealed || isAuthor || isActionPlan;
  const showVotes = (votingStatus === 'active' || votingStatus === 'finished') && !isActionPlan;
  const canVote = votingStatus === 'active';

  const handleUpdate = () => {
    if (editedContent.trim()) {
      onUpdate(
        card.id, 
        editedContent.trim(), 
        editedAssignee.trim() || undefined, 
        editedDueDate || undefined
      );
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUpdate();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedContent(card.content);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("group select-none relative", isDragging && "opacity-50 scale-95")}>
      {isEditing ? (
        <AgileBaseCard theme="emerald" className="p-6 relative z-10">
          <div className="space-y-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="text-xs min-h-[120px] p-6 bg-slate-50 border-emerald-100 rounded-[2rem] focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 font-bold leading-relaxed"
            />
            
            {isActionPlan && (
              <div className="flex flex-col gap-3 p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100">
                <div className="flex items-center gap-3">
                  <UserPlus className="h-4 w-4 text-emerald-600" />
                  <input 
                    type="text" 
                    list={`participants-list-${card.id}`}
                    placeholder="Responsável..." 
                    value={editedAssignee}
                    onChange={(e) => setEditedAssignee(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest w-full focus:ring-0 p-0 placeholder:text-slate-500"
                  />
                  <datalist id={`participants-list-${card.id}`}>
                    {participants.map(p => (
                      <option key={p.id} value={p.nickname} />
                    ))}
                  </datalist>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <input 
                    type="date" 
                    value={editedDueDate}
                    onChange={(e) => setEditedDueDate(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest w-full focus:ring-0 p-0 placeholder:text-slate-500 [color-scheme:light]"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-10 px-6 rounded-xl text-slate-500 font-black uppercase text-[10px]" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="h-10 px-8 rounded-xl bg-emerald-600 text-white font-black uppercase text-[10px] shadow-lg shadow-emerald-600/20" onClick={handleUpdate}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </AgileBaseCard>
      ) : (
        <AgileCard
          id={card.id}
          variant="retro"
          content={card.content}
          theme={theme || 'emerald'}
          authorId={card.authorId}
          authorName={participants.find(p => p.id === card.authorId)?.nickname}
          currentUserId={currentUser.uid}
          isAnonymous={!showAuthorInfo}
          isRevealed={showRealContent}
          votes={card.votes}
          onVote={() => onToggleVote(card.id, card.votes)}
          canVote={canVote && showVotes}
          isDragging={isDragging}
          isOver={isOver}
          isMergingSource={mergingSourceId === card.id}
          canMergeTarget={!!(mergingSourceId && mergingSourceId !== card.id)}
          assignee={card.assignee}
          onEdit={() => setIsEditing(true)}
          onDelete={() => setIsDeleteDialogOpen(true)}
          onStartMerge={onStartMerge}
          dragHandleProps={{ ...listeners, ...attributes }}
          onClick={() => {
            if (mergingSourceId) {
               if (mergingSourceId !== card.id) {
                 onExecuteMerge(card.id);
               } else {
                 onStartMerge(null);
               }
               return;
            }
            setIsExpanded(!isExpanded);
          }}
          className={cn(
            "relative z-10 transition-all duration-300",
            isExpanded && "min-h-[200px]",
            isActionPlan && card.isDone && "opacity-60"
          )}
        >
           {/* Custom Overlay for Merging (matching Agile standard) */}
           {mergingSourceId && mergingSourceId !== card.id && (
              <div className="absolute top-4 right-4 bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                Destino
              </div>
           )}
           {mergingSourceId === card.id && (
              <div className="absolute top-4 right-4 bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg z-30 border border-white/20 animate-pulse">
                Origem
              </div>
           )}

           {/* Rastreio entre sprints: status + proveniência (linha normal, abaixo do rodapé padrão) */}
           {isActionPlan && (card.carriedFromBoardId || isAuthor || isCreator) && (
             <div className="flex flex-col items-start gap-1.5 mt-2 pt-2 border-t border-slate-100">
               {card.carriedFromBoardId && (
                 <span
                   className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-indigo-500 truncate min-w-0"
                   title={`Trazido de: ${card.carriedFromBoardTitle || 'retro anterior'}`}
                 >
                   <CornerUpLeft className="h-3 w-3 shrink-0" />
                   <span className="truncate">Trazido de: {card.carriedFromBoardTitle || 'retro anterior'}</span>
                 </span>
               )}

               {(isAuthor || isCreator) && (
                 <button
                   type="button"
                   onClick={(e) => { e.stopPropagation(); onToggleDone(card.id, !card.isDone); }}
                   className={cn(
                     "flex items-center gap-1.5 h-6 px-2 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all shrink-0",
                     card.isDone
                       ? "bg-emerald-600 border-emerald-600 text-white"
                       : "bg-white border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600"
                   )}
                   title={card.isDone ? "Marcar como pendente" : "Marcar como concluído"}
                 >
                   <CheckCircle2 className="h-3 w-3" />
                   {card.isDone ? "Concluído" : "Marcar feito"}
                 </button>
               )}
             </div>
           )}
        </AgileCard>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-[2rem] border-rose-100 bg-white/95 backdrop-blur-3xl p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter text-rose-500 italic">Remover Feedback?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-600 mt-2">
              Esta ação é permanente. Todo o conteúdo, votos e comentários vinculados a este card serão deletados para toda a squad.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-4">
            <AlertDialogCancel className="h-12 px-8 rounded-2xl border-2 border-slate-100 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">Manter aqui</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(card.id)} className="h-12 px-8 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-500/20">Sim, remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
