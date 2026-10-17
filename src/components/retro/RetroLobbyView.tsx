'use client';

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, BookOpen, ChevronRight, ListChecks, Plus, RefreshCw, Save } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { FOCUS_RING, IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { retroFormatName } from '@/lib/retro-formats';
import {
  filterLobbyRows,
  isRetroInProgress,
  lobbyFiltersFor,
  retroLobbyPhaseLabel,
  type RetroBoardSummary,
  type RetroLobbyFilter,
  type RetroLobbyRow,
} from '@/lib/retro-lobby';
import type { RetroTemplate } from '@/lib/retro-templates';
import { isRetroFinished, retroFinishedAt, supportsRetroLifecycle } from '@/lib/retro-lifecycle';
import type { RetroCard } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RetroFormatChip } from './RetroFormatChip';
import { RetroGuide } from './RetroGuide';
import { dueStatus, formatDueShort } from './retro-room-logic';

/** Leitura dos cartões de uma retro anterior: contagens e ações ainda abertas. */
export interface RetroLobbyDetail {
  summary: RetroBoardSummary;
  open: RetroCard[];
}

export interface RetroLobbyViewProps {
  /** Nome da squad ativa (vazio quando a pessoa não tem squad). */
  squadName: string;
  /** Retros da squad e as abertas neste navegador, já sem repetição e da mais nova para a mais antiga. */
  rows: RetroLobbyRow[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  details: Record<string, RetroLobbyDetail>;
  savedFormats: RetroTemplate[];
  isCreating: boolean;
  /** Abre "Nova retro" (com um formato salvo já aplicado, quando vier o id). */
  onNew: (savedFormatId?: string) => void;
  onJoin: (code: string) => void;
  onOpenBoard: (id: string) => void;
  /** Quantas ações em aberto mostrar na lateral. */
  openActionsLimit?: number;
  now?: number;
  /** Janelas (nova retro) montadas pela página, dentro do mesmo esqueleto. */
  children?: React.ReactNode;
}

const CARD =
  'rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]';

function shortDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, "dd 'de' MMM", { locale: ptBR });
}

/**
 * Lobby da Retro (PageShell + cabeçalho da página): o que está em andamento, as retros anteriores com filtro,
 * as ações em aberto de retros passadas e os formatos salvos. Entrar por código e abrir o guia ficam no
 * cabeçalho. A página só busca os dados e liga os callbacks.
 */
export function RetroLobbyView({
  squadName,
  rows,
  loading,
  failed,
  onRetry,
  details,
  savedFormats,
  isCreating,
  onNew,
  onJoin,
  onOpenBoard,
  openActionsLimit = 6,
  now,
  children,
}: RetroLobbyViewProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [filter, setFilter] = useState<RetroLobbyFilter>('all');
  const [mountedAt] = useState(() => Date.now());

  const inProgress = rows.filter((r) => r.board && isRetroInProgress(r.board, now ?? mountedAt));
  const past = rows.filter((r) => !inProgress.includes(r));
  const openActionsByBoard = useMemo(() => new Map(Object.entries(details).map(([id, d]) => [id, d.open.length])), [details]);
  const filters = lobbyFiltersFor(rows);
  // Filtro escolhido que deixou de existir (a lista mudou): volta para "Todas".
  const activeFilter = filters.some((f) => f.id === filter) ? filter : 'all';
  const visibleRows = filterLobbyRows(past, activeFilter, openActionsByBoard);
  const openActions = useMemo(
    () =>
      rows
        .flatMap((r) => (r.board && details[r.id] ? details[r.id].open.map((card) => ({ card, board: r.board! })) : []))
        .slice(0, openActionsLimit),
    [rows, details, openActionsLimit]
  );

  const count = past.length;
  const subtitle = squadName
    ? `${squadName} · ${count === 0 ? 'nenhuma retro encerrada' : `${count} ${count === 1 ? 'retro anterior' : 'retros anteriores'}`}`
    : 'O que foi bem, o que melhorar e as ações';

  return (
    <PageShell documentTitle="Retrospectiva">
      <PageHeader
        title="Retrospectivas"
        module="retro"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Retrospectiva' }]}
        subtitle={subtitle}
        actions={
          <>
            <form
              onSubmit={(e) => { e.preventDefault(); if (joinId.trim()) onJoin(joinId.trim().toUpperCase()); }}
              className="flex h-11 items-center rounded-xl border border-border bg-card pl-3.5 pr-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30"
            >
              <label htmlFor="join-retro-id" className="sr-only">Entrar com o código da retro</label>
              <input
                id="join-retro-id"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                placeholder="Entrar com o código"
                autoComplete="off"
                className="w-44 bg-transparent text-sm uppercase tracking-wider text-foreground outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!joinId.trim()}
                aria-label="Entrar na retro"
                className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40 [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
              >
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </form>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className={cn('inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent/50', FOCUS_RING)}
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.5} />
              Guia
            </button>
            <button
              type="button"
              onClick={() => onNew()}
              disabled={isCreating}
              className={cn('inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] disabled:opacity-60 [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Nova retro
            </button>
          </>
        }
      />

      {inProgress.map((r) => (
        <section key={r.id} aria-label="Em andamento" className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-primary/40 bg-primary/10 px-5 py-4 dark:bg-primary/15">
          <span aria-hidden="true" className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
            <span className="absolute inset-0 rounded-full bg-emerald-500" />
          </span>
          <span className="flex min-w-[14rem] flex-1 flex-col">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold">{r.title}</span>
              {supportsRetroLifecycle(r.board) && <StatusChip tone="success" dot>Ao vivo</StatusChip>}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
              <RetroFormatChip templateKey={r.templateKey} />
              <span>{[r.board ? `Fase: ${retroLobbyPhaseLabel(r.board)}` : '', r.team].filter(Boolean).join(' · ')}</span>
            </span>
          </span>
          <ModalButton variant="primary" className="gap-2" onClick={() => onOpenBoard(r.id)}>Entrar na sala</ModalButton>
        </section>
      ))}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Retros anteriores" className={cn(CARD, 'flex flex-col gap-3')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-base font-bold">Retros anteriores</h2>
            <div role="group" aria-label="Filtrar retros" className="flex flex-wrap gap-1.5">
              {filters.map((f) => {
                const active = activeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      'inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors',
                      active ? 'border-primary/50 bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent/40',
                      FOCUS_RING
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {loading && rows.length === 0 ? (
              <li aria-hidden="true" className="flex flex-col gap-2 py-1 motion-safe:animate-pulse">
                <span className="h-14 rounded-xl bg-muted" />
                <span className="h-14 rounded-xl bg-muted" />
                <span className="h-14 rounded-xl bg-muted" />
              </li>
            ) : failed && rows.length === 0 ? (
              <li aria-live="polite" className="flex flex-col items-center gap-3 py-10 text-center">
                <IconTile icon={moduleIcon('retro')} tone="neutral" />
                <p className="m-0 text-sm text-muted-foreground">Não foi possível carregar as retros.</p>
                <ModalButton className="h-8 gap-1.5 px-3 text-[13px]" onClick={onRetry} disabled={loading}>
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'motion-safe:animate-spin')} strokeWidth={1.5} aria-hidden="true" /> Tentar de novo
                </ModalButton>
              </li>
            ) : visibleRows.length === 0 ? (
              <li className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border px-5 py-9 text-center">
                <span className="text-[15px] font-bold">{past.length === 0 ? 'Nenhuma retro ainda' : 'Nenhuma retro neste filtro'}</span>
                {past.length === 0 && (
                  <>
                    <span className="text-[13px] text-muted-foreground">A primeira retro da squad aparece aqui.</span>
                    <ModalButton variant="primary" onClick={() => onNew()}>Nova retro</ModalButton>
                  </>
                )}
              </li>
            ) : (
              visibleRows.map((r) => <PastRow key={r.id} row={r} detail={details[r.id]?.summary} onOpen={onOpenBoard} />)
            )}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          <section aria-label="Ações em aberto" className={cn(CARD, 'flex flex-col gap-2.5')}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="m-0 text-base font-bold">Ações em aberto</h2>
              <span className="text-xs text-muted-foreground">de retros anteriores</span>
            </div>
            {openActions.length === 0 ? (
              <p className="m-0 py-4 text-center text-sm text-muted-foreground">Nenhuma ação em aberto.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {openActions.map(({ card, board }) => {
                  const state = dueStatus(card.dueDate, card.isDone);
                  return (
                    <li key={card.id}>
                      <button
                        type="button"
                        onClick={() => onOpenBoard(board.id)}
                        className={cn('flex w-full items-start gap-2.5 rounded-[10px] border border-border p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40', FOCUS_RING)}
                      >
                        <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-sm leading-snug">{card.content}</span>
                          <span className="text-xs text-muted-foreground">{[card.assignee, board.title].filter(Boolean).join(' · ')}</span>
                        </span>
                        {card.dueDate && state !== 'none' && (
                          <span className={cn('shrink-0 text-xs tabular-nums', state === 'overdue' ? 'font-semibold text-red-700 dark:text-red-300' : 'text-muted-foreground')}>
                            {state === 'overdue' ? 'atrasada' : formatDueShort(card.dueDate)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {savedFormats.length > 0 && (
            <section aria-label="Formatos salvos" className={cn(CARD, 'flex flex-col gap-2.5')}>
              <h2 className="m-0 flex items-center gap-2 text-base font-bold"><Save className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" /> Seus formatos salvos</h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {savedFormats.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{t.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{retroFormatName(t.template) ?? 'Formato'}</span>
                    </span>
                    <ModalButton className="h-8 px-3 text-[13px]" onClick={() => onNew(t.id)}>Usar</ModalButton>
                  </li>
                ))}
              </ul>
              <p className="m-0 border-t border-border pt-2 text-center text-xs text-muted-foreground">Salvo só neste navegador</p>
            </section>
          )}
        </div>
      </div>

      <RetroGuide open={guideOpen} onOpenChange={setGuideOpen} />
      {children}
    </PageShell>
  );
}

function PastRow({ row, detail, onOpen }: { row: RetroLobbyRow; detail?: RetroBoardSummary; onOpen: (id: string) => void }) {
  const finished = isRetroFinished(row.board);
  const closedAt = retroFinishedAt(row.board);
  const meta = [
    finished && closedAt ? `encerrada em ${shortDate(closedAt.toISOString())}` : shortDate(row.createdAt),
    detail ? `${detail.cards} ${detail.cards === 1 ? 'cartão' : 'cartões'}` : '',
    detail && detail.actions > 0 ? `${detail.actions} ${detail.actions === 1 ? 'ação' : 'ações'} · ${detail.actionsDone} ${detail.actionsDone === 1 ? 'feita' : 'feitas'}` : '',
  ].filter(Boolean);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(row.id)}
        className={cn('group flex w-full items-center gap-3.5 rounded-xl border-b border-border px-2.5 py-3 text-left transition-colors hover:bg-accent/40', FOCUS_RING)}
      >
        <IconTile icon={moduleIcon('retro')} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">{row.title}</span>
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <RetroFormatChip templateKey={row.templateKey} />
            <span className="truncate">{meta.join(' · ') || row.team}</span>
          </span>
        </span>
        {row.board && (finished
          ? <StatusChip tone="success">Encerrada</StatusChip>
          : <StatusChip tone="neutral" className="max-sm:hidden">{retroLobbyPhaseLabel(row.board)}</StatusChip>)}
        <span className="hidden text-[13px] font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground sm:inline">Abrir</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </li>
  );
}
