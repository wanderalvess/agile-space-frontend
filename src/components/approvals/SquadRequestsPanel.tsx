'use client';

import { useState } from 'react';
import { Loader2, ShieldAlert, UserRoundCheck } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { ModalButton } from '@/components/room-kit/Modal';
import { CARD_SHADOW, FOCUS_RING } from '@/components/room-kit/tokens';
import { EmptyState } from '@/components/page';
import type { ApprovalAccess, SquadLinkRequest, SquadRequestStatus } from '@/lib/squad-link-requests-api';
import { cn } from '@/lib/utils';
import { ApproveRequestDialog } from './ApproveDialog';
import { ApprovalErrorLine, ApprovalListRow, ApprovalSpinner, HistoryLine, HistoryTitle } from './parts';
import { RejectRequestDialog } from './RejectDialog';
import {
  KIND_LABEL,
  REQUEST_STATUS_LABEL,
  STATUS_FILTERS,
  decisionAbility,
  requestDetail,
  requesterName,
} from './squad-requests-utils';
import type { useSquadLinkRequests } from './useSquadLinkRequests';
import { relativeWhen, shortWhen } from './when';

type Requests = ReturnType<typeof useSquadLinkRequests>;

const EMPTY_TEXT: Record<SquadRequestStatus, { title: string; description: string }> = {
  PENDING: { title: 'Nenhum pedido pendente', description: 'Quando alguém pedir para entrar na squad, o pedido aparece aqui.' },
  APPROVED: { title: 'Nenhum pedido aprovado', description: 'Os pedidos que você aprovar ficam nesta lista.' },
  REJECTED: { title: 'Nenhum pedido recusado', description: 'Os pedidos que você recusar ficam nesta lista.' },
  CANCELLED: { title: 'Nenhum pedido cancelado', description: 'Os pedidos que a própria pessoa cancelar ficam nesta lista.' },
};

function PendingActions({
  req,
  access,
  currentUserId,
  busy,
  onApprove,
  onReject,
}: {
  req: SquadLinkRequest;
  access: ApprovalAccess;
  currentUserId?: string | null;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const can = decisionAbility(req, access, currentUserId);
  // O servidor recusaria a decisão: em vez do botão, o motivo.
  return (
    <>
      {can.approve && (
        <ModalButton variant="primary" className="h-[34px] px-3.5 text-[13px] max-sm:h-11" disabled={busy} onClick={onApprove}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : null}
          Aprovar
        </ModalButton>
      )}
      {can.reject && (
        <ModalButton className="h-[34px] px-3 text-[13px] max-sm:h-11" disabled={busy} onClick={onReject}>
          Recusar
        </ModalButton>
      )}
      {can.note && (
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {can.note}
        </span>
      )}
    </>
  );
}

/**
 * Aba "Pedidos" do Time da squad: quem pediu para entrar, com Aprovar e Recusar. Mostra só os botões que o
 * servidor aceita (liderança exige `canApproveLeadership`; ninguém decide o próprio pedido).
 */
export function SquadRequestsPanel({ requests, access, currentUserId }: { requests: Requests; access: ApprovalAccess; currentUserId?: string | null }) {
  const [approving, setApproving] = useState<SquadLinkRequest | null>(null);
  const [rejecting, setRejecting] = useState<SquadLinkRequest | null>(null);
  const { filter, setFilter, items, state, error, busyId } = requests;

  const onFilterKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = STATUS_FILTERS.findIndex((f) => f.id === filter);
    setFilter(STATUS_FILTERS[(i + (e.key === 'ArrowRight' ? 1 : STATUS_FILTERS.length - 1)) % STATUS_FILTERS.length].id);
    e.preventDefault();
  };

  return (
    <section aria-label="Pedidos de vínculo da squad" className={cn('flex flex-col gap-4 rounded-[20px] border border-border bg-card p-4 sm:p-6', CARD_SHADOW)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold text-foreground">Pedidos de vínculo</h2>
        <div role="tablist" aria-label="Situação dos pedidos" onKeyDown={onFilterKey} className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                id={`pedidos-filtro-${f.id}`}
                aria-selected={on}
                aria-controls="pedidos-lista"
                tabIndex={on ? 0 : -1}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-base',
                  FOCUS_RING,
                  on ? 'border-primary/40 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
                {f.id === 'PENDING' && requests.pendingCount !== null && <span className="text-xs tabular-nums opacity-70">{requests.pendingCount}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id="pedidos-lista" aria-labelledby={`pedidos-filtro-${filter}`} className="flex flex-col gap-4">
        {(state === 'loading' || state === 'idle') && <ApprovalSpinner />}
        {state === 'error' && <ApprovalErrorLine text={error ?? ''} onRetry={requests.reload} />}
        {state === 'ready' && items.length === 0 && (
          <EmptyState embedded icon={UserRoundCheck} title={EMPTY_TEXT[filter].title} description={EMPTY_TEXT[filter].description} />
        )}
        {state === 'ready' && items.length > 0 && filter === 'PENDING' && (
          <div className="overflow-hidden rounded-[14px] border border-border">
            {items.map((req) => (
              <ApprovalListRow
                key={req.id}
                leading={<InitialsAvatar name={req.requester.name} email={req.requester.email} className="h-[38px] w-[38px] text-sm" />}
                who={requesterName(req)}
                kind={req.requestedRoleName ? `${KIND_LABEL[req.kind]} · ${req.requestedRoleName}` : KIND_LABEL[req.kind]}
                detail={requestDetail(req)}
                when={relativeWhen(req.createdAt)}
                columnsClassName="lg:grid-cols-[38px_minmax(0,1.2fr)_minmax(0,1.6fr)_130px_minmax(0,300px)]"
                actions={
                  <PendingActions
                    req={req}
                    access={access}
                    currentUserId={currentUserId}
                    busy={busyId === req.id}
                    onApprove={() => setApproving(req)}
                    onReject={() => setRejecting(req)}
                  />
                }
              />
            ))}
          </div>
        )}
        {state === 'ready' && items.length > 0 && filter !== 'PENDING' && (
          <div className="flex flex-col gap-2">
            <HistoryTitle>{REQUEST_STATUS_LABEL[filter]}s</HistoryTitle>
            {items.map((r) => (
              <HistoryLine
                key={r.id}
                left={[requesterName(r), r.requestedRoleName || r.memberName].filter(Boolean).join(' · ')}
                status={REQUEST_STATUS_LABEL[r.status]}
                right={
                  r.status === 'CANCELLED' ? (
                    <>
                      Cancelado por <strong>quem pediu</strong>
                      {r.decidedAt ? ` · ${shortWhen(r.decidedAt)}` : ''}
                    </>
                  ) : (
                    <>
                      Decidido por: <strong>{r.decidedBy || 'Liderança'}</strong>
                      {r.decidedAt ? ` · ${shortWhen(r.decidedAt)}` : ''}
                      {r.decisionNote ? ` · “${r.decisionNote}”` : ''}
                    </>
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      <ApproveRequestDialog
        request={approving}
        canApproveLeadership={access.canApproveLeadership}
        onCancel={() => setApproving(null)}
        onConfirm={(target, memberId) => {
          setApproving(null);
          void requests.approve(target, memberId);
        }}
      />

      <RejectRequestDialog
        name={rejecting ? requesterName(rejecting) : null}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => {
          const target = rejecting;
          setRejecting(null);
          if (target) void requests.reject(target, reason);
        }}
      />
    </section>
  );
}
