import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { BrainstormingIdea } from '@/lib/types';
import { AgileCard } from '@/components/shared/EliteCard';
import { AgileBaseCard } from '@/components/shared/EliteBaseCard';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Layers, CheckCircle2, XCircle } from 'lucide-react';

interface IdeaCardProps {
  idea: BrainstormingIdea;
  isAnonymous?: boolean;
  isRevealed?: boolean;
  isHot?: boolean;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, content: string) => void;
  onVote?: (id: string) => void;
  onMerge?: (id: string) => void;
  onStartMerge?: (id: string) => void;
  isMergingSource?: boolean;
  canMerge?: boolean;
  currentUserId?: string;
  className?: string;
}

export function IdeaCard({
  idea,
  isAnonymous = false,
  isRevealed = true,
  onDelete,
  onUpdate,
  onVote,
  onMerge,
  onStartMerge,
  isMergingSource = false,
  canMerge = false,
  isHot = false,
  currentUserId,
  className
}: IdeaCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedContent, setEditedContent] = useState(idea.content);
  // FLAG (possível bug real): o tipo BrainstormingIdea (src/lib/types.ts) não declara 'children'.
  // O código lê idea.children em runtime, mas o campo nunca é definido no tipo — provável feature
  // de empilhamento/merge incompleta. Acesso feito via cast tipado local para não alterar o runtime.
  const ideaChildren = (idea as { children?: BrainstormingIdea[] }).children;
  const hasChildren = ideaChildren && ideaChildren.length > 0;

  const handleSave = () => {
    if (editedContent.trim() && editedContent !== idea.content) {
      onUpdate?.(idea.id, editedContent.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <AgileBaseCard theme="amber" className={cn("p-4 space-y-3", className)}>
        <Textarea 
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="min-h-[100px] text-xs font-bold bg-slate-50 border-amber-100 rounded-xl focus-visible:ring-amber-500/20"
          autoFocus
        />
        <div className="flex justify-end gap-2">
           <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-slate-400" onClick={() => setIsEditing(false)}>
              <XCircle className="h-4 w-4" />
           </Button>
           <Button variant="secondary" size="sm" className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest" onClick={handleSave}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Salvar
           </Button>
        </div>
      </AgileBaseCard>
    );
  }

  // Check if content should be truncated (has more than 3 lines or is very long)
  const isLongContent = idea.content.split('\n').length > 3 || idea.content.length > 140;

  return (
    <AgileCard
      id={idea.id}
      variant="brainstorm"
      content={idea.content}
      theme="amber"
      authorId={idea.authorId}
      currentUserId={currentUserId}
      isAnonymous={isAnonymous}
      isRevealed={isRevealed}
      isHot={isHot}
      votes={idea.votes || []}
      onVote={onVote}
      isMergingSource={isMergingSource}
      canMergeTarget={canMerge}
      onDelete={onDelete}
      onEdit={() => setIsEditing(true)}
      allowAnyEdit={true}
      onStartMerge={onStartMerge}
      onMerge={onMerge}
      isTruncated={isLongContent}
      isExpanded={isExpanded}
      onToggleExpand={() => setIsExpanded(!isExpanded)}
      className={className}
    >
      {/* Stack Indicator */}
      {hasChildren && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/20 shrink-0 border border-white/20">
          <Layers className="h-3.5 w-3.5" />
          <span className="text-[10px] font-black">{ideaChildren!.length + 1}</span>
        </div>
      )}
    </AgileCard>
  );
}
