'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Gauge, Trash2 } from 'lucide-react';
import { feedbackApi, type FeedbackData } from '@/app/feedback/api';
import { userApi } from '@/app/users/api';
import { toast } from '@/hooks/use-toast';
import { DataTable, DataToolbar, EmptyState, ErrorState, KpiCard, KpiRow, LoadingSkeleton, type DataColumn } from '@/components/page';
import { ConfirmDialog, FOCUS_RING, IconButton, ModalButton, SelectField, StatusChip, TONES, type Tone } from '@/components/room-kit';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChipGroup, ShowMoreFooter, useVisibleLimit } from './AdminOpsParts';
import {
  PAGE_STEP,
  buildCsv,
  buildNameIndex,
  computeNps,
  downloadCsv,
  filterFeedbacks,
  formatNps,
  matchesScoreTab,
  nextChunk,
  npsSubtitle,
  resolveName,
  type NameIndex,
  type ScoreTab,
} from './admin-ops-utils';

interface Feedback extends FeedbackData {
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; tone: Tone; dot: string }> = {
  OPEN: { label: 'Novo', tone: 'brand', dot: 'bg-primary' },
  REVIEWED: { label: 'Em análise', tone: 'warn', dot: 'bg-amber-500' },
  ADDRESSED: { label: 'Resolvido', tone: 'success', dot: 'bg-emerald-500' },
  ARCHIVED: { label: 'Arquivado', tone: 'neutral', dot: 'bg-muted-foreground' },
};

const getStatusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;

function scoreTone(score: number): Tone {
  if (score === -1) return 'brand';
  if (score >= 9) return 'success';
  if (score >= 7) return 'warn';
  return 'danger';
}

function CommentCell({ comment, who }: { comment?: string | null; who: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const long = (comment || '').length > 140;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {comment ? (
        <p className={cn('text-[13px] italic leading-snug text-foreground', !open && 'line-clamp-2')}>“{comment}”</p>
      ) : (
        <p className="text-[13px] text-muted-foreground">Sem comentário</p>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn('w-fit rounded text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
        >
          {open ? 'Mostrar menos' : 'Mostrar tudo'}
        </button>
      )}
      <span className="truncate text-xs text-muted-foreground">{who}</span>
    </div>
  );
}

export function FeedbackManager() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [names, setNames] = useState<NameIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toolFilter, setToolFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState<ScoreTab>('all');
  const [pendingDelete, setPendingDelete] = useState<Feedback | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await feedbackApi.listFeedbacks();
      setFeedbacks(data.map((f) => ({ ...f, status: f.status || 'OPEN' })));
    } catch (e) {
      console.error('FeedbackManager: erro ao carregar feedbacks:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Nome no lugar do ID: usa a lista de usuários do admin; sem ela, o ID continua aparecendo.
  useEffect(() => {
    let cancelled = false;
    userApi
      .getAllUsers()
      .then((users) => {
        if (!cancelled) setNames(buildNameIndex(users));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const tools = useMemo(() => Array.from(new Set(feedbacks.map((f) => f.toolName))).sort(), [feedbacks]);

  const filtered = useMemo(
    () => filterFeedbacks(feedbacks, { search: searchTerm, status: statusFilter, tool: toolFilter, tab: scoreFilter }, names),
    [feedbacks, searchTerm, statusFilter, toolFilter, scoreFilter, names],
  );
  const [visibleLimit, showMore] = useVisibleLimit(`${searchTerm}|${statusFilter}|${toolFilter}|${scoreFilter}`, PAGE_STEP);
  const shown = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);
  const nps = useMemo(() => computeNps(feedbacks.map((f) => f.score)), [feedbacks]);
  const hasFilters = searchTerm.trim() !== '' || statusFilter !== 'all' || toolFilter !== 'all' || scoreFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setToolFilter('all');
    setScoreFilter('all');
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await feedbackApi.updateStatus(id, status);
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
      toast({ title: 'Status atualizado', description: `Feedback marcado como ${getStatusConfig(status).label}.` });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao atualizar' });
    }
  };

  const handleDelete = async () => {
    const target = pendingDelete;
    if (!target?.id) return;
    setDeleting(true);
    try {
      await feedbackApi.deleteFeedback(target.id);
      setFeedbacks((prev) => prev.filter((f) => f.id !== target.id));
      toast({ title: 'Feedback excluído' });
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao excluir' });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nada para exportar', description: 'Nenhum feedback no filtro atual.' });
      return;
    }
    const headers = ['Data', 'Ferramenta', 'Nota', 'Status', 'Usuário', 'Comentário'];
    const rows = filtered.map((f) => [
      f.createdAt ? new Date(f.createdAt).toLocaleString('pt-BR') : 'N/A',
      f.toolName,
      f.score === -1 ? 'Sugestão' : f.score,
      f.status,
      f.userId || 'N/A',
      f.comment || '',
    ]);
    downloadCsv(`feedbacks_export_${new Date().toISOString().split('T')[0]}.csv`, buildCsv(headers, rows, [5]));
  };

  if (loading) return <LoadingSkeleton variant="table" rows={6} label="Carregando feedbacks" />;
  if (loadError) {
    return <ErrorState title="Não foi possível carregar os feedbacks" onRetry={load} />;
  }

  const tabs = [
    { id: 'all' as const, label: 'Todos', count: feedbacks.length },
    { id: 'promoters' as const, label: 'Promotores', count: feedbacks.filter((f) => matchesScoreTab(f.score, 'promoters')).length },
    { id: 'neutrals' as const, label: 'Neutros', count: feedbacks.filter((f) => matchesScoreTab(f.score, 'neutrals')).length },
    { id: 'detractors' as const, label: 'Detratores', count: feedbacks.filter((f) => matchesScoreTab(f.score, 'detractors')).length },
    { id: 'suggestions' as const, label: 'Sugestões', count: feedbacks.filter((f) => matchesScoreTab(f.score, 'suggestions')).length },
  ];

  const columns: DataColumn<Feedback>[] = [
    {
      id: 'date',
      header: 'Data',
      width: '104px',
      cell: (f) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-foreground">{f.createdAt ? new Date(f.createdAt).toLocaleDateString('pt-BR') : 'Agora'}</span>
          <span className="text-xs text-muted-foreground">
            {f.createdAt ? new Date(f.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'tool',
      header: 'Ferramenta',
      width: '150px',
      cell: (f) => <span className="truncate text-[13px] font-semibold text-foreground" title={f.toolName}>{f.toolName}</span>,
    },
    {
      id: 'score',
      header: 'Nota',
      width: '92px',
      cell: (f) => (
        <StatusChip tone={scoreTone(f.score)} className="h-7 min-w-[36px] justify-center px-2.5 text-[13px] tabular-nums">
          {f.score === -1 ? 'Sugestão' : f.score}
        </StatusChip>
      ),
    },
    {
      id: 'comment',
      header: 'Comentário',
      width: 'minmax(0,1fr)',
      cell: (f) => {
        const person = resolveName(names, f.userId);
        return (
          <CommentCell
            comment={f.comment}
            who={person ? <span title={f.userId || undefined}>{person}</span> : <span className="font-mono">{f.userId}</span>}
          />
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: '150px',
      cell: (f) => {
        const cfg = getStatusConfig(f.status);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Status do feedback: ${cfg.label}. Alterar`}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-lg border border-transparent px-2.5 text-[13px] font-semibold transition-colors hover:border-border hover:bg-accent max-sm:h-11',
                  TONES[cfg.tone].text,
                  FOCUS_RING,
                )}
              >
                <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                {cfg.label}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[180px] rounded-xl border-border bg-popover p-1 text-popover-foreground">
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Alterar status</DropdownMenuLabel>
              {Object.entries(STATUS_CONFIG).map(([key, c]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => handleUpdateStatus(f.id!, key)}
                  className={cn('cursor-pointer gap-2.5 rounded-lg text-[13px]', f.status === key ? 'font-bold' : 'font-medium')}
                >
                  <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', c.dot)} />
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
    {
      id: 'actions',
      header: 'Ações',
      width: '56px',
      align: 'end',
      cell: (f) => (
        <IconButton
          size="sm"
          label="Excluir o feedback"
          icon={Trash2}
          onClick={() => setPendingDelete(f)}
          className="hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300"
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <KpiRow columns={2}>
        <KpiCard label="NPS geral" value={formatNps(nps.nps)} hint={npsSubtitle(nps)} icon={Gauge} />
      </KpiRow>

      <DataToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: 'Buscar em comentários ou usuários...',
          ariaLabel: 'Buscar em comentários ou usuários',
        }}
        filters={
          <>
            <SelectField
              aria-label="Ferramenta"
              value={toolFilter}
              onChange={setToolFilter}
              options={[{ value: 'all', label: 'Todas as ferramentas' }, ...tools.map((t) => ({ value: t, label: t }))]}
              className="h-[38px] w-[200px]"
            />
            <SelectField
              aria-label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: 'all', label: 'Todos os status' }, ...Object.entries(STATUS_CONFIG).map(([value, c]) => ({ value, label: c.label }))]}
              className="h-[38px] w-[170px]"
            />
          </>
        }
        actions={
          <ModalButton variant="secondary" onClick={exportToCSV} title="O CSV leva só o que está filtrado: data, ferramenta, nota, status, usuário, comentário">
            <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Exportar CSV
          </ModalButton>
        }
      />

      <ChipGroup options={tabs} value={scoreFilter} onChange={setScoreFilter} ariaLabel="Faixa de nota" />

      {feedbacks.length === 0 ? (
        <EmptyState title="Nenhum feedback recebido ainda" description="O botão de feedback do rodapé alimenta esta lista." />
      ) : (
        <DataTable
          ariaLabel="Feedbacks recebidos"
          columns={columns}
          rows={shown}
          getRowId={(f) => f.id || `${f.toolName}-${f.createdAt}`}
          stackBelow="lg"
          empty={
            <EmptyState
              embedded
              title="Nenhum feedback encontrado com os filtros atuais"
              actions={hasFilters ? <ModalButton variant="secondary" onClick={clearFilters}>Limpar filtros</ModalButton> : undefined}
            />
          }
          footer={
            filtered.length > 0 ? (
              <ShowMoreFooter
                shown={shown.length}
                total={filtered.length}
                noun="feedbacks"
                chunk={nextChunk(filtered.length, shown.length)}
                onMore={showMore}
              />
            ) : undefined
          }
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        tone="danger"
        icon={Trash2}
        title="Excluir este feedback?"
        description="Esta ação é irreversível."
        cancelLabel="Manter"
        confirmLabel="Excluir feedback"
        loading={deleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={handleDelete}
      >
        {pendingDelete && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone={scoreTone(pendingDelete.score)}>{pendingDelete.score === -1 ? 'Sugestão' : pendingDelete.score}</StatusChip>
              <span className="text-[13px] font-semibold text-foreground">{pendingDelete.toolName}</span>
            </div>
            <p className="text-[13px] italic text-muted-foreground">{pendingDelete.comment ? `“${pendingDelete.comment}”` : 'Sem comentário'}</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
