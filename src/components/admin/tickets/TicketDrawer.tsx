'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { AlertCircle, Loader2, MessageSquare, Send, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';
import { supportApi, type SupportTicket, type SupportTicketReply, type SupportTicketStatus } from '@/app/support/api';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ModalButton, StatusChip } from '@/components/room-kit';
import { ConfirmDialog } from '@/components/room-kit/ConfirmDialog';
import { BRAND_TEXT, FIELD, FOCUS_RING, TONES } from '@/components/room-kit/tokens';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/context/AuthContext';
import { logSystemEvent } from '@/lib/audit';
import { cn } from '@/lib/utils';
import { shortWhen } from '../approvals/approvals-utils';
import { MAX_REPLY_LENGTH, TICKET_STATUSES, canSubmit, replyIsAdmin, replyKindLabel, statusMeta, submitLabel, protocolOf, ticketKind } from './ticket-utils';

type RepliesState = { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; items: SupportTicketReply[] };

const DOT: Record<string, string> = {
  danger: 'bg-red-500',
  warn: 'bg-amber-500',
  success: 'bg-emerald-500',
  neutral: 'bg-muted-foreground',
};

function Body({
  ticket,
  onChanged,
  onDeleted,
  onClose,
}: {
  ticket: SupportTicket;
  onChanged: (t: SupportTicket) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const draftId = useId();
  const [replies, setReplies] = useState<RepliesState>({ phase: 'loading' });
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<SupportTicketStatus>(ticket.status);
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadReplies = useCallback(async () => {
    setReplies({ phase: 'loading' });
    try {
      setReplies({ phase: 'ready', items: await supportApi.getReplies(ticket.id) });
    } catch {
      // Antes a lista aparecia vazia, sem aviso.
      setReplies({ phase: 'error' });
    }
  }, [ticket.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga das respostas ao abrir o chamado
    void loadReplies();
  }, [loadReplies]);

  const { type, title } = ticketKind(ticket);
  const meta = statusMeta(ticket.status);
  const statusChanged = status !== ticket.status;
  const hasDraft = draft.trim().length > 0;
  const ok = canSubmit({ draft, statusChanged, sending });

  const submit = async () => {
    if (!ok) return;
    setSending(true);
    let replied = false;
    try {
      if (hasDraft) {
        const created = await supportApi.addReply(ticket.id, { message: draft.trim(), authorName: session?.name || session?.email });
        replied = true;
        setReplies((r) => (r.phase === 'ready' ? { phase: 'ready', items: [...r.items, created] } : r));
        setDraft('');
        void logSystemEvent({
          content: `Admin respondeu o chamado ${protocolOf(ticket)}: "${draft.trim().substring(0, 30)}..."`,
          type: 'admin',
          severity: 'info',
          userEmail: session?.email,
          module: 'SupportTickets',
        });
      }
      if (statusChanged) {
        onChanged(await supportApi.updateStatus(ticket.id, status));
      }
      toast.success('Chamado atualizado', {
        description: hasDraft && statusChanged ? 'Resposta enviada e status salvo' : hasDraft ? 'Resposta enviada' : 'Status salvo',
      });
    } catch {
      // Diz qual dos dois falhou: a resposta pode ter ido e só o status não.
      toast.error('Erro ao atualizar', {
        description: replied ? 'A resposta foi enviada, mas o status não foi salvo.' : hasDraft ? 'A resposta não foi enviada.' : 'O status não foi salvo.',
      });
    } finally {
      setSending(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await supportApi.deleteTicket(ticket.id);
      toast.success('Chamado excluído');
      setConfirmDelete(false);
      onDeleted(ticket.id);
    } catch {
      toast.error('Não foi possível excluir', { description: 'O chamado continua na lista. Tente de novo.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <header className="flex flex-col gap-2.5 border-b border-border px-6 pb-4 pr-14 pt-5">
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="font-mono font-bold text-foreground">Chamado {protocolOf(ticket)}</span>
          <span className="inline-flex h-[22px] items-center rounded-full border border-border px-2.5 text-xs font-semibold">{type}</span>
        </span>
        <SheetTitle className="text-[22px] font-bold leading-tight">{title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2.5">
          <StatusChip tone={meta.tone} className="h-6 px-2.5">
            <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT[meta.tone])} />
            {meta.label}
          </StatusChip>
          <span className="text-[13px]">Criado em {shortWhen(ticket.createdAt) || 'data desconhecida'}</span>
        </SheetDescription>
      </header>

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground">
            <User className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Relato do usuário
          </h3>
          <div className="flex flex-col gap-3 rounded-[14px] border border-border border-l-[3px] border-l-primary bg-card p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{ticket.message}</p>
            <span className="flex items-center gap-2 border-t border-border pt-2.5 text-[13px]">
              <InitialsAvatar name={ticket.requesterName} email={ticket.requesterEmail} className="h-6 w-6 text-xs" />
              <span className="font-bold text-foreground">{ticket.requesterName || ticket.requesterEmail}</span>
              {ticket.requesterName && <span className="truncate text-muted-foreground">{ticket.requesterEmail}</span>}
            </span>
          </div>
        </section>

        {replies.phase === 'loading' && (
          <span role="status" className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
            Carregando respostas...
          </span>
        )}
        {replies.phase === 'error' && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-[13px]">
            <AlertCircle className={cn('h-4 w-4 shrink-0', TONES.danger.text)} strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 font-bold text-foreground">Não foi possível carregar as respostas</span>
            <ModalButton className="h-8 px-3 text-[13px]" onClick={() => void loadReplies()}>
              Tentar de novo
            </ModalButton>
          </div>
        )}
        {replies.phase === 'ready' && replies.items.length === 0 && <span className="text-[13px] text-muted-foreground">Nenhuma resposta ainda</span>}
        {replies.phase === 'ready' &&
          replies.items.map((r) => {
            const admin = replyIsAdmin(r);
            return (
            <section key={r.id} className="flex flex-col gap-2 pl-6 max-sm:pl-3">
              <h3 className={cn('flex items-center gap-2 text-[13px] font-bold', admin ? BRAND_TEXT : 'text-muted-foreground')}>
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                {replyKindLabel(admin)}
              </h3>
              <div className={cn('flex flex-col gap-2.5 rounded-[14px] border border-border border-l-[3px] bg-card p-3.5', admin ? 'border-l-primary' : 'border-l-border')}>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{r.message}</p>
                <span className="flex justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                  <span className="truncate">{r.authorName}</span>
                  <span className="shrink-0">{shortWhen(r.createdAt)}</span>
                </span>
              </div>
            </section>
            );
          })}
      </div>

      <footer className="flex flex-col gap-3 border-t border-border bg-muted/40 px-6 pb-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Send className={cn('h-4 w-4', BRAND_TEXT)} strokeWidth={1.5} aria-hidden="true" />
            Responder e mudar status
          </span>
          <div role="group" aria-label="Status do chamado" className="inline-flex gap-0.5 rounded-[10px] border border-border bg-card p-[3px]">
            {TICKET_STATUSES.map((s) => {
              const m = statusMeta(s);
              const on = s === status;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  disabled={sending}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 text-[13px] font-semibold transition-colors duration-fast max-sm:h-10',
                    FOCUS_RING,
                    on ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', DOT[m.tone])} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">A pessoa vê: {statusMeta(status).userSees}</span>
        <textarea
          id={draftId}
          aria-label="Sua resposta de governança"
          value={draft}
          maxLength={MAX_REPLY_LENGTH}
          disabled={sending}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Sua resposta de governança..."
          className={cn(FIELD, 'min-h-[92px] resize-none py-2.5 leading-relaxed')}
        />
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Máximo de {MAX_REPLY_LENGTH} caracteres</span>
          <span className="font-mono">
            {draft.length} / {MAX_REPLY_LENGTH}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModalButton variant="primary" className="min-w-[190px] gap-2" disabled={!ok} onClick={() => void submit()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            )}
            {submitLabel({ hasDraft, statusChanged, sending })}
          </ModalButton>
          <ModalButton onClick={onClose}>Fechar</ModalButton>
          <span className="flex-1" />
          <ModalButton className="h-[34px] gap-1.5 border-red-500/40 px-3 text-[13px] text-red-700 hover:bg-red-500/10 dark:text-red-300" disabled={sending} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            Excluir chamado
          </ModalButton>
        </div>
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={Trash2}
        title={`Excluir o chamado ${protocolOf(ticket)}?`}
        description="As respostas também são apagadas e a pessoa deixa de ver o chamado em Meus Tickets. Não dá para desfazer."
        cancelLabel="Manter"
        confirmLabel="Excluir chamado"
        loading={deleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={() => void remove()}
      />
    </>
  );
}

/** Painel lateral do chamado: relato, respostas, status, resposta do admin e exclusão. */
export function TicketDrawer({
  ticket,
  open,
  onOpenChange,
  onChanged,
  onDeleted,
}: {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: (t: SupportTicket) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <Sheet open={open && !!ticket} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-border bg-card p-0 sm:max-w-[640px]">
        {ticket && <Body key={ticket.id} ticket={ticket} onChanged={onChanged} onDeleted={onDeleted} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}
