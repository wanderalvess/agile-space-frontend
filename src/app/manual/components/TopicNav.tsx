'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { cn } from '@/lib/utils';
import { fold } from '../data/search';
import { MANUAL_CATEGORIES, MANUAL_TOPICS, topicsInCategory } from '../data/topics';

interface TopicNavListProps {
  currentId: string;
  onNavigate?: () => void;
}

/** Filtro por título e a lista de tópicos agrupada por categoria. O tópico aberto leva `aria-current="page"`. */
function TopicNavList({ currentId, onNavigate }: TopicNavListProps) {
  const [q, setQ] = useState('');
  const needle = fold(q.trim());
  const groups = MANUAL_CATEGORIES.map((c) => ({
    category: c,
    topics: topicsInCategory(c.id).filter((t) => !needle || fold(`${t.title} ${t.keywords.join(' ')}`).includes(needle)),
  })).filter((g) => g.topics.length > 0);

  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <label className="relative block">
        <span className="sr-only">Filtrar tópicos</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar tópicos"
          className={cn(
            'h-10 w-full rounded-[10px] border border-border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground max-sm:h-11',
            FOCUS_RING,
          )}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Limpar o filtro"
            className={cn('absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent', FOCUS_RING)}
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </label>

      <nav aria-label="Tópicos do manual" className="flex min-h-0 flex-col gap-1 overflow-y-auto pb-2">
        {groups.map(({ category, topics }) => (
          <div key={category.id} className="flex flex-col gap-0.5">
            <p className="mb-1 ml-2.5 mt-2 text-xs font-bold text-muted-foreground">{category.label}</p>
            {topics.map((t) => {
              const Icon = t.icon;
              const current = t.id === currentId;
              return (
                <Link
                  key={t.id}
                  href={`/manual/${t.id}`}
                  onClick={onNavigate}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-[9px] border px-2.5 text-sm max-sm:h-11',
                    current
                      ? 'border-primary/40 bg-primary/10 font-bold text-foreground dark:bg-primary/15'
                      : 'border-transparent font-medium text-muted-foreground hover:bg-accent hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {t.isNew && (
                    <>
                      <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full bg-primary" />
                      <span className="sr-only">Novo</span>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && <p className="px-2.5 py-2 text-sm text-muted-foreground">Nenhum tópico com esse nome.</p>}
      </nav>
    </div>
  );
}

/** Sumário fixo à esquerda (a partir de 1024 px). */
export function TopicNav({ currentId }: { currentId: string }) {
  return (
    <div className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] flex-col lg:flex">
      <TopicNavList currentId={currentId} />
    </div>
  );
}

/** No celular e no tablet o sumário vira uma folha lateral, aberta pelo botão "Tópicos". */
export function TopicNavSheet({ currentId }: { currentId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-accent',
              FOCUS_RING,
            )}
          >
            <Menu className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Tópicos ({MANUAL_TOPICS.length})
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-80 max-w-[85vw] flex-col gap-3 p-4">
          <SheetTitle className="text-base font-bold text-foreground">Tópicos do manual</SheetTitle>
          <SheetDescription className="sr-only">Escolha o tópico que quer ler.</SheetDescription>
          <TopicNavList currentId={currentId} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
