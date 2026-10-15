'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { formatCountdown } from '@/lib/ceremony-countdown';
import { liveMeta, type UpcomingCeremony } from '@/hooks/home/derive';
import type { ToolSession } from '@/hooks/home/types';
import { cn } from '@/lib/utils';
import { CARD, FOCUS_RING, IconTile, LIFT, LiveDot, SectionHeading, TOOL_ICON } from './home-ui';

interface Props {
  sessions: ToolSession[];
  /** Mostra a tag da squad em cada card (só para quem acompanha mais de uma). */
  showSquad: boolean;
  /** Próximas cerimônias para o estado vazio. */
  upcoming: UpcomingCeremony[];
  now: Date;
}

function whenLabel(c: UpcomingCeremony, now: Date): string {
  return formatCountdown(c.start, now).label;
}

export function LiveNow({ sessions, showSquad, upcoming, now }: Props) {
  const hasLive = sessions.length > 0;

  return (
    <section aria-labelledby="home-live" className="flex flex-col gap-3">
      <SectionHeading id="home-live">
        {hasLive && <LiveDot />}
        Ao vivo agora
      </SectionHeading>

      {hasLive ? (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => (
            <li key={`${s.tool}:${s.id}`}>
              <Link
                href={s.href}
                className={cn(CARD, 'flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:border-primary/40', LIFT, FOCUS_RING)}
              >
                <IconTile icon={TOOL_ICON[s.tool]} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{s.title}</span>
                    {showSquad && (
                      <span className="inline-flex h-[18px] shrink-0 items-center rounded-[5px] border border-border px-1.5 text-[10px] font-bold text-muted-foreground">
                        {s.squadName}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{liveMeta(s)}</span>
                </span>
                <span className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary px-3 text-[13px] font-bold text-primary-foreground">
                  Entrar
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={cn(CARD, 'flex flex-wrap items-center gap-4 border-dashed px-5 py-[18px]')}>
          <IconTile icon={CalendarDays} size="lg" muted className="h-11 w-11 rounded-xl" />
          <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
            <p className="text-[15px] font-bold">Nenhuma sessão acontecendo agora</p>
            {upcoming.length > 0 && (
              <p className="text-[13px] text-muted-foreground">
                Próximas cerimônias:{' '}
                {upcoming.map((c, i) => (
                  <span key={`${c.title}:${c.start.getTime()}`}>
                    {i > 0 && ' · '}
                    <strong className={cn('font-semibold', i === 0 && 'text-foreground')}>
                      {c.title} · {whenLabel(c, now)}
                    </strong>
                  </span>
                ))}
              </p>
            )}
          </div>
          <Link
            href="/room"
            className={cn(
              'inline-flex h-[42px] items-center justify-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60',
              FOCUS_RING,
            )}
          >
            Preparar o refinamento
          </Link>
        </div>
      )}
    </section>
  );
}
