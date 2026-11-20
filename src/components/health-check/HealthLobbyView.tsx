'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  ArrowRight,
  ChevronRight,
  EyeOff,
  History,
  Info,
  LineChart as LineChartIcon,
  Plus,
  Radar as RadarIcon,
  Target,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { DataToolbar, EmptyState, ErrorState, PAGE_CARD, PageHeader, PageShell } from '@/components/page';
import { BRAND_TEXT, ConfirmDialog, FOCUS_RING, IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import { HEALTH_LOBBY_FILTERS, HEALTH_STATUS_LABELS, evolutionDelta, evolutionPoints, filterHealthRows, formatDelta, parseJoinInput, summaryOfBoard, type HealthLobbyFilter, type HealthRow } from '@/lib/health-check-lobby';
import { formatScore, scaleLabel } from '@/lib/health-check-rules';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';

export type HealthHubState = 'loading' | 'ready' | 'error' | 'no-squad';

export interface HealthLobbyViewProps {
  rows: HealthRow[];
  state: HealthHubState;
  onRetry: () => void;
  onNew: () => void;
  isCreating: boolean;
  onJoin: (id: string) => void;
  onOpen: (id: string) => void;
  /** Quem está logado: só o criador vê "Apagar". */
  currentUserId?: string;
  /** Apaga o radar (só o criador); deve lançar erro se falhar. */
  onDelete: (id: string) => Promise<void>;
  /** Janelas (nova pesquisa) montadas pela página, dentro do mesmo esqueleto. */
  children?: React.ReactNode;
}

const CARD = `${PAGE_CARD} p-5 sm:p-6`;
const Icon = moduleIcon('health');

const HOW: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: EyeOff, title: 'Respostas sinceras', text: 'Ninguém sabe quem votou: cada pessoa vê só as próprias respostas até o facilitador encerrar, e no resultado votos e comentários saem sem nome.' },
  { icon: Activity, title: 'O que é avaliado', text: 'Oito dimensões do modelo clássico (apoio, trabalho em equipe, qualidade do código, valor, velocidade, moral, processos e missão) ou as que a squad escrever.' },
  { icon: RadarIcon, title: 'Como ler o gráfico radar', text: 'Cada ponta é uma dimensão. Quanto mais para dentro, mais a squad está perdendo energia ali: comece pelos pontos mais fundos.' },
  { icon: LineChartIcon, title: 'Compare ao longo do tempo', text: 'A direção do movimento importa mais que a nota de hoje. A Evolução abaixo compara os radares encerrados da squad.' },
];

const TIPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Activity, title: 'Respostas sinceras', text: 'O radar só serve se as respostas forem honestas. Garanta que o time se sinta seguro para dizer a realidade.' },
  { icon: TrendingUp, title: 'Olhe a tendência', text: 'Compare com as pesquisas anteriores: a direção do movimento vale mais que o valor de hoje.' },
  { icon: Target, title: 'Plano de melhoria', text: 'Pegue as dimensões em atenção e combine uma ação simples para a próxima sprint.' },
];

function CardTitle({ icon: I, title, hint, aside }: { icon: LucideIcon; title: string; hint?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <IconTile icon={I} size="md" />
      <div className="flex min-w-0 flex-1 flex-col">
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        <h2 className="m-0 text-base font-bold leading-tight">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function ago(iso: string | null | undefined): string {
  if (!iso) return 'Recentemente';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Recentemente' : formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
}

function statusTone(status: HealthRow['status']) {
  return status === 'finished' ? ('success' as const) : status === 'collecting' ? ('brand' as const) : ('neutral' as const);
}

/** Esqueleto do hub: blocos no lugar dos cartões. */
function HubSkeleton() {
  return (
    <div role="status" aria-label="Carregando as pesquisas" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <span className="sr-only">Carregando as pesquisas…</span>
      {['lg:col-span-8 h-52', 'lg:col-span-4 h-52', 'lg:col-span-8 h-60', 'lg:col-span-4 h-60', 'lg:col-span-5 h-72', 'lg:col-span-7 h-72'].map((c) => (
        <div key={c} aria-hidden="true" className={cn('rounded-2xl bg-muted motion-safe:animate-pulse', c)} />
      ))}
    </div>
  );
}

/** "Comece por aqui": Nova pesquisa e entrar por ID ou link. */
function StartCard({ onNew, onJoin, isCreating }: Pick<HealthLobbyViewProps, 'onNew' | 'onJoin' | 'isCreating'>) {
  const [text, setText] = useState('');
  const target = parseJoinInput(text);
  const invalid = text.trim() !== '' && !target;
  const helpId = 'health-join-help';
  return (
    <section aria-label="Comece por aqui" className={cn(CARD, 'flex flex-col gap-4')}>
      <div className="flex items-center gap-3">
        <IconTile icon={Icon} size="md" />
        <div className="flex min-w-0 flex-col">
          <h2 className="m-0 text-base font-bold leading-tight">Comece por aqui</h2>
          <span className="text-[13px] text-muted-foreground">Crie uma pesquisa nova ou entre numa que já existe com o ID ou o link.</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <ModalButton variant="primary" onClick={onNew} disabled={isCreating} className="h-11 gap-2 px-5 text-sm">
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Nova pesquisa
        </ModalButton>
        <form
          onSubmit={(e) => { e.preventDefault(); if (target) onJoin(target.id); }}
          className="flex h-11 min-w-0 flex-1 items-center rounded-xl border border-border bg-muted/40 pl-3.5 pr-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/30"
        >
          <label htmlFor="health-join" className="sr-only">ID ou link da pesquisa</label>
          <input
            id="health-join"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Entrar com o ID ou link da pesquisa"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={helpId}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!target}
            aria-label="Entrar na pesquisa"
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40 max-sm:h-9 max-sm:w-9 [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}
          >
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </form>
      </div>
      <p id={helpId} className={cn('m-0 text-xs', invalid ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')} aria-live="polite">
        {invalid ? 'Esse texto não parece um ID nem um link de pesquisa do radar.' : target?.fromLink ? (
          <>ID reconhecido no link: <span className="font-mono font-semibold text-foreground">{target.id}</span></>
        ) : (
          'Cole o ID ou o link da pesquisa. Maiúsculas e minúsculas contam.'
        )}
      </p>
    </section>
  );
}

/** Última pesquisa da squad: coletando (Responder) ou encerrada (nota, fortes e atenção). */
function LastCard({ row, loading, onOpen }: { row: HealthRow | null; loading?: boolean; onOpen: (id: string) => void }) {
  if (!row) {
    return (
      <section aria-label="Última pesquisa" className={cn(CARD, 'flex flex-col items-center justify-center gap-3 py-10 text-center')}>
        <IconTile icon={Icon} tone="neutral" size="lg" />
        <h2 className="m-0 text-base font-bold">{loading ? 'Carregando…' : 'Nenhuma pesquisa ainda'}</h2>
        {!loading && <p className="m-0 max-w-sm text-sm text-muted-foreground">A primeira pesquisa da squad aparece aqui, com a nota de clima depois de encerrada.</p>}
      </section>
    );
  }
  const summary = row.board ? summaryOfBoard(row.board) : null;
  const finished = row.status === 'finished';
  return (
    <section aria-label="Última pesquisa" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle
        icon={Timer}
        title="Última pesquisa"
        aside={row.status ? <StatusChip tone={statusTone(row.status)} dot={row.status === 'collecting'}>{HEALTH_STATUS_LABELS[row.status]}</StatusChip> : undefined}
      />
      <div className="flex flex-col gap-0.5">
        <h3 className="m-0 truncate text-xl font-bold leading-tight" title={row.title}>{row.title}</h3>
        <p className="m-0 text-[13px] text-muted-foreground">
          {[row.scale ? scaleLabel(row.scale) : '', row.dimensionCount ? `${row.dimensionCount} ${row.dimensionCount === 1 ? 'dimensão' : 'dimensões'}` : '', finished && row.finishedAt ? `encerrada ${ago(row.finishedAt)}` : `criada ${ago(row.createdAt)}`].filter(Boolean).join(' · ')}
        </p>
      </div>
      {finished && summary && summary.climate !== null ? (
        <div className="flex items-center gap-4">
          <div role="img" aria-label={`Nota de clima ${formatScore(summary.climate)} de 10`} className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center rounded-2xl border border-border bg-muted/40">
            <span className="text-[28px] font-bold leading-none tabular-nums">{formatScore(summary.climate)}</span>
            <span className="mt-1 text-xs text-muted-foreground">de 10</span>
          </div>
          <div className="flex min-w-0 flex-col gap-2 text-[13px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-emerald-700 dark:text-emerald-300">Fortes</span>
              {summary.strong.length === 0 ? <span className="text-muted-foreground">nenhum</span> : summary.strong.slice(0, 2).map((s) => <StatusChip key={s.key} tone="success">{s.title}</StatusChip>)}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-red-700 dark:text-red-300">Atenção</span>
              {summary.attention.length === 0 ? <span className="text-muted-foreground">nenhuma</span> : summary.attention.slice(0, 2).map((s) => <StatusChip key={s.key} tone={s.level === 'critical' ? 'danger' : 'warn'}>{s.title}</StatusChip>)}
            </div>
          </div>
        </div>
      ) : row.status === 'collecting' ? (
        <div className="flex flex-col gap-1 text-[13px]">
          {row.answers !== null && (
            <p className="m-0 flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{row.participants != null ? 'Já responderam' : 'Respostas até agora'}</span>
              <span className="text-lg font-bold tabular-nums">{row.participants != null ? `${row.answers} de ${row.participants}` : row.answers}</span>
            </p>
          )}
          <p className="m-0 text-muted-foreground">O resultado fica oculto até o facilitador encerrar.</p>
        </div>
      ) : null}
      <div className="mt-auto flex justify-end border-t border-border pt-3">
        <ModalButton variant="primary" className="gap-1.5" onClick={() => onOpen(row.id)}>
          {finished ? 'Ver resultado' : row.status === 'collecting' ? 'Responder' : 'Abrir'} <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </ModalButton>
      </div>
    </section>
  );
}

function HowCard() {
  return (
    <section aria-label="Como funciona" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle icon={Info} title="Como funciona" />
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {HOW.map((h) => (
          <li key={h.title} className="flex gap-3 rounded-xl border border-border bg-muted/30 p-3.5">
            <IconTile icon={h.icon} size="sm" />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-bold">{h.title}</span>
              <span className="text-[13px] leading-relaxed text-muted-foreground">{h.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TipsCard() {
  return (
    <section aria-label="Dicas para a cerimônia" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle icon={Target} title="Dicas para a cerimônia" />
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {TIPS.map((t) => (
          <li key={t.title} className="flex gap-3">
            <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-bold">{t.title}</span>
              <span className="text-[13px] leading-relaxed text-muted-foreground">{t.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Evolução do clima: nota de 0 a 10 dos radares encerrados da squad. */
function EvolutionCard({ rows }: { rows: HealthRow[] }) {
  const boards = useMemo(() => rows.flatMap((r) => (r.board ? [r.board] : [])), [rows]);
  const points = useMemo(() => evolutionPoints(boards), [boards]);
  const delta = evolutionDelta(points);
  const data = points.map((p) => ({ id: p.id, name: format(new Date(p.createdAt), 'dd/MM'), title: p.title, score: Number(p.score.toFixed(1)) }));
  return (
    <section aria-label="Evolução do clima" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle
        icon={LineChartIcon}
        title="Evolução do clima"
        aside={
          delta !== null ? (
            <StatusChip tone={delta > 0.05 ? 'success' : delta < -0.05 ? 'danger' : 'neutral'}>
              {delta < -0.05 ? <TrendingDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" /> : <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              {formatDelta(delta)} sobre o anterior
            </StatusChip>
          ) : undefined
        }
      />
      {points.length < 2 ? (
        <p className="m-0 rounded-xl border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">
          {points.length === 0
            ? 'A evolução aparece depois do primeiro radar encerrado.'
            : `A primeira nota é ${formatScore(points[0].score)}. A evolução aparece depois do segundo radar encerrado.`}
        </p>
      ) : (
        <>
          <div className="w-full [--health-accent:hsl(var(--primary))] [.theme-totvs:not(.dark)_&]:[--health-accent:hsl(var(--foreground))]" style={{ height: 200 }} role="img" aria-label={`Nota de clima dos ${points.length} últimos radares: ${points.map((p) => formatScore(p.score)).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} width={34} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <Line type="monotone" dataKey="score" stroke="var(--health-accent)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--card))', stroke: 'var(--health-accent)', strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="sr-only">
            {points.map((p) => <li key={p.id}>{p.title}: {formatScore(p.score)} de 10</li>)}
          </ul>
        </>
      )}
      <p className="m-0 text-xs text-muted-foreground">
        Nota de clima (0 a 10) dos radares encerrados da squad. Radares com perguntas diferentes entram na nota geral; a comparação por dimensão só vale entre os que têm a mesma pergunta.
      </p>
    </section>
  );
}

/** Pesquisas da squad: lista com busca e filtro por situação. */
function SurveysCard({ rows, onOpen, currentUserId, onAskDelete }: { rows: HealthRow[]; onOpen: (id: string) => void; currentUserId?: string; onAskDelete: (row: HealthRow) => void }) {
  const [filter, setFilter] = useState<HealthLobbyFilter>('all');
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterHealthRows(rows, filter, query), [rows, filter, query]);

  return (
    <section aria-label="Pesquisas da squad" className={cn(CARD, 'flex flex-col gap-4')}>
      <CardTitle icon={History} title="Pesquisas da squad" aside={<StatusChip tone="neutral">{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</StatusChip>} />
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <DataToolbar className="min-w-0 flex-1" search={{ value: query, onChange: setQuery, placeholder: 'Buscar por nome', ariaLabel: 'Buscar pesquisa por nome' }} />
          <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-1.5">
            {HEALTH_LOBBY_FILTERS.map((f) => (
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
        </div>
      )}

      {rows.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">
          Nenhuma pesquisa ainda. Quando a squad fizer a primeira, ela aparece aqui com status, respostas e nota de clima.
        </p>
      ) : visible.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">Nenhuma pesquisa com esse filtro.</p>
      ) : (
        <div role="table" aria-label="Pesquisas da squad">
          <div role="row" className="hidden grid-cols-[minmax(0,2fr)_8.5rem_5.5rem_3rem_5.5rem_7rem_2.25rem] gap-3 border-b border-border px-3 pb-2 text-xs font-bold text-muted-foreground xl:grid">
            <span role="columnheader">Pesquisa</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Respostas</span>
            <span role="columnheader">Nota</span>
            <span role="columnheader">Criada</span>
            <span role="columnheader"><span className="sr-only">Ação</span></span>
            <span role="columnheader"><span className="sr-only">Apagar</span></span>
          </div>
          <ul className="m-0 list-none p-0">
            {visible.map((r) => {
              const mine = !!currentUserId && r.board?.creatorId === currentUserId;
              const action = r.status === 'finished' ? 'Ver resultado' : r.status === 'collecting' ? 'Responder' : 'Abrir';
              return (
                <li key={r.id} role="row" className="flex items-center gap-1 border-b border-border last:border-b-0">
                  <Link
                    href={`/health-check/${encodeURIComponent(r.id)}`}
                    onClick={(e) => { e.preventDefault(); onOpen(r.id); }}
                    className={cn('grid min-w-0 flex-1 grid-cols-2 items-center gap-x-3 gap-y-1.5 rounded-lg px-3 py-3 transition-colors hover:bg-accent/40 xl:grid-cols-[minmax(0,2fr)_8.5rem_5.5rem_3rem_5.5rem_7rem]', FOCUS_RING)}
                  >
                    <span role="cell" className="col-span-2 flex min-w-0 flex-col xl:col-span-1">
                      <span className="truncate text-sm font-bold" title={r.title}>{r.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[r.scale ? scaleLabel(r.scale) : '', r.dimensionCount ? `${r.dimensionCount} ${r.dimensionCount === 1 ? 'dimensão' : 'dimensões'}` : ''].filter(Boolean).join(' · ') || 'Aberta neste navegador'}
                      </span>
                    </span>
                    <span role="cell">{r.status ? <StatusChip tone={statusTone(r.status)}>{HEALTH_STATUS_LABELS[r.status]}</StatusChip> : <span className="text-[13px] text-muted-foreground">—</span>}</span>
                    <span role="cell" className="text-[13px] tabular-nums"><span className="text-muted-foreground xl:hidden">Respostas: </span>{r.answers === null ? '—' : r.participants != null ? `${r.answers} de ${r.participants}` : r.answers}</span>
                    <span role="cell" className={cn('text-[13px] font-bold tabular-nums', r.score === null && 'font-normal text-muted-foreground')}><span className="font-normal text-muted-foreground xl:hidden">Nota: </span>{formatScore(r.score)}</span>
                    <span role="cell" className="text-[13px] text-muted-foreground">{ago(r.createdAt)}</span>
                    <span role="cell" className={cn('flex items-center justify-end gap-1 text-[13px] font-semibold', BRAND_TEXT)}>
                      {action} <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                  </Link>
                  {mine ? (
                    <button
                      type="button"
                      onClick={() => onAskDelete(r)}
                      aria-label={`Apagar a pesquisa ${r.title}`}
                      title="Apagar a pesquisa"
                      className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-red-700 dark:hover:text-red-300 max-sm:h-11 max-sm:w-11', FOCUS_RING)}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  ) : (
                    <span aria-hidden="true" className="h-9 w-9 shrink-0 max-sm:hidden" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Lobby do Radar de clima (PageShell + cabeçalho da página): começar, última pesquisa, como funciona, dicas,
 * evolução do clima e as pesquisas da squad. A página só busca os dados e liga os callbacks.
 */
export function HealthLobbyView({ rows, state, onRetry, onNew, isCreating, onJoin, onOpen, currentUserId, onDelete, children }: HealthLobbyViewProps) {
  const router = useRouter();
  const [toDelete, setToDelete] = useState<HealthRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const last = rows.find((r) => r.status) ?? rows[0] ?? null;

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await onDelete(toDelete.id);
      setToDelete(null);
    } catch {
      setDeleteFailed(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageShell documentTitle="Radar de clima" header={state === 'no-squad' ? { squadControl: null } : undefined}>
      <PageHeader
        title="Radar de clima"
        module="health"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Radar de clima' }]}
        subtitle="Pesquisa rápida e anônima para medir o clima da squad: confiança técnica, processos e ritmo. Cada pessoa responde sozinha; o resultado só aparece quando o facilitador encerra."
      />

      {state === 'loading' ? (
        <HubSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 [&>section]:h-full">
            <StartCard onNew={onNew} onJoin={onJoin} isCreating={isCreating} />
          </div>
          <div className="lg:col-span-4 [&>section]:h-full">
            {state === 'ready' ? (
              <LastCard row={last} onOpen={onOpen} />
            ) : (
              <section aria-label="Última pesquisa" className={cn(CARD, 'flex h-full items-center justify-center text-center text-sm text-muted-foreground')}>
                {state === 'no-squad' ? 'A última pesquisa aparece quando você tem uma squad ativa.' : 'A última pesquisa aparece quando a lista carrega.'}
              </section>
            )}
          </div>

          <div className="lg:col-span-8 [&>section]:h-full"><HowCard /></div>
          <div className="lg:col-span-4 [&>section]:h-full"><TipsCard /></div>

          {state === 'no-squad' ? (
            <div className="lg:col-span-12">
              <EmptyState
                icon={Icon}
                title="Escolha uma squad para ver as pesquisas"
                description="A lista é por squad. Quem está em mais de uma squad escolhe a ativa no cabeçalho; quem ainda não tem vínculo recebe um convite ou pede acesso a quem lidera."
                actions={<ModalButton variant="primary" onClick={() => router.push('/squad')}>Ver minhas squads</ModalButton>}
              />
            </div>
          ) : state === 'error' ? (
            <div className="lg:col-span-12">
              <ErrorState
                title="Não foi possível carregar as pesquisas"
                description="A lista pode estar incompleta. Confira a conexão e tente de novo; você ainda pode criar uma pesquisa ou entrar por um ID acima."
                onRetry={onRetry}
              />
            </div>
          ) : (
            <>
              <div className="lg:col-span-5 [&>section]:h-full"><EvolutionCard rows={rows} /></div>
              <div className="lg:col-span-7 [&>section]:h-full">
                <SurveysCard rows={rows} onOpen={onOpen} currentUserId={currentUserId} onAskDelete={(r) => { setDeleteFailed(false); setToDelete(r); }} />
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) { setToDelete(null); setDeleteFailed(false); } }}
        tone="danger"
        icon={Trash2}
        title="Apagar a pesquisa?"
        description={toDelete ? `"${toDelete.title}" será apagada com todas as respostas e comentários. Quem estiver na sala é avisado. Não dá para desfazer.` : undefined}
        confirmLabel="Apagar pesquisa"
        loading={deleting}
        loadingLabel="Apagando…"
        keepOpenOnConfirm
        onConfirm={() => void confirmDelete()}
      >
        {deleteFailed && (
          <p role="alert" className="m-0 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
            Não foi possível apagar agora. Só quem criou a pesquisa pode apagar; confira a conexão e tente de novo.
          </p>
        )}
      </ConfirmDialog>
      {children}
    </PageShell>
  );
}
