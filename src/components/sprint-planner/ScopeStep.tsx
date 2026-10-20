'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, Loader2, Presentation, RefreshCw, Search, X } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { FIELD, FOCUS_RING, ModalButton, StatusChip, TabBar, useBelowBreakpoint } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/ceremony-api';
import { cn } from '@/lib/utils';
import {
  backlogApi,
  isConflict,
  retryAfterSec,
  sprintPlanApi,
  statusOf,
  type BacklogView,
  type PatchPlanRequest,
  type PlanView,
} from '@/lib/sprint-planner/api';
import {
  CLASSES,
  FILTER_LABEL,
  buildScope,
  estimateThermometer,
  filterBacklog,
  scopeTotals,
  syncedAgo,
  unclassifiedSummary,
  type ScopeFilter,
} from '@/lib/sprint-planner/scope';
import { ScopeBars } from './ScopeBars';
import { ScopePresentation } from './ScopePresentation';
import { BacklogCard, HoursChips, TaskNotices } from './ScopeTaskCard';

type BacklogState = { state: 'loading' } | { state: 'error' } | { state: 'unavailable' } | { state: 'ok'; data: BacklogView };
type MobileTab = 'sprint' | 'refinadas';

export interface ScopeStepProps {
  plan: PlanView;
  /** Troca o plano pela resposta do servidor (já com totais e termômetro novos). */
  onPlan: (plan: PlanView) => void;
  onReload: () => Promise<void>;
  onPatch: (body: Omit<PatchPlanRequest, 'version'>) => void;
  /** Leva à seção de tipos de subtarefa (etapa Capacidade). */
  onOpenTypes: () => void;
}

const FILTERS = Object.keys(FILTER_LABEL) as ScopeFilter[];
const SYNC_CONFLICT = 'Já existe uma sincronização em andamento para esta squad. Aguarde alguns instantes e tente de novo.';

function GoalCard({ goal, canEdit, onSave }: { goal: string | null; canEdit: boolean; onSave: (goal: string) => void }) {
  const [draft, setDraft] = useState(goal ?? '');
  useEffect(() => { setDraft(goal ?? ''); }, [goal]);
  const dirty = draft.trim() !== (goal ?? '').trim();
  return (
    <section aria-labelledby="escopo-meta" className={cn(PAGE_CARD, 'flex flex-col gap-2 p-4 sm:p-5')}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="escopo-meta" className="text-base font-bold text-foreground">Meta da sprint</h2>
        <StatusChip tone="neutral">Campo Sprint goal do Jira</StatusChip>
      </header>
      {canEdit ? (
        <>
          <label htmlFor="escopo-meta-texto" className="sr-only">Meta da sprint</label>
          <textarea
            id="escopo-meta-texto"
            rows={2}
            maxLength={500}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex.: Caixa sem fila: troca, cancelamento parcial e fechamento por forma de pagamento"
            className={cn(FIELD, 'min-h-[64px] resize-y py-2')}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">Será gravada no Sprint goal do Jira ao enviar.</p>
            <ModalButton onClick={() => onSave(draft.trim())} disabled={!dirty}>Salvar meta</ModalButton>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-foreground" data-testid="escopo-meta-leitura">{goal?.trim() ? goal : 'A liderança ainda não definiu a meta.'}</p>
          <p className="text-[13px] text-muted-foreground">Será gravada no Sprint goal do Jira ao enviar.</p>
        </>
      )}
    </section>
  );
}

/**
 * Etapa 2: Escopo. Esquerda, as refinadas do Jira; direita, "Nesta sprint". A liderança adiciona e tira tarefas e as
 * barras DEV/QA se mexem na hora (estimativa provisória até o servidor responder); o membro só acompanha.
 */
export function ScopeStep({ plan, onPlan, onReload, onPatch, onOpenTypes }: ScopeStepProps) {
  const { toast } = useToast();
  const canEdit = plan.permissions.canEditPlan;
  const mobile = useBelowBreakpoint(1024);
  const [backlog, setBacklog] = useState<BacklogState>({ state: 'loading' });
  const [query, setQuery] = useState('');
  const [onlyWithHours, setOnlyWithHours] = useState(false);
  const [filter, setFilter] = useState<ScopeFilter>('todas');
  const [pendingAdd, setPendingAdd] = useState<ReadonlySet<string>>(new Set());
  const [pendingRemove, setPendingRemove] = useState<ReadonlySet<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [tab, setTab] = useState<MobileTab>('sprint');

  const loadBacklog = useCallback(async (quiet = false) => {
    if (!quiet) setBacklog({ state: 'loading' });
    try {
      const r = await backlogApi.get(plan.squadId, plan.sprint.sprintKey);
      setBacklog(r.status === 'ok' ? { state: 'ok', data: r.data } : { state: 'unavailable' });
    } catch {
      setBacklog((prev) => (quiet && prev.state === 'ok' ? prev : { state: 'error' }));
    }
  }, [plan.squadId, plan.sprint.sprintKey]);

  useEffect(() => { void loadBacklog(); }, [loadBacklog]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const backlogItems = useMemo(() => (backlog.state === 'ok' ? backlog.data.items : []), [backlog]);
  const entries = useMemo(() => buildScope(plan.items, backlogItems, pendingAdd, pendingRemove), [plan.items, backlogItems, pendingAdd, pendingRemove]);
  const inScope = useMemo(() => new Set(entries.map((e) => e.key)), [entries]);
  const refinadas = useMemo(
    () => filterBacklog(backlog.state === 'ok' ? backlog.data : null, inScope, { query, onlyWithHours, filter }),
    [backlog, inScope, query, onlyWithHours, filter],
  );

  // Termômetro: o do servidor; enquanto há mudança pendente, o dele ajustado pela diferença (provisório).
  const estimated = pendingAdd.size > 0 || pendingRemove.size > 0;
  const thermometer = useMemo(() => {
    if (!estimated) return plan.thermometer;
    const settled = buildScope(plan.items, backlogItems, new Set(), new Set());
    const removed = settled.filter((e) => e.itemId && pendingRemove.has(e.itemId));
    const added = entries.filter((e) => e.pending);
    const out: PlanView['thermometer'] = { ...plan.thermometer };
    for (const c of CLASSES) {
      const key = c === 'DEV' ? 'dev' : 'qa';
      const delta = added.reduce((s, e) => s + e[key], 0) - removed.reduce((s, e) => s + e[key], 0);
      const base = plan.thermometer?.[c];
      out[c] = estimateThermometer(base, Math.max(0, (base?.allocatedHours ?? 0) + delta));
    }
    return out;
  }, [estimated, plan.thermometer, plan.items, backlogItems, entries, pendingRemove]);

  const failure = useCallback(async (e: unknown, title: string) => {
    toast({ title: isConflict(e) ? 'O escopo mudou' : title, description: errorMessage(e, 'Tente de novo.'), variant: 'destructive' });
    if (isConflict(e) || statusOf(e) === 422) await onReload();
  }, [onReload, toast]);

  const add = async (keys: string[]) => {
    setPendingAdd((p) => new Set([...p, ...keys]));
    try {
      const updated = await sprintPlanApi.addItems(plan.squadId, plan.id, keys);
      if (updated) onPlan(updated); else await onReload();
    } catch (e) {
      await failure(e, 'Não foi possível adicionar ao escopo');
    } finally {
      setPendingAdd((p) => { const n = new Set(p); keys.forEach((k) => n.delete(k)); return n; });
    }
  };

  const remove = async (itemId: string) => {
    setPendingRemove((p) => new Set([...p, itemId]));
    try {
      const updated = await sprintPlanApi.removeItem(plan.squadId, plan.id, itemId);
      if (updated) onPlan(updated); else await onReload();
    } catch (e) {
      await failure(e, 'Não foi possível tirar do escopo');
    } finally {
      setPendingRemove((p) => { const n = new Set(p); n.delete(itemId); return n; });
    }
  };

  const sync = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const r = await backlogApi.sync(plan.squadId);
      toast({ title: 'Backlog sincronizado', description: `${r.parents} tarefas refinadas e ${r.subtasks} subtarefas${r.truncated ? '. A lista foi cortada pelo limite do Jira.' : '.'}` });
      await Promise.all([loadBacklog(true), onReload()]);
    } catch (e) {
      const s = statusOf(e);
      if (s === 429) {
        const secs = retryAfterSec(e);
        if (secs) setCooldown(secs);
        setSyncNotice(secs ? `Você sincronizou há pouco. Tente de novo em ${secs} s.` : errorMessage(e, 'Você sincronizou há pouco. Tente de novo em instantes.'));
      } else if (s === 409) {
        setSyncNotice(SYNC_CONFLICT);
      } else {
        toast({ title: 'Não foi possível sincronizar', description: errorMessage(e, 'Tente de novo.'), variant: 'destructive' });
      }
    } finally {
      setSyncing(false);
    }
  };

  const syncedAt = backlog.state === 'ok' ? backlog.data.syncedAt ?? plan.syncedAt : plan.syncedAt;
  const syncedLabel = syncedAgo(syncedAt);
  const unclassified = unclassifiedSummary(backlog.state === 'ok' ? backlog.data.unclassifiedTypes : []);
  const totals = scopeTotals(entries);

  if (presenting) {
    return <ScopePresentation plan={plan} entries={entries} thermometer={thermometer} syncedLabel={syncedLabel} onExit={() => setPresenting(false)} />;
  }

  const syncButton = canEdit ? (
    <ModalButton onClick={() => void sync()} disabled={syncing || cooldown > 0}>
      {syncing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <RefreshCw aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
      {cooldown > 0 ? `Tente de novo em ${cooldown} s` : 'Sincronizar backlog com o Jira'}
    </ModalButton>
  ) : null;

  const left = (
    <section aria-labelledby="escopo-refinadas" className={cn(PAGE_CARD, 'flex min-w-0 flex-col gap-3 p-4 sm:p-5')}>
      <header className="flex flex-col gap-0.5">
        <h2 id="escopo-refinadas" className="text-base font-bold text-foreground">Refinadas no Jira</h2>
        <p className="text-[13px] text-muted-foreground">
          Status Refinamento Concluído{backlog.state === 'ok' ? ` · ${refinadas.length} ${refinadas.length === 1 ? 'tarefa' : 'tarefas'}` : ''}
        </p>
      </header>

      {backlog.state === 'ok' && backlogItems.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <input
              type="search"
              aria-label="Buscar nas refinadas"
              placeholder="Buscar por chave ou título"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(FIELD, 'h-10 pl-9')}
            />
          </div>
          <div role="group" aria-label="Filtrar as refinadas" className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold max-sm:h-10',
                  filter === f ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent',
                  FOCUS_RING,
                )}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
            <label className="ml-auto inline-flex min-h-8 cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <input type="checkbox" checked={onlyWithHours} onChange={(e) => setOnlyWithHours(e.target.checked)} className="h-4 w-4" />
              Só com horas
            </label>
          </div>
        </div>
      )}

      {backlog.state === 'loading' && <LoadingSkeleton variant="cards" rows={3} label="Carregando as refinadas" />}
      {backlog.state === 'error' && <ErrorState embedded title="Não foi possível carregar as refinadas" onRetry={() => void loadBacklog()} />}
      {backlog.state === 'unavailable' && (
        <p className="rounded-[10px] bg-muted px-4 py-3 text-[13px] text-muted-foreground" role="note">O backlog refinado ainda não está disponível neste servidor.</p>
      )}
      {backlog.state === 'ok' && backlogItems.length === 0 && (
        <EmptyState
          embedded
          title="Nenhuma tarefa refinada"
          description={canEdit ? 'Sincronize o backlog com o Jira para trazer as tarefas em Refinamento Concluído.' : 'A liderança ainda não sincronizou o backlog com o Jira.'}
          actions={syncButton ?? undefined}
        />
      )}
      {backlog.state === 'ok' && backlogItems.length > 0 && (
        refinadas.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nenhuma refinada com esse filtro.</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="Tarefas refinadas">
            {refinadas.map((t) => (
              <BacklogCard key={t.key} task={t} canEdit={canEdit} adding={pendingAdd.has(t.key)} onAdd={(k) => void add([k])} onOpenTypes={onOpenTypes} />
            ))}
          </ul>
        )
      )}
    </section>
  );

  const right = (
    <section aria-labelledby="escopo-sprint" className={cn(PAGE_CARD, 'flex min-w-0 flex-col gap-3 p-4 sm:p-5')}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="escopo-sprint" className="text-base font-bold text-foreground">Nesta sprint</h2>
        <span className="text-[13px] tabular-nums text-muted-foreground" data-testid="escopo-totais">
          {entries.length} {entries.length === 1 ? 'tarefa' : 'tarefas'} · DEV {totals.DEV.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h · QA {totals.QA.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h
        </span>
      </header>
      {entries.length === 0 ? (
        <EmptyState
          embedded
          title="Nada no escopo ainda"
          description={canEdit ? 'Use o + nas refinadas. As barras mostram a carga a cada tarefa; não precisa fechar exato.' : 'A liderança está montando o escopo. Você acompanha ao vivo.'}
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Tarefas no escopo">
          {entries.map((e) => (
            <li key={e.key} className={cn('flex items-start gap-3 rounded-[12px] border border-border bg-card p-3', e.pending && 'opacity-70')} data-testid={`escopo-${e.key}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{e.key}</span>
                  <HoursChips dev={e.dev} qa={e.qa} />
                </div>
                <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{e.title ?? 'Sem título'}</p>
                {e.backlog ? (
                  <TaskNotices task={e.backlog} onOpenTypes={onOpenTypes} />
                ) : e.carryOver ? (
                  <p><StatusChip tone="warn">Veio da sprint anterior</StatusChip></p>
                ) : null}
              </div>
              {canEdit && (
                <button
                  type="button"
                  className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border text-foreground transition-colors hover:bg-accent disabled:opacity-50 max-sm:h-11 max-sm:w-11', FOCUS_RING)}
                  onClick={() => e.itemId && void remove(e.itemId)}
                  disabled={!e.itemId}
                  aria-label={`Remover ${e.key} do escopo`}
                >
                  {e.itemId ? <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> : <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {entries.length === 0 && canEdit && (
        <p className="text-[13px] text-muted-foreground" role="note">Para avançar para a Distribuição, o escopo precisa de pelo menos uma tarefa.</p>
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      {!canEdit && (
        <p className="flex items-start gap-2 rounded-[10px] bg-muted px-4 py-3 text-[13px] text-muted-foreground" role="note">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
          A liderança está montando o escopo. Você vê ao vivo; a distribuição abre quando o escopo for apresentado.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground" data-testid="escopo-sincronizado">
          {syncedLabel ? `Jira sincronizado ${syncedLabel}` : 'Backlog do Jira ainda não sincronizado.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {backlog.state === 'ok' && backlogItems.length > 0 && syncButton}
          <ModalButton onClick={() => setPresenting(true)}>
            <Presentation aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> Apresentar ao time
          </ModalButton>
        </div>
      </div>
      {syncNotice && (
        <p role="alert" className="flex items-start gap-2 rounded-[10px] border border-amber-700/40 bg-amber-500/10 px-4 py-3 text-[13px] text-foreground" data-testid="escopo-sync-aviso">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" strokeWidth={1.5} />
          {syncNotice}
        </p>
      )}

      <GoalCard goal={plan.goal} canEdit={canEdit} onSave={(goal) => onPatch({ goal })} />

      {unclassified && (
        <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-amber-700/40 bg-amber-500/10 px-4 py-3 text-[13px] text-foreground" data-testid="escopo-sem-classificacao">
          <p>
            <strong>
              {unclassified.count === 1 ? '1 subtarefa de tipo sem classificação' : `${unclassified.count} subtarefas de tipos sem classificação`} ({unclassified.hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h) não entram no total.
            </strong>{' '}
            {unclassified.names}. Quem mapeia os tipos é a liderança da squad.
          </p>
          <ModalButton onClick={onOpenTypes}>Mapear tipos</ModalButton>
        </div>
      )}

      <section aria-labelledby="escopo-carga" className={cn(PAGE_CARD, 'sticky top-0 z-10 flex flex-col gap-2 p-4 sm:p-5')}>
        <h2 id="escopo-carga" className="sr-only">Carga do escopo</h2>
        <ScopeBars thermometer={thermometer} estimated={estimated} />
      </section>

      {mobile ? (
        <div className="flex flex-col gap-3">
          <TabBar
            tabs={[{ id: 'sprint', label: 'Nesta sprint', count: entries.length }, { id: 'refinadas', label: 'Refinadas', count: refinadas.length }] as const}
            value={tab}
            onChange={setTab}
            label="Ver lista"
            idPrefix="escopo-lista"
            className="px-0"
          />
          <div role="tabpanel" id={`escopo-lista-panel-${tab}`} aria-labelledby={`escopo-lista-tab-${tab}`}>{tab === 'sprint' ? right : left}</div>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {left}
          {right}
        </div>
      )}
    </div>
  );
}
