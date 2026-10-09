'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RetroCard as RetroCardType, RetroParticipant, RetroColumnTheme, RetroReactionType } from '@/lib/types';
import { RETRO_REACTIONS } from '@/lib/types';
import {
  Pencil,
  Trash2,
  Star,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Sparkles,
  UserPlus,
  Calendar,
  GitMerge,
  Clock,
  Ghost,
  User as UserIcon,
  Lock,
  ExternalLink,
  CheckCircle2,
  CornerUpLeft,
  AlertTriangle
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
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const REACTION_ICONS: Record<RetroReactionType, typeof ThumbsUp> = {
  up: ThumbsUp,
  love: Heart,
  wow: Sparkles,
  concern: ThumbsDown,
};

// Cores por reação: positivas ficam neutras até alguém marcar; "preocupa" é a
// única com leitura sempre em vermelho quando ativa — sinal de atenção do time.
const REACTION_ACTIVE_CLASSES: Record<RetroReactionType, string> = {
  up: 'bg-emerald-50 border-emerald-200 text-emerald-600',
  love: 'bg-pink-50 border-pink-200 text-pink-600',
  wow: 'bg-slate-100 border-slate-300 text-slate-600',
  concern: 'bg-red-50 border-red-200 text-red-600',
};

function RetroCardReactions({
  card,
  currentUserId,
  onToggleReaction,
}: {
  card: RetroCardType;
  currentUserId: string;
  onToggleReaction: (cardId: string, type: RetroReactionType, currentUserIds: string[]) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
      {RETRO_REACTIONS.map(({ key, label }) => {
        const userIds = card.reactions?.[key] || [];
        const isActive = userIds.includes(currentUserId);
        const Icon = REACTION_ICONS[key];
        return (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={`${label}${userIds.length > 0 ? ` (${userIds.length})` : ''}`}
            aria-pressed={isActive}
            onClick={() => onToggleReaction(card.id, key, userIds)}
            className={cn(
              "flex items-center gap-1 h-6 px-2 rounded-full border text-[10px] font-black transition-all",
              isActive ? REACTION_ACTIVE_CLASSES[key] : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
            )}
          >
            <Icon className="h-3 w-3" />
            {userIds.length > 0 && userIds.length}
          </button>
        );
      })}
    </div>
  );
}

// Ideias fundidas viram uma linha do tempo conectada abaixo do texto
// principal, em vez de um "- texto" concatenado dentro do content.
// Acima de 3 no total, colapsa em "+N mais" pra não estourar o card.
function RetroMergedTimeline({ items }: { items: string[] }) {
  if (!items.length) return null;

  const MAX_VISIBLE = 2;
  const overflow = items.length > 3;
  const visible = overflow ? items.slice(0, MAX_VISIBLE) : items;
  const hiddenCount = overflow ? items.length - MAX_VISIBLE : 0;

  return (
    <div className="flex flex-col border-l-2 border-slate-200 dark:border-slate-700 ml-1 pl-3 mt-2.5" onClick={(e) => e.stopPropagation()}>
      {visible.map((text, i) => (
        <div key={i} className="relative py-1.5">
          <span className="absolute -left-[18px] top-3 h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <p className="text-[12.5px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 break-words whitespace-pre-wrap">{text}</p>
        </div>
      ))}
      {hiddenCount > 0 && (
        <div className="relative py-1.5">
          <span className="absolute -left-[18px] top-3 h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">+{hiddenCount} mais</span>
        </div>
      )}
    </div>
  );
}

interface RetroCardProps {
  card: RetroCardType;
  isCardsRevealed: boolean;
  isAuthor: boolean;
  isCreator: boolean;
  onDelete: (cardId: string) => void;
  onUpdate: (cardId: string, newContent: string, assignee?: string, dueDate?: string) => void;
  onToggleVote: (cardId: string, currentVotes: string[]) => void;
  onToggleReaction: (cardId: string, type: RetroReactionType, currentUserIds: string[]) => void;
  onToggleDone: (cardId: string, isDone: boolean) => void;
  // Antes vinha tipado como `User` do firebase/auth; só o `uid` é lido aqui,
  // então um shape mínimo evita a dependência de um SDK que não existe mais.
  currentUser: { uid: string };
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
  onToggleReaction,
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
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // O campo cresce com o texto (até 55% da altura da tela) em vez de rolar dentro de uma
  // caixa pequena: a coluna da retro é estreita e o texto longo ficava ilegível.
  useEffect(() => {
    const el = editTextareaRef.current;
    if (!isEditing || !el) return;
    el.style.height = 'auto';
    // scrollHeight não conta a borda; sem somar, sobra uma barra de rolagem de 1-2 px.
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + border, Math.round(window.innerHeight * 0.55))}px`;
  }, [editedContent, isEditing]);

  // Ao abrir a edição o cursor vai para o fim do texto (autoFocus sozinho deixava no começo).
  useEffect(() => {
    const el = editTextareaRef.current;
    if (isEditing && el) el.setSelectionRange(el.value.length, el.value.length);
  }, [isEditing]);

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
    const text = editedContent.trim();
    // Texto vazio não fecha o editor em silêncio: o card precisa de texto (para apagar existe a lixeira).
    if (!text) return;
    const unchanged = text === card.content
      && (editedAssignee.trim() || undefined) === (card.assignee || undefined)
      && (editedDueDate || undefined) === (card.dueDate || undefined);
    if (!unchanged) {
      onUpdate(
        card.id,
        text,
        editedAssignee.trim() || undefined,
        editedDueDate || undefined
      );
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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
        <AgileBaseCard theme="emerald" className="p-3 relative z-10">
          <div className="space-y-3">
            <Textarea
              ref={editTextareaRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={3}
              aria-label="Editar o texto do card"
              maxLength={1000}
              className="min-h-[96px] resize-none overflow-y-auto px-4 py-3 text-sm bg-slate-50 border-emerald-100 rounded-2xl focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 font-semibold leading-relaxed text-slate-800"
            />
            <p className="px-1 text-[10px] font-semibold leading-snug text-slate-500">
              Enter salva · Shift+Enter quebra a linha · Esc cancela
            </p>
            
            {isActionPlan && (
              <div className="flex flex-col gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
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

            {/* Empilhados: lado a lado os dois vazavam da coluna estreita da retro. */}
            <div className="flex flex-col gap-2">
              <Button size="sm" className="h-10 w-full rounded-xl bg-emerald-600 text-white font-black uppercase text-[10px] shadow-lg shadow-emerald-600/20" onClick={handleUpdate} disabled={!editedContent.trim()}>
                Salvar alterações
              </Button>
              <Button variant="ghost" size="sm" className="h-9 w-full rounded-xl text-slate-500 font-black uppercase text-[10px]" onClick={() => { setIsEditing(false); setEditedContent(card.content); }}>
                Cancelar
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
          allowAnyEdit={isCreator}
          allowAnyDelete={isCreator}
          dueDate={card.dueDate}
          canVote={canVote && showVotes}
          voteIcon={Star}
          contentExtra={card.originalTexts?.length ? <RetroMergedTimeline items={card.originalTexts} /> : undefined}
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

               {(card.carryCount || 0) > 1 && (
                 <span
                   className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-amber-600 truncate min-w-0"
                   title={`Reimportada ${card.carryCount}x sem ser concluída — tema recorrente`}
                 >
                   <AlertTriangle className="h-3 w-3 shrink-0" />
                   <span className="truncate">Recorrente ({card.carryCount}x)</span>
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

           {showRealContent && !isActionPlan && (
             <RetroCardReactions card={card} currentUserId={currentUser.uid} onToggleReaction={onToggleReaction} />
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
