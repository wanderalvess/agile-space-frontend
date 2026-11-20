'use client';

import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import type { SupportTicket } from '@/app/support/api';
import { Segmented } from '@/components/admin/Segmented';
import { protocolOf, ticketKind } from '@/components/admin/tickets/ticket-utils';
import { IconTile, ModalButton } from '@/components/room-kit';
import { BRAND_TINT, CARD_SHADOW, FIELD, FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { hasUnread, listMeta, typeInfoOf, type MineFilter } from './support-utils';
import type { ListPhase } from './useSupportTickets';

interface TicketListProps {
  tickets: SupportTicket[];
  rows: SupportTicket[];
  counts: Record<MineFilter, number>;
  phase: ListPhase;
  filter: MineFilter;
  query: string;
  selectedId: string | null;
  onFilter: (f: MineFilter) => void;
  onQuery: (q: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRetry: () => void;
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando chamados" role="status" className="flex flex-col">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-2 border-b border-border px-4 py-4">
          <div className="h-3 w-[30%] rounded-md bg-muted motion-safe:animate-pulse" />
          <div className="h-3.5 w-[82%] rounded-md bg-muted motion-safe:animate-pulse" />
          <div className="h-3 w-[46%] rounded-md bg-muted motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** Coluna da esquerda: busca, filtros com contagem e os chamados da pessoa. */
export function TicketList({ tickets, rows, counts, phase, filter, query, selectedId, onFilter, onQuery, onSelect, onNew, onRetry }: TicketListProps) {
  const ready = phase === 'ready';
  const isEmpty = ready && tickets.length === 0;
  const noMatch = ready && tickets.length > 0 && rows.length === 0;

  return (
    <section aria-label="Meus chamados" className={cn('flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:min-h-[720px]', CARD_SHADOW)}>
      <div className="flex flex-col gap-2.5 border-b border-border p-3.5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Buscar chamado"
            placeholder="Buscar por assunto ou protocolo"
            className={cn(FIELD, 'h-10 pl-9')}
          />
        </label>
        <Segmented
          label="Filtrar chamados"
          value={filter}
          onChange={onFilter}
          className="self-start"
          options={[
            { value: 'all', label: 'Todos', count: ready ? counts.all : undefined },
            { value: 'open', label: 'Abertos', count: ready ? counts.open : undefined },
            { value: 'closed', label: 'Fechados', count: ready ? counts.closed : undefined },
          ]}
        />
      </div>

      {phase === 'loading' && <Skeleton />}

      {phase === 'error' && (
        <div role="alert" className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
          <IconTile icon={AlertCircle} tone="danger" size="lg" />
          <strong className="text-base text-foreground">Não foi possível carregar seus chamados</strong>
          <span className="text-sm leading-relaxed text-muted-foreground">Verifique sua conexão e tente de novo. Nada do que você enviou foi perdido.</span>
          <ModalButton className="mt-1 gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Tentar de novo
          </ModalButton>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-foreground">Você ainda não abriu chamados</h2>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">Quando precisar de ajuda, relatar um erro ou sugerir algo, comece por aqui.</p>
          <ModalButton variant="primary" className="mt-1" onClick={onNew}>
            Nova solicitação
          </ModalButton>
        </div>
      )}

      {noMatch && (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <strong className="text-base text-foreground">Nenhum chamado encontrado</strong>
          <span className="text-sm text-muted-foreground">Tente outro termo ou volte para Todos.</span>
          <ModalButton className="mt-1 h-9" onClick={() => { onFilter('all'); onQuery(''); }}>
            Limpar filtros
          </ModalButton>
        </div>
      )}

      {ready && rows.length > 0 && (
        <ul className="scrollbar-thin m-0 flex flex-col overflow-auto p-0">
          {rows.map((t) => {
            const on = t.id === selectedId;
            const unread = hasUnread(t);
            const { icon: TypeIcon } = typeInfoOf(t);
            return (
              <li key={t.id} className="list-none">
                <button
                  type="button"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => onSelect(t.id)}
                  className={cn(
                    'flex w-full flex-col gap-1.5 border-b border-l-[3px] border-b-border px-4 py-3.5 text-left transition-colors duration-fast hover:bg-muted/50',
                    FOCUS_RING,
                    'focus-visible:ring-inset focus-visible:ring-offset-0',
                    on ? cn('border-l-primary', BRAND_TINT) : 'border-l-transparent',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="font-mono text-xs text-muted-foreground">{protocolOf(t)}</span>
                    <span className="flex-1" />
                    {unread && <span className="inline-flex h-5 items-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">Nova resposta</span>}
                    <StatusBadge status={t.status} />
                  </span>
                  <span className={cn('text-sm leading-snug text-foreground', unread ? 'font-bold' : 'font-medium')}>{ticketKind(t).title}</span>
                  <span className="text-xs text-muted-foreground">{listMeta(t)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
