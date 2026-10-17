'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, BookOpen, ChevronRight, ListChecks, Plus, RefreshCw, Save } from 'lucide-react';
import { PageHeader, PageShell } from '@/components/page';
import { CreateRetroDialog } from '@/components/retro/CreateRetroDialog';
import { RetroGuide } from '@/components/retro/RetroGuide';
import { dueStatus, formatDueShort } from '@/components/retro/retro-room-logic';
import { FOCUS_RING, IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import { useUserContext } from '@/context/UserContext';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { useToolHistory } from '@/hooks/useToolHistory';
import { moduleIcon } from '@/lib/modules-registry';
import { retroFormatName } from '@/lib/retro-formats';
import {
  RETRO_LOBBY_FILTERS,
  filterLobbyRows,
  isRetroInProgress,
  mergeLobbyRows,
  pendingActionsOf,
  retroLobbyPhaseLabel,
  summarizeRetroBoard,
  type RetroBoardSummary,
  type RetroLobbyFilter,
  type RetroLobbyRow,
} from '@/lib/retro-lobby';
import { listTemplates, type RetroTemplate } from '@/lib/retro-templates';
import type { RetroBoard, RetroCard } from '@/lib/types';
import { cn } from '@/lib/utils';
import { retroApi } from './api';

/** Quantas retros recentes têm os cartões lidos para mostrar contagens e ações em aberto (uma leitura por retro). */
const DETAIL_LIMIT = 8;
const OPEN_ACTIONS_LIMIT = 6;

interface OpenAction {
  card: RetroCard;
  board: RetroBoard;
}

const CARD =
  'rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]';

function shortDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : format(d, "dd 'de' MMM", { locale: ptBR });
}

export default function RetroHubPage() {
  const router = useRouter();
  const { userProfile, requestIdentity } = useUserContext();
  const { squadId: activeSquadId, squadName } = useActiveSquad();
  const { history: localHistory } = useToolHistory('retro');

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [presetFormatId, setPresetFormatId] = useState<string | undefined>();
  const [guideOpen, setGuideOpen] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [filter, setFilter] = useState<RetroLobbyFilter>('all');

  const [boards, setBoards] = useState<RetroBoard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [boardsFailed, setBoardsFailed] = useState(false);
  const [details, setDetails] = useState<Record<string, { summary: RetroBoardSummary; open: RetroCard[] }>>({});
  const [savedFormats, setSavedFormats] = useState<RetroTemplate[]>([]);

  useEffect(() => { setSavedFormats(listTemplates()); }, [isSetupOpen]);

  const loadBoards = useCallback(async () => {
    if (!activeSquadId) {
      // Sem squad não há o que listar: sem isto o esqueleto ficava para sempre.
      setBoards([]);
      setLoadingBoards(false);
      return;
    }
    setLoadingBoards(true);
    try {
      const list = await retroApi.listBoards({ squadId: activeSquadId });
      setBoards(list);
      setBoardsFailed(false);
    } catch (err) {
      console.error('Erro ao listar retros', err);
      setBoardsFailed(true);
    } finally {
      setLoadingBoards(false);
    }
  }, [activeSquadId]);

  useEffect(() => { void loadBoards(); }, [loadBoards]);

  const rows = useMemo(
    () => mergeLobbyRows(boards, localHistory.map((h) => ({ roomId: h.roomId, title: h.title, team: h.team, createdAt: h.createdAt }))),
    [boards, localHistory]
  );

  // Contagens e ações em aberto: lê os cartões das retros mais recentes (falha de uma não derruba as outras).
  useEffect(() => {
    const recent = rows.filter((r) => r.board).slice(0, DETAIL_LIMIT);
    if (recent.length === 0) return;
    let cancelled = false;
    Promise.allSettled(recent.map(async (r) => ({ id: r.id, board: r.board!, cards: await retroApi.getCards(r.id) }))).then((settled) => {
      if (cancelled) return;
      const next: Record<string, { summary: RetroBoardSummary; open: RetroCard[] }> = {};
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue;
        const { id, board, cards } = s.value;
        next[id] = { summary: summarizeRetroBoard(board, cards), open: pendingActionsOf(board, cards) };
      }
      setDetails(next);
    });
    return () => { cancelled = true; };
  }, [rows]);

  const openActionsByBoard = useMemo(() => new Map(Object.entries(details).map(([id, d]) => [id, d.open.length])), [details]);
  const openActions = useMemo<OpenAction[]>(
    () =>
      rows
        .flatMap((r) => (r.board && details[r.id] ? details[r.id].open.map((card) => ({ card, board: r.board! })) : []))
        .slice(0, OPEN_ACTIONS_LIMIT),
    [rows, details]
  );

  const now = Date.now();
  const inProgress = rows.filter((r) => r.board && isRetroInProgress(r.board, now));
  const past = rows.filter((r) => !inProgress.includes(r));
  const visibleRows = filterLobbyRows(past, filter, openActionsByBoard);

  const openNew = (formatId?: string) => {
    setPresetFormatId(formatId);
    if (!userProfile) requestIdentity(() => setIsSetupOpen(true));
    else setIsSetupOpen(true);
  };

  // ?nova=1 (atalho da Home): abre o diálogo de criar assim que o perfil carrega e tira o parâmetro da URL.
  const [novaHandled, setNovaHandled] = useState(false);
  useEffect(() => {
    if (novaHandled || !userProfile) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('nova') !== '1') return;
    setNovaHandled(true);
    setIsSetupOpen(true);
    params.delete('nova');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  }, [userProfile, novaHandled]);

  const joinRoom = () => {
    const id = joinId.trim();
    if (id) router.push(`/retro/${id.toUpperCase()}`);
  };
  const openBoard = (id: string) => router.push(`/retro/${id}`);

  const count = past.length;
  const subtitle = squadName ? `${squadName} · ${count === 0 ? 'nenhuma retro encerrada' : `${count} ${count === 1 ? 'retro anterior' : 'retros anteriores'}`}` : 'O que foi bem, o que melhorar e as ações';

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
              onSubmit={(e) => { e.preventDefault(); joinRoom(); }}
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
              onClick={() => openNew()}
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
            <span className="text-base font-bold">{r.title}</span>
            <span className="text-[13px] text-muted-foreground">
              {[retroFormatName(r.templateKey), r.board ? `Fase: ${retroLobbyPhaseLabel(r.board)}` : '', r.team].filter(Boolean).join(' · ')}
            </span>
          </span>
          <ModalButton variant="primary" className="gap-2" onClick={() => openBoard(r.id)}>Entrar na sala</ModalButton>
        </section>
      ))}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Retros anteriores" className={cn(CARD, 'flex flex-col gap-3')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-base font-bold">Retros anteriores</h2>
            <div role="group" aria-label="Filtrar retros" className="flex flex-wrap gap-1.5">
              {RETRO_LOBBY_FILTERS.map((f) => {
                const active = filter === f.id;
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
            {loadingBoards && rows.length === 0 ? (
              <li aria-hidden="true" className="flex flex-col gap-2 py-1 motion-safe:animate-pulse">
                <span className="h-14 rounded-xl bg-muted" />
                <span className="h-14 rounded-xl bg-muted" />
                <span className="h-14 rounded-xl bg-muted" />
              </li>
            ) : boardsFailed && rows.length === 0 ? (
              <li aria-live="polite" className="flex flex-col items-center gap-3 py-10 text-center">
                <IconTile icon={moduleIcon('retro')} tone="neutral" />
                <p className="m-0 text-sm text-muted-foreground">Não foi possível carregar as retros.</p>
                <ModalButton className="h-8 gap-1.5 px-3 text-[13px]" onClick={() => void loadBoards()} disabled={loadingBoards}>
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingBoards && 'motion-safe:animate-spin')} strokeWidth={1.5} aria-hidden="true" /> Tentar de novo
                </ModalButton>
              </li>
            ) : visibleRows.length === 0 ? (
              <li className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border px-5 py-9 text-center">
                <span className="text-[15px] font-bold">{past.length === 0 ? 'Nenhuma retro ainda' : 'Nenhuma retro neste filtro'}</span>
                {past.length === 0 && (
                  <>
                    <span className="text-[13px] text-muted-foreground">A primeira retro da squad aparece aqui.</span>
                    <ModalButton variant="primary" onClick={() => openNew()}>Nova retro</ModalButton>
                  </>
                )}
              </li>
            ) : (
              visibleRows.map((r) => <PastRow key={r.id} row={r} detail={details[r.id]?.summary} onOpen={openBoard} />)
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
                        onClick={() => openBoard(board.id)}
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
                    <ModalButton className="h-8 px-3 text-[13px]" onClick={() => openNew(t.id)}>Usar</ModalButton>
                  </li>
                ))}
              </ul>
              <p className="m-0 border-t border-border pt-2 text-center text-xs text-muted-foreground">Salvo só neste navegador</p>
            </section>
          )}
        </div>
      </div>

      <RetroGuide open={guideOpen} onOpenChange={setGuideOpen} />
      <CreateRetroDialog open={isSetupOpen} onOpenChange={setIsSetupOpen} onCreatingChange={setIsCreating} presetFormatId={presetFormatId} />
    </PageShell>
  );
}

function PastRow({ row, detail, onOpen }: { row: RetroLobbyRow; detail?: RetroBoardSummary; onOpen: (id: string) => void }) {
  const meta = [
    retroFormatName(row.templateKey),
    shortDate(row.createdAt),
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
          <span className="truncate text-xs text-muted-foreground">{meta.join(' · ') || row.team}</span>
        </span>
        {row.board && <StatusChip tone="neutral">{retroLobbyPhaseLabel(row.board)}</StatusChip>}
        <span className="hidden text-[13px] font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground sm:inline">Abrir</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
      </button>
    </li>
  );
}
