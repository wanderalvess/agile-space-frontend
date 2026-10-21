'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookOpen, CheckCircle2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageShell } from '@/components/page';
import { protocolOf } from '@/components/admin/tickets/ticket-utils';
import { ModalButton } from '@/components/room-kit';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { NewTicketModal } from '@/components/support/NewTicketModal';
import { SupportGuide } from '@/components/support/SupportGuide';
import { TicketConversation } from '@/components/support/TicketConversation';
import { TicketList } from '@/components/support/TicketList';
import { actionErrorCopy, filterMine, mineCounts, parseNewTicketPrefill, type MineFilter, type NewTicketPrefill } from '@/components/support/support-utils';
import { useSupportTickets } from '@/components/support/useSupportTickets';
import { useAuth } from '@/context/AuthContext';
import { SupportApiError, type SupportTicketType } from './api';

function SupportScreen() {
  const { session, isAuthenticated } = useAuth();
  const params = useSearchParams();
  const linkedId = params.get('ticket');
  const data = useSupportTickets(isAuthenticated, linkedId);

  const [filter, setFilter] = useState<MineFilter>('all');
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<NewTicketPrefill | null>(null);
  const [prefillKey, setPrefillKey] = useState(0);
  const conversationRef = useRef<HTMLDivElement>(null);

  // Link do sino (/support?ticket=ID): abre aquele chamado, mesmo já estando na tela.
  const { select } = data;
  useEffect(() => {
    if (linkedId) select(linkedId);
  }, [linkedId, select]);

  // Link com ?novo=1 (ex.: "Pedir exportação ou exclusão"): abre a Nova solicitação preenchida e limpa os
  // parâmetros da URL, para não reabrir ao recarregar.
  const paramsKey = params.toString();
  useEffect(() => {
    const p = parseNewTicketPrefill(new URLSearchParams(paramsKey));
    if (!p) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre o modal a partir do link
    setPrefill(p);
    setPrefillKey((k) => k + 1);
    setNewOpen(true);
    try {
      const keep = new URLSearchParams(paramsKey);
      ['novo', 'tipo', 'assunto'].forEach((k) => keep.delete(k));
      const rest = keep.toString();
      window.history.replaceState(null, '', rest ? `/support?${rest}` : '/support');
    } catch {
      /* sem histórico (teste/iframe) */
    }
  }, [paramsKey]);

  const counts = useMemo(() => mineCounts(data.tickets), [data.tickets]);
  const rows = useMemo(() => filterMine(data.tickets, { filter, query }), [data.tickets, filter, query]);
  const selected = data.tickets.find((t) => t.id === data.selectedId) ?? null;

  const open = (id: string) => {
    data.select(id);
    try {
      window.history.replaceState(null, '', `/support?ticket=${encodeURIComponent(id)}`);
    } catch {
      /* sem histórico (teste/iframe): a seleção continua valendo na tela */
    }
    // Em tela estreita a conversa fica abaixo da lista.
    if (window.matchMedia?.('(max-width: 1023px)').matches) {
      window.setTimeout(() => conversationRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0);
    }
  };

  const createTicket = async (input: { type: SupportTicketType; subject: string; message: string }) => {
    try {
      const ticket = await data.create({ ...input, requesterName: session?.name });
      setCreated(protocolOf(ticket));
      setFilter('all');
      setQuery('');
      setNewOpen(false);
      return true;
    } catch (error) {
      const copy = actionErrorCopy(error, 'create');
      toast.error(copy.title, { description: copy.description });
      return false;
    }
  };

  const reply = async (message: string) => {
    if (!selected) return false;
    try {
      await data.reply(selected.id, message, session?.name);
      return true;
    } catch (error) {
      const copy = actionErrorCopy(error, 'reply');
      toast.error(copy.title, { description: copy.description });
      if (error instanceof SupportApiError && error.status === 409) void data.refresh();
      return false;
    }
  };

  const closeSelected = async () => {
    if (!selected) return false;
    try {
      await data.close(selected.id);
      toast.success(`Chamado ${protocolOf(selected)} fechado`);
      return true;
    } catch (error) {
      const copy = actionErrorCopy(error, 'close');
      toast.error(copy.title, { description: copy.description });
      return false;
    }
  };

  const reopenSelected = async () => {
    if (!selected) return false;
    try {
      await data.reopen(selected.id);
      toast.success(`Chamado ${protocolOf(selected)} reaberto`);
      return true;
    } catch (error) {
      const copy = actionErrorCopy(error, 'reopen');
      toast.error(copy.title, { description: copy.description });
      if (error instanceof SupportApiError && error.status === 409) {
        void data.refresh();
        return true;
      }
      return false;
    }
  };

  return (
    <PageShell documentTitle="Suporte">
      <PageHeader
        title="Suporte"
        module="support"
        subtitle="Dúvidas, erros e sugestões para o time do portal. Você acompanha tudo por aqui."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Suporte' }]}
        actions={
          <>
            <ModalButton className="h-10 gap-2" onClick={() => setGuideOpen(true)}>
              <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Guia
            </ModalButton>
            <ModalButton variant="primary" className="h-10 gap-2" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Nova solicitação
            </ModalButton>
          </>
        }
      />

      {created && (
        <div role="status" className="room-rise flex items-center gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-foreground">
          <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={1.5} aria-hidden="true" />
          <span className="flex-1">
            <strong>Chamado {created} criado.</strong> Quando o time responder, você recebe um aviso no sino.
          </span>
          <button
            type="button"
            aria-label="Dispensar aviso"
            onClick={() => setCreated(null)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground ${FOCUS_RING}`}
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(320px,430px)_minmax(0,1fr)]">
        <TicketList
          tickets={data.tickets}
          rows={rows}
          counts={counts}
          phase={data.phase}
          filter={filter}
          query={query}
          selectedId={data.selectedId}
          onFilter={setFilter}
          onQuery={setQuery}
          onSelect={open}
          onNew={() => setNewOpen(true)}
          onRetry={() => void data.retryList()}
        />
        <div ref={conversationRef} className="flex min-w-0 flex-col scroll-mt-4 [&>section]:flex-1">
          <TicketConversation
            ticket={selected}
            replies={data.replies}
            listPhase={data.phase}
            hasTickets={data.tickets.length > 0}
            onRetryReplies={() => void data.retryReplies()}
            onReply={reply}
            onClose={closeSelected}
            onReopen={reopenSelected}
          />
        </div>
      </div>

      <NewTicketModal key={prefillKey} prefill={prefill} open={newOpen} onOpenChange={setNewOpen} onSubmit={createTicket} />
      <SupportGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </PageShell>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportScreen />
    </Suspense>
  );
}
