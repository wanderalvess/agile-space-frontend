'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { historyMeta, isLive, ritualFacts, statusLabel, toolListHref } from '@/hooks/home/derive';
import type { RitualKey, SessionStatus, ToolSession } from '@/hooks/home/types';
import { cn } from '@/lib/utils';
import { CARD, FOCUS_RING, IconTile, LIFT, ORB, SectionHeading, StatusChip, TOOL_ICON } from './home-ui';

interface RitualDef {
  key: RitualKey;
  title: string;
  description: string;
  cta: string;
  span: string;
  highlight?: boolean;
}

const RITUALS: RitualDef[] = [
  { key: 'poker', title: 'Planning Poker', description: 'Estimativa em horas por papel, ao vivo ou assíncrona.', cta: 'Nova sessão de poker', span: 'sm:col-span-2 lg:col-span-6', highlight: true },
  { key: 'retro', title: 'Retrospectiva', description: 'Correu bem, melhorar e ações, com votação por pontos.', cta: 'Nova retro', span: 'sm:col-span-2 lg:col-span-6' },
  { key: 'showcase', title: 'Showcase', description: 'Review da sprint com evidências e modo Teatro.', cta: 'Novo showcase', span: 'lg:col-span-4' },
  { key: 'health', title: 'Radar de clima', description: 'Health check anônimo do time.', cta: 'Novo radar', span: 'lg:col-span-4' },
  { key: 'brainstorming', title: 'Brainstorming', description: 'Mural, grupos, matriz e plano em 5 fases.', cta: 'Novo brainstorming', span: 'sm:col-span-2 lg:col-span-4' },
];

const MAX_HISTORY_ITEMS = 12;

function chipTone(status: SessionStatus): 'live' | 'neutral' | 'done' {
  if (status === 'live') return 'live';
  if (status === 'done') return 'done';
  return 'neutral';
}

interface Props {
  history: Record<RitualKey, ToolSession[]>;
  loading: boolean;
  showSquad: boolean;
  /** "Squad Phoenix" ou "Todas as squads", exibido no painel lateral. */
  scopeLabel: string;
  now: Date;
}

export function RitualsSection({ history, loading, showSquad, scopeLabel, now }: Props) {
  const [openKey, setOpenKey] = useState<RitualKey | null>(null);
  const open = RITUALS.find((r) => r.key === openKey);
  const sessions = openKey ? history[openKey].slice(0, MAX_HISTORY_ITEMS) : [];

  return (
    <section aria-labelledby="home-rituals" className="flex flex-col gap-3">
      <SectionHeading id="home-rituals">Rituais do time</SectionHeading>

      <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-12">
        {RITUALS.map((r) => {
          const facts = loading ? [] : ritualFacts(history[r.key], now);
          const liveNow = history[r.key].some(isLive);
          return (
            <li key={r.key} className={r.span}>
              <button
                type="button"
                onClick={() => setOpenKey(r.key)}
                aria-haspopup="dialog"
                className={cn(
                  CARD,
                  'relative flex min-h-[170px] w-full flex-col gap-2.5 overflow-hidden rounded-[18px] p-5 text-left transition-colors hover:border-primary/40',
                  r.highlight && 'border-primary/40',
                  LIFT,
                  FOCUS_RING,
                )}
              >
                <span aria-hidden="true" className={cn('pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full', ORB)} />
                <span className="relative flex items-center gap-2.5">
                  <IconTile icon={TOOL_ICON[r.key]} />
                  <span className="text-lg font-bold">{r.title}</span>
                </span>
                <span className="relative text-[13px] leading-relaxed text-muted-foreground">{r.description}</span>
                <span className="relative mt-auto flex flex-wrap gap-1.5">
                  {facts.map((f, i) => (
                    <span
                      key={f}
                      className={cn(
                        'inline-flex h-6 items-center rounded-full border border-border bg-muted/40 px-2.5 text-xs',
                        i === 0 && liveNow && 'border-transparent bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {f}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenKey(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 border-l border-border bg-card p-0 sm:max-w-[480px]">
          {open && (
            <>
              <div className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-5 pr-12">
                <IconTile icon={TOOL_ICON[open.key]} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <SheetTitle className="text-xl font-bold">{open.title}</SheetTitle>
                  <SheetDescription>{scopeLabel}</SheetDescription>
                </div>
              </div>
              <div className="flex gap-2 border-b border-border px-5 py-4">
                <Link
                  href={toolListHref(open.key)}
                  className={cn(
                    'inline-flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90',
                    FOCUS_RING,
                  )}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                  {open.cta}
                </Link>
                <Link
                  href={toolListHref(open.key)}
                  className={cn(
                    'inline-flex h-[42px] items-center justify-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/60',
                    FOCUS_RING,
                  )}
                >
                  Ver todas
                </Link>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-4 pb-5 pt-3.5">
                <h3 className="px-1.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sessões anteriores</h3>
                {loading ? (
                  <div aria-hidden="true" className="flex flex-col gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-[66px] rounded-xl border border-border bg-muted/30 motion-safe:animate-pulse" />
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="px-1.5 py-8 text-center text-sm text-muted-foreground">Nenhuma sessão ainda</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {sessions.map((s) => (
                      <li key={`${s.tool}:${s.id}`}>
                        <Link
                          href={s.href}
                          onClick={() => setOpenKey(null)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50',
                            FOCUS_RING,
                          )}
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">{s.title}</span>
                              {showSquad && (
                                <span className="inline-flex h-[18px] shrink-0 items-center rounded-[5px] border border-border px-1.5 text-[10px] font-bold text-muted-foreground">
                                  {s.squadName}
                                </span>
                              )}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{historyMeta(s, now)}</span>
                          </span>
                          <StatusChip tone={chipTone(s.status)}>{statusLabel(s.status, s.tool)}</StatusChip>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
