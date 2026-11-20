'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUp, CheckCircle2, Check, Plus, RefreshCw } from 'lucide-react';
import { DataToolbar, EmptyState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { FOCUS_RING, ModalButton, StatusChip, TONES } from '@/components/room-kit';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import {
  KIND_LABEL,
  NO_FILTERS,
  TYPE_LABEL,
  applyFilters,
  countByType,
  formatLongDate,
  formatShortDate,
  groupByMonth,
  hasActiveFilters,
  monthLabel,
  newerThan,
  yearsOf,
  type ChangeKind,
  type ChangelogEntry,
  type Filters,
  type ReleaseType,
  type TypeFilter,
} from './releases';
import { compareTagsDesc } from './merge';

export type ChangelogLoadState = 'carregando' | 'pronto';

export interface ChangelogViewProps {
  entries: ChangelogEntry[];
  state: ChangelogLoadState;
  /** O servidor não respondeu: a lista mostrada é só a local. */
  serverError: boolean;
  onRetry: () => void;
  /** Tag do build em uso ("v4.24.0"). */
  runningTag: string;
  /** Há pessoa logada (sem sessão não existe "última visita"). */
  signedIn: boolean;
  /** Última versão vista por esta pessoa e quando. */
  seenTag: string | null;
  seenAt: string | null;
  /** O servidor publicou uma versão que este build ainda não tem. */
  serverAhead: string | null;
  onMarkAllRead: () => void;
  onUndoRead: () => void;
  /** Mostra o "Você está em dia" com Desfazer (acabou de marcar). */
  justRead: boolean;
  onReload: () => void;
}

const KIND_ICON: Record<ChangeKind, typeof Plus> = { novo: Plus, melhoria: ArrowUp, correcao: CheckCircle2 };
const KIND_TONE: Record<ChangeKind, string> = { novo: TONES.brand.chip, melhoria: TONES.neutral.chip, correcao: TONES.success.chip };
const TYPE_CHIP: Record<ReleaseType, string> = {
  major: 'bg-primary text-primary-foreground',
  minor: TONES.brand.chip,
  patch: cn(TONES.neutral.chip, 'border border-border'),
};

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
  { id: 'patch', label: 'Patch' },
];

function Pill({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-base hover:bg-accent max-sm:h-11',
        pressed ? 'border-primary/50 bg-primary/10 font-bold text-foreground dark:bg-primary/15' : 'border-border font-medium text-muted-foreground',
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

/** Tela Versões (sem a casca): versão em uso, novidades, busca e filtros, linha do tempo por mês e painel Navegar. */
export function ChangelogView({
  entries,
  state,
  serverError,
  onRetry,
  runningTag,
  signedIn,
  seenTag,
  seenAt,
  serverAhead,
  onMarkAllRead,
  onUndoRead,
  justRead,
  onReload,
}: ChangelogViewProps) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  const loading = state === 'carregando';
  const filtered = useMemo(() => applyFilters(entries, filters), [entries, filters]);
  const groups = useMemo(() => groupByMonth(filtered), [filtered]);
  const typeCounts = useMemo(() => countByType(entries, filters), [entries, filters]);
  const years = useMemo(() => yearsOf(entries), [entries]);
  const since = useMemo(() => (signedIn ? newerThan(entries, seenTag) : []), [entries, seenTag, signedIn]);
  const current = entries.find((e) => e.tag === runningTag) ?? null;
  const newestTag = entries[0]?.tag ?? null;
  const newerAvailable = serverAhead ?? (newestTag && compareTagsDesc(newestTag, runningTag) < 0 ? newestTag : null);
  const isEmpty = !loading && entries.length === 0;
  const noMatch = !loading && entries.length > 0 && filtered.length === 0 && hasActiveFilters(filters);
  const activeKey = activeMonth && groups.some((g) => g.key === activeMonth) ? activeMonth : (groups[0]?.key ?? null);
  const unseen = new Set(since.map((e) => e.tag));

  const goToMonth = (key: string) => {
    setActiveMonth(key);
    const el = document.getElementById(`m-${key}`);
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const isOpen = (tag: string, index: number) => open[tag] ?? index < 3;
  const indexOf = (tag: string) => entries.findIndex((e) => e.tag === tag);
  const HeaderIcon = moduleIcon('changelog');

  return (
    <>
      <section aria-label="Versão atual" className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-2xl border border-primary/30 bg-primary/10 px-6 py-5 dark:bg-primary/15">
        <div className="flex min-w-[260px] flex-col gap-1">
          <span className="text-[13px] text-muted-foreground">Versão em uso</span>
          <span className="text-[32px] font-bold leading-[1.1] tracking-tight text-foreground">Você está na {runningTag}</span>
          <span className="text-sm text-muted-foreground">{current ? `Publicada em ${formatLongDate(current.iso)}` : 'Versão deste portal'}</span>
        </div>
        {current && (
          <div className="flex min-w-[280px] flex-1 flex-col gap-1">
            <span className="text-base font-bold text-foreground">{current.title}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{current.description}</span>
          </div>
        )}
        {newerAvailable && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-sm">
              <strong className="font-bold">A {newerAvailable} já está disponível.</strong>
            </span>
            <ModalButton variant="primary" className="h-[34px] gap-2 px-3.5 text-[13px]" onClick={onReload}>
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
              Recarregar a página
            </ModalButton>
          </div>
        )}
      </section>

      {signedIn && since.length > 0 && !loading && (
        <section aria-label="Novidades desde a sua última visita" className={cn(PAGE_CARD, 'flex flex-col gap-3.5 px-5 py-4')}>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-foreground">O que há de novo desde a sua última visita</h2>
              {seenAt && <span className="text-[13px] text-muted-foreground">Você esteve aqui em {formatLongDate(seenAt.slice(0, 10))}</span>}
            </div>
            <ModalButton className="h-9 gap-2 text-[13px]" onClick={onMarkAllRead}>
              <Check aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              Marcar tudo como lido
            </ModalButton>
          </div>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {since.slice(0, 3).map((e) => (
              <li key={e.tag} className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-foreground">{e.tag}</span>
                  <span className="text-xs text-muted-foreground">{formatShortDate(e.iso)}</span>
                </span>
                <span className="text-sm leading-snug text-foreground">{e.changes[0]?.text ?? e.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {justRead && signedIn && since.length === 0 && (
        <div role="status" className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <Check aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          <span className="flex-1">Você está em dia. Marcamos a leitura neste navegador.</span>
          <button type="button" onClick={onUndoRead} className={cn('rounded-md px-1 text-[13px] font-bold underline', FOCUS_RING)}>
            Desfazer
          </button>
        </div>
      )}

      {serverError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 text-sm text-foreground">
          <AlertTriangle aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} />
          <span className="flex-1">Mostrando só a lista local; não conseguimos falar com o servidor.</span>
          <ModalButton className="h-[34px] gap-2 text-[13px]" onClick={onRetry}>
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
            Tentar de novo
          </ModalButton>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Busca e filtros" className="flex flex-col gap-3">
            <DataToolbar
              search={{
                value: filters.query,
                onChange: (query) => setFilters((f) => ({ ...f, query })),
                placeholder: 'Buscar por versão, título ou mudança',
                ariaLabel: 'Buscar nas versões',
              }}
              count={loading ? undefined : { shown: filtered.length, total: entries.length, noun: 'versões' }}
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-[13px] text-muted-foreground">Tipo</span>
                {TYPE_FILTERS.map((t) => (
                  <Pill key={t.id} pressed={filters.type === t.id} onClick={() => setFilters((f) => ({ ...f, type: t.id }))}>
                    {t.label}
                    <span className="font-normal text-muted-foreground">{typeCounts[t.id]}</span>
                  </Pill>
                ))}
              </div>
              {years.length > 0 && (
                <div role="group" aria-label="Filtrar por ano" className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-[13px] text-muted-foreground">Ano</span>
                  <Pill pressed={filters.year === 'todos'} onClick={() => setFilters((f) => ({ ...f, year: 'todos' }))}>
                    Todos
                  </Pill>
                  {years.map((y) => (
                    <Pill key={y} pressed={filters.year === y} onClick={() => setFilters((f) => ({ ...f, year: y }))}>
                      {y}
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          </section>

          {loading && <LoadingSkeleton variant="cards" rows={3} label="Carregando o histórico de versões" />}

          {isEmpty && (
            <EmptyState
              icon={HeaderIcon}
              title="Ainda não há versões publicadas"
              description="Quando a equipe publicar a primeira versão, ela aparece aqui."
              actions={
                <ModalButton onClick={onRetry}>Verificar de novo</ModalButton>
              }
            />
          )}

          {noMatch && (
            <EmptyState
              icon={HeaderIcon}
              title="Nenhuma versão com esses filtros"
              description="Tente outra palavra ou limpe os filtros."
              actions={
                <ModalButton variant="primary" onClick={() => setFilters(NO_FILTERS)}>
                  Limpar filtros
                </ModalButton>
              }
            />
          )}

          {!loading && groups.length > 0 && (
            <div className="flex flex-col">
              {groups.map((g) => (
                <section key={g.key} aria-labelledby={`h-m-${g.key}`} className="flex flex-col">
                  <div id={`m-${g.key}`} className="grid scroll-mt-24 grid-cols-[28px_minmax(0,1fr)] gap-4 pb-1.5 pt-2.5">
                    <span aria-hidden="true" className="flex justify-center">
                      <span className="w-0.5 rounded-sm bg-border" />
                    </span>
                    <h2 id={`h-m-${g.key}`} className="flex items-baseline gap-2.5 text-lg font-bold text-foreground">
                      {g.label}
                      <span className="text-[13px] font-normal text-muted-foreground">{monthLabel(g.entries.length)}</span>
                    </h2>
                  </div>
                  {g.entries.map((e) => {
                    const idx = indexOf(e.tag);
                    const expanded = isOpen(e.tag, idx);
                    const isCurrent = e.tag === runningTag;
                    const isNew = unseen.has(e.tag);
                    const highlight = isCurrent || isNew;
                    const panelId = `changes-${e.tag}`;
                    return (
                      <div key={e.tag} className="grid grid-cols-[28px_minmax(0,1fr)] gap-4">
                        <span aria-hidden="true" className="flex flex-col items-center">
                          <span className="h-7 w-0.5 bg-border" />
                          <span className={cn('box-border h-3.5 w-3.5 shrink-0 rounded-full border-2', highlight ? 'border-primary bg-primary' : 'border-border bg-background')} />
                          <span className="w-0.5 flex-1 bg-border" />
                        </span>
                        <article
                          aria-label={`Versão ${e.tag}`}
                          className={cn(PAGE_CARD, 'mb-3.5 flex flex-col gap-3 px-5 py-5 sm:px-[22px]', highlight && 'border-primary/50')}
                        >
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="text-xl font-bold tracking-tight text-foreground">{e.tag}</h3>
                            <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold', TYPE_CHIP[e.type])}>{TYPE_LABEL[e.type]}</span>
                            {isCurrent && <StatusChip tone="success" className="h-6 px-2.5 font-bold">Versão atual</StatusChip>}
                            {isNew && <span className="inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-bold text-primary-foreground">Nova</span>}
                            <span className="flex-1" />
                            <span className="text-[13px] text-muted-foreground">{formatLongDate(e.iso)}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-[17px] font-bold leading-snug text-foreground">{e.title}</p>
                            <p className="text-sm leading-relaxed text-muted-foreground">{e.description}</p>
                          </div>
                          {expanded && (
                            <ul id={panelId} className="grid grid-cols-1 gap-x-7 gap-y-2.5 border-t border-border pt-3 md:grid-cols-2">
                              {e.changes.map((c, i) => {
                                const Icon = KIND_ICON[c.kind];
                                return (
                                  <li key={`${e.tag}-${i}`} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                                    <span
                                      title={KIND_LABEL[c.kind]}
                                      className={cn('mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]', KIND_TONE[c.kind])}
                                    >
                                      <Icon aria-hidden="true" className="h-[13px] w-[13px]" strokeWidth={1.5} />
                                      <span className="sr-only">{KIND_LABEL[c.kind]}:</span>
                                    </span>
                                    <span>{c.text}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {e.changes.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setOpen((o) => ({ ...o, [e.tag]: !expanded }))}
                              aria-expanded={expanded}
                              aria-controls={expanded ? panelId : undefined}
                              className={cn('-ml-1 h-8 self-start rounded-lg px-3 text-[13px] font-bold text-primary hover:bg-accent max-sm:h-11 [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
                            >
                              {expanded ? 'Ocultar mudanças' : `Ver mais (${e.changes.length} ${e.changes.length === 1 ? 'mudança' : 'mudanças'})`}
                            </button>
                          )}
                        </article>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </div>

        <aside aria-label="Navegar" className="flex flex-col gap-3.5 lg:sticky lg:top-[88px]">
          <section className={cn(PAGE_CARD, 'flex flex-col gap-0.5 p-4')}>
            <h2 className="mb-2 text-[15px] font-bold text-foreground">Navegar</h2>
            {groups.length === 0 && <span className="px-2 py-1 text-[13px] text-muted-foreground">Nenhum mês para mostrar.</span>}
            {groups.map((g, i) => (
              <div key={g.key} className="contents">
                {(i === 0 || groups[i - 1].year !== g.year) && g.year && (
                  <span className="mb-1 ml-2 mt-2.5 text-xs font-bold tracking-wide text-muted-foreground">{g.year}</span>
                )}
                <button
                  type="button"
                  onClick={() => goToMonth(g.key)}
                  aria-current={activeKey === g.key ? 'true' : undefined}
                  className={cn(
                    'flex h-[34px] items-center gap-2 border-l-2 px-2 text-left text-sm transition-colors duration-base hover:bg-accent max-sm:h-11',
                    activeKey === g.key ? 'border-primary font-bold text-foreground' : 'border-transparent font-medium text-muted-foreground',
                    FOCUS_RING,
                  )}
                >
                  <span className="flex-1">{g.short}</span>
                  <span className="text-xs text-muted-foreground">{g.entries.length}</span>
                </button>
              </div>
            ))}
          </section>
          <section aria-label="Legenda" className="flex flex-col gap-2 rounded-2xl border border-border p-4">
            <h2 className="text-[15px] font-bold text-foreground">Tipos de mudança</h2>
            {(['novo', 'melhoria', 'correcao'] as ChangeKind[]).map((k) => {
              const Icon = KIND_ICON[k];
              return (
                <span key={k} className="flex items-center gap-2.5 text-[13px] text-foreground">
                  <span className={cn('flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]', KIND_TONE[k])}>
                    <Icon aria-hidden="true" className="h-[13px] w-[13px]" strokeWidth={1.5} />
                  </span>
                  {KIND_LABEL[k]}
                </span>
              );
            })}
          </section>
        </aside>
      </div>
    </>
  );
}
