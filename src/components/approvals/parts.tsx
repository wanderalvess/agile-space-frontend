'use client';

import { CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONES, type Tone } from '@/components/room-kit/tokens';
import { IconTile } from '@/components/room-kit/primitives';
import { ModalButton } from '@/components/room-kit/Modal';

/** Peças de lista compartilhadas pela aba Aprovações do admin e pela aba Pedidos da squad. */

export function ApprovalSpinner() {
  return (
    <div className="flex items-center justify-center py-7" role="status" aria-label="Carregando">
      <Loader2 className="h-7 w-7 animate-spin text-primary motion-reduce:animate-none [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} />
    </div>
  );
}

export function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="py-1.5 text-[13px] italic text-muted-foreground">{children}</p>;
}

/** Uma linha de pedido: placa do tipo (ou avatar), quem, detalhe, quando e as ações. */
export function ApprovalListRow({
  icon,
  leading,
  tone,
  who,
  kind,
  detail,
  when,
  actions,
}: {
  icon?: LucideIcon;
  /** Substitui a placa do tipo (ex.: avatar com iniciais). */
  leading?: React.ReactNode;
  tone?: Tone;
  who: string;
  kind: React.ReactNode;
  detail: React.ReactNode;
  when: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 border-b border-border p-4 last:border-b-0 lg:grid-cols-[38px_minmax(0,1.3fr)_minmax(0,1.6fr)_170px_auto]">
      {leading ?? (icon ? <IconTile icon={icon} tone={tone ?? 'brand'} size="lg" className="h-[38px] w-[38px] rounded-xl" /> : <span aria-hidden="true" />)}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words text-sm font-bold text-foreground">{who}</span>
        <span className="break-words text-xs text-muted-foreground">{kind}</span>
      </div>
      <div className="col-start-2 text-[13px] leading-snug text-muted-foreground lg:col-start-auto">{detail}</div>
      <span className="col-start-2 text-xs text-muted-foreground lg:col-start-auto">{when}</span>
      <div className="col-start-2 flex flex-wrap gap-2 lg:col-start-auto lg:justify-end">{actions}</div>
    </div>
  );
}

export function HistoryTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

export function HistoryLine({ left, status, right }: { left: string; status: string; right: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[10px] border border-border bg-foreground/[0.04] px-3 py-2.5 text-xs">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <CheckCircle2 className={cn('h-4 w-4 shrink-0', TONES.success.text)} strokeWidth={1.5} aria-hidden="true" />
        <span className="break-all font-semibold text-foreground">{left}</span>
        <span className="inline-flex h-5 items-center rounded-full border border-border px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{status}</span>
      </span>
      <span className="text-muted-foreground">{right}</span>
    </div>
  );
}

export function ApprovalErrorLine({ text, onRetry }: { text: string; onRetry: () => void | Promise<void> }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-3 text-[13px]">
      <span className={TONES.danger.text}>{text || 'Não foi possível carregar.'}</span>
      <ModalButton className="h-8 px-3 text-[13px]" onClick={() => void onRetry()}>
        Tentar de novo
      </ModalButton>
    </div>
  );
}
