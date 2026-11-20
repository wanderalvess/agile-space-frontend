'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Clock,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { PasswordResetRequest } from '@/app/admin/api';
import type { LinkRequest } from '@/lib/admin-link-requests-api';
import { cn } from '@/lib/utils';
import { CARD_SHADOW, FOCUS_RING } from '@/components/room-kit/tokens';
import { IconTile } from '@/components/room-kit/primitives';
import { ModalButton } from '@/components/room-kit/Modal';
import { ApprovalErrorLine, ApprovalListRow, ApprovalSpinner, EmptyText, HistoryLine, HistoryTitle } from '@/components/approvals/parts';
import { RejectRequestDialog } from '@/components/approvals/RejectDialog';
import {
  approvalCounts,
  buildApprovalRows,
  fullWhen,
  linkRequestDetail,
  linkStatusLabel,
  relativeWhen,
  resetStatusLabel,
  shortWhen,
  splitLinkRequests,
  splitResets,
  type ResetLink,
} from './approvals-utils';
import { ResetLinkBanner } from './ResetLinkParts';
import { useLinkRequests, useResetRequests } from './useApprovals';

type Tab = 'all' | 'links' | 'resets';

const UNAVAILABLE_TEXT = 'Pedidos de vínculo ainda não estão disponíveis neste ambiente';

function LinkRow({ req, busy, onApprove, onReject }: { req: LinkRequest; busy: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <ApprovalListRow
      icon={Link2}
      tone="brand"
      who={req.requester.name || req.requester.email}
      kind={`Pedido de vínculo · ${req.projectKey}`}
      detail={linkRequestDetail(req)}
      when={relativeWhen(req.createdAt)}
      actions={
        <>
          <ModalButton variant="primary" className="h-[34px] px-3.5 text-[13px]" disabled={busy} onClick={onApprove}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" /> : null}
            Aprovar vínculo
          </ModalButton>
          <ModalButton className="h-[34px] px-3 text-[13px]" disabled={busy} onClick={onReject}>
            Recusar
          </ModalButton>
        </>
      }
    />
  );
}

function ResetRow({ req, busy, onApprove }: { req: PasswordResetRequest; busy: boolean; onApprove: () => void }) {
  return (
    <ApprovalListRow
      icon={KeyRound}
      tone="warn"
      who={req.userName || req.userEmail}
      kind={`Redefinição de senha · ${req.userEmail}`}
      detail="Pedido feito na tela de login."
      when={`Solicitado em: ${fullWhen(req.requestedAt) || 'Desconhecido'}`}
      actions={<ApproveResetButton busy={busy} onClick={onApprove} />}
    />
  );
}

function ApproveResetButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <ModalButton variant="primary" className="h-[34px] gap-2 px-3.5 text-[13px]" disabled={busy} onClick={onClick}>
      {busy ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      )}
      Aprovar &amp; Gerar Link
    </ModalButton>
  );
}

/** Aviso de que o backend deste ambiente ainda não tem os pedidos de vínculo. */
function UnavailableNote({ compact = false }: { compact?: boolean }) {
  return (
    <div role="status" className={cn('flex items-center gap-3 rounded-xl border border-dashed border-border text-muted-foreground', compact ? 'px-3.5 py-2.5 text-[13px]' : 'p-4 text-sm')}>
      <Link2 className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {UNAVAILABLE_TEXT}
    </div>
  );
}

/** Aprovações do admin: pedidos de vínculo de liderança e redefinições de senha, em abas. */
export function ApprovalsHub() {
  const [tab, setTab] = useState<Tab>('all');
  const [link, setLink] = useState<ResetLink | null>(null);
  const [rejecting, setRejecting] = useState<LinkRequest | null>(null);

  const onLink = useCallback((l: ResetLink) => setLink(l), []);
  const resets = useResetRequests(onLink);
  const links = useLinkRequests();

  const resetSplit = useMemo(() => splitResets(resets.requests), [resets.requests]);
  const linkSplit = useMemo(() => splitLinkRequests(links.items), [links.items]);
  const rows = useMemo(() => buildApprovalRows(linkSplit.pending, resetSplit.pending), [linkSplit.pending, resetSplit.pending]);

  const counts = approvalCounts({
    links: links.state === 'ready' ? linkSplit.pending.length : null,
    resets: resets.loading && resets.requests.length === 0 && !resets.error ? null : resetSplit.pending.length,
  });

  const tabs: { id: Tab; label: string; count: number | null }[] = [
    { id: 'all', label: 'Todas', count: counts.all },
    { id: 'links', label: 'Vínculos', count: counts.links },
    { id: 'resets', label: 'Redefinições', count: counts.resets },
  ];

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.id === tab);
    setTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id);
    e.preventDefault();
  };

  const confirmReject = (text: string) => {
    if (!rejecting) return;
    const target = rejecting;
    setRejecting(null);
    void links.reject(target, text);
  };

  const linkRows = (list: LinkRequest[]) =>
    list.map((req) => (
      <LinkRow
        key={req.id}
        req={req}
        busy={links.busyId === req.id}
        onApprove={() => void links.approve(req)}
        onReject={() => setRejecting(req)}
      />
    ));

  const allLoading = resets.loading && resets.requests.length === 0 && !resets.error && links.state === 'loading';

  return (
    <section aria-labelledby="approvals-title" className={cn('flex flex-col gap-4 rounded-[20px] border border-border bg-card p-4 sm:p-6', CARD_SHADOW)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="approvals-title" className="text-[22px] font-bold text-foreground">Aprovações</h2>
        <div role="tablist" aria-label="Tipo de aprovação" onKeyDown={onTabKey} className="flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`apr-tab-${t.id}`}
                aria-selected={on}
                aria-controls="apr-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-base',
                  FOCUS_RING,
                  on
                    ? 'border-primary/40 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {t.count !== null && <span className="text-xs font-normal tabular-nums">{t.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {link && <ResetLinkBanner link={link} onClose={() => setLink(null)} />}

      <div role="tabpanel" id="apr-panel" aria-labelledby={`apr-tab-${tab}`} className="flex flex-col gap-4">
        {tab === 'all' && (
          <>
            {allLoading ? (
              <ApprovalSpinner />
            ) : rows.length > 0 ? (
              <div className="overflow-hidden rounded-[14px] border border-border">
                {rows.map((row) =>
                  row.kind === 'link' ? (
                    <LinkRow
                      key={row.id}
                      req={row.request}
                      busy={links.busyId === row.request.id}
                      onApprove={() => void links.approve(row.request)}
                      onReject={() => setRejecting(row.request)}
                    />
                  ) : (
                    <ResetRow key={row.id} req={row.request} busy={resets.approvingId === row.request.id} onApprove={() => void resets.approve(row.request)} />
                  ),
                )}
              </div>
            ) : (
              <EmptyText>Nada aguardando aprovação.</EmptyText>
            )}
            {resets.error && <ApprovalErrorLine text={resets.error} onRetry={resets.reload} />}
            {links.state === 'unavailable' && <UnavailableNote compact />}
            {links.state === 'error' && <ApprovalErrorLine text={links.error ?? ''} onRetry={links.reload} />}
          </>
        )}

        {tab === 'links' && (
          <>
            {links.state === 'loading' && <ApprovalSpinner />}
            {links.state === 'unavailable' && <UnavailableNote />}
            {links.state === 'error' && <ApprovalErrorLine text={links.error ?? ''} onRetry={links.reload} />}
            {links.state === 'ready' && (
              <>
                {linkSplit.pending.length === 0 ? (
                  <EmptyText>Nenhum pedido de vínculo pendente.</EmptyText>
                ) : (
                  <div className="overflow-hidden rounded-[14px] border border-border">{linkRows(linkSplit.pending)}</div>
                )}
                {linkSplit.history.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <HistoryTitle>Histórico recente</HistoryTitle>
                    {linkSplit.history.map((r) => (
                      <HistoryLine
                        key={r.id}
                        left={`${r.requester.name || r.requester.email} · ${r.projectKey}`}
                        status={linkStatusLabel(r.status)}
                        right={
                          r.status === 'CANCELLED' ? (
                            <>
                              Cancelado por <strong>quem pediu</strong> · {shortWhen(r.decidedAt)}
                            </>
                          ) : (
                            <>
                              Decidido por: <strong>{r.decidedBy || 'Admin'}</strong> · {shortWhen(r.decidedAt)}
                              {r.decisionNote ? ` · “${r.decisionNote}”` : ''}
                            </>
                          )
                        }
                      />
                    ))}
                    <span className="text-xs text-muted-foreground">Mostra os 5 mais recentes</span>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'resets' && (
          <section aria-labelledby="resets-title" className="overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.05]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 px-4 py-4 sm:px-[18px]">
              <span className="flex min-w-0 items-center gap-3">
                <IconTile icon={KeyRound} tone="warn" size="lg" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span id="resets-title" className="flex flex-wrap items-center gap-2 text-base font-bold text-foreground">
                    Solicitações de Redefinição de Senha
                    {resetSplit.pending.length > 0 && (
                      <span className="inline-flex h-[22px] items-center rounded-full bg-amber-700 px-2 text-xs font-bold text-white">
                        {resetSplit.pending.length} PENDENTE{resetSplit.pending.length > 1 ? 'S' : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">Aprovação manual por Admin (sem SSO oficial)</span>
                </span>
              </span>
              <ModalButton className="h-[34px] gap-1.5 px-3 text-[13px]" onClick={() => void resets.reload()} disabled={resets.loading}>
                <RefreshCw className={cn('h-3.5 w-3.5', resets.loading && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.5} aria-hidden="true" />
                Atualizar
              </ModalButton>
            </div>
            <div className="flex flex-col gap-3.5 px-4 py-4 sm:px-[18px]">
              {resets.loading && resets.requests.length === 0 && !resets.error ? (
                <ApprovalSpinner />
              ) : resets.error && resets.requests.length === 0 ? (
                <ApprovalErrorLine text={resets.error} onRetry={resets.reload} />
              ) : resetSplit.pending.length === 0 && resetSplit.history.length === 0 ? (
                <EmptyText>Nenhuma solicitação de redefinição de senha registrada no momento.</EmptyText>
              ) : (
                <>
                  {resetSplit.pending.map((req) => (
                    <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-card p-3.5">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="break-all text-sm font-bold text-foreground">
                          {req.userName || req.userEmail}{' '}
                          <span className="font-mono text-xs font-normal text-muted-foreground">({req.userEmail})</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" strokeWidth={1.5} aria-hidden="true" />
                          Solicitado em: {fullWhen(req.requestedAt) || 'Desconhecido'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={resets.approvingId === req.id}
                        onClick={() => void resets.approve(req)}
                        className={cn(
                          'inline-flex h-9 items-center gap-2 rounded-[10px] bg-amber-700 px-4 text-[13px] font-bold text-white transition-colors hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-60',
                          FOCUS_RING,
                        )}
                      >
                        {resets.approvingId === req.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                        )}
                        Aprovar &amp; Gerar Link
                      </button>
                    </div>
                  ))}
                  {resetSplit.history.length > 0 && (
                    <div className="flex flex-col gap-2 pt-1">
                      <HistoryTitle>Histórico recente</HistoryTitle>
                      {resetSplit.history.map((r) => (
                        <HistoryLine
                          key={r.id}
                          left={r.userEmail}
                          status={resetStatusLabel(r.status)}
                          right={
                            <>
                              Aprovado por: <strong>{r.approvedBy || 'Admin'}</strong>
                              {r.approvedAt ? ` · ${shortWhen(r.approvedAt)}` : ''}
                            </>
                          }
                        />
                      ))}
                      <span className="text-xs text-muted-foreground">Mostra os 5 mais recentes</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </div>

      <RejectRequestDialog
        name={rejecting ? rejecting.requester.name || rejecting.requester.email : null}
        onCancel={() => setRejecting(null)}
        onConfirm={confirmReject}
      />
    </section>
  );
}
