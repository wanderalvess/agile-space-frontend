'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Link2 } from 'lucide-react';
import { FOCUS_RING } from '@/components/room-kit';
import type { BoardOrigin } from '@/lib/action-plan-origin';
import { cn } from '@/lib/utils';

/**
 * Faixa "Criado a partir de Radar de clima «Sprint 42»" no topo do plano, com o caminho de volta à sessão que o
 * originou. Só aparece quando o plano nasceu de uma cerimônia (nunca em plano manual nem num servidor sem origem).
 */
export function PlanOriginBanner({ origin }: { origin: BoardOrigin | null }) {
  if (!origin) return null;
  return (
    <div
      role="note"
      aria-label="Origem do plano"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground"
    >
      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">
        Criado a partir de <strong className="font-semibold">{origin.label}</strong>
        {origin.title ? <> «{origin.title}»</> : null}
      </span>
      {origin.href && (
        <Link
          href={origin.href}
          aria-label={`Abrir ${origin.label} de origem`}
          className={cn('inline-flex min-h-8 items-center gap-1 rounded-md font-semibold underline-offset-2 hover:underline max-xl:min-h-11', FOCUS_RING)}
        >
          Abrir a sessão <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
