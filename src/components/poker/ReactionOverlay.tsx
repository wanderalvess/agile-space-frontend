'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { REACTION_KINDS, reactionKindOf } from '@/components/room-kit';

export interface RoomReaction { id: string; uid: string; emoji: string; ts: string; nickname?: string }

/** Quanto tempo a bolha de reação fica na mesa (a animação sobe e some em 2,2 s). */
const LIFETIME_MS = 2400;

/**
 * Barra de reações da mesa (ícones, não emoji). O valor enviado ao servidor é o
 * `id` do tipo ("agree", "doubt"...), no mesmo campo `emoji` de sempre; reações
 * antigas em emoji continuam aparecendo como o tipo equivalente.
 */
export function ReactionBar({ onReact }: { onReact: (kind: string) => void }) {
  return (
    <div role="group" aria-label="Reações" className="flex gap-1 rounded-full border border-border bg-muted/50 p-1">
      {REACTION_KINDS.map((k) => (
        <button
          key={k.id}
          type="button"
          aria-label={k.label}
          title={k.label}
          onClick={() => onReact(k.id)}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-card transition-transform duration-fast hover:-translate-y-0.5 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
        >
          <k.icon className={cn('h-4 w-4', k.tone.split(' ').filter((c) => c.includes('text-')).join(' '))} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/** Bolhas que sobem na borda direita da mesa: "Ana · Concordo". */
export function ReactionBubbles({ reactions }: { reactions: RoomReaction[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const recent = reactions.filter((r) => {
    const t = new Date(r.ts).getTime();
    return !isNaN(t) && now - t < LIFETIME_MS;
  });

  return (
    <div aria-live="polite" className="pointer-events-none absolute bottom-16 right-6 z-[3] h-0 w-72">
      {recent.map((r, idx) => {
        const kind = reactionKindOf(r.emoji);
        return (
          <span
            key={r.id}
            className="room-float absolute bottom-0 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-xs font-medium shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
            style={{ left: `${(idx * 47) % 140}px` }}
          >
            <span className={cn('flex h-[22px] w-[22px] items-center justify-center rounded-full', kind.tone)}>
              <kind.icon className="h-[13px] w-[13px]" strokeWidth={1.5} aria-hidden="true" />
            </span>
            {r.nickname ? `${r.nickname.split(/\s+/)[0]} · ` : ''}{kind.label}
          </span>
        );
      })}
    </div>
  );
}
