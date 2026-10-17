'use client';

import React, { useState } from 'react';
import { Compass, GripVertical, Info, Lock, MinusCircle, Target, Trash, Zap, type LucideIcon } from 'lucide-react';
import { IconTile, ModalButton, StatusChip, TONES, TabBar, useBelowBreakpoint, type Tone } from '@/components/room-kit';
import { getQuadrant, ideaText, votesOf } from '@/lib/brainstorming-utils';
import type { BrainstormingGroup, BrainstormingIdea } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useIdeaView } from './brainstorm-context';
import { MATRIX_COLUMNS, groupColorOf, matrixColumn, matrixColumnIdeas, NO_GROUP_COLOR, type MatrixColumn } from './brainstorm-room-logic';
import { MoveToMenu } from './MoveToMenu';

interface PrioritizationPhaseProps {
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  onUpdateQualifiers: (ideaId: string, qualifiers: { roi: number; effort: number }) => void;
}

const COLUMN_STYLE: Record<MatrixColumn['id'], { icon: LucideIcon; tone: Tone }> = {
  unclassified: { icon: Target, tone: 'neutral' },
  quick_wins: { icon: Zap, tone: 'success' },
  strategic: { icon: Compass, tone: 'brand' },
  secondary: { icon: MinusCircle, tone: 'neutral' },
  discard: { icon: Trash, tone: 'danger' },
};

/**
 * Etapa 4, Matriz de priorização: cinco colunas (A classificar, Quick wins, Estratégico, Secundários e Descartar).
 * Arrastar o cartão (mouse) grava retorno e esforço da coluna; "Mover para…" faz o mesmo no toque e no teclado.
 */
export function PrioritizationPhase({ ideas, groups, onUpdateQualifiers }: PrioritizationPhaseProps) {
  const { readOnly = false } = useIdeaView();
  const [draggedIdeaId, setDraggedIdeaId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [mobileColumn, setMobileColumn] = useState<MatrixColumn['id']>('unclassified');
  const compact = useBelowBreakpoint(768);

  const moveToColumn = (ideaId: string, columnId: string) => {
    const column = matrixColumn(columnId);
    const idea = ideas.find((i) => i.id === ideaId);
    if (!column || !idea || readOnly) return;
    // Já está nessa coluna: nada a gravar.
    if (getQuadrant(idea.qualifiers) === column.id) return;
    onUpdateQualifiers(ideaId, column.qualifiers);
  };

  const handleDragStart = (e: React.DragEvent, ideaId: string) => {
    e.dataTransfer.setData('text/plain', ideaId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIdeaId(ideaId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeColumnId !== columnId) setActiveColumnId(columnId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Passar por cima de um cartão da própria coluna não conta como sair dela.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setActiveColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setActiveColumnId(null);
    setDraggedIdeaId(null);
    const ideaId = e.dataTransfer.getData('text/plain');
    if (ideaId) moveToColumn(ideaId, columnId);
  };

  const handleDragEnd = () => {
    setDraggedIdeaId(null);
    setActiveColumnId(null);
  };

  const groupOf = (idea: BrainstormingIdea) => groups.find((g) => g.id === idea.groupId);
  const columnOptions = (idea: BrainstormingIdea) => MATRIX_COLUMNS.map((c) => ({ id: c.id, label: c.title, current: c.id === getQuadrant(idea.qualifiers) }));

  const columns = compact ? MATRIX_COLUMNS.filter((c) => c.id === mobileColumn) : MATRIX_COLUMNS;

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-foreground">Matriz de priorização</h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">{readOnly ? 'Brainstorming encerrado: só leitura.' : <>Arraste as ideias para a coluna certa{compact ? ' ou use o botão de mover' : ''}.</>}</p>
        </div>
        <StatusChip tone="brand" className="h-8 gap-1.5 px-3 text-[13px]">
          <Info className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Dica: o foco do time são os Quick wins
        </StatusChip>
      </div>

      {compact && (
        <TabBar
          label="Colunas da Matriz"
          idPrefix="matriz"
          value={mobileColumn}
          onChange={setMobileColumn}
          tabs={MATRIX_COLUMNS.map((c) => ({ id: c.id, label: c.title, count: matrixColumnIdeas(ideas, c.id).length }))}
          className="overflow-x-auto px-0 [scrollbar-width:none]"
          tabClassName="shrink-0 whitespace-nowrap max-sm:h-11"
        />
      )}

      <div className={cn('flex items-start gap-3.5', compact ? 'flex-col' : 'overflow-x-auto pb-3')}>
        {columns.map((col) => {
          const style = COLUMN_STYLE[col.id];
          const colIdeas = matrixColumnIdeas(ideas, col.id);
          const isOver = activeColumnId === col.id;
          return (
            <section
              key={col.id}
              id={compact ? `matriz-panel-${col.id}` : undefined}
              role={compact ? 'tabpanel' : undefined}
              aria-labelledby={compact ? `matriz-tab-${col.id}` : undefined}
              aria-label={compact ? undefined : col.title}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={cn(
                'flex min-h-[320px] flex-col rounded-2xl border bg-card/60 transition-colors duration-fast',
                compact ? 'w-full' : 'min-w-[250px] flex-1',
                isOver ? 'border-dashed border-primary bg-primary/10 dark:bg-primary/15' : 'border-border'
              )}
            >
              <header className="flex items-center gap-2.5 border-b border-border p-3">
                <IconTile icon={style.icon} tone={style.tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 truncate text-sm font-semibold text-foreground">{col.title}</h3>
                  <p className="m-0 text-xs text-muted-foreground">{col.hint}</p>
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', TONES[style.tone].chip)}>{colIdeas.length}</span>
              </header>

              <ul className="m-0 flex flex-1 list-none flex-col gap-2.5 p-3">
                {colIdeas.map((idea) => {
                  const group = groupOf(idea);
                  const votes = votesOf(idea).length;
                  const hidden = !!idea.hidden;
                  return (
                    <li
                      key={idea.id}
                      draggable={!readOnly}
                      onDragStart={(e) => handleDragStart(e, idea.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-[box-shadow,opacity] duration-fast hover:shadow-md',
                        !readOnly && 'cursor-grab active:cursor-grabbing',
                        draggedIdeaId === idea.id && 'opacity-50'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                        <p className={cn('m-0 min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] font-medium leading-snug text-foreground', hidden && 'italic text-muted-foreground')}>
                          {hidden && <Lock className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={1.5} aria-hidden="true" />}
                          {ideaText(idea)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group ? groupColorOf(group) : NO_GROUP_COLOR }} />
                        <span className="min-w-0 truncate">{group?.title ?? 'Sem grupo'}</span>
                        {!hidden && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="shrink-0 tabular-nums">{votes} {votes === 1 ? 'voto' : 'votos'}</span>
                          </>
                        )}
                      </div>
                      {!readOnly && <div className="flex flex-wrap items-center gap-1.5">
                        {col.id !== 'quick_wins' && (
                          <ModalButton className="h-8 gap-1.5 px-2.5 text-xs max-sm:h-11" aria-label="Mover para Quick wins" onClick={() => moveToColumn(idea.id, 'quick_wins')}>
                            <Zap className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Quick wins
                          </ModalButton>
                        )}
                        {col.id !== 'discard' && (
                          <ModalButton className="h-8 gap-1.5 px-2.5 text-xs max-sm:h-11" aria-label="Mover para Descartar" onClick={() => moveToColumn(idea.id, 'discard')}>
                            <Trash className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> Descartar
                          </ModalButton>
                        )}
                        <MoveToMenu options={columnOptions(idea)} onSelect={(id) => moveToColumn(idea.id, id)} label="Mover para outra coluna" className="ml-auto" />
                      </div>}
                    </li>
                  );
                })}
                {colIdeas.length === 0 && (
                  <li className="flex min-h-[120px] flex-1 items-center justify-center rounded-xl border border-dashed border-border text-[13px] text-muted-foreground">Solte aqui</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
