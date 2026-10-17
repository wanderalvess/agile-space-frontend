'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PAGE_CARD } from '@/components/page';
import { hubHref } from '@/lib/squad-hub';
import type { BoardColumn } from '@/lib/squad-summary';
import { cn } from '@/lib/utils';

const ACCENT: Record<BoardColumn['id'], string> = {
  todo: 'text-muted-foreground',
  doing: 'text-amber-700 dark:text-amber-400',
  done: 'text-emerald-700 dark:text-emerald-400',
};

/** Board resumido da sprint: três colunas por categoria do Jira, até 3 cartões em cada. */
export function SprintBoard({ columns, myKeys }: { columns: BoardColumn[]; myKeys: Set<string> }) {
  return (
    <section className={cn(PAGE_CARD, 'flex-1 p-5')} aria-label="Board da sprint">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">Board da sprint</h2>
        <Link
          href={hubHref('quadro')}
          className="inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground max-sm:min-h-11"
        >
          Board completo <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {columns.map((col) => (
          <div key={col.id} className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className={cn('text-[13px] font-semibold', ACCENT[col.id])}>{col.label}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{col.items.length}</span>
            </div>

            {col.items.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">nada por aqui</p>
            ) : (
              col.items.slice(0, 3).map((item) => {
                const mine = myKeys.has(item.key);
                return (
                  <article
                    key={item.key}
                    className={cn('min-w-0 rounded-lg border bg-card p-2.5', mine ? 'border-primary/50' : 'border-border')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{item.key}</span>
                      {mine && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">seu</span>}
                    </div>
                    {/* O snapshot do squad não guarda o summary da issue (só parent_title): sem título inventado. */}
                    <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-foreground">
                      {item.title || item.parentTitle || item.assigneeName || 'sem responsável'}
                    </p>
                  </article>
                );
              })
            )}

            {col.items.length > 3 && <span className="text-center text-xs text-muted-foreground">e mais {col.items.length - 3}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
