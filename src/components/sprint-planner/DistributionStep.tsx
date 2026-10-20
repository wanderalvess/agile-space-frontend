'use client';

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ModalButton, StatusChip, TabBar, useBelowBreakpoint } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { DistributionPerson, DistributionView, PlanStatus } from '@/lib/sprint-planner/api';
import {
  allSubtasks, distributableTasks, ownershipOf, progressOf, warningTitle, type Ownership,
} from '@/lib/sprint-planner/distribution';
import { ZONE_TONE, formatHours, formatPct, formatRange } from '@/lib/sprint-planner/format';
import { ZONE_BAR } from './CapacityThermometer';
import { DistributionGantt } from './DistributionGantt';
import { SubtaskRow, type DateDraft, type RowError } from './SubtaskRow';
import { useDistribution } from './useDistribution';

type Tab = 'todas' | 'minhas' | 'disponiveis' | 'equipe';

const TAB_OF: Record<Ownership, Exclude<Tab, 'todas'>> = { mine: 'minhas', free: 'disponiveis', other: 'equipe' };

function PersonMeter({ p, me }: { p: DistributionPerson; me: boolean }) {
  const width = p.pct == null ? 0 : Math.min(100, Math.max(0, p.pct));
  return (
    <li className="flex flex-col gap-1" data-testid={`pessoa-${p.accountId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{p.name}{me && ' (você)'} <span className="font-normal text-muted-foreground">· {p.role}</span></span>
        <StatusChip tone={ZONE_TONE[p.zone]}>{formatPct(p.pct)}</StatusChip>
      </div>
      <div
        role="meter"
        aria-label={`Carga de ${p.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p.pct == null ? 0 : Math.round(p.pct)}
        aria-valuetext={`${formatHours(p.allocatedHours)} de ${formatHours(p.capacityHours)}`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn('h-full rounded-full', ZONE_BAR[p.zone])} style={{ width: `${width}%` }} />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">{formatHours(p.allocatedHours)} de {formatHours(p.capacityHours)} · sobram {formatHours(p.freeHours)}</p>
    </li>
  );
}

function Balance({ view }: { view: DistributionView }) {
  const me = view.people.find((p) => p.accountId === view.myAccountId);
  const team = view.people.reduce((a, p) => ({ alloc: a.alloc + p.allocatedHours, cap: a.cap + p.capacityHours }), { alloc: 0, cap: 0 });
  return (
    <section aria-label="Seu saldo" className={cn(PAGE_CARD, 'flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5')}>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{me ? `Seu saldo · ${me.role}` : 'Seu saldo'}</p>
        {me ? (
          <p className="text-2xl font-bold tabular-nums text-foreground" data-testid="saldo">
            {formatNum(me.freeHours)}/{formatNum(me.capacityHours)} <span className="text-base font-medium text-muted-foreground">h livres</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="saldo">Você não está na capacidade deste plano.</p>
        )}
      </div>
      <p className="text-sm tabular-nums text-muted-foreground" data-testid="total-equipe">
        Equipe: <span className="font-semibold text-foreground">{formatHours(team.alloc)}</span> de {formatHours(team.cap)} distribuídas
      </p>
    </section>
  );
}

const formatNum = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function Warnings({ view, onJump }: { view: DistributionView; onJump: (key: string) => void }) {
  const [open, setOpen] = useState(true);
  if (view.warnings.length === 0) return null;
  return (
    <section aria-labelledby="dist-avisos" className={cn(PAGE_CARD, 'flex flex-col gap-2 p-4')}>
      <h2 id="dist-avisos" className="text-base font-bold text-foreground">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="dist-avisos-lista"
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-8 w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? <ChevronDown aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> : <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
          <AlertTriangle aria-hidden="true" className="h-4 w-4 text-amber-700 dark:text-amber-400" strokeWidth={1.5} />
          Avisos ({view.warnings.length})
        </button>
      </h2>
      {open && (
        <ul id="dist-avisos-lista" className="flex flex-col gap-1.5">
          {view.warnings.map((w, i) => (
            <li key={`${w.code}-${w.subtaskKey ?? w.accountId ?? i}`} className="flex flex-wrap items-center gap-2 text-sm text-foreground" data-testid="aviso">
              <StatusChip tone="warn">{warningTitle(w.code)}</StatusChip>
              <span>{w.message}</span>
              {w.subtaskKey && (
                <button
                  type="button"
                  onClick={() => onJump(w.subtaskKey as string)}
                  className="min-h-6 rounded-md px-1 text-xs font-semibold underline underline-offset-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Ir para {w.subtaskKey}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export interface DistributionStepProps {
  squadId: string;
  planId: string;
  planStatus: PlanStatus;
}

/**
 * Etapa 3: Distribuição. Cada pessoa pega as próprias subtarefas (DEV/QA) e marca início e fim; a liderança acompanha
 * e pode atribuir a outra pessoa. Tudo o que é regra (saldo, termômetro, avisos, cascata do QA) vem do servidor.
 */
export function DistributionStep({ squadId, planId, planStatus }: DistributionStepProps) {
  const open = planStatus === 'DISTRIBUICAO' || planStatus === 'REVISAO' || planStatus === 'ENVIADO';
  const editable = planStatus === 'DISTRIBUICAO';
  const { toast } = useToast();
  const mobile = useBelowBreakpoint(768);
  const { load, live, refreshing, reload, claim, release, saveDates } = useDistribution(squadId, planId, open);
  const [drafts, setDrafts] = useState<Record<string, DateDraft>>({});
  const [errors, setErrors] = useState<Record<string, RowError>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [tabPick, setTabPick] = useState<Tab | null>(null);

  const view = load.state === 'ok' ? load.view : null;
  const { tasks, ignored } = useMemo(() => (view ? distributableTasks(view) : { tasks: [], ignored: 0 }), [view]);
  const byKey = useMemo(() => new Map((view ? allSubtasks(view) : []).map((s) => [s.key, s])), [view]);

  const setBusyKey = (key: string, v: boolean) => setBusy((b) => ({ ...b, [key]: v }));
  const onDraft = useCallback((key: string, d: DateDraft | null) => {
    setDrafts((cur) => {
      const next = { ...cur };
      if (d) next[key] = d; else delete next[key];
      return next;
    });
    setErrors((cur) => {
      if (!cur[key]) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  }, []);

  const onClaim = async (key: string, accountId?: string) => {
    setBusyKey(key, true);
    const r = await claim(key, accountId);
    setBusyKey(key, false);
    if (!r.ok && r.message && !r.message.startsWith('Outra pessoa')) toast({ title: 'Não foi possível pegar', description: r.message, variant: 'destructive' });
  };
  const onRelease = async (key: string) => {
    setBusyKey(key, true);
    const r = await release(key);
    setBusyKey(key, false);
    if (r.ok) onDraft(key, null);
  };
  const onSave = async (key: string, d: DateDraft) => {
    setBusyKey(key, true);
    const r = await saveDates(key, d.start, d.end);
    setBusyKey(key, false);
    if (r.ok) onDraft(key, null);
    else if (r.message) setErrors((cur) => ({ ...cur, [key]: { message: r.message as string, minStartDate: r.minStartDate ?? null } }));
  };

  const jump = (key: string) => {
    const s = byKey.get(key);
    setTabPick(mobile && s && view ? TAB_OF[ownershipOf(s, view.myAccountId)] : 'todas');
    setTimeout(() => document.querySelector(`[data-testid="sub-${key}"]`)?.scrollIntoView({ block: 'center' }), 50);
  };

  if (!open) {
    return (
      <EmptyState
        title="A distribuição ainda não abriu"
        description="Ela abre quando o planejamento avança do Escopo para a Distribuição. Aí cada pessoa pega as próprias subtarefas e marca as datas."
      />
    );
  }
  if (load.state === 'loading') return <LoadingSkeleton variant="page" label="Carregando a distribuição" />;
  if (load.state === 'error' || !view) {
    return <ErrorState title="Não foi possível carregar a distribuição" description={load.state === 'error' ? load.message : undefined} onRetry={() => void reload()} />;
  }

  const all = allSubtasks(view);
  const counts = { minhas: 0, disponiveis: 0, equipe: 0 };
  for (const s of all) counts[TAB_OF[ownershipOf(s, view.myAccountId)]] += 1;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    ...(mobile ? [] : [{ id: 'todas' as Tab, label: 'Todas', count: all.length }]),
    { id: 'minhas', label: 'Minhas', count: counts.minhas },
    { id: 'disponiveis', label: 'Disponíveis', count: counts.disponiveis },
    { id: 'equipe', label: 'Equipe', count: counts.equipe },
  ];
  const defaultTab: Tab = mobile ? (counts.minhas > 0 ? 'minhas' : 'disponiveis') : 'todas';
  const picked = tabPick ?? defaultTab;
  const tab: Tab = tabs.some((t) => t.id === picked) ? picked : defaultTab;
  const progress = progressOf(view);

  const visibleTasks = tasks
    .map((t) => ({ ...t, subtasks: t.subtasks.filter((s) => tab === 'todas' || TAB_OF[ownershipOf(s, view.myAccountId)] === tab) }))
    .filter((t) => t.subtasks.length > 0);

  return (
    <div className="flex flex-col gap-4" data-testid="distribuicao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {formatRange(view.sprint.startDate, view.sprint.endDate)}
          {view.syncedAt ? ` · Jira sincronizado em ${view.syncedAt}` : ''}
        </p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="tempo-real">
            {live ? <Wifi aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} /> : <WifiOff aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {live ? 'Atualiza sozinho' : 'Atualize manualmente'}
          </span>
          <ModalButton onClick={() => void reload()} disabled={refreshing}>
            <RefreshCw aria-hidden="true" className={cn('h-4 w-4', refreshing && 'motion-safe:animate-spin')} strokeWidth={1.5} /> Atualizar
          </ModalButton>
        </div>
      </div>

      {!editable && (
        <p role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground" data-testid="somente-leitura">
          Esta etapa está somente para consulta: o planejamento já passou da Distribuição.
        </p>
      )}

      <Balance view={view} />

      {view.canEditPlan && progress.total > 0 && (
        <section aria-label="Andamento da distribuição" className={cn(PAGE_CARD, 'flex flex-col gap-1 p-4')} data-testid="andamento">
          <p className="text-sm font-semibold text-foreground">{progress.withDates} de {progress.total} pessoas marcaram datas</p>
          {progress.missing.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Falta: {progress.missing.map((p) => `${p.name} (${p.role})`).join(' e ')}. Você vê tudo, mas só cada pessoa marca as próprias datas.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="dist-pessoas" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-4 sm:p-5')}>
        <h2 id="dist-pessoas" className="text-base font-bold text-foreground">Carga por pessoa</h2>
        {view.people.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pessoa com capacidade neste plano.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {view.people.map((p) => <PersonMeter key={p.accountId} p={p} me={p.accountId === view.myAccountId} />)}
          </ul>
        )}
      </section>

      <Warnings view={view} onJump={jump} />

      <section aria-labelledby="dist-lista" className="flex flex-col gap-3">
        <h2 id="dist-lista" className="text-base font-bold text-foreground">Subtarefas do escopo</h2>
        <TabBar tabs={tabs} value={tab} onChange={setTabPick} label="Filtrar subtarefas" idPrefix="dist" className="overflow-x-auto px-0" tabClassName="shrink-0 whitespace-nowrap" />
        <div role="tabpanel" id={`dist-panel-${tab}`} aria-labelledby={`dist-tab-${tab}`} className="flex flex-col gap-4">
          {all.length === 0 ? (
            <EmptyState title="Nenhuma subtarefa para distribuir" description="As tarefas do escopo não têm subtarefas de DEV ou QA. Confira os tipos de subtarefa na etapa Capacidade." />
          ) : visibleTasks.length === 0 ? (
            <EmptyState
              title={tab === 'minhas' ? 'Você ainda não pegou subtarefas' : tab === 'disponiveis' ? 'Nada disponível' : 'Ninguém da equipe pegou subtarefas'}
              description={tab === 'minhas' ? 'Veja a aba Disponíveis e toque em Pegar.' : 'Quando houver subtarefas nesta lista, elas aparecem aqui.'}
            />
          ) : (
            visibleTasks.map((t) => (
              <article key={t.itemId} aria-label={t.parentKey} className="flex flex-col gap-2">
                <header className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-sm font-bold text-foreground">{t.parentKey}</h3>
                  <span className="text-sm text-muted-foreground">{t.title}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">DEV {formatHours(t.devHours)} · QA {formatHours(t.qaHours)}</span>
                </header>
                <ul className="flex flex-col gap-2">
                  {t.subtasks.map((s) => (
                    <SubtaskRow
                      key={s.key}
                      sub={s}
                      view={view}
                      byKey={byKey}
                      editable={editable}
                      busy={!!busy[s.key]}
                      draft={drafts[s.key]}
                      error={errors[s.key]}
                      onDraft={onDraft}
                      onClaim={onClaim}
                      onRelease={onRelease}
                      onSave={onSave}
                    />
                  ))}
                </ul>
              </article>
            ))
          )}
          {ignored > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="fora-da-conta">
              {ignored === 1 ? '1 subtarefa sem classificação ou fora da conta não entra' : `${ignored} subtarefas sem classificação ou fora da conta não entram`} na distribuição.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="dist-gantt" className="flex flex-col gap-2">
        {mobile ? (
          <details className="group">
            <summary className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md text-base font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span id="dist-gantt">Cronograma</span>
              <span className="text-xs font-normal text-muted-foreground">toque para abrir; role para os lados</span>
            </summary>
            <div className="mt-2"><DistributionGantt view={view} compact /></div>
          </details>
        ) : (
          <>
            <h2 id="dist-gantt" className="text-base font-bold text-foreground">Cronograma</h2>
            <DistributionGantt view={view} />
          </>
        )}
      </section>
    </div>
  );
}
