'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CornerUpLeft,
  EyeOff,
  GitMerge,
  GripVertical,
  Heart,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog, FIELD, FOCUS_RING, ModalButton } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { RETRO_REACTIONS, type RetroCard as RetroCardType, type RetroParticipant, type RetroReactionType } from '@/lib/types';
import { canShowCardContent } from './retro-card-visibility';
import { dueStatus, formatDueDate, formatDueShort } from './retro-room-logic';

const REACTION_ICONS: Record<RetroReactionType, LucideIcon> = {
  up: ThumbsUp,
  love: Heart,
  wow: Sparkles,
  concern: ThumbsDown,
};

// Quando a reação está marcada: positivas na cor delas; "preocupa" sempre em vermelho (sinal de atenção do time).
const REACTION_ON: Record<RetroReactionType, string> = {
  up: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  love: 'border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300',
  wow: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  concern: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
};

const DUE_CHIP: Record<ReturnType<typeof dueStatus>, string> = {
  none: 'bg-muted text-muted-foreground',
  ok: 'bg-muted text-muted-foreground',
  soon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  overdue: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

/** Ideias fundidas: linha do tempo abaixo do texto principal. Acima de 3, mostra 2 e resume o resto em "+N mais". */
function MergedTimeline({ items, large }: { items: string[]; large?: boolean }) {
  if (!items.length) return null;
  const MAX_VISIBLE = 2;
  const overflow = items.length > 3;
  const visible = overflow ? items.slice(0, MAX_VISIBLE) : items;
  const hidden = overflow ? items.length - MAX_VISIBLE : 0;
  return (
    <div className="ml-1 flex flex-col border-l-2 border-border pl-3" onClick={(e) => e.stopPropagation()}>
      {visible.map((text, i) => (
        <div key={i} className="relative py-1.5">
          <span aria-hidden="true" className="absolute -left-[18px] top-3 h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          <p className={cn('m-0 whitespace-pre-wrap break-words leading-relaxed text-muted-foreground', large ? 'text-base' : 'text-[13px]')}>{text}</p>
        </div>
      ))}
      {hidden > 0 && (
        <div className="relative py-1.5">
          <span aria-hidden="true" className="absolute -left-[18px] top-3 h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          <span className="text-xs font-semibold text-muted-foreground">+{hidden} mais</span>
        </div>
      )}
    </div>
  );
}

export interface RetroCardProps {
  card: RetroCardType;
  isActionColumn: boolean;
  isCardsRevealed: boolean;
  isAuthor: boolean;
  isCreator: boolean;
  currentUserId: string;
  votingStatus: 'disabled' | 'active' | 'finished';
  participants: RetroParticipant[];
  isAuthorsRevealed: boolean;
  mergingSourceId: string | null;
  /** Um dos cartões mais votados da coluna (destaque durante e depois da votação). */
  isTopVoted?: boolean;
  /** Texto maior para a projeção (modo apresentação). */
  large?: boolean;
  onDelete: (cardId: string) => void;
  onUpdate: (cardId: string, newContent: string, assignee?: string, dueDate?: string) => void;
  onToggleVote: (cardId: string, currentVotes: string[]) => void;
  onToggleReaction: (cardId: string, type: RetroReactionType, currentUserIds: string[]) => void;
  onToggleDone: (cardId: string, isDone: boolean) => void;
  onStartMerge: (cardId: string | null) => void;
  onExecuteMerge: (targetId: string) => void;
}

export function RetroCard({
  card,
  isActionColumn,
  isCardsRevealed,
  isAuthor,
  isCreator,
  currentUserId,
  votingStatus,
  participants,
  isAuthorsRevealed,
  mergingSourceId,
  isTopVoted = false,
  large = false,
  onDelete,
  onUpdate,
  onToggleVote,
  onToggleReaction,
  onToggleDone,
  onStartMerge,
  onExecuteMerge,
}: RetroCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(card.content);
  const [editedAssignee, setEditedAssignee] = useState(card.assignee || '');
  const [editedDueDate, setEditedDueDate] = useState(card.dueDate || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  // O campo cresce com o texto (até 55% da altura da tela) em vez de rolar dentro de uma caixa pequena.
  useEffect(() => {
    const el = editRef.current;
    if (!isEditing || !el) return;
    el.style.height = 'auto';
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + border, Math.round(window.innerHeight * 0.55))}px`;
  }, [editedContent, isEditing]);

  // Ao abrir a edição o cursor vai para o fim do texto.
  useEffect(() => {
    const el = editRef.current;
    if (isEditing && el) el.setSelectionRange(el.value.length, el.value.length);
  }, [isEditing]);

  // Sem editar, o rascunho acompanha o que o servidor mandou (texto fundido, responsável, prazo).
  useEffect(() => {
    if (isEditing) return;
    setEditedContent(card.content);
    setEditedAssignee(card.assignee || '');
    setEditedDueDate(card.dueDate || '');
  }, [card.content, card.assignee, card.dueDate, isEditing]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined };

  const showRealContent = canShowCardContent(card, { isCardsRevealed, isAuthor, isActionPlan: isActionColumn });
  const showAuthorInfo = isAuthorsRevealed || isAuthor || isActionColumn;
  const authorName = isAuthor ? 'Você' : participants.find((p) => p.id === card.authorId)?.nickname;
  const showVotes = (votingStatus === 'active' || votingStatus === 'finished') && !isActionColumn;
  const canVote = votingStatus === 'active';
  const hasVoted = card.votes.includes(currentUserId);
  const canEdit = isAuthor || isCreator;
  const isMergeSource = mergingSourceId === card.id;
  const isMergeTarget = !!mergingSourceId && !isMergeSource;

  const saveEdit = () => {
    const text = editedContent.trim();
    // Texto vazio não fecha o editor em silêncio: o cartão precisa de texto (para apagar existe a lixeira).
    if (!text) return;
    const assignee = editedAssignee.trim() || undefined;
    const due = editedDueDate || undefined;
    const unchanged = text === card.content && assignee === (card.assignee || undefined) && due === (card.dueDate || undefined);
    if (!unchanged) onUpdate(card.id, text, assignee, due);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditedContent(card.content);
    setEditedAssignee(card.assignee || '');
    setEditedDueDate(card.dueDate || '');
  };

  const handleEditKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === 'Escape') cancelEdit();
  };

  const onCardClick = () => {
    if (!mergingSourceId) return;
    if (mergingSourceId !== card.id) onExecuteMerge(card.id);
    else onStartMerge(null);
  };

  const shell = cn(
    'group relative flex flex-col gap-2.5 rounded-xl border bg-card p-3 text-card-foreground transition-[border-color,box-shadow,opacity,transform] duration-base',
    'shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)]',
    isTopVoted && showVotes ? 'border-primary/60' : 'border-border',
    isMergeSource && 'ring-2 ring-primary',
    isMergeTarget && 'cursor-pointer hover:border-primary hover:ring-2 hover:ring-primary/40',
    isOver && !isDragging && 'border-primary/60',
    isActionColumn && card.isDone && 'opacity-70'
  );

  // ---- Editando ----
  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="select-none">
        <div className={cn(shell, 'border-primary/60')}>
          <Textarea
            ref={editRef}
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            onKeyDown={handleEditKey}
            autoFocus
            rows={3}
            maxLength={1000}
            aria-label="Editar o texto do cartão"
            className={cn(FIELD, 'min-h-[96px] resize-none overflow-y-auto py-2.5 leading-relaxed')}
          />
          <p className="m-0 text-xs text-muted-foreground">Enter salva · Shift+Enter quebra a linha · Esc cancela</p>

          {isActionColumn && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
              <label className="flex items-center gap-2.5 text-sm">
                <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                <span className="sr-only">Responsável</span>
                <input
                  type="text"
                  list={`retro-assignees-${card.id}`}
                  placeholder="Responsável"
                  value={editedAssignee}
                  onChange={(e) => setEditedAssignee(e.target.value)}
                  className={cn(FIELD, 'h-9')}
                />
                <datalist id={`retro-assignees-${card.id}`}>
                  {participants.map((p) => <option key={p.id} value={p.nickname} />)}
                </datalist>
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                <span className="sr-only">Prazo</span>
                <input type="date" value={editedDueDate} onChange={(e) => setEditedDueDate(e.target.value)} className={cn(FIELD, 'h-9')} />
              </label>
            </div>
          )}

          <div className="flex gap-2">
            <ModalButton variant="primary" className="h-9 flex-1" onClick={saveEdit} disabled={!editedContent.trim()}>Salvar</ModalButton>
            <ModalButton className="h-9" onClick={cancelEdit}>Cancelar</ModalButton>
          </div>
        </div>
      </div>
    );
  }

  // ---- Oculto até a revelação ----
  if (!showRealContent) {
    return (
      <div ref={setNodeRef} style={style} className={cn('select-none', isDragging && 'scale-95 opacity-50')}>
        <article onClick={onCardClick} className={cn(shell, 'flex-row items-center gap-3 text-sm text-muted-foreground', isMergeTarget && 'hover:ring-0')} aria-label="Cartão oculto até a revelação">
          <EyeOff className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Cartão de <strong className="font-semibold text-foreground">{isAuthorsRevealed && authorName ? authorName : 'alguém'}</strong> · oculto até a revelação
          </span>
          <span aria-hidden="true" className="h-2 w-14 shrink-0 rounded bg-border" />
          {isCreator && (
            <span {...attributes} {...listeners} aria-label="Arrastar cartão" className={cn('inline-flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md hover:bg-accent active:cursor-grabbing', FOCUS_RING)}>
              <GripVertical className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
          )}
        </article>
      </div>
    );
  }

  const dueState = dueStatus(card.dueDate, card.isDone);
  const textSize = large ? 'text-xl leading-snug' : 'text-sm leading-[1.45]';
  const metaSize = large ? 'text-sm' : 'text-xs';

  return (
    <div ref={setNodeRef} style={style} className={cn('select-none', isDragging && 'scale-95 opacity-50')}>
      <article onClick={onCardClick} className={shell}>
        {isMergeSource && (
          <span className="absolute -top-2 right-3 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground">Origem</span>
        )}
        {isMergeTarget && (
          <span className="absolute -top-2 right-3 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 [.theme-totvs:not(.dark)_&]:text-foreground">Destino</span>
        )}

        {/* Texto */}
        <div className="flex items-start gap-2.5">
          {isActionColumn && (
            <button
              type="button"
              role="checkbox"
              aria-checked={!!card.isDone}
              aria-label={card.isDone ? 'Marcar como pendente' : 'Marcar como concluída'}
              disabled={!canEdit}
              onClick={(e) => { e.stopPropagation(); onToggleDone(card.id, !card.isDone); }}
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors disabled:cursor-default',
                card.isDone ? 'border-primary bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-muted-foreground/50 hover:border-primary',
                FOCUS_RING
              )}
            >
              {card.isDone && <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />}
            </button>
          )}
          <p className={cn('m-0 min-w-0 flex-1 whitespace-pre-wrap break-words font-medium', textSize, card.isDone && isActionColumn ? 'text-muted-foreground line-through' : 'text-foreground')}>
            {card.content}
          </p>
          <div className="-mr-1 -mt-1 flex shrink-0 items-center opacity-0 transition-opacity duration-fast focus-within:opacity-100 group-hover:opacity-100 data-[open=true]:opacity-100 [@media(hover:none)]:opacity-100" data-open={menuOpen}>
            <span {...attributes} {...listeners} aria-label="Arrastar cartão" title="Arrastar cartão" className={cn('inline-flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:cursor-grabbing max-sm:h-9', FOCUS_RING)}>
              <GripVertical className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </span>
            {(canEdit || isCardsRevealed) && (
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Mais ações do cartão"
                    title="Mais ações do cartão"
                    onClick={(e) => e.stopPropagation()}
                    className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent max-sm:h-9 max-sm:w-9', FOCUS_RING)}
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => setIsEditing(true)} className="gap-2">
                      <Pencil className="h-4 w-4" strokeWidth={1.5} /> Editar cartão
                    </DropdownMenuItem>
                  )}
                  {isCardsRevealed && !isMergeSource && (
                    <DropdownMenuItem onClick={() => onStartMerge(card.id)} className="gap-2">
                      <GitMerge className="h-4 w-4" strokeWidth={1.5} /> Juntar com outro cartão
                    </DropdownMenuItem>
                  )}
                  {canEdit && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setConfirmDelete(true)} className="gap-2 text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300">
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Excluir cartão
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <MergedTimeline items={card.originalTexts ?? []} large={large} />

        {/* Rodapé: ação (responsável, prazo, origem) ou feedback (autor, reações, votos) */}
        {isActionColumn ? (
          <div className="flex flex-wrap items-center gap-2">
            {card.assignee && (
              <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-0.5 pr-2', metaSize)}>
                <InitialsAvatar name={card.assignee} className="h-5 w-5 text-[11px]" />
                {card.assignee}
              </span>
            )}
            {card.dueDate && dueState !== 'none' && (
              <span className={cn('inline-flex h-6 items-center rounded-md px-2 tabular-nums', metaSize, DUE_CHIP[dueState])} title={`Prazo: ${formatDueDate(card.dueDate)}`}>
                {dueState === 'overdue' ? `Atrasada · ${formatDueShort(card.dueDate)}` : formatDueShort(card.dueDate)}
              </span>
            )}
            {card.carriedFromBoardId && (
              <span className={cn('inline-flex h-6 max-w-full items-center gap-1 rounded-md bg-amber-500/10 px-2 font-semibold text-amber-700 dark:text-amber-300', metaSize)} title={`Trazido de: ${card.carriedFromBoardTitle || 'retro anterior'}`}>
                <CornerUpLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span className="truncate">Veio de {card.carriedFromBoardTitle || 'retro anterior'}</span>
              </span>
            )}
            {(card.carryCount || 0) > 1 && (
              <span className={cn('inline-flex h-6 items-center gap-1 rounded-md bg-red-500/10 px-2 font-semibold text-red-700 dark:text-red-300', metaSize)} title={`Reimportada ${card.carryCount}x sem ser concluída: tema recorrente`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                Recorrente ({card.carryCount}x)
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-muted-foreground', metaSize)}>
                {showAuthorInfo && authorName ? (
                  <InitialsAvatar name={authorName} className="h-6 w-6 text-xs" />
                ) : (
                  <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-muted"><EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} /></span>
                )}
                <span className="truncate">{showAuthorInfo && authorName ? authorName : 'Anônimo'}</span>
              </span>
              {isAuthor && !isCardsRevealed && (
                <span className="inline-flex h-5 items-center rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">só você vê</span>
              )}
              <span className="flex-1" />
              {showVotes && (
                <button
                  type="button"
                  aria-pressed={hasVoted}
                  disabled={!canVote}
                  title={hasVoted ? 'Remover meu voto' : canVote ? 'Votar neste cartão' : 'A votação não está aberta'}
                  aria-label={`${hasVoted ? 'Remover meu voto' : 'Votar neste cartão'} (${card.votes.length} ${card.votes.length === 1 ? 'voto' : 'votos'})`}
                  onClick={(e) => { e.stopPropagation(); onToggleVote(card.id, card.votes); }}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold tabular-nums transition-colors max-sm:h-9',
                    hasVoted
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/40 [.theme-totvs:not(.dark)_&]:text-foreground'
                      : 'bg-muted text-muted-foreground enabled:hover:bg-accent',
                    'disabled:cursor-default',
                    FOCUS_RING
                  )}
                >
                  <Star className={cn('h-3.5 w-3.5', hasVoted && 'fill-current')} strokeWidth={1.5} aria-hidden="true" />
                  {card.votes.length}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {RETRO_REACTIONS.map(({ key, label }) => {
                const userIds = card.reactions?.[key] || [];
                const on = userIds.includes(currentUserId);
                const Icon = REACTION_ICONS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    aria-label={`${label}${userIds.length > 0 ? ` (${userIds.length})` : ''}`}
                    aria-pressed={on}
                    onClick={() => onToggleReaction(card.id, key, userIds)}
                    className={cn(
                      'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold tabular-nums transition-colors max-sm:h-8',
                      on ? REACTION_ON[key] : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-accent',
                      FOCUS_RING
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    {userIds.length > 0 && userIds.length}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </article>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={Trash2}
        title="Remover este cartão?"
        description="Os votos e as reações dele também saem, para toda a squad."
        cancelLabel="Manter"
        confirmLabel="Remover cartão"
        onConfirm={() => onDelete(card.id)}
      >
        <p className="m-0 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-[10px] border border-border bg-muted/50 p-3 text-sm leading-snug text-foreground">{card.content}</p>
      </ConfirmDialog>
    </div>
  );
}
