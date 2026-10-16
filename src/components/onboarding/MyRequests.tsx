'use client';

import type { LinkRequest, LinkRequestStatus } from '@/lib/link-requests-api';
import { TONES, type Tone } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { Caption, ListBox } from './ui';

const STATUS: Record<LinkRequestStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pendente', tone: 'warn' },
  APPROVED: { label: 'Aprovado', tone: 'success' },
  REJECTED: { label: 'Recusado', tone: 'danger' },
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

export function MyRequests({ requests }: { requests: LinkRequest[] }) {
  const shown = pendingRequestsView(requests);
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
            </div>
          );
        })}
      </ListBox>
    </section>
  );
}
