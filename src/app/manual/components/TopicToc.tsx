'use client';

import { useEffect, useState } from 'react';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import type { TopicHeading } from '../data/search';

/** "Neste tópico": links para as seções, com a seção que está na tela marcada. */
export function TopicToc({ headings }: { headings: TopicHeading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || headings.length === 0) return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = headings.find((h) => seen.get(h.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="Neste tópico" className="flex flex-col gap-0.5">
      <p className="mb-1.5 ml-3 text-xs font-bold text-muted-foreground">Neste tópico</p>
      {headings.map((h) => {
        const on = h.id === active;
        return (
          <a
            key={h.id}
            href={`#${h.id}`}
            onClick={() => setActive(h.id)}
            aria-current={on ? 'location' : undefined}
            className={cn(
              'rounded-r-md border-l-2 py-1.5 pl-3 pr-2 text-sm leading-snug hover:text-foreground',
              on ? 'border-primary font-bold text-foreground' : 'border-transparent font-medium text-muted-foreground',
              FOCUS_RING,
            )}
          >
            {h.text}
          </a>
        );
      })}
    </nav>
  );
}
