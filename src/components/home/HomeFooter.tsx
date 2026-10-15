'use client';

import Link from 'next/link';
import { MessageSquareHeart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from './home-ui';

/** Rodapé da Home: sem logo, só o nome do portal e os atalhos de sempre. */
export function HomeFooter({ onOpenFeedback }: { onOpenFeedback: () => void }) {
  const linkClass = cn(
    'inline-flex h-8 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
    FOCUS_RING,
  );
  return (
    <footer className="relative mt-auto border-t border-border">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Portal Tech V&amp;D</span> · TOTVS · © 2026
        </p>
        <nav aria-label="Links úteis do rodapé" className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={onOpenFeedback} className={cn(linkClass, 'gap-1.5')}>
            <MessageSquareHeart aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            Feedback
          </button>
          <Link href="/changelog" className={linkClass}>
            Versões
          </Link>
          <Link href="/manual" className={linkClass}>
            Manual
          </Link>
        </nav>
      </div>
    </footer>
  );
}
