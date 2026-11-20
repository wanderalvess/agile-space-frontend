'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, RotateCcw, Send } from 'lucide-react';
import type { SupportTicket } from '@/app/support/api';
import { protocolOf, ticketKind } from '@/components/admin/tickets/ticket-utils';
import { ModalButton } from '@/components/room-kit';
import { ConfirmDialog } from '@/components/room-kit/ConfirmDialog';
import { BRAND_TINT, CARD_SHADOW, FIELD } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { MAX_MESSAGE, buildTimeline, canSendReply, isClosed, typeInfoOf, whenLabel } from './support-utils';
import type { ListPhase, RepliesState } from './useSupportTickets';

interface TicketConversationProps {
  ticket: SupportTicket | null;
  replies: RepliesState;
  listPhase: ListPhase;
  hasTickets: boolean;
  onRetryReplies: () => void;
  onReply: (message: string) => Promise<boolean>;
  onClose: () => Promise<boolean>;
  onReopen: () => Promise<boolean>;
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-8 py-12 text-center">
      <MessageSquare className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function placeholderCopy(listPhase: ListPhase, hasTickets: boolean): { title: string; text: string } {
  if (listPhase === 'error') return { title: 'Conversa indisponível', text: 'Assim que a lista carregar, a conversa aparece aqui.' };
  if (listPhase === 'ready' && !hasTickets) return { title: 'Nenhum chamado ainda', text: 'Ao enviar uma solicitação, a conversa com o time aparece aqui.' };
  return { title: 'Escolha um chamado', text: 'Selecione um chamado na lista para ver a conversa.' };
}

function Body({ ticket, replies, onRetryReplies, onReply, onClose, onReopen }: Omit<TicketConversationProps, 'ticket' | 'listPhase' | 'hasTickets'> & { ticket: SupportTicket }) {
  const draftId = useId();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState<null | 'close' | 'reopen'>(null);
  const [acting, setActing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const closed = isClosed(ticket);
  const { title } = ticketKind(ticket);
  const type = typeInfoOf(ticket);
  const items = buildTimeline(ticket, replies.phase === 'ready' ? replies.items : []);
  const count = replies.phase === 'ready' ? replies.items.length : -1;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [count, ticket.id]);

  const send = async () => {
    if (!canSendReply({ draft, sending })) return;
    setSending(true);
    const ok = await onReply(draft.trim());
    setSending(false);
    if (ok) setDraft('');
  };

  const runConfirmed = async () => {
    setActing(true);
    const ok = confirm === 'close' ? await onClose() : await onReopen();
    setActing(false);
    if (ok) setConfirm(null);
  };

  return (
    <div className="room-rise flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-bold text-foreground">{protocolOf(ticket)}</span>
            <StatusBadge status={ticket.status} />
            <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-muted-foreground">
              <type.icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              {type.label}
            </span>
          </span>
          <h2 className="break-words text-[22px] font-bold leading-tight tracking-tight text-foreground">{title}</h2>
          <span className="text-[13px] text-muted-foreground">Aberto {whenLabel(ticket.createdAt)}</span>
        </div>
        <div className="flex gap-2">
          {!closed && (
            <ModalButton className="h-[38px]" onClick={() => setConfirm('close')}>
              Fechar chamado
            </ModalButton>
          )}
          {closed && (
            <ModalButton className="h-[38px] gap-2" onClick={() => setConfirm('reopen')}>
              <RotateCcw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Reabrir chamado
            </ModalButton>
          )}
        </div>
      </header>

      <div role="log" aria-label="Conversa" className="scrollbar-thin flex min-h-[260px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        {items.map((it) =>
          it.kind === 'event' ? (
            <div key={it.key} className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>{it.when ? `${it.text} · ${it.when}` : it.text}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : (
            <div key={it.key} className={cn('flex flex-col gap-1.5', it.mine ? 'items-end' : 'items-start')}>
              <span className="text-xs text-muted-foreground">
                <strong className="font-semibold text-foreground">{it.name}</strong>
                {it.when && ` · ${it.when}`}
              </span>
              <div
                className={cn(
                  'max-w-[640px] whitespace-pre-wrap break-words rounded-[14px] border px-4 py-3 text-sm leading-relaxed text-foreground',
                  it.mine ? cn('border-primary/30', BRAND_TINT) : 'border-border bg-muted/50',
                )}
              >
                {it.text}
              </div>
            </div>
          ),
        )}

        {replies.phase === 'loading' && (
          <span role="status" className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
            Carregando respostas...
          </span>
        )}
        {replies.phase === 'error' && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-[13px]">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700 dark:text-red-300" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 font-bold text-foreground">Não foi possível carregar as respostas</span>
            <ModalButton className="h-8 px-3 text-[13px]" onClick={onRetryReplies}>
              Tentar de novo
            </ModalButton>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {closed ? (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-muted/40 px-6 py-3.5 text-sm text-muted-foreground">
          <span>Este chamado está fechado. Reabra para enviar uma nova mensagem.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 border-t border-border px-6 pb-[18px] pt-3.5">
          <textarea
            id={draftId}
            aria-label="Responder ao time"
            rows={3}
            value={draft}
            maxLength={MAX_MESSAGE}
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Escreva sua resposta"
            className={cn(FIELD, 'min-h-[84px] resize-y py-2.5 leading-relaxed')}
          />
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-xs text-muted-foreground">O time recebe sua resposta e continua por aqui.</span>
            <ModalButton variant="primary" className="h-[38px] gap-2" disabled={!canSendReply({ draft, sending })} onClick={() => void send()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              )}
              {sending ? 'Enviando…' : 'Enviar resposta'}
            </ModalButton>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === 'close'}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="neutral"
        icon={CheckCircle2}
        title={`Fechar o chamado ${protocolOf(ticket)}?`}
        description="Use quando o assunto estiver resolvido. Você pode reabrir depois e a conversa continua do ponto onde parou."
        confirmLabel="Fechar chamado"
        loading={acting}
        loadingLabel="Fechando…"
        keepOpenOnConfirm
        onConfirm={() => void runConfirmed()}
      />
      <ConfirmDialog
        open={confirm === 'reopen'}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone="brand"
        icon={RotateCcw}
        title={`Reabrir o chamado ${protocolOf(ticket)}?`}
        description="O chamado volta para Aberto. Depois de reabrir, escreva o que ainda não foi resolvido."
        confirmLabel="Reabrir chamado"
        loading={acting}
        loadingLabel="Reabrindo…"
        keepOpenOnConfirm
        onConfirm={() => void runConfirmed()}
      />
    </div>
  );
}

/** Coluna da direita: linha do tempo do chamado aberto, resposta do usuário, fechar e reabrir. */
export function TicketConversation({ ticket, listPhase, hasTickets, ...rest }: TicketConversationProps) {
  const copy = placeholderCopy(listPhase, hasTickets);
  return (
    <section aria-label="Conversa do chamado" className={cn('flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:min-h-[720px]', CARD_SHADOW)}>
      {ticket && listPhase === 'ready' ? (
        <Body key={ticket.id} ticket={ticket} {...rest} />
      ) : listPhase === 'loading' ? (
        <div aria-busy="true" role="status" aria-label="Carregando conversa" className="flex flex-col gap-3.5 p-6">
          <div className="h-3.5 w-[18%] rounded-md bg-muted motion-safe:animate-pulse" />
          <div className="h-6 w-[60%] rounded-md bg-muted motion-safe:animate-pulse" />
          <div className="mt-3 h-[90px] w-[70%] rounded-xl bg-muted motion-safe:animate-pulse" />
          <div className="h-[70px] w-[62%] self-end rounded-xl bg-muted motion-safe:animate-pulse" />
        </div>
      ) : (
        <Placeholder title={copy.title} text={copy.text} />
      )}
    </section>
  );
}
