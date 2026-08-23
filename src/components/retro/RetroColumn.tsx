'use client';

import { useMemo, useState, useRef, useEffect, memo } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RetroCard as RetroCardType, RetroColumnKey, RetroBoard as RetroBoardType, RetroParticipant, RetroColumnTheme, RetroColumnDef } from "@/lib/types";
import { AddRetroCard } from "./AddRetroCard";
import { RetroCard } from "./RetroCard";
import { RetroActionImportDialog } from "./RetroActionImportDialog";
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertCircle, ListTodo, LayoutGrid, ThumbsUp, History, MonitorPlay, Minimize2, Pencil, CircleDot, Zap, Heart, Info, PackageOpen, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { retroApi } from '../../app/retro/api';

// Theme-based configuration mapping
const THEME_CONFIG: Record<RetroColumnTheme, {
  color: string;
  accent: string;
  icon: typeof CheckCircle2;
  border: string;
  shadowPulse: string;
  hoverBg: string;
}> = {
  success: {
    color: 'bg-emerald-500',
    accent: 'bg-emerald-50 text-emerald-600',
    icon: CheckCircle2,
    border: 'border-emerald-100',
    shadowPulse: 'animate-shadow-pulse-green border-emerald-200 shadow-emerald-500/20',
    hoverBg: 'hover:bg-emerald-50 hover:text-emerald-600',
  },
  warning: {
    color: 'bg-amber-500',
    accent: 'bg-amber-50 text-amber-600',
    icon: AlertCircle,
    border: 'border-amber-100',
    shadowPulse: 'animate-shadow-pulse-orange border-amber-200 shadow-amber-500/20',
    hoverBg: 'hover:bg-amber-50 hover:text-amber-600',
  },
  action: {
    color: 'bg-indigo-600',
    accent: 'bg-indigo-50 text-indigo-600',
    icon: ListTodo,
    border: 'border-indigo-100',
    shadowPulse: 'animate-shadow-pulse-indigo border-indigo-200 shadow-indigo-500/20',
    hoverBg: 'hover:bg-indigo-50 hover:text-indigo-600',
  },
  neutral: {
    color: 'bg-slate-500',
    accent: 'bg-slate-50 text-slate-600',
    icon: CircleDot,
    border: 'border-slate-100',
    shadowPulse: 'border-slate-200 shadow-slate-500/10',
    hoverBg: 'hover:bg-slate-50 hover:text-slate-600',
  },
  purple: {
    color: 'bg-violet-500',
    accent: 'bg-violet-50 text-violet-600',
    icon: Zap,
    border: 'border-violet-100',
    shadowPulse: 'animate-shadow-pulse-violet border-violet-200 shadow-violet-500/20',
    hoverBg: 'hover:bg-violet-50 hover:text-violet-600',
  },
  pink: {
    color: 'bg-pink-500',
    accent: 'bg-pink-50 text-pink-600',
    icon: Heart,
    border: 'border-pink-100',
    shadowPulse: 'animate-shadow-pulse-pink border-pink-200 shadow-pink-500/20',
    hoverBg: 'hover:bg-pink-50 hover:text-pink-600',
  },
  cyan: {
    color: 'bg-cyan-500',
    accent: 'bg-cyan-50 text-cyan-600',
    icon: Info,
    border: 'border-cyan-100',
    shadowPulse: 'animate-shadow-pulse-cyan border-cyan-200 shadow-cyan-500/20',
    hoverBg: 'hover:bg-cyan-50 hover:text-cyan-600',
  },
};

interface RetroColumnProps {
  title: string;
  columnKey: RetroColumnKey;
  theme?: RetroColumnTheme;
  cards: RetroCardType[];
  allCards: RetroCardType[];
  boardId: string;
  boardData: RetroBoardType;
  currentUser: { uid: string };
  isCreator: boolean;
  isCardsRevealed: boolean;
  onAddCard: (content: string, columnKey: RetroColumnKey, assignee?: string, dueDate?: string) => void;
  onDeleteCard: (cardId: string) => void;
  onUpdateCard: (cardId: string, newContent: string, assignee?: string, dueDate?: string) => void;
  onToggleVote: (cardId: string, currentVotes: string[]) => void;
  onToggleDone: (cardId: string, isDone: boolean) => void;
  onImportActions: (board: RetroBoardType, pendingCards: RetroCardType[]) => void;
  votingStatus: RetroBoardType['votingStatus'];
  participants: RetroParticipant[];
  isAuthorsRevealed: boolean;
  onToggleColumnSort: (columnKey: string, isSorted: boolean) => void;
  isFocused?: boolean;
  onFocus?: () => void;
  mergingSourceId: string | null;
  onStartMerge: (cardId: string | null) => void;
  onExecuteMerge: (targetId: string) => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: (value: boolean) => void;
  columns?: RetroColumnDef[];
}

function RetroColumnComponent({
  title,
  columnKey,
  theme = 'neutral',
  cards,
  allCards,
  boardId,
  boardData,
  currentUser,
  isCreator,
  isCardsRevealed,
  participants,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
  onToggleVote,
  onToggleDone,
  onImportActions,
  votingStatus,
  isAuthorsRevealed,
  onToggleColumnSort,
  onStartMerge,
  onExecuteMerge,
  mergingSourceId,
  isFocused,
  onFocus,
  isFocusMode,
  onToggleFocusMode,
  columns,
}: RetroColumnProps) {
  const isSortedByVotes = boardData.columnSorts?.[columnKey] || false;
  const { toast } = useToast();
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Inline title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    const newTitle = editedTitle.trim();
    if (!newTitle || newTitle === title || !boardData.columns) return;

    // Update the column title in the columns array
    const updatedColumns = boardData.columns.map(col =>
      col.id === columnKey ? { ...col, title: newTitle } : col
    );
    retroApi.saveOrUpdateBoard({ ...boardData, columns: updatedColumns }).catch(err => console.error(err));
    toast({ title: "Título atualizado!", description: `Coluna renomeada para "${newTitle}".` });
  };

  const { setNodeRef, isOver } = useDroppable({
    id: columnKey,
    data: { type: 'column' }
  });

  const config = THEME_CONFIG[theme] || THEME_CONFIG.neutral;
  const Icon = config.icon;

  // Determine if this column is a "feedback" column (non-action) for voting
  const isActionColumn = theme === 'action';
  const isFeedbackColumn = !isActionColumn;

  const sortedCards = useMemo(() => {
    // Filtro de segurança contra duplicatas
    const uniqueCards = Array.from(new Map(cards.map(c => [c.id, c])).values());
    const tempCards = [...uniqueCards];
    const shouldSortByVotes = isSortedByVotes && isFeedbackColumn;
    
    if (votingStatus === 'finished' || shouldSortByVotes) {
      tempCards.sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0));
    } else {
      tempCards.sort((a, b) => a.order - b.order);
    }
    return tempCards;
  }, [cards, votingStatus, isSortedByVotes, isFeedbackColumn]);

  const cardIds = useMemo(() => sortedCards.map(c => c.id), [sortedCards]);

  const handleExportToWorkspace = () => {
    if (cards.length === 0) {
      toast({ title: "Nenhuma ação para exportar", variant: "destructive" });
      return;
    }

    const roomTitle = boardData.title || "Retrospectiva";
    const roomTeam = boardData.team || "Squad Geral";

    // Use dynamic columns for counts
    const feedbackColumns = (columns || []).filter(c => c.theme !== 'action');
    const actionColumns = (columns || []).filter(c => c.theme === 'action');

    const feedbackCount = feedbackColumns.reduce((count, col) => {
      return count + allCards.filter(c => c.columnKey === col.id).length;
    }, 0);
    const actionItems = cards.map(c => c.content);

    const summary = {
      feedbackCount,
      actionItems
    };

    retroApi.saveOrUpdateBoard({ ...boardData, summary }).catch(err => console.error(err));

    toast({
      title: "Resumo Sincronizado!",
      description: "O histórico da cerimônia foi salvo para todos os participantes.",
    });
  };

  // Navegação sincronizada: quando o facilitador liga "Sincronizar Coluna",
  // só ele pode focar outra coluna — o resto do time fica preso na dele.
  const isNavLocked = !!(boardData.syncStageEnabled && !isCreator);

  return (
    <div
      ref={setNodeRef}
      onClick={!isFocused && !isNavLocked ? onFocus : undefined}
      className={cn(
        "flex flex-col bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2rem] h-full overflow-hidden transition-all duration-500 relative",
        isFocused && isFocusMode ? "fixed inset-0 z-[100] m-0 rounded-none bg-white font-sans" :
        isFocused ? cn("flex-[6] z-10", config.shadowPulse) :
        isFocusMode ? "hidden" : cn("flex-none w-[60px] group/col grayscale", isNavLocked ? "cursor-not-allowed" : "cursor-pointer hover:bg-white/60"),
        isOver && "ring-2 ring-emerald-500/30 bg-emerald-50/20"
      )}
    >
      {/* HEADER: FOCUSED MODE */}
      {isFocused ? (
        <>
          <div className="flex items-center justify-between p-5 pt-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className={cn("p-4 rounded-2xl text-white shadow-xl", config.color)}>
                <Icon className="h-8 w-8" />
              </div>
              <div className="flex flex-col justify-center">
                {/* Inline Title Edit */}
                {isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    value={editedTitle}
                    onChange={e => setEditedTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') { setEditedTitle(title); setIsEditingTitle(false); } }}
                    className="text-3xl font-black uppercase tracking-tighter text-slate-800 leading-none italic bg-transparent border-b-2 border-dashed border-slate-300 focus:border-orange-400 outline-none w-full max-w-[400px] transition-colors"
                  />
                ) : (
                  <div className="flex items-center gap-2 group/title">
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800 leading-none italic">{title}</h2>
                    {isCreator && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
                        className="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700"
                        title="Editar título"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
                {/* Removido o rótulo técnico do tema para um visual mais limpo e premium */}
              </div>
            </div>
            
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onToggleFocusMode?.(!isFocusMode); }}
                        className={cn(
                          "h-8 px-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all gap-2",
                          isFocusMode ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                        )}
                      >
                        {isFocusMode ? (
                          <>
                            <Minimize2 className="h-3.5 w-3.5" />
                            Sair do Modo Foco
                          </>
                        ) : (
                          <>
                            <MonitorPlay className="h-3.5 w-3.5" />
                            Apresentar
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border-none">
                      <p>{isFocusMode ? 'Sair (ESC) · ← → Navegar' : 'Modo Apresentação'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {isActionColumn && isCreator && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setIsImportOpen(true); }}
                  className="h-8 px-3 text-[9px] font-black uppercase tracking-widest border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                  title="Importar ações pendentes de uma retro anterior do mesmo squad"
                >
                  <PackageOpen className="w-3.5 h-3.5 mr-2" />
                  Importar Pendências
                </Button>
              )}

                {isActionColumn && cards.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportToWorkspace}
                  className="h-8 px-3 text-[9px] font-black uppercase tracking-widest border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all"
                  title="Sincronizar Resumo"
                >
                  <History className="w-3.5 h-3.5 mr-2" />
                  Sincronizar
                </Button>
              )}
              {isFeedbackColumn && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); isCreator && onToggleColumnSort(columnKey, !isSortedByVotes); }}
                  disabled={!isCreator}
                  className={cn(
                    "h-8 w-8 p-0 rounded-xl transition-all",
                    isSortedByVotes ? "bg-emerald-100 text-emerald-600 shadow-sm" : "text-slate-500 hover:bg-slate-50",
                    !isCreator && "opacity-30"
                  )}
                  title="Ordenar por Votos"
                >
                  <ThumbsUp className={cn("h-3.5 w-3.5", isSortedByVotes && "fill-current")} />
                </Button>
              )}

              <div className={cn("px-2.5 py-1 rounded-xl text-[10px] font-black border", config.accent)}>
                {cards.length}
              </div>
            </div>
          </div>

          {!isFocusMode && (
            <div className="px-5 pb-3 shrink-0">
              <AddRetroCard columnKey={columnKey} theme={theme} onAddCard={onAddCard} participants={participants} />
            </div>
          )}

          <ScrollArea className={cn("flex-1 px-5 pb-6 custom-scrollbar", isFocusMode && "px-10 py-6 bg-slate-50/30")}>
            <SortableContext items={cardIds} strategy={rectSortingStrategy}>
              <div className={cn(
                "grid gap-3 min-h-[100px] transition-all duration-500 pb-20 sm:pb-6",
                isFocusMode 
                  ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" 
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
              )}>
                {sortedCards.length === 0 && !isFocusMode && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-70 group/empty">
                    <div className={cn("p-6 rounded-full", config.accent)}>
                      <Icon className="h-10 w-10" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Silêncio produtivo...</p>
                      <p className="text-[10px] font-bold text-slate-500">Seja o primeiro a compartilhar um insight.</p>
                    </div>
                  </div>
                )}
                {sortedCards.map(card => (
                  <RetroCard
                    key={card.id}
                    card={card}
                    isCardsRevealed={isCardsRevealed}
                    isAuthor={card.authorId === currentUser?.uid}
                    isCreator={isCreator}
                    onDelete={onDeleteCard}
                    onUpdate={onUpdateCard}
                    onToggleVote={onToggleVote as any}
                    onToggleDone={onToggleDone}
                    currentUser={currentUser}
                    theme={theme}
                    votingStatus={votingStatus}
                    participants={participants}
                    isAuthorsRevealed={isAuthorsRevealed}
                    mergingSourceId={mergingSourceId}
                    onStartMerge={onStartMerge}
                    onExecuteMerge={onExecuteMerge}
                  />
                ))}
              </div>
            </SortableContext>
          </ScrollArea>
        </>
      ) : (
        /* MINIMIZED MODE */
        <div className={cn(
          "flex flex-col items-center justify-between h-full py-10 gap-8 transition-all duration-300",
          config.hoverBg
        )}>
           <div className={cn(
             "p-2.5 rounded-xl text-white shadow-lg transition-transform group-hover/col:scale-110", 
             config.color
           )}>
              <Icon className="h-5 w-5" />
           </div>
           
           <h2 className="[writing-mode:vertical-lr] rotate-180 text-[11px] font-black uppercase tracking-[0.4em] transition-colors">
              {title}
           </h2>
           {isNavLocked && (
             <span title="Navegação controlada pelo facilitador">
               <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
             </span>
           )}
           <div className="flex-1" /> {/* Spacer */}
           <div className={cn(
             "w-12 h-12 flex items-center justify-center rounded-2xl text-[12px] font-black border-2 transition-all", 
             config.accent,
             "group-hover/col:shadow-lg group-hover/col:scale-105"
           )}>
              {cards.length}
           </div>
        </div>
      )}

      {isActionColumn && (
        <RetroActionImportDialog
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          team={boardData.team || ''}
          currentBoardId={boardId}
          onImport={onImportActions}
        />
      )}
    </div>
  );
}

export const RetroColumn = memo(RetroColumnComponent);
