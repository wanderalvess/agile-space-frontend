'use client';

import Link from 'next/link';
import { ArrowRight, LifeBuoy } from 'lucide-react';
import { STATUS_META, TICKET_STATUSES } from '@/components/admin/tickets/ticket-utils';
import { GuideSheet, IconTile } from '@/components/room-kit';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { SUPPORT_TYPES } from './support-utils';

const STATUS_HELP: Record<(typeof TICKET_STATUSES)[number], string> = {
  OPEN: 'recebido, ainda sem atendimento.',
  IN_PROGRESS: 'o time está cuidando.',
  CLOSED: 'resolvido ou encerrado. Você pode reabrir.',
};

const SHORTCUTS = [
  { href: '/manual', label: 'Manual do portal' },
  { href: '/changelog', label: 'Versões e novidades' },
] as const;

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-bold text-muted-foreground">{label}</h3>
      {children}
    </section>
  );
}

function GuideBody() {
  return (
    <div className="flex flex-col gap-4">
      <Section label="Qual tipo escolher">
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {SUPPORT_TYPES.map((t) => (
            <li key={t.id} className="flex items-start gap-3">
              <IconTile icon={t.icon} tone="neutral" size="sm" />
              <span className="flex flex-col text-sm">
                <strong className="font-semibold text-foreground">{t.label}</strong>
                <span className="text-muted-foreground">{t.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section label="Status">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {TICKET_STATUSES.map((s) => (
            <li key={s}>
              <strong className="font-semibold text-foreground">{STATUS_META[s].label}</strong> <span className="text-muted-foreground">- {STATUS_HELP[s]}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section label="Antes de abrir">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {SHORTCUTS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className={cn('flex items-center gap-2.5 rounded-[10px] border border-border px-3 py-2.5 text-sm font-semibold text-foreground transition-colors duration-fast hover:bg-accent', FOCUS_RING)}
              >
                {s.label}
                <span className="flex-1" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/** Guia do Suporte em folha lateral: qual tipo escolher, o que cada status quer dizer e atalhos para Manual e Versões. */
export function SupportGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <GuideSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Guia do Suporte"
      description="Como abrir e acompanhar uma solicitação"
      icon={LifeBuoy}
      tabs={[{ id: 'guia', label: 'Como funciona', content: <GuideBody /> }]}
    />
  );
}
