'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowDownWideNarrow, ClipboardCheck, EyeOff, Lock, PackageOpen, Pencil, PenLine, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING, ModalButton } from '@/components/room-kit';
import type { RetroBoard, RetroCard as RetroCardType, RetroColumnDef, RetroParticipant, RetroReactionType } from '@/lib/types';
import { AddRetroCard } from './AddRetroCard';
import { RetroCard } from './RetroCard';
import { COLUMN_EMPTY_COPY, columnTone } from './retro-tones';
import { isActionTheme, isColumnSortedByVotes, sortColumnCards, votesUsedInColumn } from './retro-room-logic';

export type RetroColumnView = 'board' | 'focus' | 'present';

export interface RetroColumnProps {
  column: RetroColumnDef;
  cards: RetroCardType[];
  boardData: RetroBoard;
  currentUserId: string;
  participants: RetroParticipant[];
  isCreator: boolean;
  view: RetroColumnView;
  /** Coluna da etapa ativa: leva o realce quando a sincronização ou a apresentação estão ligadas. */
  isActiveStage: boolean;
  /** Mostra o realce da etapa ativa (sincronização ligada ou apresentação). */
  highlightStage: boolean;
  /** Só o facilitador troca de coluna (sincronização ligada). */
  isNavLocked: boolean;
  /** Foco e apresentação: só os cartões que receberam voto. */
  onlyVoted: boolean;
  onToggleOnlyVoted: () => void;
  mergingSourceId: string | null;
  onFocus: (columnId: string) => void;
  onAddCard: (content: string, columnKey: string, assignee?: string, dueDate?: string) => Promise<boolean> | void;
  onDeleteCard: (cardId: string) => void;
  onUpdateCard: (cardId: string, newContent: string, assignee?: string, dueDate?: string) => void;
  onToggleVote: (cardId: string, currentVotes: string[]) => void;
  onToggleReaction: (cardId: string, type: RetroReactionType, currentUserIds: string[]) => void;
  onToggleDone: (cardId: string, isDone: boolean) => void;
  onToggleColumnSort: (columnKey: string, isSorted: boolean) => void;
  onRenameColumn: (columnId: string, title: string) => void;
  onSyncSummary: () => void;
  onOpenImport: () => void;
  onStartMerge: (cardId: string | null) => void;
  onExecuteMerge: (targetId: string) => void;
  /** Retro encerrada para quem não é facilitador: sem campo de novo cartão e com os cartões só para leitura. */
  readOnly?: boolean;
  /** "Fulana está escrevendo…" nesta coluna (backend novo); `null`/ausente = ninguém. */
  typingLabel?: string | null;
  /** Avisa que a pessoa digita um cartão nesta coluna. */
  onTyping?: (columnKey: string) => void;
}

function RetroColumnComponent({
  column,
  cards,
  boardData,
  currentUserId,
  participants,
  isCreator,
  view,
  isActiveStage,
  highlightStage,
  isNavLocked,
  onlyVoted,
  onToggleOnlyVoted,
  mergingSourceId,
  onFocus,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
  onToggleVote,
  onToggleReaction,
  onToggleDone,
  onToggleColumnSort,
  onRenameColumn,
  onSyncSummary,
  onOpenImport,
  onStartMerge,
  onExecuteMerge,
  readOnly = false,
  typingLabel = null,
  onTyping,
}: RetroColumnProps) {
  const { id: columnKey, title, theme } = column;
  const tone = columnTone(theme);
  const Icon = tone.icon;
  const isActionColumn = isActionTheme(theme);
  const isFeedbackColumn = !isActionColumn;
  const present = view === 'present';
  const focus = view === 'focus';
  const big = focus || present;
  const { votingStatus, isCardsRevealed } = boardData;

  const sortedByVotes = isColumnSortedByVotes(boardData, columnKey, theme);
  const maxVotes = boardData.maxVotesPerParticipant || 0;
  const showVoteCounter = isFeedbackColumn && maxVotes > 0 && (votingStatus === 'active' || votingStatus === 'finished');
  const votesUsed = useMemo(() => votesUsedInColumn(cards, columnKey, currentUserId), [cards, columnKey, currentUserId]);

  const sortedCards = useMemo(() => sortColumnCards(cards, sortedByVotes && isFeedbackColumn), [cards, sortedByVotes, isFeedbackColumn]);
  const visibleCards = useMemo(
    () => (onlyVoted && isFeedbackColumn ? sortedCards.filter((c) => c.votes.length > 0) : sortedCards),
    [onlyVoted, isFeedbackColumn, sortedCards]
  );
  const cardIds = useMemo(() => visibleCards.map((c) => c.id), [visibleCards]);

  // Mais votados da coluna (destaque): só durante e depois da votação.
  const topVotes = useMemo(() => {
    if (!isFeedbackColumn || (votingStatus !== 'active' && votingStatus !== 'finished')) return 0;
    return cards.reduce((max, c) => Math.max(max, c.votes.length), 0);
  }, [cards, isFeedbackColumn, votingStatus]);

  const { setNodeRef, isOver } = useDroppable({ id: columnKey, data: { type: 'column' } });

  // Título editável (só o facilitador). Enter e Esc desmontam o campo e isso dispara o blur logo depois:
  // sem a trava, salvava duas vezes (Enter) ou salvava o texto digitado mesmo cancelando com Esc.
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const skipBlurSaveRef = useRef(false);
  useEffect(() => { setEditedTitle(title); }, [title]);
  useEffect(() => {
    if (!isEditingTitle) return;
    skipBlurSaveRef.current = false;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [isEditingTitle]);
  const saveTitle = () => {
    setIsEditingTitle(false);
    const next = editedTitle.trim();
    if (!next || next === title) return;
    onRenameColumn(columnKey, next);
  };

  const [composerOpen, setComposerOpen] = useState(false);
  const empty = visibleCards.length === 0;
  const emptyCopy = COLUMN_EMPTY_COPY[theme] ?? COLUMN_EMPTY_COPY.neutral;
  const filteredEmpty = onlyVoted && isFeedbackColumn && cards.length > 0 && empty;

  const sortLabel = isCreator ? 'Ordenar por votos' : 'Ordenado por votos';

  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        'flex min-w-0 flex-col gap-2.5 rounded-2xl border border-t-[3px] border-border bg-muted/30 p-3 transition-[border-color,box-shadow,opacity] duration-base',
        tone.top,
        view === 'board' && 'min-w-[min(86vw,320px)] flex-1 snap-start sm:min-w-[270px] 2xl:min-w-[320px]',
        highlightStage && isActiveStage && 'ring-2 ring-primary/50',
        present && !isActiveStage && 'opacity-55',
        isOver && 'ring-2 ring-primary/60 bg-primary/5'
      )}
    >
      {/* Cabeçalho */}
      <div
        className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 py-0.5', big && 'sm:flex-nowrap', !isNavLocked && view === 'board' && 'cursor-pointer')}
        onClick={view === 'board' && !isNavLocked ? () => onFocus(columnKey) : undefined}
      >
        {big && (
          <span aria-hidden="true" className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]', tone.tint)}>
            <Icon className="h-[17px] w-[17px]" strokeWidth={1.5} />
          </span>
        )}

        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            value={editedTitle}
            maxLength={60}
            aria-label="Nome da coluna"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={() => {
              if (skipBlurSaveRef.current) { skipBlurSaveRef.current = false; return; }
              saveTitle();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { skipBlurSaveRef.current = true; saveTitle(); }
              if (e.key === 'Escape') { e.stopPropagation(); skipBlurSaveRef.current = true; setEditedTitle(title); setIsEditingTitle(false); }
            }}
            className={cn('h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-bold', present ? 'text-xl' : 'text-[15px]', FOCUS_RING)}
          />
        ) : (
          <>
            <h2 title={title} className={cn('m-0 min-w-0 truncate font-bold leading-tight text-foreground', present ? 'text-xl' : 'text-[15px]')}>{title}</h2>
            {!big && <span className="text-xs font-semibold tabular-nums text-muted-foreground">{cards.length}</span>}
            {isCreator && !present && (
              <button
                type="button"
                title="Editar o nome da coluna"
                aria-label={`Editar o nome da coluna ${title}`}
                onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
                className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-accent focus-visible:opacity-100 sm:opacity-0 sm:hover:opacity-100 [section:hover_&]:opacity-100', FOCUS_RING)}
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </>
        )}

        <span className="flex-1" />

        {showVoteCounter && (
          <span
            title="Seus votos usados neste painel / limite por pessoa"
            aria-label={`Você usou ${votesUsed} de ${maxVotes} votos neste painel`}
            className={cn('inline-flex items-center gap-1 text-xs font-semibold tabular-nums', votesUsed >= maxVotes ? 'text-amber-700 dark:text-amber-300' : 'text-primary [.theme-totvs:not(.dark)_&]:text-foreground')}
          >
            <Star className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            {Math.max(0, maxVotes - votesUsed)} {maxVotes - votesUsed === 1 ? 'voto' : 'votos'}
          </span>
        )}

        {highlightStage && focus && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Todos veem a mesma coluna
          </span>
        )}

        {isActionColumn && isCreator && cards.length > 0 && !present && (
          <button
            type="button"
            title="Salvar o resumo da retro no histórico"
            aria-label="Salvar o resumo da retro no histórico"
            onClick={(e) => { e.stopPropagation(); onSyncSummary(); }}
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent', FOCUS_RING)}
          >
            <ClipboardCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}

        {isFeedbackColumn && (isCreator || sortedByVotes) && (
          <button
            type="button"
            aria-pressed={sortedByVotes}
            aria-label={sortLabel}
            title={sortLabel}
            disabled={!isCreator}
            onClick={(e) => { e.stopPropagation(); if (isCreator) onToggleColumnSort(columnKey, !sortedByVotes); }}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none',
              sortedByVotes ? 'border-primary/50 bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
              FOCUS_RING
            )}
          >
            <ArrowDownWideNarrow className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}

        {big && isFeedbackColumn && votingStatus !== 'disabled' && (
          <button
            type="button"
            aria-pressed={onlyVoted}
            aria-label="Só cartões com voto"
            title="Só cartões com voto"
            onClick={onToggleOnlyVoted}
            className={cn(
              'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
              onlyVoted ? 'border-primary/50 bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
              FOCUS_RING
            )}
          >
            <Star className={cn('h-4 w-4', onlyVoted && 'fill-current')} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}

        {big && (
          <span className={cn('inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-[13px] font-bold tabular-nums', tone.tint)}>{cards.length}</span>
        )}
      </div>

      {typingLabel && (
        <p role="status" className="m-0 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <PenLine className="h-3.5 w-3.5 shrink-0 motion-safe:animate-pulse" strokeWidth={1.5} aria-hidden="true" />
          <span className="min-w-0 truncate">{typingLabel}</span>
        </p>
      )}

      {/* Campo fixo no topo (visão foco) */}
      {focus && !readOnly && (
        <AddRetroCard columnKey={columnKey} isActionColumn={isActionColumn} variant="field" onAddCard={onAddCard} participants={participants} onTyping={onTyping} />
      )}

      {/* Cartões */}
      {empty ? (
        big ? (
          <div className={cn('flex flex-col items-center gap-2.5 text-center', present ? 'py-16' : 'px-5 pb-16 pt-12')}>
            <span aria-hidden="true" className={cn('flex h-[72px] w-[72px] items-center justify-center rounded-[22px]', tone.tint)}>
              <Icon className="h-8 w-8" strokeWidth={1.5} />
            </span>
            <p className="m-0 mt-1.5 text-base font-bold text-foreground">{filteredEmpty ? 'Nenhum cartão com voto' : emptyCopy.title}</p>
            <p className="m-0 text-sm text-muted-foreground">{filteredEmpty ? 'Tire o filtro para ver todos os cartões.' : emptyCopy.hint}</p>
            {focus && !filteredEmpty && !readOnly && (
              <ModalButton
                className="mt-2 gap-2"
                onClick={(e) => {
                  (e.currentTarget.closest('section')?.querySelector('textarea') as HTMLTextAreaElement | null)?.focus();
                }}
              >
                <PenLine className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Escrever
              </ModalButton>
            )}
            {!isCardsRevealed && isFeedbackColumn && !filteredEmpty && (
              <p className="m-0 mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Seus cartões ficam ocultos até a revelação
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[10px] border border-dashed border-border p-3.5 text-center text-[13px] text-muted-foreground">Nenhum cartão ainda</div>
        )
      ) : null}

      <SortableContext items={cardIds} strategy={focus || present ? rectSortingStrategy : verticalListSortingStrategy}>
        <div
          className={cn(
            'min-h-2',
            view === 'board' && 'flex flex-col gap-2.5',
            focus && 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3',
            present && 'grid grid-cols-1 gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]'
          )}
        >
          {visibleCards.map((card) => (
            <RetroCard
              key={card.id}
              card={card}
              isActionColumn={isActionColumn}
              isCardsRevealed={isCardsRevealed}
              isAuthor={!!card.authorId && card.authorId === currentUserId}
              isCreator={isCreator}
              currentUserId={currentUserId}
              votingStatus={votingStatus}
              participants={participants}
              isAuthorsRevealed={boardData.isAuthorsRevealed === true}
              mergingSourceId={mergingSourceId}
              isTopVoted={topVotes > 0 && card.votes.length === topVotes}
              large={present}
              readOnly={readOnly}
              onDelete={onDeleteCard}
              onUpdate={onUpdateCard}
              onToggleVote={onToggleVote}
              onToggleReaction={onToggleReaction}
              onToggleDone={onToggleDone}
              onStartMerge={onStartMerge}
              onExecuteMerge={onExecuteMerge}
            />
          ))}
        </div>
      </SortableContext>

      {/* Rodapé da coluna (visão em quadro) */}
      {view === 'board' && !readOnly && (
        <AddRetroCard
          columnKey={columnKey}
          isActionColumn={isActionColumn}
          variant="button"
          open={composerOpen}
          onOpenChange={setComposerOpen}
          onAddCard={onAddCard}
          participants={participants}
          onTyping={onTyping}
        />
      )}

      {isActionColumn && isCreator && !present && !readOnly && (
        <button
          type="button"
          onClick={onOpenImport}
          className={cn('inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-primary/10 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
        >
          <PackageOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Importar ações pendentes
        </button>
      )}
    </section>
  );
}

export const RetroColumn = memo(RetroColumnComponent);
