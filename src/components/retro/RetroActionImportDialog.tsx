'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, ListTodo, RefreshCw } from 'lucide-react';
import { retroApi } from '@/app/retro/api';
import { Modal, ModalButton } from '@/components/room-kit';
import { pendingActionsOf } from '@/lib/retro-lobby';
import { formatDueDate } from './retro-room-logic';
import type { RetroBoard, RetroCard } from '@/lib/types';

interface PendingGroup {
  board: RetroBoard;
  pendingCards: RetroCard[];
}

/** Ações escolhidas de um quadro anterior, prontas para virar ações deste. */
export interface RetroImportEntry {
  board: RetroBoard;
  cards: RetroCard[];
}

interface RetroActionImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team: string;
  /** Squad.id real: `team` é só o nome de exibição e pode colidir entre squads. */
  squadId?: string;
  currentBoardId: string;
  onImport: (entries: RetroImportEntry[]) => void;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

/** Traz para esta retro as ações ainda abertas das retros anteriores da squad. O facilitador marca quais. */
export function RetroActionImportDialog({ isOpen, onClose, team, squadId, currentBoardId, onImport }: RetroActionImportDialogProps) {
  const [groups, setGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading] = useState(false);
  // Falha de rede não é "nenhuma ação pendente": a tela diz que não conseguiu e deixa tentar de novo.
  const [failedBoards, setFailedBoards] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setFailedBoards(0);
    try {
      const allBoards = squadId ? await retroApi.listBoards({ squadId }) : await retroApi.listBoards({ team });
      const candidates = allBoards.filter((b) => b.id !== currentBoardId);

      const settled = await Promise.allSettled(candidates.map(async (board) => {
        const cardsList = await retroApi.getCards(board.id);
        return { board, pendingCards: pendingActionsOf(board, cardsList) };
      }));

      const results = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      setFailedBoards(settled.length - results.length);

      const sorted = results
        .filter((g) => g.pendingCards.length > 0)
        .sort((a, b) => (b.board.createdAt || '').localeCompare(a.board.createdAt || ''));
      setGroups(sorted);
      setSelected(new Set(sorted.flatMap((g) => g.pendingCards.map((c) => c.id))));
    } catch (error) {
      console.error('Erro ao buscar ações pendentes:', error);
      setGroups([]);
      setSelected(new Set());
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [squadId, team, currentBoardId]);

  useEffect(() => {
    if (isOpen && (squadId || team)) void fetchPending();
  }, [isOpen, team, squadId, fetchPending]);

  const total = useMemo(() => groups.reduce((n, g) => n + g.pendingCards.length, 0), [groups]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = () => {
    const entries = groups
      .map((g) => ({ board: g.board, cards: g.pendingCards.filter((c) => selected.has(c.id)) }))
      .filter((e) => e.cards.length > 0);
    if (entries.length === 0) return;
    onImport(entries);
    onClose();
  };

  const count = selected.size;

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="md"
      className="sm:max-w-[580px]"
      icon={ListTodo}
      title="Ações pendentes"
      description={<>Retros anteriores de <strong className="text-foreground">{team || 'este time'}</strong> com ações em aberto.</>}
      footer={
        <>
          <ModalButton onClick={onClose}>Cancelar</ModalButton>
          <ModalButton variant="primary" onClick={confirm} disabled={count === 0}>
            {count === 0 ? 'Importar' : `Importar ${count} ${count === 1 ? 'ação' : 'ações'}`}
          </ModalButton>
        </>
      }
    >
      <div className="flex min-h-[220px] flex-col gap-3 pt-2">
        {loading ? (
          <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 py-10">
            <RefreshCw className="h-6 w-6 motion-safe:animate-spin text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="m-0 text-sm text-muted-foreground">Buscando retros anteriores…</p>
          </div>
        ) : loadFailed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <History className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="m-0 text-sm font-semibold">Não foi possível buscar as retros anteriores</p>
            <ModalButton onClick={() => void fetchPending()}>Tentar de novo</ModalButton>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <History className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="m-0 text-sm font-semibold">Nenhuma ação pendente</p>
            <p className="m-0 max-w-xs text-sm text-muted-foreground">
              {failedBoards > 0
                ? `Não consegui ler ${failedBoards} retro${failedBoards > 1 ? 's' : ''} anterior${failedBoards > 1 ? 'es' : ''}. As demais não têm ações em aberto.`
                : 'As retros anteriores deste time não têm ações em aberto.'}
            </p>
            {failedBoards > 0 && <ModalButton onClick={() => void fetchPending()}>Tentar de novo</ModalButton>}
          </div>
        ) : (
          <>
            {failedBoards > 0 && (
              <p className="m-0 text-xs text-amber-700 dark:text-amber-300">
                Não consegui ler {failedBoards} retro{failedBoards > 1 ? 's' : ''} anterior{failedBoards > 1 ? 'es' : ''}; a lista pode estar incompleta.
              </p>
            )}
            {groups.map(({ board, pendingCards }) => (
              <fieldset key={board.id} className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-1 p-0 text-[13px] font-semibold text-foreground">
                  {board.title || 'Retrospectiva sem título'}
                  <span className="ml-2 font-normal text-muted-foreground">{formatDate(board.createdAt)}</span>
                </legend>
                {pendingCards.map((card) => (
                  <label
                    key={card.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-accent/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(card.id)}
                      onChange={() => toggle(card.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm leading-snug">{card.content}</span>
                      <span className="text-xs text-muted-foreground">
                        {[card.assignee, card.dueDate ? `prazo ${formatDueDate(card.dueDate)}` : '', (card.carryCount || 0) > 0 ? `já reimportada ${card.carryCount}x` : '']
                          .filter(Boolean)
                          .join(' · ') || 'Sem responsável'}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
            <p className="m-0 text-xs text-muted-foreground">{total} {total === 1 ? 'ação em aberto' : 'ações em aberto'} nas retros anteriores.</p>
          </>
        )}
      </div>
    </Modal>
  );
}
