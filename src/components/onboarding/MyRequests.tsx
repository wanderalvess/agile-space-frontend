'use client';

import { useState } from 'react';
import { Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { cancelLinkRequest, type LinkRequest, type LinkRequestStatus } from '@/lib/link-requests-api';
import { ConfirmDialog } from '@/components/room-kit/ConfirmDialog';
import { ModalButton } from '@/components/room-kit/Modal';
import { TONES, type Tone } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { Caption, ListBox } from './ui';

const STATUS: Record<LinkRequestStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pendente', tone: 'warn' },
  APPROVED: { label: 'Aprovado', tone: 'success' },
  REJECTED: { label: 'Recusado', tone: 'danger' },
  CANCELLED: { label: 'Cancelado', tone: 'neutral' },
};

/** Data curta (dd/mm) do pedido; vazia se o servidor mandar algo que não é data. */
export function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** Só aparece quando há pedido pendente: os da pessoa, do mais novo ao mais antigo, no máximo cinco. */
export function pendingRequestsView(requests: LinkRequest[]): LinkRequest[] {
  if (!requests.some((r) => r.status === 'PENDING')) return [];
  return [...requests].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
}

/**
 * "Meus pedidos": só aparece com pedido pendente. Pedido PENDING tem o botão Cancelar pedido (com confirmação);
 * `onChanged` relê a lista depois de cancelar (também quando o servidor diz que o pedido já foi decidido).
 */
export function MyRequests({ requests, onChanged }: { requests: LinkRequest[]; onChanged?: () => void | Promise<void> }) {
  const [target, setTarget] = useState<LinkRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = pendingRequestsView(requests);

  const confirmCancel = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await cancelLinkRequest(target.id);
      toast('Pedido cancelado', { description: 'Você pode pedir de novo quando quiser.' });
    } catch (e) {
      toast.error('Não foi possível cancelar o pedido', { description: e instanceof Error && e.message ? e.message : 'Tente novamente.' });
    } finally {
      // Relê sempre: um 409 quer dizer que o pedido já saiu de Pendente.
      await Promise.resolve(onChanged?.()).catch(() => undefined);
      setBusy(false);
      setTarget(null);
    }
  };

  if (shown.length === 0) return null;
  return (
    <section aria-label="Meus pedidos de vínculo" className="flex w-full flex-col gap-2">
      <Caption>Meus pedidos</Caption>
      <ListBox className="bg-card">
        {shown.map((r) => {
          const status = STATUS[r.status] ?? STATUS.PENDING;
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="flex min-w-0 flex-1 basis-48 flex-col">
                <span className="truncate text-sm font-semibold">
                  {r.projectKey}
                  {r.memberName ? ` · ${r.memberName}` : ''}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {[shortDate(r.createdAt), r.status === 'REJECTED' && r.decisionNote ? r.decisionNote : r.emailInJira].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className={cn('inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-xs font-bold', TONES[status.tone].chip)}>{status.label}</span>
              {r.status === 'PENDING' && (
                <ModalButton className="h-8 shrink-0 px-3 text-[13px] max-sm:h-11" disabled={busy} onClick={() => setTarget(r)}>
                  {busy && target?.id === r.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Undo2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  )}
                  Cancelar pedido
                </ModalButton>
              )}
            </div>
          );
        })}
      </ListBox>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        tone="warn"
        icon={Undo2}
        title="Cancelar este pedido?"
        description="O pedido deixa de aguardar aprovação. Você pode pedir de novo depois."
        cancelLabel="Manter pedido"
        confirmLabel="Cancelar pedido"
        loading={busy}
        loadingLabel="Cancelando…"
        keepOpenOnConfirm
        onConfirm={() => void confirmCancel()}
      />
    </section>
  );
}
