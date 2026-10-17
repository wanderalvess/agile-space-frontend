'use client';

import React, { useMemo, useRef, useState } from 'react';
import { GitMerge, Lightbulb, Plus, Search, X } from 'lucide-react';
import { FIELD, IconTile, ModalButton, Segmented, StatusChip } from '@/components/room-kit';
import type { BrainstormingIdea } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useIdeaView } from './brainstorm-context';
import { downloadElementAsPng, useExportRequest } from './brainstorm-image';
import { IDEA_ORDERS, filterAndSortIdeas, type IdeaOrder } from './brainstorm-room-logic';
import { IDEA_MAX_LENGTH, IdeaCard } from './IdeaCard';

interface MuralPhaseProps {
  ideas: BrainstormingIdea[];
  /** Devolve true quando a ideia foi salva; o campo só é limpo nesse caso (se falhar, o texto digitado fica). */
  onAddIdea: (content: string) => Promise<boolean> | boolean;
  onDeleteIdea: (idea: BrainstormingIdea) => void;
  onUpdateIdea: (id: string, content: string) => Promise<boolean | void> | boolean | void;
  onVoteIdea: (id: string) => void;
  onStartMerge: (id: string | null) => void;
  onExecuteMerge: (sourceId: string, targetId: string) => void;
  mergingSourceId: string | null;
  /** Modo apresentação: esconde o campo de lançar para projetar o mural sem distrações. */
  isPresentationMode?: boolean;
  /** Número do pedido de imagem (PNG): muda a cada "Salvar imagem". */
  exportRequest?: number;
  onExportDone?: (ok: boolean) => void;
}

/**
 * Etapa 1, Mural: campo de lançar, busca, ordem (recentes ou populares) e a grade de cartões. A fusão escolhe
 * uma ideia de origem e depois o destino: textos e votos se somam, a origem some.
 */
export function MuralPhase({
  ideas,
  onAddIdea,
  onDeleteIdea,
  onUpdateIdea,
  onVoteIdea,
  onStartMerge,
  onExecuteMerge,
  mergingSourceId,
  isPresentationMode,
  exportRequest,
  onExportDone,
}: MuralPhaseProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { readOnly = false } = useIdeaView();
  const [newIdea, setNewIdea] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [order, setOrder] = useState<IdeaOrder>('recent');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = useMemo(() => filterAndSortIdeas(ideas, searchQuery, order), [ideas, searchQuery, order]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newIdea.trim();
    if (!text || isSubmitting || readOnly) return;
    setIsSubmitting(true);
    try {
      const saved = await onAddIdea(text);
      // só limpa se salvou: em caso de erro o texto continua no campo para tentar de novo
      if (saved !== false) setNewIdea('');
    } finally {
      setIsSubmitting(false);
    }
  };

  useExportRequest(exportRequest, async () => {
    const ok = gridRef.current ? await downloadElementAsPng(gridRef.current, 'brainstorming-mural.png') : false;
    onExportDone?.(ok);
  });

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
      {!isPresentationMode && (
        <form onSubmit={handleSubmit} className="sticky top-0 z-10 -mx-1 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <IconTile icon={Lightbulb} size="sm" className="max-sm:hidden" />
          <input
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            aria-label="Escreva uma ideia"
            maxLength={IDEA_MAX_LENGTH}
            disabled={readOnly}
            placeholder={readOnly ? 'Brainstorming encerrado: só leitura' : 'O que você está pensando? Escreva e lance'}
            className={cn(FIELD, 'h-11 min-w-0 flex-1 border-transparent bg-transparent disabled:cursor-not-allowed')}
          />
          <ModalButton type="submit" variant="primary" className="h-11 shrink-0 gap-1.5 px-5" disabled={!newIdea.trim() || isSubmitting || readOnly}>
            Lançar ideia <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </ModalButton>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Pesquisar ideias"
            placeholder="Pesquisar ideias"
            className={cn(FIELD, 'h-11 pl-9')}
          />
        </div>
        <Segmented label="Ordem das ideias" options={IDEA_ORDERS} value={order} onChange={setOrder} />
        <span className="flex-1" />
        <StatusChip tone="neutral" className="h-8 gap-1.5 px-3 text-[13px]">
          <span aria-live="polite">
            {searchQuery ? 'Encontradas' : 'Ideias'} <strong className="font-semibold tabular-nums text-foreground">{filtered.length}</strong>
          </span>
        </StatusChip>
      </div>

      {mergingSourceId && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/50 bg-primary/10 p-3.5 dark:bg-primary/15">
          <IconTile icon={GitMerge} size="sm" />
          <div className="min-w-[14rem] flex-1">
            <p className="m-0 text-sm font-semibold text-foreground">Modo de fusão ativo</p>
            <p className="m-0 text-[13px] text-muted-foreground">Escolha a ideia de destino: os textos e os votos das duas se combinam. A ideia de origem some.</p>
          </div>
          <ModalButton className="gap-1.5" onClick={() => onStartMerge(null)}>
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Cancelar
          </ModalButton>
        </div>
      )}

      <div ref={gridRef} className="rounded-2xl bg-background">
        {filtered.length > 0 ? (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((idea) => (
              <li key={idea.id} className="min-w-0">
                <IdeaCard
                  idea={idea}
                  onDelete={onDeleteIdea}
                  onUpdate={onUpdateIdea}
                  onVote={onVoteIdea}
                  onStartMerge={onStartMerge}
                  onMerge={(targetId) => {
                    if (mergingSourceId) onExecuteMerge(mergingSourceId, targetId);
                  }}
                  isMergingSource={idea.id === mergingSourceId}
                  canMerge={mergingSourceId !== null && idea.id !== mergingSourceId}
                />
              </li>
            ))}
          </ul>
        ) : searchQuery ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Search className="h-8 w-8 opacity-50" strokeWidth={1.5} aria-hidden="true" />
            <p className="m-0 text-sm font-medium">Nenhuma ideia corresponde à busca</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <IconTile icon={Lightbulb} size="lg" />
            <h2 className="m-0 text-lg font-bold text-foreground">O mural está vazio</h2>
            <p className="m-0 max-w-sm text-sm text-muted-foreground">
              {isPresentationMode ? 'Ainda não há ideias lançadas.' : 'Escreva no campo acima e lance a primeira ideia. Não precisa ser boa: precisa ser sua.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
