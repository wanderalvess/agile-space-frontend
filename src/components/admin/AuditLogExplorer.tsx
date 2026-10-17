'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { adminApi, type AuditLogData } from '@/app/admin/api';
import { userApi } from '@/app/users/api';
import { toast } from '@/hooks/use-toast';
import { DataTable, DataToolbar, EmptyState, ErrorState, LoadingSkeleton, type DataColumn } from '@/components/page';
import { FOCUS_RING, IconButton, ModalButton, SelectField, StatusChip } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { ShowMoreFooter, useVisibleLimit } from './AdminOpsParts';
import {
  AUDIT_PERIOD_OPTIONS,
  buildCsv,
  buildNameIndex,
  distinctSorted,
  downloadCsv,
  filterAuditLogs,
  nextChunk,
  resolveName,
  type NameIndex,
} from './admin-ops-utils';

const AUDIT_STEP = 25;

function Details({ text }: { text?: string | null }) {
  const [open, setOpen] = useState(false);
  const long = (text || '').length > 160;
  if (!text) return <span className="text-[13px] text-muted-foreground">—</span>;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className={cn('text-[13px] leading-snug text-foreground', !open && 'line-clamp-2')}>{text}</p>
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
    </div>
  );
}

export function AuditLogExplorer() {
  const [events, setEvents] = useState<AuditLogData[]>([]);
  const [names, setNames] = useState<NameIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [period, setPeriod] = useState('all');
  const [action, setAction] = useState('all');
  const [operator, setOperator] = useState('all');

  const fetchLogs = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const logs = await adminApi.getAuditLogs();
      setEvents(logs || []);
      setLoadError(false);
    } catch (e) {
      console.error('Erro ao buscar os registros de auditoria:', e);
      if (initial) setLoadError(true);
      else toast({ variant: 'destructive', title: 'Não foi possível carregar a auditoria' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

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

  const actionOptions = useMemo(() => distinctSorted(events.map((e) => e.action)), [events]);
  const operatorOptions = useMemo(() => distinctSorted(events.map((e) => e.performedBy)), [events]);

  const filtered = useMemo(
    () => filterAuditLogs(events, { search: searchTerm, period, action, operator }, new Date(), names),
    [events, searchTerm, period, action, operator, names],
  );
  const [visibleLimit, showMore] = useVisibleLimit(`${searchTerm}|${period}|${action}|${operator}`, AUDIT_STEP);
  const shown = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);
  const hasFilters = searchTerm.trim() !== '' || period !== 'all' || action !== 'all' || operator !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setPeriod('all');
    setAction('all');
    setOperator('all');
  };

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast({ title: 'Nada para exportar', description: 'Nenhum registro no filtro atual.' });
      return;
    }
    const headers = ['Data', 'Ação', 'Operador', 'Detalhes'];
    const rows = filtered.map((e) => [
      e.createdAt ? new Date(e.createdAt).toLocaleString('pt-BR') : 'N/A',
      e.action,
      e.performedBy || 'System',
      e.details || '',
    ]);
    downloadCsv(`audit_logs_${new Date().toISOString().split('T')[0]}.csv`, buildCsv(headers, rows, [3]));
  };

  if (loading) return <LoadingSkeleton variant="table" rows={6} label="Carregando registros de auditoria" />;
  if (loadError) {
    return <ErrorState title="Não foi possível carregar a auditoria" onRetry={() => fetchLogs(true)} />;
  }

  const columns: DataColumn<AuditLogData>[] = [
    {
      id: 'when',
      header: 'Data / hora',
      width: '180px',
      cell: (e) => (
        <span className="text-[13px] font-medium tabular-nums text-foreground">
          {e.createdAt ? new Date(e.createdAt).toLocaleString('pt-BR') : 'Recente'}
        </span>
      ),
    },
    {
      id: 'action',
      header: 'Ação',
      width: '170px',
      cell: (e) => <StatusChip tone="brand" className="h-6 max-w-full truncate">{e.action}</StatusChip>,
    },
    {
      id: 'operator',
      header: 'Operador',
      width: '230px',
      cell: (e) => {
        const person = resolveName(names, e.performedBy);
        return person ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-semibold text-foreground">{person}</span>
            <span className="truncate text-xs text-muted-foreground">{e.performedBy}</span>
          </div>
        ) : (
          <span className="truncate text-[13px] font-semibold text-foreground" title={e.performedBy}>{e.performedBy}</span>
        );
      },
    },
    { id: 'details', header: 'Detalhes', width: 'minmax(0,1fr)', cell: (e) => <Details text={e.details} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataToolbar
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: 'Buscar nos logs (ação, operador, detalhes)...',
          ariaLabel: 'Buscar nos registros de auditoria por ação, operador ou detalhes',
        }}
        filters={
          <>
            <SelectField aria-label="Período" value={period} onChange={setPeriod} options={AUDIT_PERIOD_OPTIONS} className="h-[38px] w-[176px]" />
            <SelectField
              aria-label="Ação"
              value={action}
              onChange={setAction}
              options={[{ value: 'all', label: 'Todas as ações' }, ...actionOptions.map((a) => ({ value: a, label: a }))]}
              className="h-[38px] w-[170px]"
            />
            <SelectField
              aria-label="Operador"
              value={operator}
              onChange={setOperator}
              options={[
                { value: 'all', label: 'Todos os operadores' },
                ...operatorOptions.map((o) => ({ value: o, label: resolveName(names, o) ? `${resolveName(names, o)} (${o})` : o })),
              ]}
              className="h-[38px] w-[220px]"
            />
          </>
        }
        actions={
          <>
            <IconButton
              label="Atualizar"
              icon={RefreshCw}
              onClick={() => fetchLogs(false)}
              disabled={refreshing}
              className={cn(refreshing && '[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none')}
            />
            <ModalButton variant="secondary" onClick={exportToCSV} title="O CSV leva só o que está filtrado">
              <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Exportar CSV
            </ModalButton>
          </>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          title="Nenhum registro de auditoria ainda"
          description="Criação e revogação de chaves e mudanças de configuração entram aqui."
        />
      ) : (
        <DataTable
          ariaLabel="Registros de auditoria"
          columns={columns}
          rows={shown}
          getRowId={(e) => e.id || `audit-${events.indexOf(e)}`}
          stackBelow="lg"
          empty={
            <EmptyState
              embedded
              title="Nenhum registro encontrado com estes filtros"
              actions={hasFilters ? <ModalButton variant="secondary" onClick={clearFilters}>Limpar filtros</ModalButton> : undefined}
            />
          }
          footer={
            filtered.length > 0 ? (
              <ShowMoreFooter
                shown={shown.length}
                total={filtered.length}
                noun={hasFilters ? `registros do filtro (${events.length} carregados)` : 'registros'}
                chunk={nextChunk(filtered.length, shown.length, AUDIT_STEP)}
                onMore={showMore}
              />
            ) : undefined
          }
        />
      )}
    </div>
  );
}
