'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supportApi, type SupportTicket } from '@/app/support/api';
import { DataTable, DataToolbar, EmptyState, ErrorState, LoadingSkeleton, type DataColumn } from '@/components/page';
import { IconButton, ModalButton, StatusChip } from '@/components/room-kit';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { Segmented } from '../Segmented';
import { TicketDrawer } from './TicketDrawer';
import { emptyTicketsCopy, filterTickets, splitSubject, statusCounts, statusMeta, type TicketFilter } from './ticket-utils';

type Phase = 'loading' | 'ready' | 'error';

const DOT: Record<string, string> = {
  danger: 'bg-red-500',
  warn: 'bg-amber-500',
  success: 'bg-emerald-500',
  neutral: 'bg-muted-foreground',
};

/** Aba Chamados: pedidos enviados pela Central de Suporte (listar, responder, mudar status e excluir). */
export function TicketsManager({ onOpenCount }: { onOpenCount?: (n: number) => void }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TicketFilter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setPhase('loading');
      try {
        const data = await supportApi.listAll();
        setTickets(data);
        setPhase('ready');
      } catch {
        if (silent) toast.error('Erro ao carregar chamados', { description: 'A lista continua como estava. Tente de novo.' });
        else setPhase('error');
      } finally {
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial da aba
    void load();
  }, [load]);

  const counts = useMemo(() => statusCounts(tickets), [tickets]);

  // Avisa a barra lateral quantos estão abertos (a cada carga, resposta, mudança de status ou exclusão).
  const openCount = counts.OPEN;
  useEffect(() => {
    if (phase === 'ready') onOpenCount?.(openCount);
  }, [phase, openCount, onOpenCount]);
  const rows = useMemo(() => filterTickets(tickets, { status: filter, query }), [tickets, filter, query]);
  const selected = tickets.find((t) => t.id === openId) ?? null;

  const open = (t: SupportTicket) => {
    setOpenId(t.id);
    setDrawerOpen(true);
  };

  const replaceTicket = (updated: SupportTicket) => {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
  };

  const removeTicket = (id: string) => {
    setDrawerOpen(false);
    setTickets((prev) => prev.filter((t) => t.id !== id));
  };

  const clearFilters = () => {
    setFilter('all');
    setQuery('');
  };

  const columns: DataColumn<SupportTicket>[] = [
    {
      id: 'status',
      header: 'Status',
      width: '136px',
      cell: (t) => {
        const m = statusMeta(t.status);
        return (
          <StatusChip tone={m.tone} className="h-6 px-2.5">
            <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT[m.tone])} />
            {m.label}
          </StatusChip>
        );
      },
    },
    {
      id: 'subject',
      header: 'Assunto',
      width: 'minmax(0,1.8fr)',
      primary: true,
      cell: (t) => (
        <button
          type="button"
          onClick={() => open(t)}
          className={cn('flex min-w-0 flex-col items-start gap-0.5 rounded-md text-left', FOCUS_RING)}
        >
          <span className="max-w-full truncate text-sm font-bold text-foreground">{splitSubject(t.subject).title}</span>
          <span className="max-w-full truncate text-[13px] text-muted-foreground">{t.message}</span>
        </button>
      ),
    },
    {
      id: 'type',
      header: 'Tipo',
      width: '104px',
      cell: (t) => (
        <span className="inline-flex h-[22px] w-fit items-center rounded-full border border-border px-2.5 text-xs font-semibold text-muted-foreground">
          {splitSubject(t.subject).type}
        </span>
      ),
    },
    {
      id: 'who',
      header: 'Solicitante',
      width: 'minmax(0,1fr)',
      cell: (t) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-semibold text-foreground">{t.requesterName || t.requesterEmail}</span>
          {t.requesterName && <span className="truncate text-xs text-muted-foreground">{t.requesterEmail}</span>}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Criado em',
      width: '104px',
      cell: (t) => <span className="text-[13px] text-muted-foreground">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : '—'}</span>,
    },
    {
      id: 'open',
      header: 'Abrir',
      width: '40px',
      align: 'end',
      cell: (t) => (
        <IconButton size="sm" label={`Abrir o chamado: ${splitSubject(t.subject).title}`} icon={ChevronRight} className="border-transparent" onClick={() => open(t)} />
      ),
    },
  ];

  const empty = emptyTicketsCopy({ total: tickets.length, status: filter, query });

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] font-bold text-foreground">Chamados de suporte</h2>
            {phase === 'ready' && counts.OPEN > 0 && (
              <StatusChip tone="warn" className="h-[26px] px-3">
                {counts.OPEN} {counts.OPEN === 1 ? 'aberto' : 'abertos'}
              </StatusChip>
            )}
          </span>
          <p className="text-sm text-muted-foreground">Pedidos enviados pela Central de Suporte</p>
        </div>
        <ModalButton className="h-[34px] gap-2 px-3 text-[13px]" disabled={refreshing || phase === 'loading'} onClick={() => void load(true)}>
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.5} aria-hidden="true" />
          Atualizar
        </ModalButton>
      </section>

      <DataToolbar
        filters={
          <Segmented
            label="Filtrar por status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos', count: phase === 'ready' ? counts.all : undefined },
              { value: 'OPEN', label: 'Aberto', count: phase === 'ready' ? counts.OPEN : undefined },
              { value: 'IN_PROGRESS', label: 'Em andamento', count: phase === 'ready' ? counts.IN_PROGRESS : undefined },
              { value: 'CLOSED', label: 'Resolvido', count: phase === 'ready' ? counts.CLOSED : undefined },
            ]}
          />
        }
        search={{ value: query, onChange: setQuery, placeholder: 'Buscar por assunto ou solicitante', ariaLabel: 'Buscar chamados' }}
      />

      {phase === 'loading' && <LoadingSkeleton variant="table" rows={6} label="Carregando chamados..." />}
      {phase === 'error' && (
        <ErrorState
          title="Não foi possível carregar os chamados"
          description="Se a conta deixou de ser administradora, o servidor recusa a lista."
          onRetry={() => void load()}
          className="rounded-2xl border border-dashed border-border"
        />
      )}
      {phase === 'ready' && (
        <DataTable
          ariaLabel="Chamados de suporte"
          columns={columns}
          rows={rows}
          getRowId={(t) => t.id}
          empty={
            <EmptyState
              embedded
              title={empty.title}
              description={empty.description}
              actions={empty.canClear ? <ModalButton onClick={clearFilters}>Limpar filtro</ModalButton> : undefined}
            />
          }
        />
      )}

      <TicketDrawer ticket={selected} open={drawerOpen} onOpenChange={setDrawerOpen} onChanged={replaceTicket} onDeleted={removeTicket} />
    </div>
  );
}
