'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { AgileBaseCard } from './EliteBaseCard';
import { 
  User, 
  Ghost, 
  Clock, 
  ThumbsUp, 
  Paperclip,
  Calendar,
  Lock,
  GitMerge,
  GripVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Flame
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type AgileCardVariant = 'retro' | 'brainstorm' | 'planner' | 'default';

interface AgileCardProps {
  id: string;
  content: string;
  variant?: AgileCardVariant;
  
  // Author Info
  authorName?: string;
  authorId?: string;
  currentUserId?: string;
  isAnonymous?: boolean;
  
  // Voting
  votes?: string[]; // Array of UIDs
  onVote?: (id: string) => void;
  canVote?: boolean;
  
  // Metadata
  timestamp?: string;
  theme?: 'primary' | 'amber' | 'emerald' | 'rose' | 'indigo' | 'slate' | 'success' | 'warning' | 'action' | 'neutral' | 'purple' | 'pink' | 'cyan' | string;
  
  // Privacy/States
  isRevealed?: boolean;
  isDragging?: boolean;
  isOver?: boolean;
  isMergingSource?: boolean;
  canMergeTarget?: boolean;
  isHot?: boolean;
  hasChildrenGroup?: boolean;
  
  // Extra Details (Planner)
  devHours?: number;
  qaHours?: number;
  link?: string;
  dueDate?: string;
  assignee?: string;
  
  // Truncation
  isTruncated?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  
  // Actions
  onEdit?: (id: string) => void;
  allowAnyEdit?: boolean;
  onDelete?: (id: string, e?: React.MouseEvent) => void;
  onStartMerge?: (id: string) => void;
  onMerge?: (id: string) => void;
  onClick?: (id: string) => void;
  
  // Drag and Drop handle
  dragHandleProps?: any;
  
  children?: React.ReactNode;
  className?: string;
}

export function AgileCard({
  id,
  content,
  variant = 'default',
  authorName,
  authorId,
  currentUserId,
  isAnonymous = false,
  votes = [],
  onVote,
  canVote = true,
  timestamp = 'AGORA',
  theme = 'slate',
  isRevealed = true,
  isDragging,
  isOver,
  isMergingSource,
  canMergeTarget,
  isHot = false,
  hasChildrenGroup,
  devHours,
  qaHours,
  link,
  dueDate,
  assignee,
  onEdit,
  allowAnyEdit = false,
  onDelete,
  onStartMerge,
  onMerge,
  onClick,
  dragHandleProps,
  isTruncated,
  isExpanded,
  onToggleExpand,
  children,
  className
}: AgileCardProps) {
  const isAuthor = authorId === currentUserId;
  const hasVoted = currentUserId && votes.includes(currentUserId);
  const voteCount = votes.length;

  const showRealContent = isRevealed || isAuthor;

  return (
    <AgileBaseCard
      theme={theme}
      isDragging={isDragging}
      isOver={isOver}
      isMergingSource={isMergingSource}
      canMergeTarget={canMergeTarget}
      isHot={isHot}
      hasChildrenGroup={hasChildrenGroup}
      onClick={() => {
        if (canMergeTarget && onMerge) {
          onMerge(id);
        } else {
          onClick?.(id);
        }
      }}
      className={cn(
        "p-3 h-full flex flex-col min-h-[90px]",
        canMergeTarget && "cursor-pointer",
        isHot && "ring-4 ring-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-pulse border-orange-400",
        className
      )}
    >
      {isHot && (
        <div className="absolute -top-3 -right-3 z-50 bg-gradient-to-br from-orange-500 to-amber-500 text-white p-2 rounded-xl shadow-lg border-2 border-white animate-bounce">
           <Flame className="h-4 w-4 fill-current" />
        </div>
      )}
      {/* Header: Author & Metadata */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-xl",
            isAnonymous ? "bg-slate-100 dark:bg-slate-800 text-slate-400" : 
            variant === 'brainstorm' ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400" :
            variant === 'retro' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" :
            "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400"
          )}>
            {isAnonymous ? <Ghost className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 leading-none">
              {isAnonymous ? "Anônimo" : (isAuthor ? "Você" : (authorName || "Participante"))}
            </span>
            {assignee && (
              <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tighter mt-0.5">
                Para: {assignee}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
            {dragHandleProps && (
              <div 
                {...dragHandleProps} 
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-all"
              >
                 <GripVertical className="h-3.5 w-3.5" />
              </div>
            )}
            {variant === 'planner' && link && (
                <a 
                  href={link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                    <ExternalLink className="h-3 w-3" />
                </a>
            )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative">
        <p className={cn(
          "text-slate-800 dark:text-slate-200 font-bold leading-snug break-words whitespace-pre-wrap transition-all duration-300",
          !showRealContent && "blur-sm select-none opacity-50 grayscale",
          variant === 'planner' ? "text-xs" : "text-sm",
          isTruncated && !isExpanded && "line-clamp-3"
        )}>
          {showRealContent ? content : "Uma ideia anônima está sendo escrita..."}
        </p>
        
        {isTruncated && content.length > 0 && showRealContent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.(id);
            }}
            className="text-[9px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 mt-2 flex items-center gap-1 transition-colors"
          >
            {isExpanded ? "Ver Menos" : "Ver Mais ..."}
          </button>
        )}

        {!showRealContent && (
            <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="h-5 w-5 text-slate-400" />
            </div>
        )}
      </div>

      {/* Extra Badges (Planner) */}
      {variant === 'planner' && (devHours !== undefined || qaHours !== undefined) && (
        <div className="flex flex-wrap gap-2 mb-3 mt-2">
            {devHours !== undefined && (
                <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 px-2.5 py-0.5 rounded-lg border border-violet-100/50 dark:border-violet-900/30">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-50">DEV</span>
                    <span className="text-[10px] font-black italic tracking-tighter">{devHours}H</span>
                </div>
            )}
            {qaHours !== undefined && (
                <div className="flex items-center gap-1.5 bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 px-2.5 py-0.5 rounded-lg border border-fuchsia-100/50 dark:border-fuchsia-900/30">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-50">QA</span>
                    <span className="text-[10px] font-black italic tracking-tighter">{qaHours}H</span>
                </div>
            )}
        </div>
      )}

      {/* Footer: Actions & Votes */}
      <div className="flex items-center justify-between mt-2 size-fit w-full shrink-0">
        <div className="flex items-center gap-1.5">
          {onVote && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!canVote}
              onClick={(e) => { e.stopPropagation(); onVote(id); }}
              className={cn(
                "h-8 px-2.5 gap-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-widest",
                hasVoted 
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" 
                  : "text-slate-600 dark:text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              )}
            >
              <ThumbsUp className={cn("h-3 w-3", hasVoted && "fill-current")} />
              <span>{voteCount}</span>
            </Button>
          )}

          {/* Inline Action Buttons */}
          <div className="flex items-center gap-1 ml-1 scale-90 sm:scale-100 origin-left">
            {(isAuthor || allowAnyEdit) && onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onEdit(id); }}
                className="h-8 w-8 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all"
                title="Editar Card"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            
            {onStartMerge && !isMergingSource && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onStartMerge(id); }}
                className="h-8 w-8 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all"
                title="Fundir Ideia"
              >
                <GitMerge className="h-3.5 w-3.5" />
              </Button>
            )}

            {isAuthor && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                title="Excluir Card"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {children}
    </AgileBaseCard>
  );
}
