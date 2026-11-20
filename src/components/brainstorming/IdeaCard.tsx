'use client';

import React, { useState } from 'react';
import { Check, Flame, GitMerge, Ghost, Lock, Pencil, ThumbsUp, Trash2 } from 'lucide-react';
import { CARD_SHADOW, FOCUS_RING, IconButton, ModalButton, PersonAvatar, TONES } from '@/components/room-kit';
import { votesOf } from '@/lib/brainstorming-utils';
import type { BrainstormingIdea } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useIdeaPresentation, useIdeaView } from './brainstorm-context';
import { editedBadge } from './brainstorm-ceremony';
import { isHotIdea } from './brainstorm-room-logic';

export const IDEA_MAX_LENGTH = 5000;

/** Texto de ideia longo corta em três linhas, com "Ver mais". */
function isLongText(content: string): boolean {
  return content.split('\n').length > 3 || content.length > 140;
}

export interface IdeaCardProps {
  idea: BrainstormingIdea;
  onVote?: (id: string) => void;
  /** Pode devolver false para avisar que não salvou: o cartão continua em edição e o texto digitado não se perde. */
  onUpdate?: (id: string, content: string) => Promise<boolean | void> | boolean | void;
  /** Pede para excluir (a sala confirma antes). O botão só aparece para o autor e para o facilitador. */
  onDelete?: (idea: BrainstormingIdea) => void;
  onStartMerge?: (id: string) => void;
  onMerge?: (id: string) => void;
  isMergingSource?: boolean;
  canMerge?: boolean;
  /** Ações extras no pé do cartão (ex.: "Mover para…"). */
  actionsExtra?: React.ReactNode;
  className?: string;
}

/**
 * Cartão de ideia do Brainstorming, o mesmo no Mural, na Teia e nos Grupos. Autor (Você, primeiro nome ou
 * Anônimo), texto, "Em alta" a partir de 3 votos, voto e, conforme a etapa, editar, juntar e excluir.
 * Com o texto coberto pelo facilitador mostra só "Ideia oculta"; voto e fusão ficam bloqueados.
 */
export function IdeaCard({
  idea,
  onVote,
  onUpdate,
  onDelete,
  onStartMerge,
  onMerge,
  isMergingSource = false,
  canMerge = false,
  actionsExtra,
  className,
}: IdeaCardProps) {
  const view = useIdeaView();
  const { author, masked, isMine, canEditText, canVote, quota, readOnly } = useIdeaPresentation(idea);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState(idea.content);

  const votes = votesOf(idea);
  const hasVoted = !!view.currentUserId && votes.includes(view.currentUserId);
  const hot = !masked && isHotIdea(idea);
  const canDelete = !masked && !readOnly && !!onDelete && (isMine || view.isFacilitator);
  const edited = !masked ? editedBadge(idea) : null;
  const voteHint = hasVoted ? 'Remover meu voto' : 'Votar nesta ideia';
  const voteBlockedHint = readOnly ? 'Brainstorming encerrado' : quota.reached ? 'Você usou todos os seus votos' : voteHint;

  const startEditing = () => {
    // sempre parte do texto atual (outra pessoa pode ter editado desde que o cartão foi montado)
    setDraft(idea.content);
    setIsEditing(true);
  };

  const save = async () => {
    const text = draft.trim();
    if (!text || text === idea.content) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      const saved = await onUpdate?.(idea.id, text);
      if (saved !== false) setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const surface = cn(
    'relative flex flex-col gap-2.5 rounded-2xl border bg-card p-3.5 text-card-foreground transition-[border-color,box-shadow] duration-fast',
    CARD_SHADOW,
    hot ? 'border-amber-500/50' : 'border-border',
    isMergingSource && 'border-primary ring-2 ring-primary/60',
    canMerge && 'cursor-pointer border-dashed border-primary/60 hover:bg-accent/40',
    className
  );

  if (isEditing && canEditText) {
    return (
      <article className={cn(surface, 'border-primary/50')}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsEditing(false);
          }}
          autoFocus
          maxLength={IDEA_MAX_LENGTH}
          aria-label="Texto da ideia"
          className={cn('min-h-[104px] w-full resize-y rounded-[10px] border border-border bg-muted/40 p-2.5 text-sm text-foreground', FOCUS_RING)}
        />
        <div className="flex justify-end gap-2">
          <ModalButton className="h-9 px-3 text-[13px]" onClick={() => setIsEditing(false)}>Cancelar</ModalButton>
          <ModalButton variant="primary" className="h-9 gap-1.5 px-3 text-[13px]" onClick={() => void save()} disabled={isSaving}>
            <Check className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Salvar
          </ModalButton>
        </div>
      </article>
    );
  }

  if (masked) {
    return (
      <article className={surface} aria-label="Ideia oculta" onClick={() => { if (canMerge) onMerge?.(idea.id); }}>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
          <Lock className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Ideia oculta
        </div>
        <div aria-hidden="true" className="flex flex-col gap-1.5">
          <span className="h-2.5 w-full rounded-full bg-muted" />
          <span className="h-2.5 w-2/3 rounded-full bg-muted" />
        </div>
        <p className="m-0 text-xs text-muted-foreground">O facilitador revela as ideias no fim da escrita.</p>
      </article>
    );
  }

  const long = isLongText(idea.content);

  return (
    <article className={surface} onClick={() => { if (canMerge) onMerge?.(idea.id); }}>
      {(isMergingSource || canMerge) && (
        <span
          className={cn(
            'absolute -top-2.5 right-3 inline-flex h-[22px] items-center rounded-full px-2.5 text-xs font-semibold',
            isMergingSource ? TONES.warn.chip : 'bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground'
          )}
        >
          {isMergingSource ? 'Será juntada' : 'Juntar aqui'}
        </span>
      )}

      <header className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {author.kind === 'anonymous' ? (
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Ghost className="h-3.5 w-3.5" strokeWidth={1.5} />
            </span>
          ) : author.kind === 'unknown' ? (
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">?</span>
          ) : (
            <PersonAvatar name={idea.authorName || (idea.authorId && view.names.get(idea.authorId)) || author.label} userId={idea.authorId} size="sm" />
          )}
          <span className="truncate text-xs font-semibold text-muted-foreground">{author.label}</span>
        </span>
        {hot && (
          <span className={cn('inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold', TONES.warn.chip)}>
            <Flame className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Em alta
          </span>
        )}
      </header>

      <div className="min-w-0 flex-1">
        <p className={cn('m-0 whitespace-pre-wrap break-words text-sm font-medium leading-snug text-foreground', long && !isExpanded && 'line-clamp-3')}>{idea.content}</p>
        {long && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded((v) => !v); }}
            aria-expanded={isExpanded}
            className={cn('mt-1.5 rounded text-xs font-semibold text-primary hover:underline [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
          >
            {isExpanded ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-1">
        {onVote && (
          <button
            type="button"
            aria-pressed={hasVoted}
            aria-label={canVote ? voteHint : `${voteHint}. ${voteBlockedHint}`}
            title={canVote ? voteHint : voteBlockedHint}
            disabled={!canVote}
            onClick={(e) => { e.stopPropagation(); onVote(idea.id); }}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-semibold tabular-nums transition-colors max-sm:h-11 max-sm:px-3 disabled:cursor-not-allowed disabled:opacity-60',
              hasVoted ? 'border-transparent bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground enabled:hover:bg-accent enabled:hover:text-foreground',
              FOCUS_RING
            )}
          >
            <ThumbsUp className={cn('h-3.5 w-3.5', hasVoted && 'fill-current')} strokeWidth={1.5} aria-hidden="true" />
            {votes.length}
          </button>
        )}
        {onUpdate && canEditText && <IconButton size="sm" label="Editar a ideia" icon={Pencil} onClick={(e) => { e.stopPropagation(); startEditing(); }} className="border-transparent text-muted-foreground max-sm:h-11 max-sm:w-11" />}
        {onStartMerge && !isMergingSource && !readOnly && (
          <IconButton size="sm" label="Juntar com outra ideia" icon={GitMerge} onClick={(e) => { e.stopPropagation(); onStartMerge(idea.id); }} className="border-transparent text-muted-foreground max-sm:h-11 max-sm:w-11" />
        )}
        {canDelete && (
          <IconButton size="sm" label="Excluir a ideia" icon={Trash2} onClick={(e) => { e.stopPropagation(); onDelete?.(idea); }} className="border-transparent text-muted-foreground hover:text-red-700 dark:hover:text-red-300 max-sm:h-11 max-sm:w-11" />
        )}
        {actionsExtra}
        {edited && (
          <span title={edited.title} className="ml-auto truncate text-xs text-muted-foreground">{edited.label}</span>
        )}
      </footer>
    </article>
  );
}
