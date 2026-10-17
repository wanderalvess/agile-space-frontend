'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Gauge,
  History,
  ListChecks,
  MapPin,
  Plus,
  Route,
  Search,
  Sparkles,
  Target,
  User,
  Users,
  CircleHelp,
  FilterX,
} from 'lucide-react';
import { DataTable, DataToolbar, EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD, PageHeader, PageShell, type DataColumn } from '@/components/page';
import { FOCUS_RING, IconTile, ModalButton, SelectField, StatusChip } from '@/components/room-kit';
import { SOURCE_LABEL, SOURCE_TYPES, type PlanCounts, type ProgressFilter } from '@/lib/action-plan-origin';
import {
  FILTER_ALL,
  extractPlanId,
  filterPlanRows,
  formatShortDate,
  planPath,
  visibilityLabel,
  type PlanLobbyRow,
  type PlanRowFilters,
  type TaskSummary,
} from '@/lib/action-plan';
import { cn } from '@/lib/utils';
import { FIVE_W_TWO_H_FIELDS } from './ActionPlanGuide';

export interface LatestPlan {
  row: PlanLobbyRow;
  /** Contagem por status lida das ações desse plano; `null` enquanto carrega ou se a leitura falhou. */
  summary: TaskSummary | null;
  /** Contagens que o servidor já manda na lista (total e concluídas); dispensam a leitura das ações. */
  counts?: PlanCounts | null;
}

export interface ActionPlanLobbyViewProps {
  /** Há uma squad ativa (sem ela não existe lista da squad; criar e entrar pelo ID seguem). */
  hasSquad: boolean;
  rows: PlanLobbyRow[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  latest: LatestPlan | null;
  isCreating?: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  /** "Ver minhas squads" (sem squad ativa). */
  onSquads: () => void;
  /** Janelas (novo plano) montadas pela página, dentro do mesmo esqueleto. */
  children?: React.ReactNode;
}

const FIELD_ICONS = {
  what: Target,
  why: CircleHelp,
  where: MapPin,
  when: Clock,
  who: User,
  how: Route,
  howMuch: Gauge,
} as const;

/** A ordem do cartão segue a do 5W2H: What, Why, Where, When, Who, How, How Much. */
const FIELD_ORDER = ['what', 'why', 'where', 'when', 'who', 'how', 'howMuch'] as const;

const TIPS = [
  { title: 'Clareza acima de tudo', desc: 'Um bom plano não deixa margem para dúvida. O 5W2H força o detalhamento essencial.', icon: Target },
  { title: 'Responsabilidade única', desc: 'Cada ação tem um e só um dono (Who). Se é de todo mundo, não é de ninguém.', icon: User },
  { title: 'Prazos realistas', desc: 'Defina datas (When) alcançáveis para manter a motivação e a credibilidade do time.', icon: Clock },
] as const;

const ORIGIN_OPTIONS = [
  { value: FILTER_ALL, label: 'Todas as origens' },
  ...SOURCE_TYPES.map((t) => ({ value: t, label: SOURCE_LABEL[t] })),
];

const PROGRESS_OPTIONS: { value: ProgressFilter; label: string }[] = [
  { value: 'all', label: 'Todos os andamentos' },
  { value: 'open', label: 'Com ações abertas' },
  { value: 'done', label: 'Concluídos' },
];

const STATUS_COUNTS: { key: 'todo' | 'doing' | 'done' | 'blocked'; label: string }[] = [
  { key: 'todo', label: 'A fazer' },
  { key: 'doing', label: 'Em andamento' },
  { key: 'done', label: 'Concluído' },
  { key: 'blocked', label: 'Impedido' },
];

/** Concluídas sobre o total do último plano: das contagens do servidor, ou das ações lidas (reserva do backend antigo). */
function progressOf(latest: LatestPlan): { done: number; total: number; pct: number } | null {
  if (latest.counts) return { done: latest.counts.done, total: latest.counts.total, pct: latest.counts.pct };
  if (latest.summary) return { done: latest.summary.done, total: latest.summary.total, pct: latest.summary.donePct };
  return null;
}

function SectionTitle({ icon, children }: { icon: React.ComponentProps<typeof IconTile>['icon']; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <IconTile icon={icon} size="sm" />
      <h2 className="m-0 text-base font-semibold text-foreground">{children}</h2>
    </div>
  );
}

/**
 * Hub do Plano de ação (PageShell + cabeçalho da página, como o lobby da Retro): começar um plano novo ou entrar
 * por ID ou link, o último plano da squad, as sete perguntas do 5W2H, dicas e a lista de planos da squad.
 * A página busca os dados e liga os callbacks.
 */
export function ActionPlanLobbyView({ hasSquad, rows, loading, failed, onRetry, latest, isCreating, onNew, onOpen, onSquads, children }: ActionPlanLobbyViewProps) {
  const [joinText, setJoinText] = useState('');
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState<PlanRowFilters['origin']>(FILTER_ALL);
  const [progress, setProgress] = useState<ProgressFilter>('all');
  const joined = extractPlanId(joinText);
  // Origem e contagens só existem num servidor que conhece a V78: sem elas a coluna e o filtro somem.
  const hasOrigin = rows.some((r) => r.sourceType !== undefined);
  const hasCounts = rows.some((r) => r.counts !== null);
  const filterOrigin = hasOrigin ? origin : FILTER_ALL;
  const filterProgress = hasCounts ? progress : 'all';
  const visible = filterPlanRows(rows, query, { origin: filterOrigin, progress: filterProgress });
  const filtering = query.trim() !== '' || filterOrigin !== FILTER_ALL || filterProgress !== 'all';
  const clearFilters = () => {
    setQuery('');
    setOrigin(FILTER_ALL);
    setProgress('all');
  };

  const columns: DataColumn<PlanLobbyRow>[] = [
    {
      id: 'title',
      header: 'Plano',
      width: 'minmax(0,2.2fr)',
      primary: true,
      cell: (r) => (
        <Link href={planPath(r.id)} className={cn('truncate rounded-md text-sm font-semibold text-foreground hover:underline', FOCUS_RING)}>
          {r.title || 'Plano de ação'}
        </Link>
      ),
    },
    ...(hasOrigin
      ? [
          {
            id: 'origin',
            header: 'Origem',
            width: 'minmax(0,1.3fr)',
            cell: (r: PlanLobbyRow) =>
              r.sourceType ? (
                <div className="flex min-w-0 flex-col items-start gap-0.5">
                  <StatusChip tone={r.sourceType === 'MANUAL' ? 'neutral' : 'brand'}>{SOURCE_LABEL[r.sourceType]}</StatusChip>
                  {r.sourceType !== 'MANUAL' && r.sourceTitle?.trim() ? (
                    <span className="max-w-full truncate text-xs text-muted-foreground" title={r.sourceTitle}>{r.sourceTitle}</span>
                  ) : null}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              ),
          } satisfies DataColumn<PlanLobbyRow>,
        ]
      : []),
    ...(hasCounts
      ? [
          {
            id: 'progress',
            header: 'Ações concluídas',
            width: '170px',
            cell: (r: PlanLobbyRow) =>
              r.counts ? (
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm tabular-nums text-foreground">{r.counts.done} de {r.counts.total}</span>
                  <div
                    role="progressbar"
                    aria-label={`Ações concluídas de ${r.title || 'o plano'}`}
                    aria-valuenow={r.counts.pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${r.counts.pct}%` }} />
                  </div>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              ),
          } satisfies DataColumn<PlanLobbyRow>,
        ]
      : []),
    {
      id: 'visibility',
      header: 'Quem vê',
      width: '150px',
      cell: (r) =>
        r.isPublic === null ? (
          <StatusChip tone="neutral">Neste navegador</StatusChip>
        ) : (
          <StatusChip tone={r.isPublic ? 'brand' : 'warn'}>{visibilityLabel(r.isPublic)}</StatusChip>
        ),
    },
    {
      id: 'created',
      header: 'Criado',
      width: '90px',
      cell: (r) => <span className="text-sm tabular-nums text-muted-foreground">{formatShortDate(r.createdAt) || '—'}</span>,
    },
    {
      id: 'open',
      header: 'Abrir',
      width: '110px',
      align: 'end',
      cell: (r) => (
        <ModalButton className="h-9 gap-1.5 px-3 text-[13px] max-xl:h-11" onClick={() => onOpen(r.id)} aria-label={`Abrir ${r.title || 'o plano'}`}>
          Abrir <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </ModalButton>
      ),
    },
  ];

  return (
    <PageShell documentTitle="Plano de ação">
      <PageHeader
        title="Plano de ação"
        module="action-plan"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Plano de ação' }]}
        subtitle="Matrizes 5W2H para transformar decisões em ações, cada uma com responsável, prazo e status. Planos nascem aqui ou das cerimônias da squad."
      />

      <div className="grid w-full grid-cols-1 items-stretch gap-5 text-left md:grid-cols-2 lg:grid-cols-12">
        {/* Comece por aqui */}
        <section aria-label="Iniciar" className={cn(PAGE_CARD, 'col-span-1 flex flex-col justify-between gap-5 p-6 md:col-span-2 lg:col-span-8')}>
          <div className="flex items-start gap-3">
            <IconTile icon={ListChecks} />
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-semibold text-foreground">Comece por aqui</h2>
              <p className="mt-1 text-sm text-muted-foreground">Crie um plano novo ou entre num que já existe com o ID ou o link.</p>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
            <ModalButton variant="primary" onClick={onNew} disabled={isCreating} className="h-11 shrink-0 gap-2 px-6">
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Novo plano
            </ModalButton>

            <form
              className="flex min-w-0 flex-1 flex-col gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (joined.id) onOpen(joined.id);
              }}
            >
              <div className="relative">
                <input
                  value={joinText}
                  onChange={(e) => setJoinText(e.target.value)}
                  placeholder="Entrar com o ID ou link do plano"
                  aria-label="Entrar com o ID ou link do plano"
                  autoComplete="off"
                  className="h-11 w-full rounded-[10px] border border-border bg-background pl-3.5 pr-14 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="submit"
                  disabled={!joined.id}
                  aria-label="Entrar no plano"
                  className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 max-sm:h-8 [.theme-totvs:not(.dark)_&]:text-foreground"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
              {joined.fromLink && joined.id ? (
                <span role="status" className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span className="min-w-0 break-all">ID reconhecido no link: {joined.id}</span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Cole o ID ou o link do plano.</span>
              )}
            </form>
          </div>
        </section>

        {/* Último plano */}
        <section aria-label="Último plano" className={cn(PAGE_CARD, 'col-span-1 flex min-h-[240px] flex-col gap-3.5 p-6 lg:col-span-4')}>
          <SectionTitle icon={History}>Último plano</SectionTitle>
          {loading && !latest ? (
            <div role="status" aria-label="Carregando o último plano" className="flex flex-col gap-2 py-2 motion-safe:animate-pulse">
              <span className="h-6 rounded-md bg-muted" />
              <span className="h-4 w-2/3 rounded-md bg-muted" />
              <span className="h-2 rounded-full bg-muted" />
            </div>
          ) : latest ? (
            <>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="m-0 break-words text-lg font-bold leading-snug text-foreground">{latest.row.title}</h3>
                <span className="text-[13px] text-muted-foreground">
                  {formatShortDate(latest.row.createdAt) ? `criado em ${formatShortDate(latest.row.createdAt)}` : 'plano de ação'}
                </span>
              </div>
              {progressOf(latest) && (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="text-muted-foreground">Concluídas</span>
                      <strong className="tabular-nums">{progressOf(latest)!.done} de {progressOf(latest)!.total}</strong>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Ações concluídas"
                      aria-valuenow={progressOf(latest)!.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2 overflow-hidden rounded-full bg-muted"
                    >
                      <div className="h-full rounded-full bg-primary" style={{ width: `${progressOf(latest)!.pct}%` }} />
                    </div>
                  </div>
                  <dl className="m-0 flex flex-wrap gap-x-5 gap-y-2">
                    {latest.summary ? (
                      STATUS_COUNTS.map((s) => (
                        <div key={s.key} className="flex flex-col gap-0.5">
                          <dt className="text-xs text-muted-foreground">{s.label}</dt>
                          <dd className="m-0 text-xl font-bold tabular-nums">{latest.summary![s.key]}</dd>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">Abertas</dt>
                        <dd className="m-0 text-xl font-bold tabular-nums">{progressOf(latest)!.total - progressOf(latest)!.done}</dd>
                      </div>
                    )}
                  </dl>
                </>
              )}
              <div className="mt-auto flex justify-end border-t border-border pt-3">
                <ModalButton variant="primary" className="gap-1.5" onClick={() => onOpen(latest.row.id)}>
                  Abrir <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </ModalButton>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4 text-center">
              <span className="text-[15px] font-bold">Nenhum plano ainda</span>
              <span className="max-w-xs text-sm text-muted-foreground">Crie o primeiro, ou leve para cá o resultado de um brainstorming.</span>
            </div>
          )}
        </section>

        {/* Como funciona: as sete perguntas */}
        <section aria-label="Como funciona" className={cn(PAGE_CARD, 'col-span-1 flex flex-col gap-3 p-6 md:col-span-2 lg:col-span-8')}>
          <SectionTitle icon={Search}>Como funciona: as 7 perguntas do 5W2H</SectionTitle>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
            {FIELD_ORDER.map((key) => {
              const field = FIVE_W_TWO_H_FIELDS.find((f) => f.key === key)!;
              const Icon = FIELD_ICONS[key];
              return (
                <li key={key} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground">
                    <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-semibold text-foreground">{field.title}</span>
                    <span className="block text-sm leading-normal text-muted-foreground">{field.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Dicas */}
        <section aria-label="Dicas" className={cn(PAGE_CARD, 'col-span-1 flex flex-col gap-3 p-6 md:col-span-2 lg:col-span-4')}>
          <div className="flex items-center gap-2.5">
            <IconTile icon={Sparkles} size="sm" tone="warn" />
            <h2 className="m-0 text-base font-semibold text-foreground">Dicas para a cerimônia</h2>
          </div>
          <div className="flex-1 space-y-3">
            {TIPS.map((tip) => (
              <div key={tip.title} className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                  <tip.icon className="h-3.5 w-3.5 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div className="space-y-0.5">
                  <h3 className="m-0 text-sm font-semibold text-foreground">{tip.title}</h3>
                  <p className="m-0 text-sm leading-snug text-muted-foreground">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Planos da squad */}
        <section aria-label="Planos da squad" className="col-span-1 flex flex-col gap-3 md:col-span-2 lg:col-span-12">
          <div className="flex items-center gap-2.5">
            <IconTile icon={Users} size="sm" />
            <h2 className="m-0 text-base font-semibold text-foreground">Planos da squad</h2>
          </div>

          {!hasSquad && rows.length === 0 ? (
            <div className={PAGE_CARD}>
              <EmptyState
                embedded
                icon={Users}
                title="Escolha uma squad para ver os planos"
                description="A lista é por squad. Quem está em mais de uma escolhe a ativa no cabeçalho; quem ainda não tem vínculo recebe um convite ou pede acesso a quem lidera."
                actions={<ModalButton onClick={onSquads}>Ver minhas squads</ModalButton>}
              />
            </div>
          ) : loading && rows.length === 0 ? (
            <LoadingSkeleton variant="table" rows={4} label="Carregando os planos da squad" />
          ) : failed && rows.length === 0 ? (
            <div className={PAGE_CARD}>
              <ErrorState embedded title="Não foi possível carregar os planos" description="A lista pode estar incompleta. Confira a conexão e tente de novo; você ainda pode criar ou entrar por um ID acima." onRetry={onRetry} />
            </div>
          ) : (
            <>
              <DataToolbar
                search={{ value: query, onChange: setQuery, placeholder: 'Buscar por nome' }}
                filters={
                  hasOrigin || hasCounts ? (
                    <>
                      {hasOrigin && (
                        <SelectField
                          aria-label="Filtrar por origem"
                          value={filterOrigin ?? FILTER_ALL}
                          onChange={(v) => setOrigin(v as PlanRowFilters['origin'])}
                          options={ORIGIN_OPTIONS}
                          className="h-[38px] w-full sm:w-[190px] max-sm:h-11"
                        />
                      )}
                      {hasCounts && (
                        <SelectField
                          aria-label="Filtrar por andamento"
                          value={filterProgress}
                          onChange={(v) => setProgress(v as ProgressFilter)}
                          options={PROGRESS_OPTIONS}
                          className="h-[38px] w-full sm:w-[200px] max-sm:h-11"
                        />
                      )}
                    </>
                  ) : undefined
                }
                count={{ shown: visible.length, total: rows.length, noun: rows.length === 1 ? 'plano' : 'planos' }}
              />
              {failed && (
                <p role="alert" className="m-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-800 dark:text-amber-200">
                  Não foi possível carregar a lista da squad; estes são os planos abertos neste navegador.{' '}
                  <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">Tentar de novo</button>
                </p>
              )}
              <DataTable
                ariaLabel="Planos da squad"
                columns={columns}
                rows={visible}
                getRowId={(r) => r.id}
                stackBelow="md"
                stickyHeader={false}
                empty={
                  <EmptyState
                    embedded
                    icon={ListChecks}
                    title={rows.length === 0 ? 'Nenhum plano ainda' : hasOrigin || hasCounts ? 'Nenhum plano neste filtro' : 'Nenhum plano com esse nome'}
                    description={rows.length === 0 ? 'Sem registros ainda. Use o botão de criar para começar; os planos da squad aparecem aqui.' : hasOrigin || hasCounts ? 'Tente outro nome ou limpe os filtros para ver todos os planos.' : 'Tente outro trecho do nome.'}
                    actions={
                      rows.length === 0 ? (
                        <ModalButton variant="primary" className="gap-2" onClick={onNew}>
                          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Novo plano
                        </ModalButton>
                      ) : filtering ? (
                        <ModalButton className="gap-2" onClick={clearFilters}>
                          <FilterX className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Limpar filtros
                        </ModalButton>
                      ) : undefined
                    }
                  />
                }
              />
            </>
          )}
        </section>
      </div>

      {children}
    </PageShell>
  );
}
