'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CloudOff, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { historyMeta, isLive, ritualFacts, statusLabel, toolCreateHref, toolListHref } from '@/hooks/home/derive';
import type { RitualKey, SessionStatus, ToolSession } from '@/hooks/home/types';
import { cn } from '@/lib/utils';
import { moduleLabel } from '@/lib/modules-registry';
import { CARD, FOCUS_RING, IconTile, ORB, RetryButton, SectionHeading, StatusChip, TOOL_ICON } from './home-ui';
import { RitualArt } from './RitualArt';

interface RitualDef {
  key: RitualKey;
  title: string;
  description: string;
  cta: string;
  highlight?: boolean;
}

const RITUALS: RitualDef[] = [
  { key: 'poker', title: moduleLabel('poker'), description: 'Estimativa em horas por papel, ao vivo ou assíncrona.', cta: 'Nova sessão de poker', highlight: true },
  { key: 'retro', title: moduleLabel('retro'), description: 'Correu bem, melhorar e ações, com votação por pontos.', cta: 'Nova retro' },
  { key: 'showcase', title: moduleLabel('showcase'), description: 'Review da sprint com evidências e modo Teatro.', cta: 'Nova review' },
  { key: 'health', title: moduleLabel('health'), description: 'Health check anônimo do time.', cta: 'Novo radar' },
  { key: 'brainstorming', title: moduleLabel('brainstorming'), description: 'Mural, grupos, matriz e plano em 5 fases.', cta: 'Novo brainstorming' },
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
  /** A última busca falhou: sem lista, "nenhuma sessão" seria enganoso. */
  failed?: boolean;
  /** "Tentar de novo" dos avisos de histórico indisponível (refaz a busca; `loading` fica true enquanto isso). */
  onRetry?: () => void;
  showSquad: boolean;
  /** "Squad Phoenix" ou "Todas as squads" (só com várias squads; vazio com uma), exibido no painel lateral. */
  scopeLabel: string;
  now: Date;
}

export function RitualsSection({ history, loading, failed = false, onRetry, showSquad, scopeLabel, now }: Props) {
  const [openKey, setOpenKey] = useState<RitualKey | null>(null);
  const open = RITUALS.find((r) => r.key === openKey);
  const sessions = openKey ? history[openKey].slice(0, MAX_HISTORY_ITEMS) : [];
  const anyUnavailable = failed && RITUALS.some((r) => history[r.key].length === 0);

  return (
    <section aria-labelledby="home-rituals" className="flex flex-col gap-3">
      <SectionHeading id="home-rituals">Rituais do time</SectionHeading>

      {/* Região sempre montada: o leitor de tela anuncia o aviso quando ele aparece. */}
      <div aria-live="polite">
        {anyUnavailable && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-border bg-card px-4 py-2.5">
            <CloudOff aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">Histórico indisponível agora.</p>
            {onRetry && <RetryButton onRetry={onRetry} busy={loading} />}
          </div>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {RITUALS.map((r) => {
          const noData = failed && history[r.key].length === 0;
          const facts = loading ? [] : noData ? ['Histórico indisponível'] : ritualFacts(history[r.key], now);
          const liveNow = history[r.key].some(isLive);
          return (
            <li key={r.key} className={cn(r.key === 'brainstorming' && 'sm:col-span-2 lg:col-span-1')}>
              <motion.button
                type="button"
                whileHover="hover"
                onClick={() => setOpenKey(r.key)}
                aria-haspopup="dialog"
                className={cn(
                  CARD,
                  'group relative flex h-full min-h-[300px] w-full flex-col gap-3 overflow-hidden rounded-[24px] p-6 text-left shadow-lg transition-[border-color,box-shadow] duration-300 hover:border-primary/50 hover:shadow-2xl dark:shadow-none',
                  r.highlight && 'border-primary/40',
                  FOCUS_RING,
                )}
              >
                <span aria-hidden="true" className={cn('pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-125', ORB)} />
                <span className="relative flex items-center justify-between">
                  <span className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-110">
                    <IconTile icon={TOOL_ICON[r.key]} size="lg" />
                  </span>
                  {liveNow && (
                    <span className="inline-flex h-6 items-center rounded-full bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Ao vivo</span>
                  )}
                </span>
                <span className="relative flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-xl font-bold leading-tight transition-colors group-hover:text-primary [.theme-totvs:not(.dark)_&]:group-hover:text-foreground">
                    {r.title}
                    <ArrowUpRight aria-hidden="true" className="h-4 w-4 -translate-x-0.5 translate-y-0.5 text-primary opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" strokeWidth={1.75} />
                  </span>
                  <span className="text-[13px] leading-relaxed text-muted-foreground">{r.description}</span>
                </span>
                <RitualArt ritual={r.key} />
                <span className="relative mt-auto flex flex-wrap gap-1.5">
                  {facts.map((f) => (
                    <span key={f} className="inline-flex h-6 items-center rounded-full border border-border bg-muted/40 px-2.5 text-xs">
                      {f}
                    </span>
                  ))}
                </span>
                <span className="relative inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-opacity group-hover:opacity-90 [.theme-totvs:not(.dark)_&]:text-foreground">
                  Ver sessões de {r.title.toLowerCase()}
                </span>
              </motion.button>
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
                  {scopeLabel ? <SheetDescription>{scopeLabel}</SheetDescription> : null}
                </div>
              </div>
              <div className="flex gap-2 border-b border-border px-5 py-4">
                <Link
                  href={toolCreateHref(open.key)}
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
                <h3 className="px-1.5 pb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Sessões anteriores</h3>
                {loading && !failed ? (
                  <div aria-hidden="true" className="flex flex-col gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-[66px] rounded-xl border border-border bg-muted/30 motion-safe:animate-pulse" />
                    ))}
                  </div>
                ) : sessions.length === 0 ? (
                  <div aria-live="polite" className="flex flex-col items-center gap-3 px-1.5 py-8 text-center">
                    <p className="text-sm text-muted-foreground">{failed ? 'Não foi possível carregar o histórico agora' : 'Nenhuma sessão ainda'}</p>
                    {failed && onRetry && <RetryButton onRetry={onRetry} busy={loading} />}
                  </div>
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
                                <span className="inline-flex h-[18px] shrink-0 items-center rounded-[5px] border border-border px-1.5 text-xs font-bold text-muted-foreground">
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
