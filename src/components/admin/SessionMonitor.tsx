'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, RefreshCw, Trash2, Users } from 'lucide-react';
import { adminApi } from '@/app/admin/api';
import { toast } from '@/hooks/use-toast';
import { DataToolbar, EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ConfirmDialog, IconButton, ModalButton, SelectField, StatusChip, FOCUS_RING } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import { AdminCheckbox, ChipGroup, ShowMoreFooter, useVisibleLimit } from './AdminOpsParts';
import {
  PAGE_STEP,
  SESSION_PERIOD_OPTIONS,
  SESSION_TOOLS,
  SESSION_TYPE_FILTERS,
  bulkDeleteSummary,
  canSelectWholeFilter,
  filterSessions,
  nextChunk,
  sessionOpenPath,
  sessionParticipants,
  sortSessions,
  type AdminSession,
  type SessionSort,
  type SessionSortKey,
} from './admin-ops-utils';

/** Colunas: marcador, ferramenta, título, criação, participantes, ações. */
const COLS = '28px 168px minmax(0,1.7fr) minmax(0,1fr) 128px 84px';

function formatCreated(createdAt?: string | null): string {
  if (!createdAt) return 'Histórico';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return 'Histórico';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ToolChip({ type }: { type: string }) {
  const tool = SESSION_TOOLS[type];
  const Icon = moduleIcon(tool?.module ?? 'poker');
  return (
    <StatusChip tone="neutral" className="h-6 gap-1.5 px-2.5">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      {tool?.label ?? 'Outro'}
    </StatusChip>
  );
}

export function SessionMonitor() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<SessionSort | null>({ key: 'participantCount', direction: 'desc' });

  const [pendingOne, setPendingOne] = useState<AdminSession | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSessions = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await adminApi.getSessions();
      setSessions(Array.isArray(data) ? data : []);
      setLoadError(false);
    } catch (error) {
      console.error('Erro ao buscar as sessões:', error);
      if (initial) setLoadError(true);
      else toast({ variant: 'destructive', title: 'Erro na listagem', description: 'Não foi possível buscar as sessões.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(true);
  }, [fetchSessions]);

  const filtered = useMemo(
    () => filterSessions(sessions, { search: searchTerm, type: selectedType, range: selectedDateRange }),
    [sessions, searchTerm, selectedType, selectedDateRange],
  );
  const sorted = useMemo(() => sortSessions(filtered, sort), [filtered, sort]);
  const [visibleLimit, showMore] = useVisibleLimit(`${searchTerm}|${selectedType}|${selectedDateRange}`, PAGE_STEP);
  const page = useMemo(() => sorted.slice(0, visibleLimit), [sorted, visibleLimit]);
  const pageIds = useMemo(() => page.map((s) => s.id), [page]);

  const selectedOnPage = pageIds.filter((id) => selectedIds.includes(id)).length;
  const headState: boolean | 'indeterminate' =
    pageIds.length > 0 && selectedOnPage === pageIds.length ? true : selectedOnPage > 0 ? 'indeterminate' : false;
  const offerWholeFilter = canSelectWholeFilter(pageIds, selectedIds, filtered.length);
  const hasFilters = searchTerm.trim() !== '' || selectedType !== 'all' || selectedDateRange !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedDateRange('all');
  };

  const toggleSelect = (id: string) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  // O marcador do cabeçalho mexe só na página que está na tela.
  const togglePage = () => {
    setSelectedIds((prev) => (headState === true ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds]))));
  };

  const handleSort = (key: SessionSortKey) => {
    setSort((cur) => ({ key, direction: cur && cur.key === key && cur.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const handleDeleteOne = async () => {
    const session = pendingOne;
    if (!session) return;
    setDeleting(true);
    try {
      await adminApi.deleteSession(session.id, session.type);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setSelectedIds((prev) => prev.filter((id) => id !== session.id));
      toast({ title: 'Sessão removida', description: 'A sala foi excluída.' });
      setPendingOne(null);
    } catch (error) {
      console.error('Erro ao deletar sessão:', error);
      toast({ variant: 'destructive', title: 'Erro na exclusão', description: 'Não foi possível remover a sessão.' });
      setPendingOne(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const items = sessions.filter((s) => selectedIds.includes(s.id));
    if (items.length === 0) {
      setBulkOpen(false);
      return;
    }
    setDeleting(true);
    const removedIds: string[] = [];
    let failed = 0;
    for (const item of items) {
      try {
        await adminApi.deleteSession(item.id, item.type);
        removedIds.push(item.id);
      } catch (err) {
        failed++;
        console.error(`Erro ao deletar sessão ${item.id}:`, err);
      }
    }
    setSessions((prev) => prev.filter((s) => !removedIds.includes(s.id)));
    // Quem falhou continua marcado, para tentar de novo.
    setSelectedIds((prev) => prev.filter((id) => !removedIds.includes(id)));
    const summary = bulkDeleteSummary(removedIds.length, failed);
    toast({ variant: summary.failedAny ? 'destructive' : 'default', title: summary.title, description: summary.description });
    setBulkOpen(false);
    setDeleting(false);
  };

  if (loading) return <LoadingSkeleton variant="table" rows={6} label="Varrendo as sessões das ferramentas" />;
  if (loadError) {
    return (
      <ErrorState
        title="Não foi possível carregar as sessões"
        description="Confira a conexão e tente de novo."
        onRetry={() => fetchSessions(true)}
      />
    );
  }

  const sortIcon = (key: SessionSortKey) => {
    if (!sort || sort.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" strokeWidth={1.5} aria-hidden="true" />;
    return sort.direction === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} aria-hidden="true" />
    );
  };
  const ariaSort = (key: SessionSortKey): 'ascending' | 'descending' | 'none' =>
    sort?.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';

  const sortHead = (k: SessionSortKey, children: React.ReactNode) => (
    <span role="columnheader" aria-sort={ariaSort(k)}>
      <button
        type="button"
        onClick={() => handleSort(k)}
        className={cn('inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground', FOCUS_RING)}
      >
        {children} {sortIcon(k)}
      </button>
    </span>
  );

  const bulkList = sessions.filter((s) => selectedIds.includes(s.id));
  const shownBulk = bulkList.slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <DataToolbar
        search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Buscar por título ou ID...', ariaLabel: 'Buscar sessões por título ou ID' }}
        filters={
          <>
            <ChipGroup options={SESSION_TYPE_FILTERS} value={selectedType as (typeof SESSION_TYPE_FILTERS)[number]['id']} onChange={setSelectedType} ariaLabel="Tipo de sessão" />
            <SelectField
              aria-label="Período"
              value={selectedDateRange}
              onChange={setSelectedDateRange}
              options={SESSION_PERIOD_OPTIONS}
              className="h-[38px] w-[178px]"
            />
          </>
        }
        actions={
          <IconButton
            label="Atualizar a lista"
            icon={RefreshCw}
            onClick={() => fetchSessions(false)}
            disabled={refreshing}
            className={cn(refreshing && '[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none')}
          />
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão ainda"
          description="As salas de Poker, Retro, Health Check, Brainstorm e Planning aparecem aqui."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma sessão encontrada com estes filtros"
          actions={hasFilters ? <ModalButton variant="secondary" onClick={clearFilters}>Limpar filtros</ModalButton> : undefined}
        />
      ) : (
        <section aria-label="Sessões" className={cn(PAGE_CARD, 'overflow-clip')}>
          {selectedOnPage > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-5 py-2.5 text-[13px] text-foreground">
              <span>
                {selectedOnPage} {selectedOnPage === 1 ? 'selecionada' : 'selecionadas'} nesta página
              </span>
              {offerWholeFilter && (
                <ModalButton variant="ghost" className="h-8 px-3 text-[13px]" onClick={() => setSelectedIds(filtered.map((s) => s.id))}>
                  Selecionar as {filtered.length} do filtro
                </ModalButton>
              )}
            </div>
          )}
          <div role="table" aria-label="Histórico de sessões" aria-rowcount={page.length + 1} style={{ '--cols': COLS } as React.CSSProperties}>
            <div role="row" className="hidden items-center gap-3 bg-muted px-5 py-2.5 lg:grid lg:[grid-template-columns:var(--cols)]">
              <span role="columnheader">
                <AdminCheckbox checked={headState} onChange={togglePage} label="Selecionar as sessões desta página" />
              </span>
              {sortHead('type', 'Ferramenta')}
              {sortHead('title', 'Título / nome')}
              {sortHead('createdAt', 'Criação')}
              {sortHead('participantCount', 'Participantes')}
              <span role="columnheader" className="text-right text-xs font-bold text-muted-foreground">Ações</span>
            </div>

            {page.map((s) => {
              const checked = selectedIds.includes(s.id);
              const path = sessionOpenPath(s.type, s.id);
              const part = sessionParticipants(s);
              const title = s.title || 'Sem título';
              return (
                <div
                  key={s.id}
                  role="row"
                  aria-selected={checked}
                  className={cn(
                    'grid grid-cols-[28px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-border px-4 py-3.5 transition-colors duration-fast first:border-t-0 hover:bg-muted/40',
                    'lg:items-center lg:gap-3 lg:px-5 lg:py-2.5 lg:[grid-template-columns:var(--cols)]',
                    checked && 'bg-primary/5 hover:bg-primary/10',
                  )}
                >
                  <div role="cell" className="pt-0.5 lg:pt-0">
                    <AdminCheckbox checked={checked} onChange={() => toggleSelect(s.id)} label={`Selecionar a sessão ${title}`} />
                  </div>
                  <div role="cell" className="min-w-0 max-lg:order-2 max-lg:col-start-2">
                    <ToolChip type={s.type} />
                  </div>
                  <div role="cell" className="flex min-w-0 flex-col max-lg:order-1 max-lg:col-start-2">
                    <span className="truncate text-sm font-semibold text-foreground" title={title}>{title}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">ID: {s.id}</span>
                  </div>
                  <div role="cell" className="flex min-w-0 flex-col max-lg:order-3 max-lg:col-start-2">
                    <span className="text-[13px] font-medium text-foreground">{formatCreated(s.createdAt)}</span>
                    <span className="truncate text-xs text-muted-foreground">por {s.creatorId ? `${s.creatorId.slice(0, 10)}...` : 'origem desconhecida'}</span>
                  </div>
                  <div role="cell" className="flex items-center gap-1.5 text-foreground max-lg:order-4 max-lg:col-start-2">
                    <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className={cn('text-sm font-semibold tabular-nums', part.value === '—' && 'text-muted-foreground')}>{part.value}</span>
                    {part.note && <span className="text-xs text-muted-foreground">{part.note}</span>}
                    <span className="sr-only">participantes</span>
                  </div>
                  <div role="cell" className="flex items-center justify-end gap-1.5 max-lg:order-5 max-lg:col-start-2 max-lg:justify-start">
                    {path ? (
                      <Link
                        href={path}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir a sessão ${title} em nova aba`}
                        title="Abrir em nova aba"
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent',
                          FOCUS_RING,
                        )}
                      >
                        <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                      </Link>
                    ) : (
                      <IconButton size="sm" label="Planning ainda não tem tela de sala" icon={ExternalLink} disabled aria-disabled="true" />
                    )}
                    <IconButton
                      size="sm"
                      label={`Excluir a sessão ${title}`}
                      icon={Trash2}
                      onClick={() => setPendingOne(s)}
                      className="hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <ShowMoreFooter
            shown={page.length}
            total={filtered.length}
            noun="sessões"
            note={`total carregado: ${sessions.length}. O servidor devolve só as 100 sessões mais recentes`}
            chunk={nextChunk(filtered.length, page.length)}
            onMore={showMore}
          />
        </section>
      )}

      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Seleção ativa"
          className="fixed bottom-6 left-1/2 z-40 flex w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3.5 text-card-foreground shadow-[0_20px_50px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
        >
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-muted-foreground">Seleção ativa</span>
            <span className="text-sm font-semibold">
              {selectedIds.length} {selectedIds.length === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ModalButton variant="secondary" onClick={() => setSelectedIds([])}>Cancelar</ModalButton>
            <ModalButton variant="danger" onClick={() => setBulkOpen(true)}>
              <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Excluir selecionadas
            </ModalButton>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingOne}
        onOpenChange={(open) => { if (!open) setPendingOne(null); }}
        tone="danger"
        icon={Trash2}
        title={`Excluir a sessão “${pendingOne?.title || 'Sem título'}”?`}
        description="Esta ação é irreversível."
        cancelLabel="Manter"
        confirmLabel="Excluir sessão"
        loading={deleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={handleDeleteOne}
      >
        {pendingOne && (
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <ToolChip type={pendingOne.type} />
              <span className="font-mono text-xs text-muted-foreground">ID: {pendingOne.id}</span>
            </div>
            <span className="text-[13px] text-muted-foreground">
              {sessionParticipants(pendingOne).value === '—' ? 'Participantes não registrados' : `${sessionParticipants(pendingOne).value} participantes`} · criada em {formatCreated(pendingOne.createdAt)}
            </span>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        tone="danger"
        icon={Trash2}
        title={`Excluir ${bulkList.length} ${bulkList.length === 1 ? 'sessão' : 'sessões'}?`}
        description="Esta ação é irreversível. Se alguma falhar, o aviso diz quantas ficaram."
        cancelLabel="Manter"
        confirmLabel={`Excluir ${bulkList.length} ${bulkList.length === 1 ? 'sessão' : 'sessões'}`}
        loading={deleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={handleBulkDelete}
      >
        <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
          {shownBulk.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[13px] text-foreground">
              <ToolChip type={s.type} />
              <span className="min-w-0 truncate">{s.title || 'Sem título'}</span>
            </li>
          ))}
          {bulkList.length > shownBulk.length && (
            <li className="text-xs text-muted-foreground">e mais {bulkList.length - shownBulk.length}</li>
          )}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
