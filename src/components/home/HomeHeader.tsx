'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import type { SquadSummary } from '@/hooks/home/types';
import { cn } from '@/lib/utils';
import { FOCUS_RING, TINT_TEXT } from './home-ui';
import { NotificationCenter } from './NotificationCenter';
import { ProfileMenu } from './ProfileMenu';
import { SquadSwitcher } from './SquadSwitcher';

interface Props {
  squads: SquadSummary[];
  scope: string | null;
  isMulti: boolean;
  switchingTo: string | null;
  onPickSquad: (squadId: string | null) => void;
  query: string;
  onQueryChange: (value: string) => void;
}

/** Cabeçalho da Home. A marca é só texto: o portal não tem logo nem mascote. */
export function HomeHeader({ squads, scope, isMulti, switchingTo, onPickSquad, query, onQueryChange }: Props) {
  return (
    <header className="z-40 border-b md:sticky md:top-0 border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-3.5 gap-y-2.5 px-4 py-3 sm:px-8 2xl:px-12">
        <Link href="/" className={cn('order-1 flex flex-col rounded-md leading-tight', FOCUS_RING)}>
          <span className="text-[15px] font-bold">
            Portal Tech <span className={TINT_TEXT}>V&amp;D</span>
          </span>
          <span className="text-[11px] text-muted-foreground">TOTVS · Varejo e Distribuição</span>
        </Link>

        <div className="order-3 md:order-2">
          <SquadSwitcher squads={squads} scope={scope} isMulti={isMulti} switchingTo={switchingTo} onPick={onPickSquad} />
        </div>

        <div className="relative order-4 w-full md:order-3 md:mx-auto md:w-auto md:max-w-[420px] md:flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <label htmlFor="home-module-search" className="sr-only">
            Buscar módulo
          </label>
          <input
            id="home-module-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar módulo ou ferramenta"
            autoComplete="off"
            className={cn(
              'h-10 w-full rounded-[10px] border border-border bg-muted/40 pl-[38px] pr-3 text-sm text-foreground placeholder:text-muted-foreground',
              FOCUS_RING,
            )}
          />
        </div>

        <div className="order-2 ml-auto flex items-center gap-2.5 md:order-4 md:ml-0">
          <NotificationCenter />
          <ThemeToggle className="h-10 w-10 rounded-[10px] max-sm:h-11 max-sm:w-11" />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
