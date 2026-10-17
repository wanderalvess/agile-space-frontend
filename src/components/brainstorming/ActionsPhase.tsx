'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ListChecks, Lock, Target, ThumbsUp, TrendingUp, Zap } from 'lucide-react';
import { IconTile, ModalButton, SelectField, StatusChip } from '@/components/room-kit';
import { getQuadrant, ideaText, votesOf } from '@/lib/brainstorming-utils';
import type { BrainstormingBoard, BrainstormingGroup, BrainstormingIdea } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CreatePlanDialog } from './CreatePlanDialog';
import { NO_GROUP_COLOR, groupColorOf, quadrantLabel, sortByVotes } from './brainstorm-room-logic';

interface ActionsPhaseProps {
  ideas: BrainstormingIdea[];
  groups: BrainstormingGroup[];
  boardData: BrainstormingBoard;
  onUpdateIdea: (id: string, content: string) => Promise<boolean | void> | boolean | void;
  onMoveIdea: (id: string, groupId: string | null) => void;
}

const NO_GROUP = '__none';
const RANK_SIZE = 10;

const SECTION_CARD = 'rounded-2xl border border-border bg-card p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]';

/**
 * Etapa 5, Plano: as ideias que venceram (Quick wins por votos e iniciativas estratégicas), o ranking e o botão
 * que leva as melhores para um plano de ação 5W2H, com prévia.
 */
export function ActionsPhase({ ideas, groups, boardData, onUpdateIdea, onMoveIdea }: ActionsPhaseProps) {
  const [planOpen, setPlanOpen] = useState(false);

  const sorted = useMemo(() => sortByVotes(ideas), [ideas]);
  // mesma classificação da etapa Matriz (uma ideia devolvida a "A classificar" não vira Quick win aqui)
  const quickWins = sorted.filter((i) => getQuadrant(i.qualifiers) === 'quick_wins');
  const strategic = sorted.filter((i) => getQuadrant(i.qualifiers) === 'strategic');
  // ideias que o servidor ainda não revelou a esta pessoa não têm texto: não dá para virar ação
  const hasHiddenIdeas = ideas.some((i) => i.hidden);
  const groupOf = (idea: BrainstormingIdea) => groups.find((g) => g.id === idea.groupId);

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-bold text-foreground">Plano</h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">Resumo do que a squad decidiu nas etapas anteriores.</p>
        </div>
        <ModalButton
          variant="primary"
          className="h-11 gap-2 px-5"
          onClick={() => setPlanOpen(true)}
          disabled={hasHiddenIdeas}
          title={hasHiddenIdeas ? 'Disponível quando o facilitador revelar as ideias' : undefined}
        >
          <ListChecks className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Criar plano de ação
        </ModalButton>
      </div>

      <section aria-label="Execução imediata" className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={Zap} tone="success" size="sm" />
          <h3 className="m-0 text-base font-bold text-foreground">Execução imediata (Quick wins)</h3>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {quickWins.length > 0 ? (
            quickWins.map((idea, i) => <ActionCard key={idea.id} idea={idea} groups={groups} rank={i + 1} onUpdate={onUpdateIdea} onMove={onMoveIdea} />)
          ) : (
            <p className="col-span-full m-0 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma ideia classificada como Quick win ainda.</p>
          )}
        </div>
      </section>

      <section aria-label="Iniciativas estratégicas" className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={Target} size="sm" />
          <h3 className="m-0 text-base font-bold text-foreground">Iniciativas estratégicas</h3>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {strategic.length > 0 ? (
            strategic.map((idea) => <ActionCard key={idea.id} idea={idea} groups={groups} isStrategic onUpdate={onUpdateIdea} onMove={onMoveIdea} />)
          ) : (
            <p className="col-span-full m-0 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma iniciativa estratégica identificada.</p>
          )}
        </div>
      </section>

      <section aria-label="Ranking de ideias" className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile icon={TrendingUp} tone="neutral" size="sm" />
          <h3 className="m-0 text-base font-bold text-foreground">Ranking de ideias</h3>
          <StatusChip tone="neutral">{Math.min(RANK_SIZE, sorted.length)} primeiras</StatusChip>
        </div>
        <div className={cn(SECTION_CARD, 'overflow-x-auto p-0')}>
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="bg-muted/60">
              <tr>
                {['Posição', 'Ideia', 'Grupo', 'Votos', 'Retorno e esforço'].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 text-xs font-bold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, RANK_SIZE).map((idea, i) => {
                const group = groupOf(idea);
                return (
                  <tr key={idea.id} className="border-t border-border">
                    <td className="px-4 py-3 text-sm font-bold tabular-nums text-muted-foreground">#{i + 1}</td>
                    <td className="max-w-md px-4 py-3 text-[13px] font-medium text-foreground">
                      <span className="line-clamp-2">{ideaText(idea)}</span>
                    </td>
                    <td className="px-4 py-3 text-[13px]">
                      {group ? (
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: groupColorOf(group) }} />
                          {group.title}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem grupo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-foreground">{idea.hidden ? '—' : votesOf(idea).length}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">{quadrantLabel(idea.qualifiers)}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Sem ideias ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <CreatePlanDialog open={planOpen} onOpenChange={setPlanOpen} boardId={boardData.id} boardTitle={boardData.title} team={boardData.team} ideas={ideas} groups={groups} />
    </div>
  );
}

function ActionCard({
  idea,
  groups,
  rank,
  isStrategic,
  onUpdate,
  onMove,
}: {
  idea: BrainstormingIdea;
  groups: BrainstormingGroup[];
  rank?: number;
  isStrategic?: boolean;
  onUpdate: (id: string, content: string) => Promise<boolean | void> | boolean | void;
  onMove: (id: string, groupId: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(idea.content);
  const savingRef = useRef(false);
  const group = groups.find((g) => g.id === idea.groupId);
  const hidden = !!idea.hidden;

  const options = useMemo(() => [{ value: NO_GROUP, label: 'Sem grupo' }, ...groups.map((g) => ({ value: g.id, label: g.title }))], [groups]);

  const save = async () => {
    // Enter e perda de foco disparam as duas: salva uma vez só
    if (savingRef.current) return;
    const text = draft.trim();
    if (!text || text === idea.content) {
      setIsEditing(false);
      return;
    }
    savingRef.current = true;
    try {
      const saved = await onUpdate(idea.id, text);
      if (saved !== false) setIsEditing(false);
    } finally {
      savingRef.current = false;
    }
  };

  const votes = votesOf(idea).length;
  const dot = group ? groupColorOf(group) : NO_GROUP_COLOR;

  return (
    <article className={cn(SECTION_CARD, 'flex h-full flex-col gap-3 p-3.5')}>
      <div className="flex items-center gap-2">
        {rank !== undefined && <StatusChip tone="brand" className="h-5 px-2">Top {rank}</StatusChip>}
        {isStrategic && <StatusChip tone="warn" className="h-5 px-2">Estratégico</StatusChip>}
      </div>

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            aria-label="Texto da ideia"
            maxLength={5000}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void save();
              }
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="min-h-[88px] w-full resize-none rounded-[10px] border border-primary/50 bg-muted/40 p-2 text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : hidden ? (
          <p className="m-0 flex items-center gap-1.5 text-[13px] italic text-muted-foreground">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> {ideaText(idea)}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(idea.content);
              setIsEditing(true);
            }}
            title="Clique para editar o texto"
            className="-m-1 block w-[calc(100%+0.5rem)] rounded-lg p-1 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn('block whitespace-pre-wrap break-words text-[13px] font-medium leading-snug text-foreground', !isExpanded && 'line-clamp-4')}>{idea.content}</span>
          </button>
        )}
        {!hidden && !isEditing && idea.content.length > 100 && (
          <button type="button" onClick={() => setIsExpanded((v) => !v)} aria-expanded={isExpanded} className="mt-1.5 rounded text-xs font-semibold text-primary hover:underline [.theme-totvs:not(.dark)_&]:text-foreground">
            {isExpanded ? 'Ver menos' : 'Ver tudo'}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
          <SelectField
            aria-label="Mover a ideia para um grupo"
            value={idea.groupId || NO_GROUP}
            onChange={(v) => onMove(idea.id, v === NO_GROUP ? null : v)}
            options={options}
            className="h-8 min-w-0 max-w-[10rem] border-transparent bg-transparent px-2 text-xs"
          />
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-muted-foreground" title={`${votes} ${votes === 1 ? 'voto' : 'votos'}`}>
          <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          {hidden ? '—' : votes}
        </span>
      </div>
    </article>
  );
}
