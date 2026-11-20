'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Check, History, Network, Plus, Sparkles, Trash2, Users, type LucideIcon } from 'lucide-react';
import { EmptyState, ErrorState, DataTable, DataToolbar, LoadingSkeleton, PAGE_CARD, PageHeader, PageShell, type DataColumn } from '@/components/page';
import { ConfirmDialog, FOCUS_RING, IconButton, IconTile, ModalButton, StatusChip } from '@/components/room-kit';
import {
  BRAINSTORM_LOBBY_FILTERS,
  createdPhrase,
  filterBrainstormRows,
  isLobbyRowFinished,
  isLobbyRowLive,
  lobbyRowFacilitator,
  lobbyStageLabel,
  readRoomCode,
  shortCreated,
  type BrainstormLobbyFilter,
  type BrainstormLobbyRow,
} from '@/lib/brainstorming-lobby';
import { moduleIcon } from '@/lib/modules-registry';
import { cn } from '@/lib/utils';
import { BRAIN_STAGES, normalizeStage } from './brainstorm-room-logic';
import { BRAIN_REFERENCE, BRAIN_TIPS } from './brainstorm-copy';

/** Contagens da última sessão (lidas do mural dela). */
export interface BrainstormLastDetail {
  ideas?: number;
  people?: number;
  groups?: number;
}

export type BrainstormLobbyState = 'loading' | 'ready' | 'error' | 'no-squad';

export interface BrainstormLobbyViewProps {
  state: BrainstormLobbyState;
  rows: BrainstormLobbyRow[];
  /** Contagens da sessão mais recente da squad; ausentes enquanto carregam ou se falharam. */
  lastDetail?: BrainstormLastDetail;
  currentUserId?: string;
  isCreating: boolean;
  onRetry: () => void;
  onNew: () => void;
  onJoin: (id: string) => void;
  onOpen: (id: string) => void;
  /** Apaga o mural no servidor (só o facilitador vê o botão). */
  onDelete: (row: BrainstormLobbyRow) => Promise<void>;
  /** Janelas (nova sessão) montadas pela página, dentro do mesmo esqueleto. */
  children?: React.ReactNode;
  now?: number;
}

const SECTION = cn(PAGE_CARD, 'flex flex-col gap-4 p-6');

function SectionTitle({ icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-2">
      <IconTile icon={Icon} size="sm" tone="neutral" />
      <h2 className="m-0 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  );
}

/** Campo "ID ou link": aceita colar o endereço inteiro da sala e diz qual ID entendeu. */
function JoinByCode({ onJoin }: { onJoin: (id: string) => void }) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const reading = readRoomCode(value);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reading.state === 'id' || reading.state === 'link') {
      setInvalid(false);
      onJoin(reading.id);
    } else if (reading.state === 'invalid') {
      setInvalid(true);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 flex-col gap-1.5" noValidate>
      <div className="relative">
        <label htmlFor="brain-join" className="sr-only">Entrar com o ID ou link do brainstorming</label>
        <input
          id="brain-join"
          value={value}
          onChange={(e) => { setValue(e.target.value); setInvalid(false); }}
          placeholder="Entrar com o ID ou link do brainstorming"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby="brain-join-help"
          className={cn(
            'h-11 w-full rounded-[10px] border border-border bg-muted/40 pl-3.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground',
            'transition-colors duration-fast focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            invalid && 'border-red-500/60'
          )}
        />
        <button
          type="submit"
          disabled={reading.state === 'empty'}
          aria-label="Entrar"
          title="Entrar"
          className={cn(
            'absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40 [.theme-totvs:not(.dark)_&]:text-foreground',
            FOCUS_RING
          )}
        >
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <p id="brain-join-help" role={invalid ? 'alert' : undefined} className={cn('m-0 flex items-start gap-1.5 text-xs', invalid ? 'text-red-700 dark:text-red-300' : 'text-muted-foreground')}>
        {invalid ? (
          <>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" /> Isso não parece um ID nem o link de um brainstorming. Confira e cole de novo.
          </>
        ) : reading.state === 'link' ? (
          <>
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" /> ID reconhecido no link: {reading.id}.
          </>
        ) : (
          'Cole o ID ou o link da sessão.'
        )}
      </p>
    </form>
  );
}

function StepList({ phase }: { phase: BrainstormLobbyRow['phase'] }) {
  const current = BRAIN_STAGES.findIndex((s) => s.id === normalizeStage(phase));
  return (
    <ol aria-label="Etapas" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {BRAIN_STAGES.map((stage, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li
            key={stage.id}
            aria-current={on ? 'step' : undefined}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold',
              on ? 'border-primary/50 bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground' : done ? 'border-border text-foreground' : 'border-border text-muted-foreground'
            )}
          >
            {done && <Check className="h-3 w-3" strokeWidth={2} aria-hidden="true" />}
            {stage.label}
          </li>
        );
      })}
    </ol>
  );
}

function LastSession({ row, detail, currentUserId, onOpen, now }: { row: BrainstormLobbyRow; detail?: BrainstormLastDetail; currentUserId?: string; onOpen: (id: string) => void; now?: number }) {
  const live = isLobbyRowLive(row);
  const finished = isLobbyRowFinished(row);
  const mine = !!currentUserId && lobbyRowFacilitator(row) === currentUserId;
  const ideas = detail?.ideas ?? row.ideas;
  const people = detail?.people ?? row.people;
  const stats = [
    { label: 'Ideias', value: ideas },
    { label: 'Pessoas', value: people },
    { label: 'Grupos', value: detail?.groups },
  ];
  return (
    <section aria-label="Última sessão" className={SECTION}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={History} title="Última sessão" />
        {finished ? (
          <StatusChip tone="warn">Encerrado</StatusChip>
        ) : live ? (
          <StatusChip tone="success" dot>Em andamento</StatusChip>
        ) : (
          <StatusChip tone="neutral">Concluída</StatusChip>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="m-0 truncate text-lg font-bold text-foreground" title={row.title}>{row.title}</h3>
        <span className="text-[13px] text-muted-foreground">
          criada {createdPhrase(row.createdAt, now)}
          {mine ? ' · você facilita' : ''}
        </span>
      </div>
      <StepList phase={row.phase} />
      <dl className="m-0 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="m-0 text-xl font-bold tabular-nums text-foreground">{s.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      <div>
        <ModalButton variant="primary" className="gap-2" onClick={() => onOpen(row.id)}>
          {live ? 'Retomar' : 'Abrir'} <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </ModalButton>
      </div>
    </section>
  );
}

/**
 * Hub do Brainstorming (PageShell + cabeçalho da página): começar, última sessão, como funciona, dicas e a lista
 * da squad com busca, filtro e apagar (só o facilitador). A página só busca os dados e liga os callbacks.
 */
export function BrainstormLobbyView({
  state,
  rows,
  lastDetail,
  currentUserId,
  isCreating,
  onRetry,
  onNew,
  onJoin,
  onOpen,
  onDelete,
  children,
  now,
}: BrainstormLobbyViewProps) {
  const [filter, setFilter] = useState<BrainstormLobbyFilter>('all');
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<BrainstormLobbyRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const squadRows = rows;
  const visible = useMemo(() => filterBrainstormRows(rows, filter, query), [rows, filter, query]);
  const last = rows.find((r) => !r.localOnly);
  const fromServer = state === 'ready' || state === 'loading';
  const showList = fromServer || rows.length > 0;
  const listTitle = fromServer ? 'Brainstormings da squad' : 'Abertos neste navegador';

  const columns: DataColumn<BrainstormLobbyRow>[] = [
    {
      id: 'title',
      header: 'Sessão',
      primary: true,
      width: 'minmax(0,2fr)',
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground" title={r.title}>{r.title}</span>
          {r.localOnly ? (
            <span className="text-xs text-muted-foreground">aberta neste navegador</span>
          ) : (
            !!currentUserId && lobbyRowFacilitator(r) === currentUserId && <span className="text-xs text-muted-foreground">você facilita</span>
          )}
        </span>
      ),
    },
    { id: 'stage', header: 'Etapa', width: '120px', cell: (r) => <StatusChip tone={isLobbyRowLive(r) ? 'brand' : 'neutral'} className="self-start">{lobbyStageLabel(r.phase) || '—'}</StatusChip> },
    {
      id: 'status',
      header: 'Status',
      width: '110px',
      cell: (r) => (r.localOnly ? <span className="text-sm text-muted-foreground">—</span> : isLobbyRowFinished(r) ? <StatusChip tone="warn" className="self-start">Encerrado</StatusChip> : <StatusChip tone="success" className="self-start">Aberto</StatusChip>),
    },
    { id: 'ideas', header: 'Ideias', width: '80px', cell: (r) => <span className="text-sm tabular-nums">{r.ideas ?? '—'}</span> },
    { id: 'people', header: 'Pessoas', width: '90px', cell: (r) => <span className="text-sm tabular-nums">{r.people ?? '—'}</span> },
    { id: 'created', header: 'Criada', width: '120px', cell: (r) => <span className="text-sm text-muted-foreground">{shortCreated(r.createdAt, now)}</span> },
    {
      id: 'actions',
      header: 'Ações',
      width: '170px',
      align: 'end',
      cell: (r) => (
        <span className="flex items-center justify-end gap-1.5">
          <ModalButton className="h-8 gap-1.5 px-3 text-[13px]" onClick={() => onOpen(r.id)} aria-label={`${isLobbyRowLive(r) ? 'Retomar' : 'Abrir'} ${r.title}`}>
            {isLobbyRowLive(r) ? 'Retomar' : 'Abrir'} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          </ModalButton>
          {!!currentUserId && lobbyRowFacilitator(r) === currentUserId && (
            <IconButton size="sm" label={`Apagar ${r.title}`} icon={Trash2} onClick={() => setToDelete(r)} className="text-red-700 dark:text-red-300" />
          )}
        </span>
      ),
    },
  ];

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await onDelete(toDelete);
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const brainstormIcon = moduleIcon('brainstorming');

  return (
    <PageShell documentTitle="Brainstorming" header={state === 'no-squad' ? { squadControl: null } : undefined}>
      <PageHeader
        title="Brainstorming"
        module="brainstorming"
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Brainstorming' }]}
        subtitle="Quadro de ideias com a squad: lançar, ligar, agrupar, votar, priorizar e levar o que vencer para um plano de ação."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section aria-label="Iniciar" className={cn(SECTION, 'lg:col-span-7 lg:justify-between')}>
          <div className="flex items-start gap-3">
            <IconTile icon={brainstormIcon} />
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-semibold text-foreground">Comece por aqui</h2>
              <p className="m-0 mt-1 text-sm text-muted-foreground">Crie um brainstorming novo ou entre num que já existe com o ID ou o link.</p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
            <ModalButton variant="primary" onClick={onNew} disabled={isCreating} className="h-11 shrink-0 gap-2 px-6">
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Novo brainstorming
            </ModalButton>
            <JoinByCode onJoin={onJoin} />
          </div>
        </section>

        <div className="lg:col-span-5">
          {state === 'loading' && <LoadingSkeleton variant="cards" rows={1} label="Carregando a última sessão" />}
          {state === 'ready' && last && <LastSession row={last} detail={lastDetail} currentUserId={currentUserId} onOpen={onOpen} now={now} />}
          {state === 'ready' && !last && (
            <section aria-label="Última sessão" className={SECTION}>
              <SectionTitle icon={History} title="Última sessão" />
              <EmptyState embedded icon={brainstormIcon} title="Nenhum brainstorming ainda" description="Crie o primeiro para ver aqui a etapa, as ideias e quem participou." />
            </section>
          )}
          {state === 'error' && (
            <ErrorState
              title="Não foi possível carregar os brainstormings"
              description="A lista pode estar incompleta. Confira a conexão e tente de novo; você ainda pode criar ou entrar por um ID."
              onRetry={onRetry}
            />
          )}
          {state === 'no-squad' && (
            <EmptyState
              icon={Users}
              title="Escolha uma squad para ver os brainstormings"
              description="A lista é por squad. Quem está em mais de uma escolhe a ativa no cabeçalho; quem ainda não tem vínculo recebe um convite ou pede acesso a quem lidera."
              actions={<Link href="/squad" className={cn('inline-flex h-10 items-center rounded-[10px] border border-border px-4 text-sm font-medium hover:bg-accent', FOCUS_RING)}>Ver minhas squads</Link>}
            />
          )}
        </div>

        <section aria-label="Como funciona" className={cn(SECTION, 'lg:col-span-8')}>
          <SectionTitle icon={Network} title="Como funciona" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BRAIN_REFERENCE.map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
                  <item.icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="block text-sm leading-normal text-muted-foreground">{item.description}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Dicas" className={cn(SECTION, 'lg:col-span-4')}>
          <SectionTitle icon={Sparkles} title="Dicas para a cerimônia" />
          <div className="flex flex-col gap-3">
            {BRAIN_TIPS.map((tip) => (
              <div key={tip.title} className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                  <tip.icon className="h-4 w-4 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <div className="space-y-0.5">
                  <h3 className="m-0 text-sm font-semibold text-foreground">{tip.title}</h3>
                  <p className="m-0 text-sm leading-snug text-muted-foreground">{tip.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showList && (
        <section aria-label={listTitle} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <IconTile icon={brainstormIcon} size="sm" />
            <h2 className="m-0 text-lg font-bold text-foreground">{listTitle}</h2>
          </div>
          {state === 'loading' ? (
            <LoadingSkeleton variant="table" rows={4} label="Carregando os brainstormings da squad" />
          ) : (
            <>
              <DataToolbar
                search={{ value: query, onChange: setQuery, placeholder: 'Buscar por nome', ariaLabel: 'Buscar brainstorming por nome' }}
                filters={
                  <div role="group" aria-label="Filtrar" className="flex flex-wrap gap-1.5">
                    {BRAINSTORM_LOBBY_FILTERS.map((f) => {
                      const active = filter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setFilter(f.id)}
                          className={cn(
                            'inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors max-sm:h-11',
                            active ? 'border-primary/50 bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:bg-accent/40',
                            FOCUS_RING
                          )}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                }
                count={{ shown: visible.length, total: squadRows.length, noun: squadRows.length === 1 ? 'registro' : 'registros' }}
              />
              <DataTable
                columns={columns}
                rows={visible}
                getRowId={(r) => r.id}
                ariaLabel="Brainstormings da squad"
                stackBelow="lg"
                empty={
                  <EmptyState
                    embedded
                    icon={brainstormIcon}
                    title={squadRows.length === 0 ? 'Sem registros ainda' : 'Nenhum brainstorming neste filtro'}
                    description={squadRows.length === 0 ? 'Use o botão de criar para começar; as sessões da squad aparecem aqui.' : 'Tire o filtro ou mude a busca.'}
                  />
                }
              />
            </>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(next) => { if (!next && !deleting) setToDelete(null); }}
        tone="danger"
        icon={Trash2}
        title="Apagar este brainstorming?"
        description={
          <>
            <strong className="font-semibold text-foreground">{toDelete?.title}</strong>: o mural, as ideias, os grupos e a lista de participantes são apagados para todos. Quem estiver na sala é avisado. Não dá para desfazer.
          </>
        }
        cancelLabel="Cancelar"
        confirmLabel="Apagar brainstorming"
        loading={deleting}
        loadingLabel="Apagando…"
        keepOpenOnConfirm
        onConfirm={() => void confirmDelete()}
      />

      {children}
    </PageShell>
  );
}

