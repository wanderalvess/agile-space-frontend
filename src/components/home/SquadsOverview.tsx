'use client';

import { formatCountdown } from '@/lib/ceremony-countdown';
import { sprintLabel } from '@/hooks/home/derive';
import type { SquadSummary } from '@/hooks/home/types';
import { cn } from '@/lib/utils';
import { CARD, FOCUS_RING, LIFT, SectionHeading } from './home-ui';

interface Props {
  squads: SquadSummary[];
  /** Squad selecionada (filtra o "Ao vivo agora"); null = todas. */
  scope: string | null;
  liveBySquad: Record<string, number>;
  switchingTo: string | null;
  now: Date;
  onPick: (squadId: string | null) => void;
}

/** "Suas squads": só para quem acompanha mais de uma. Clicar filtra o ao vivo e troca a squad ativa. */
export function SquadsOverview({ squads, scope, liveBySquad, switchingTo, now, onPick }: Props) {
  return (
    <section aria-labelledby="home-squads" className="flex flex-col gap-3">
      <SectionHeading id="home-squads">Suas squads</SectionHeading>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {squads.map((s) => {
          const selected = scope === s.id;
          const live = liveBySquad[s.id] ?? 0;
          const label = sprintLabel(s.sprintName, s.daysLeft);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={!!switchingTo}
                onClick={() => onPick(selected ? null : s.id)}
                className={cn(
                  CARD,
                  'flex w-full flex-col gap-2.5 p-4 text-left transition-colors hover:border-primary/40 disabled:opacity-70',
                  selected && 'border-primary/60',
                  LIFT,
                  FOCUS_RING,
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-bold">{s.name}</span>
                  {live > 0 && (
                    <span className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                      {live} ao vivo
                    </span>
                  )}
                </span>
                {s.sprintPercent !== null ? (
                  <span className="flex flex-col gap-1.5">
                    <span className="flex justify-between text-xs text-muted-foreground">
                      <span>{label}</span>
                      <span>{s.sprintPercent}%</span>
                    </span>
                    <span
                      role="progressbar"
                      aria-label={`Progresso da sprint de ${s.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={s.sprintPercent}
                      className="h-[5px] overflow-hidden rounded-[3px] border border-border bg-muted/40"
                    >
                      <span className="block h-full rounded-[3px] bg-primary" style={{ width: `${s.sprintPercent}%` }} />
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Sem sprint sincronizada</span>
                )}
                {s.nextCeremony && (
                  <span className="text-xs text-muted-foreground">
                    Próxima: {s.nextCeremony.title} · {formatCountdown(s.nextCeremony.start, now).label}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
