'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';

/** Par rótulo + valor (conta do Jira, dados da pessoa). */
export function DetailItem({ icon: Icon, label, value, mono, leading }: { icon: LucideIcon; label: string; value?: string; mono?: boolean; leading?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      {leading ?? <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />}
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={cn('truncate text-[13px] font-medium text-foreground', mono && 'font-code')} title={value || undefined}>
          {value || '—'}
        </dd>
      </div>
    </div>
  );
}

/** Botão de texto discreto (ação dentro de cartão), com alvo de 44 px no celular. */
export const TEXT_ACTION = cn(
  'inline-flex items-center gap-1.5 rounded-md px-1 text-[13px] font-semibold text-primary underline-offset-2 hover:underline max-sm:min-h-11',
  '[.theme-totvs:not(.dark)_&]:text-foreground',
  FOCUS_RING,
);
