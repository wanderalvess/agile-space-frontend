'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Check, ChevronRight, History, Info, ListChecks, Plus, Search, Target, Timer, type LucideIcon } from 'lucide-react';
import { ErrorState, EmptyState } from '@/components/page';
import { FIELD, FOCUS_RING, IconTile, ModalButton, StatusChip, BRAND_TEXT, CARD_SHADOW } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import { parseServerDate } from '@/lib/server-time';
import { showcaseApi } from '@/app/showcase/api';
import type { ShowcaseSession } from './types';
import {
  HISTORY_FILTERS,
  HUB_CHECKLIST,
  decisionCounts,
  filterHistory,
  hubTotals,
  hubTotalsText,
  normalizeChecklist,
  normalizeReviewStatus,
  parseJoinInput,
  reviewStatusLabel,
  sessionActionLabel,
  sessionApprovalRate,
  sessionHref,
  sprintCaption,
  type HistoryStatusFilter,
  type ReviewStatus,
} from './review-room-logic';

export type HubState = 'loading' | 'ready' | 'error' | 'no-squad';

export interface ReviewHubProps {
  sessions: ShowcaseSession[];
  state: HubState;
  onRetry: () => void;
  onNewSession: () => void;
  isCreating: boolean;
}

const CARD = `rounded-2xl border border-border bg-card p-5 text-card-foreground sm:p-6 ${CARD_SHADOW}`;
const Icon = moduleIcon('showcase');

function statusTone(status: ReviewStatus) {
  return status === 'finished' ? 'success' : status === 'active' ? 'brand' : 'neutral';
}

function CardTitle({ icon: I, title, hint, sub, aside }: { icon: LucideIcon; title: string; hint?: string; sub?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={I} size="md" />
      <div className="flex min-w-0 flex-1 flex-col">
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        <h2 className="m-0 text-base font-bold leading-tight">{title}</h2>
        {sub && <span className="text-[13px] text-muted-foreground">{sub}</span>}
      </div>
      {aside}
    </div>
  );
}

/** Esqueleto do hub: cinco blocos no lugar dos cartões. */
function HubSkeleton() {
  return (
    <div role="status" aria-label="Carregando as Reviews" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <span className="sr-only">Carregando as Reviews…</span>
      {['lg:col-span-8 h-56', 'lg:col-span-4 h-56', 'lg:col-span-8 h-64', 'lg:col-span-4 h-64', 'lg:col-span-12 h-48'].map((c) => (
        <div key={c} aria-hidden="true" className={cn('rounded-2xl bg-muted motion-safe:animate-pulse', c)} />
      ))}
    </div>
  );
}

/** "Comece por aqui": Nova Review e entrar por ID ou link. */
function StartCard({ onNewSession, isCreating }: { onNewSession: () => void; isCreating: boolean }) {
  const router = useRouter();
  const [joinText, setJoinText] = useState('');
  const target = parseJoinInput(joinText);
  const helpId = 'review-join-help';

  const join = () => {
    if (target) router.push(`/showcase/${encodeURIComponent(target.id)}`);
  };

  return (
    <section aria-label="Comece por aqui" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle icon={Icon} title="Comece por aqui" sub="Crie uma Review nova ou entre numa que já existe com o ID ou o link." />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <ModalButton variant="primary" onClick={onNewSession} disabled={isCreating} className="h-11 gap-2 px-5 text-sm">
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Nova Review
        </ModalButton>
        <form
          onSubmit={(e) => { e.preventDefault(); join(); }}
          className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-border bg-muted/40 pl-3.5 pr-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30"
        >
          <label htmlFor="review-join" className="sr-only">ID ou link da sala</label>
          <input
            id="review-join"
            value={joinText}
            onChange={(e) => setJoinText(e.target.value)}
            placeholder="Entrar com o ID ou link da sala"
            autoComplete="off"
            aria-describedby={helpId}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!target}
            aria-label="Entrar na Review"
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40 max-sm:h-9 max-sm:w-9 [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </form>
      </div>
      <p id={helpId} className="m-0 text-xs text-muted-foreground" aria-live="polite">
        {target?.fromLink ? (
          <>ID reconhecido no link: <span className="font-mono font-semibold text-foreground">{target.id}</span></>
        ) : (
          'Cole o ID ou o link da Review. Maiúsculas e minúsculas contam.'
        )}
      </p>
    </section>
  );
}

/** Anel e números do "Métricas de aceite". */
function MetricsCard({ sessions }: { sessions: ShowcaseSession[] }) {
  const t = useMemo(() => hubTotals(sessions), [sessions]);
  return (
    <section aria-label="Métricas de aceite" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle icon={Target} title="Métricas de aceite" aside={<StatusChip tone="neutral">Do PO</StatusChip>} />
      <div className="flex items-center gap-5 py-1">
        <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`Taxa de aceite: ${t.acceptanceRate}%`}>
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9155" fill="none" strokeWidth="3.5" className="stroke-muted" />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${t.acceptanceRate}, 100`}
              className="stroke-primary transition-[stroke-dasharray] duration-slow motion-reduce:transition-none [.theme-totvs:not(.dark)_&]:stroke-foreground"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold leading-none tabular-nums">{t.acceptanceRate}%</span>
            <span className="mt-0.5 text-xs text-muted-foreground">aceite</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="text-2xl font-bold leading-none tabular-nums">
            {t.sessions} <span className="text-sm font-semibold text-muted-foreground">{t.sessions === 1 ? 'Review' : 'Reviews'}</span>
          </div>
          <p className="m-0 text-xs text-muted-foreground">{hubTotalsText(t)}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-border pt-3">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">Cards prontos</span>
          <span className={cn('font-bold tabular-nums', BRAND_TEXT)}>{t.readyRate}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Cards prontos: ${t.readyRate}%`}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-slow motion-reduce:transition-none" style={{ width: `${t.readyRate}%` }} />
        </div>
      </div>
    </section>
  );
}

/** Última Review: status, barra empilhada por decisão e o botão que depende do estado. */
function LastReviewCard({ session, loading }: { session: ShowcaseSession | null; loading?: boolean }) {
  const router = useRouter();
  if (!session) {
    return (
      <section aria-label="Última Review" className={cn(CARD, 'flex flex-col items-center justify-center gap-3 py-10 text-center')}>
        <IconTile icon={Icon} tone="neutral" size="lg" />
        <h2 className="m-0 text-base font-bold">{loading ? 'Carregando…' : 'Nenhuma Review ainda'}</h2>
        {!loading && <p className="m-0 max-w-sm text-sm text-muted-foreground">Crie a primeira Review para ver aqui o resumo das aprovações.</p>}
      </section>
    );
  }
  const status = normalizeReviewStatus(session.status, session.updatedAt);
  const c = decisionCounts(session.tasks || []);
  const pct = (n: number) => (c.total > 0 ? (n / c.total) * 100 : 0);
  const segments = [
    { label: 'Aprovados', n: c.approved, bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    { label: 'Ajustes', n: c.adjustment, bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    { label: 'Rejeitados', n: c.rejected, bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
    { label: 'Pendentes', n: c.pending, bar: 'bg-muted-foreground/30', text: 'text-muted-foreground' },
  ];
  return (
    <section aria-label="Última Review" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle icon={Timer} title="Última Review" aside={<StatusChip tone={statusTone(status)} dot={status === 'active'}>{reviewStatusLabel(status)}</StatusChip>} />
      <div className="flex flex-col gap-0.5">
        <h3 className="m-0 truncate text-xl font-bold leading-tight" title={session.name}>{session.name}</h3>
        <p className="m-0 text-[13px] text-muted-foreground">{sprintCaption(session)}</p>
      </div>
      {c.total > 0 ? (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={segments.map((s) => `${s.label}: ${s.n}`).join(', ')}>
            {segments.map((s) => (
              <div key={s.label} className={s.bar} style={{ width: `${pct(s.n)}%` }} title={`${s.label}: ${s.n}`} />
            ))}
          </div>
          <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {segments.map((s) => (
              <div key={s.label} className="flex flex-col items-center rounded-xl border border-border bg-muted/40 px-2 py-2.5 text-center">
                <dd className={cn('m-0 text-lg font-bold leading-none tabular-nums', s.text)}>{s.n}</dd>
                <dt className="mt-1 text-xs text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="m-0 py-3 text-sm text-muted-foreground">Nenhuma tarefa importada nesta Review.</p>
      )}
      <div className="mt-auto flex justify-end border-t border-border pt-3">
        <ModalButton variant="primary" className="gap-1.5" onClick={() => router.push(sessionHref(session.id, status))}>
          {sessionActionLabel(status)} <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </ModalButton>
      </div>
    </section>
  );
}

/** Passo a passo: marcas gravadas na última Review, valem para quem entrar. */
function ChecklistCard({ last }: { last: ShowcaseSession | null }) {
  const { toast } = useToast();
  const serverChecklist = useMemo(() => normalizeChecklist(last?.readinessChecklist), [last?.readinessChecklist]);
  // Marcação otimista: a lista vem de uma carga única, então sem estado local o checkbox não mudava na tela.
  const [local, setLocal] = useState<boolean[] | null>(null);
  const checklist = local ?? serverChecklist;
  const sessionId = last?.id;

  useEffect(() => { setLocal(null); }, [sessionId]);

  const toggle = async (index: number) => {
    if (!sessionId) return;
    const previous = checklist;
    const updated = [...checklist];
    updated[index] = !updated[index];
    setLocal(updated);
    try {
      // Busca a Review atual e grava só o checklist por cima dela: a cópia da lista pode estar velha
      // e regravá-la inteira desfaria decisões e edições feitas na sala depois da carga.
      const latest = await showcaseApi.getSession(sessionId);
      if (!latest) throw new Error('Review não encontrada');
      await showcaseApi.saveSession({ ...latest, readinessChecklist: updated });
    } catch (e) {
      console.error('Error saving checklist state', e);
      setLocal(previous);
      toast({ title: 'Não foi possível salvar o checklist', description: 'Tente de novo.', variant: 'destructive' });
    }
  };

  return (
    <section aria-label="Passo a passo" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle icon={ListChecks} hint="Passo a passo" title="Review sem slides" />
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {HUB_CHECKLIST.map((item, i) => {
          const done = !!checklist[i];
          return (
            <li key={item}>
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                disabled={!sessionId}
                onClick={() => toggle(i)}
                className={cn('flex min-h-10 w-full items-start gap-3 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent max-sm:min-h-11', FOCUS_RING)}
              >
                <span aria-hidden="true" className={cn('mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-colors', done ? 'border-primary bg-primary text-primary-foreground [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border')}>
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={cn('text-[13px] leading-snug', done ? 'text-muted-foreground line-through' : 'text-foreground')}>{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-auto flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        {sessionId ? 'Marque cada etapa ao concluir; vale para quem entrar na Review.' : 'Crie a primeira Review para marcar as etapas.'}
      </p>
    </section>
  );
}

function ago(iso: string | null | undefined): string {
  if (!iso) return 'Recentemente';
  const d = parseServerDate(iso);
  return d ? formatDistanceToNow(d, { addSuffix: true, locale: ptBR }) : 'Recentemente';
}

/** Histórico: as Reviews carregadas (até 50), com busca e filtro por status. */
function HistoryCard({ sessions }: { sessions: ShowcaseSession[] }) {
  const [filter, setFilter] = useState<HistoryStatusFilter>('all');
  const [query, setQuery] = useState('');
  const rows = useMemo(() => filterHistory(sessions, filter, query), [sessions, filter, query]);

  return (
    <section aria-label="Histórico de Reviews" className={cn(CARD, 'flex flex-col gap-4')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <CardTitle icon={History} title="Histórico de Reviews" aside={<StatusChip tone="neutral">{sessions.length} {sessions.length === 1 ? 'registro' : 'registros'}</StatusChip>} />
        <span className="hidden flex-1 lg:block" />
        {sessions.length > 0 && (
          <>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou sprint"
                aria-label="Buscar por nome ou sprint"
                className={cn(FIELD, 'h-9 pl-9 text-[13px] max-sm:h-11')}
              />
            </div>
            <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-1.5">
              {HISTORY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors max-sm:h-11',
                    filter === f.id ? 'border-primary/50 bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent/40',
                    FOCUS_RING
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">
          Sem registros de histórico. Use Nova Review para iniciar.
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">Nenhuma Review com esse filtro.</p>
      ) : (
        <div role="table" aria-label="Histórico de Reviews">
          <div role="row" className="hidden grid-cols-[minmax(0,2.2fr)_9rem_6rem_6rem_9rem_7rem] gap-3 border-b border-border px-3 pb-2 text-xs font-bold text-muted-foreground lg:grid">
            <span role="columnheader">Review</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Aprovação</span>
            <span role="columnheader">Cards</span>
            <span role="columnheader">Criada</span>
            <span role="columnheader"><span className="sr-only">Ação</span></span>
          </div>
          <ul className="m-0 list-none p-0">
            {rows.map((s) => {
              const status = normalizeReviewStatus(s.status, s.updatedAt);
              const tasks = s.tasks || [];
              const rate = sessionApprovalRate(tasks);
              return (
                <li key={s.id} role="row" className="border-b border-border last:border-b-0">
                  <Link
                    href={sessionHref(s.id, status)}
                    className={cn('grid grid-cols-2 items-center gap-x-3 gap-y-1.5 rounded-lg px-3 py-3 transition-colors hover:bg-accent/40 lg:grid-cols-[minmax(0,2.2fr)_9rem_6rem_6rem_9rem_7rem]', FOCUS_RING)}
                  >
                    <span role="cell" className="col-span-2 flex min-w-0 flex-col lg:col-span-1">
                      <span className="truncate text-sm font-bold" title={s.name}>{s.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{sprintCaption(s)}</span>
                    </span>
                    <span role="cell"><StatusChip tone={statusTone(status)} dot={status === 'active'}>{reviewStatusLabel(status)}</StatusChip></span>
                    <span role="cell" className={cn('text-[13px] font-semibold tabular-nums', rate === null && 'text-muted-foreground')}>
                      {rate === null ? '—' : <span className="text-emerald-700 dark:text-emerald-300">{rate}% OK</span>}
                    </span>
                    <span role="cell" className="text-[13px]">{tasks.length} {tasks.length === 1 ? 'card' : 'cards'}</span>
                    <span role="cell" className="text-[13px] text-muted-foreground">{ago(s.createdAt)}</span>
                    <span role="cell" className={cn('flex items-center justify-end gap-1 text-[13px] font-semibold', BRAND_TEXT)}>
                      {sessionActionLabel(status)} <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Corpo do hub /showcase (Review): começar, métricas, última Review, passo a passo e histórico. */
export function ReviewHub({ sessions, state, onRetry, onNewSession, isCreating }: ReviewHubProps) {
  const router = useRouter();
  const last = sessions[0] ?? null;

  if (state === 'loading') return <HubSkeleton />;

  if (state === 'no-squad') {
    return (
      <EmptyState
        icon={Icon}
        title="Escolha uma squad para ver as Reviews"
        description="A lista de Reviews é por squad. Quem está em mais de uma squad escolhe a ativa no cabeçalho; quem ainda não tem vínculo recebe um convite ou pede acesso a quem lidera."
        actions={<ModalButton variant="primary" onClick={() => router.push('/squad')}>Ver minhas squads</ModalButton>}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-8 [&>section]:h-full">
        <StartCard onNewSession={onNewSession} isCreating={isCreating} />
      </div>
      <div className="lg:col-span-4 [&>section]:h-full [&>div]:h-full">
        {state === 'error' ? <div className={cn(CARD, 'h-full')}><p className="m-0 text-sm text-muted-foreground">As métricas aparecem quando as Reviews carregam.</p></div> : <MetricsCard sessions={sessions} />}
      </div>

      {state === 'error' ? (
        <div className="lg:col-span-12">
          <ErrorState
            title="Não foi possível carregar as Reviews"
            description="A lista pode estar incompleta. Confira a conexão e tente de novo; você ainda pode criar uma Review ou entrar por um ID acima."
            onRetry={onRetry}
          />
        </div>
      ) : (
        <>
          <div className="lg:col-span-8 [&>section]:h-full"><LastReviewCard session={last} /></div>
          <div className="lg:col-span-4 [&>section]:h-full"><ChecklistCard last={last} /></div>
          <div className="lg:col-span-12"><HistoryCard sessions={sessions} /></div>
        </>
      )}
    </div>
  );
}

