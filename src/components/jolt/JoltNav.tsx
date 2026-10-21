'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/components/room-kit/tokens';

const TABS = [
  { href: '/jolt', label: 'Início', id: 'inicio' },
  { href: '/jolt/sandbox', label: 'Sandbox', id: 'sandbox' },
  { href: '/jolt/gerador', label: 'Gerador', id: 'gerador' },
] as const;

export type JoltTab = (typeof TABS)[number]['id'];

/** Barra do módulo: Início, Sandbox e Gerador, e o atalho para o JSON Studio. */
export function JoltNav({ active }: { active: JoltTab }) {
  return (
    <nav aria-label="Seções do Jolt" className="-mt-1 flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={t.id === active ? 'page' : undefined}
          className={cn(
            '-mb-px inline-flex h-11 items-center whitespace-nowrap border-b-2 px-4 text-sm transition-colors duration-fast',
            t.id === active ? 'border-primary font-bold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {t.label}
        </Link>
      ))}
      <span className="flex-1" />
      <Link
        href="/devtools/data-studio"
        className={cn('inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[13px] text-muted-foreground hover:text-foreground', FOCUS_RING)}
      >
        JSON Studio
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      </Link>
    </nav>
  );
}

/** Cabeçalho do portal para a página do Jolt: enxuto (só "Entrar") para visitante. */
export function joltHeaderProps(isGuest: boolean) {
  if (!isGuest) return undefined;
  const here = typeof window === 'undefined' ? '/jolt' : window.location.pathname + window.location.search;
  return { squadControl: null, minimal: true, signInHref: `/login?returnUrl=${encodeURIComponent(here)}` } as const;
}
