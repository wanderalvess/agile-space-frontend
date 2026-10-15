'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { greetingFor, type HeroChip } from '@/hooks/home/derive';
import { cn } from '@/lib/utils';
import { FOCUS_RING, LIFT, TINT_BG, TINT_TEXT, TITLE_GRADIENT } from './home-ui';

const subscribeNever = () => () => {};

interface Props {
  firstName: string;
  chips: HeroChip[];
}

/** Saudação, chips de contexto e os dois atalhos de criação. */
export function HomeHero({ firstName, chips }: Props) {
  // A hora vem do navegador; no servidor (e na hidratação) fica o "Olá" neutro, sem divergir do HTML.
  const greeting = useSyncExternalStore(subscribeNever, () => greetingFor(new Date().getHours()), () => 'Olá');

  return (
    <section aria-label="Saudação" className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-col gap-2.5">
        <h1 className={cn('text-4xl font-bold leading-[1.1] tracking-tight sm:text-[44px]', TITLE_GRADIENT)}>
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-[13px]">
            {chips.map((c) => (
              <li
                key={c.text}
                className={cn(
                  'inline-flex h-7 items-center rounded-full px-3',
                  c.brand ? cn(TINT_BG, TINT_TEXT, 'font-semibold') : 'border border-border bg-muted/40 text-muted-foreground',
                )}
              >
                {c.text}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/retro?nova=1"
          className={cn(
            'inline-flex h-[42px] items-center justify-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60',
            LIFT,
            FOCUS_RING,
          )}
        >
          Nova retro
        </Link>
        <Link
          href="/room?nova=1"
          className={cn(
            'inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90',
            LIFT,
            FOCUS_RING,
          )}
        >
          <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          Nova sessão de poker
        </Link>
      </div>
    </section>
  );
}
