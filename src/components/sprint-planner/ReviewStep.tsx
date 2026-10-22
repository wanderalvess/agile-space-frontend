'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, ExternalLink, RefreshCw, Send } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ModalButton, StatusChip, useBelowBreakpoint } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/ceremony-api';
import { cn } from '@/lib/utils';
import { reviewApi, statusOf, type JiraChange, type PreviewKind, type ReviewPending, type ReviewPerson, type ReviewTask, type ReviewView } from '@/lib/sprint-planner/api';
import { ZONE_TONE, formatHours, formatPct, formatRange, type StepId } from '@/lib/sprint-planner/format';
import { connectPlanSocket } from '@/lib/sprint-planner/plan-socket';
import { syncedAgo } from '@/lib/sprint-planner/scope';
import {
  FIELD_LABEL, KIND_LABEL, datedLabel, jiraFieldLabel, jumpLabel, jumpTarget, pendingsCounter, pendingsOf, previewValue, sendBlockReason, summaryLine,
  type JumpTarget,
} from '@/lib/sprint-planner/review';
import { ZONE_BAR } from './CapacityThermometer';

type Load = { state: 'loading' } | { state: 'error'; message: string; notFound: boolean } | { state: 'ok'; view: ReviewView };

const KIND_TONE: Record<PreviewKind, 'success' | 'warn' | 'neutral'> = { SET: 'success', CHANGE: 'warn', UNCHANGED: 'neutral' };

function Counters({ view }: { view: ReviewView }) {
  const clear = view.blockingCount === 0 && view.warningCount === 0;
  return (
    <section aria-label="Situação da revisão" className={cn(PAGE_CARD, 'flex flex-wrap items-center gap-3 p-4 sm:p-5')} data-testid="contadores">
      {clear ? <StatusChip tone="success">Sem pendências</StatusChip> : view.blockingCount > 0 ? <StatusChip tone="danger">Não pode enviar</StatusChip> : <StatusChip tone="warn">Só avisos</StatusChip>}
      <p className="text-base font-bold text-foreground" data-testid="resumo-contagem">{summaryLine(view)}</p>
    </section>
  );
}

function PeopleSummary({ people }: { people: ReviewPerson[] }) {
  return (
    <section aria-labelledby="rev-pessoas" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-4 sm:p-5')}>
      <h2 id="rev-pessoas" className="text-base font-bold text-foreground">Por pessoa</h2>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pessoa com capacidade neste plano.</p>
      ) : (
        <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {people.map((p) => {
            const width = p.pct == null ? 0 : Math.min(100, Math.max(0, p.pct));
            return (
              <li key={p.accountId} className="flex flex-col gap-1" data-testid={`rev-pessoa-${p.accountId}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{p.name} <span className="font-normal text-muted-foreground">· {p.role}</span></span>
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
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatHours(p.allocatedHours)} de {formatHours(p.capacityHours)} · sobram {formatHours(p.freeHours)} · <span data-testid={`datas-${p.accountId}`}>{datedLabel(p.datedSubtaskCount, p.subtaskCount)}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TaskCard({ task, open, onToggle }: { task: ReviewTask; open: boolean; onToggle: () => void }) {
  const panel = `rev-tarefa-${task.itemId}`;
  return (
    <li className={cn(PAGE_CARD, 'flex flex-col gap-2 p-3 sm:p-4')} data-testid={`rev-tarefa-${task.parentKey}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="flex min-h-8 w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.5} /> : <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
        <span className="text-sm font-bold text-foreground">{task.parentKey}</span>
        <span className="min-w-0 flex-1 text-sm text-muted-foreground">{task.title}</span>
        <span className="text-xs tabular-nums text-muted-foreground">DEV {formatHours(task.devHours)} · QA {formatHours(task.qaHours)}</span>
      </button>
      {open && (
        <ul id={panel} className="flex flex-col divide-y divide-border">
          {task.subtasks.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm" data-testid={`rev-sub-${s.key}`}>
              <span className="font-semibold text-foreground">{s.key}</span>
              <span className="min-w-0 flex-1 text-muted-foreground">{s.title}{s.typeName ? ` · ${s.typeName}` : ''}</span>
              <span className={cn(!s.assigneeName && 'font-semibold text-destructive')}>{s.assigneeName ?? 'Sem responsável'}</span>
              <span className={cn('tabular-nums', !s.startDate && 'font-semibold text-destructive')}>
                {s.startDate && s.endDate ? formatRange(s.startDate, s.endDate) : 'Sem datas'}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{formatHours(s.estimateH)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function TasksSummary({ tasks }: { tasks: ReviewTask[] }) {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const allOpen = tasks.length > 0 && tasks.every((t) => openIds[t.itemId]);
  return (
    <section aria-labelledby="rev-tarefas" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="rev-tarefas" className="text-base font-bold text-foreground">Por tarefa</h2>
        {tasks.length > 0 && (
          <ModalButton onClick={() => setOpenIds(allOpen ? {} : Object.fromEntries(tasks.map((t) => [t.itemId, true])))}>
            {allOpen ? 'Recolher tudo' : 'Expandir tudo'}
          </ModalButton>
        )}
      </div>
      {tasks.length === 0 ? (
        <EmptyState title="Nenhuma tarefa no escopo" description="Volte ao Escopo e adicione tarefas ao planejamento." />
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => <TaskCard key={t.itemId} task={t} open={!!openIds[t.itemId]} onToggle={() => setOpenIds((o) => ({ ...o, [t.itemId]: !o[t.itemId] }))} />)}
        </ul>
      )}
    </section>
  );
}

function PendingGroup({ title, tone, items, onJump }: { title: string; tone: 'danger' | 'warn'; items: ReviewPending[]; onJump: (t: JumpTarget) => void }) {
  if (items.length === 0) return null;
  const Icon = tone === 'danger' ? AlertCircle : AlertTriangle;
  return (
    <div className="flex flex-col gap-1.5" data-testid={`pendencias-${tone === 'danger' ? 'bloqueio' : 'aviso'}`}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Icon aria-hidden="true" className={cn('h-4 w-4', tone === 'danger' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400')} strokeWidth={1.5} />
        {title} ({items.length})
      </h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((p, i) => {
          const target = jumpTarget(p);
          return (
            <li key={`${p.code}-${p.subtaskKey ?? p.accountId ?? p.itemId ?? i}`} className="flex flex-wrap items-center gap-2 text-sm text-foreground" data-testid="pendencia">
              <StatusChip tone={tone}>{tone === 'danger' ? 'Impede' : 'Aviso'}</StatusChip>
              <span className="min-w-0 flex-1">{p.message}</span>
              {target && (
                <button
                  type="button"
                  onClick={() => onJump(target)}
                  className="min-h-6 rounded-md px-1 text-xs font-semibold underline underline-offset-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {jumpLabel(p)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Pendings({ view, mobile, onJump }: { view: ReviewView; mobile: boolean; onJump: (t: JumpTarget) => void }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const shown = open ?? !mobile;
  const blocking = pendingsOf(view, 'BLOCKING');
  const warnings = pendingsOf(view, 'WARNING');
  return (
    <section aria-labelledby="rev-pend" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-4 sm:p-5')}>
      <h2 id="rev-pend" className="text-base font-bold text-foreground">
        <button
          type="button"
          aria-expanded={shown}
          aria-controls="rev-pend-lista"
          onClick={() => setOpen(!shown)}
          className="flex min-h-8 w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {shown ? <ChevronDown aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> : <ChevronRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />}
          Pendências <span className="font-normal text-muted-foreground" data-testid="contador-pendencias">{pendingsCounter(view)}</span>
        </button>
      </h2>
      {shown && (
        <div id="rev-pend-lista" className="flex flex-col gap-4">
          {view.pendings.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="sem-pendencias">Tudo com dono e datas. Nada impede o envio.</p>
          ) : (
            <>
              <PendingGroup title="Impedem o envio" tone="danger" items={blocking} onJump={onJump} />
              <PendingGroup title="Avisos" tone="warn" items={warnings} onJump={onJump} />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function KindChip({ kind }: { kind: PreviewKind }) {
  return <StatusChip tone={KIND_TONE[kind]}>{kind} · {KIND_LABEL[kind]}</StatusChip>;
}

function FieldCell({ c }: { c: JiraChange }) {
  return (
    <>
      <span className="font-semibold text-foreground">{FIELD_LABEL[c.field]}</span>
      <span className={cn('text-xs text-muted-foreground', !c.jiraFieldName && 'italic')}>{jiraFieldLabel(c)}</span>
    </>
  );
}

function JiraPreviewSection({ view, mobile }: { view: ReviewView; mobile: boolean }) {
  const p = view.jiraPreview;
  return (
    <section aria-labelledby="rev-jira" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-4 sm:p-5')} data-testid="previa-jira">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="rev-jira" className="text-base font-bold text-foreground">Prévia do que será gravado no Jira</h2>
        <StatusChip tone="warn">Regras de escrita no Jira em definição</StatusChip>
      </div>
      <p className="text-sm text-muted-foreground">
        {p.rulesNote ?? 'Por subtarefa: responsável, sprint e datas. Os campos de data do Jira e o que fazer com o que já estiver preenchido ainda serão decididos.'}
      </p>
      <p className="text-sm tabular-nums text-foreground" data-testid="contadores-previa">
        {p.counts.issues} {p.counts.issues === 1 ? 'issue' : 'issues'} · {p.counts.set} a definir · {p.counts.change} a alterar · {p.counts.unchanged} iguais
      </p>

      {p.sprintGoal && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm" data-testid="previa-meta">
          <span className="font-semibold text-foreground">Meta da sprint</span>
          <KindChip kind={p.sprintGoal.kind} />
          <span className="min-w-0 flex-1 text-muted-foreground">
            {p.sprintGoal.to ? `“${p.sprintGoal.to}”` : 'Sem meta'} será gravada no Sprint goal{view.goalSavedInJira && p.sprintGoal.kind === 'UNCHANGED' ? ' (já está no Jira)' : ''}.
          </span>
        </div>
      )}

      {p.changes.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="previa-vazia">Nenhuma mudança a gravar por enquanto.</p>
      ) : mobile ? (
        <ul className="flex flex-col gap-2" data-testid="previa-cartoes">
          {p.changes.map((c, i) => (
            <li key={`${c.issueKey}-${c.field}-${i}`} className="flex flex-col gap-1 rounded-xl border border-border p-3 text-sm" data-testid="previa-linha">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-foreground">{c.issueKey}</span>
                <KindChip kind={c.kind} />
              </div>
              {c.summary && <span className="text-muted-foreground">{c.summary}</span>}
              <div className="flex flex-wrap items-baseline gap-2"><FieldCell c={c} /></div>
              <p className="tabular-nums text-foreground">{previewValue(c.from)} <span aria-label="para">→</span> {previewValue(c.to)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm" data-testid="previa-tabela">
            <caption className="sr-only">Mudanças que seriam gravadas no Jira</caption>
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-3">Issue</th>
                <th scope="col" className="py-2 pr-3">Campo</th>
                <th scope="col" className="py-2 pr-3">De</th>
                <th scope="col" className="py-2 pr-3">Para</th>
                <th scope="col" className="py-2">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {p.changes.map((c, i) => (
                <tr key={`${c.issueKey}-${c.field}-${i}`} data-testid="previa-linha">
                  <th scope="row" className="py-2 pr-3 align-top font-semibold text-foreground">
                    {c.issueKey}
                    {c.summary && <span className="block text-xs font-normal text-muted-foreground">{c.summary}</span>}
                  </th>
                  <td className="py-2 pr-3 align-top"><div className="flex flex-col"><FieldCell c={c} /></div></td>
                  <td className="py-2 pr-3 align-top tabular-nums text-muted-foreground">{previewValue(c.from)}</td>
                  <td className="py-2 pr-3 align-top tabular-nums text-foreground">{previewValue(c.to)}</td>
                  <td className="py-2 align-top"><KindChip kind={c.kind} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Mudanças depois do envio: regra em definição.</p>
    </section>
  );
}

export interface ReviewStepProps {
  squadId: string;
  planId: string;
  /** Leva para outra etapa (usa `?etapa=`); `focus` é a subtarefa, pessoa ou tarefa do atalho. */
  onJump: (step: StepId, focus: string | null) => void;
  /** Volta o plano para a Distribuição (só liderança); sem a prop, o botão não aparece. */
  onBack?: () => void;
  backing?: boolean;
  /** Muda quando o plano muda por fora, para recarregar a revisão. */
  refreshKey?: number | string;
}

/**
 * Etapa 4: Revisar e enviar. Resumo por pessoa e por tarefa, pendências (vermelhas impedem, amarelas avisam) e a prévia
 * do que seria gravado no Jira. Tudo o que é regra (contagens, severidade, canSend, prévia) vem do servidor.
 * O envio ao Jira responde 501 até as regras de escrita serem definidas.
 */
export function ReviewStep({ squadId, planId, onJump, onBack, backing, refreshKey }: ReviewStepProps) {
  const { toast } = useToast();
  const mobile = useBelowBreakpoint(768);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const loaded = useRef(false);

  const reload = useCallback(async (quiet = true) => {
    if (!quiet) setLoad({ state: 'loading' });
    setRefreshing(true);
    try {
      const view = await reviewApi.get(squadId, planId);
      loaded.current = true;
      setLoad({ state: 'ok', view });
    } catch (e) {
      const s = statusOf(e);
      if (!loaded.current || !quiet) setLoad({ state: 'error', message: errorMessage(e, 'Não foi possível carregar a revisão.'), notFound: s === 404 || s === 403 });
    } finally {
      setRefreshing(false);
    }
  }, [squadId, planId]);

  useEffect(() => { void reload(false); }, [reload, refreshKey]);
  useEffect(() => {
    const close = connectPlanSocket(planId, { onRefresh: () => void reload(true) });
    return () => { if (typeof close === 'function') close(); };
  }, [planId, reload]);

  if (load.state === 'loading') return <LoadingSkeleton variant="page" label="Carregando a revisão" />;
  if (load.state === 'error') {
    return load.notFound
      ? <EmptyState title="Revisão não encontrada" description="O planejamento pode ter sido excluído ou ser de outra squad." />
      : <ErrorState title="Não foi possível carregar a revisão" description={load.message} onRetry={() => void reload(false)} />;
  }

  const view = load.view;
  const canEdit = view.canEditPlan;
  const reason = sendBlockReason(view, canEdit);
  const sent = view.status === 'ENVIADO';
  const empty = view.tasks.length === 0 && view.people.length === 0;

  const send = async () => {
    setSending(true);
    setSendError(null);
    try {
      await reviewApi.sendToJira(squadId, planId);
      toast({ title: 'Enviado ao Jira' });
      await reload(true);
    } catch (e) {
      setSendError(errorMessage(e, 'Não foi possível enviar ao Jira.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="revisao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {formatRange(view.sprint.startDate, view.sprint.endDate)}
          {syncedAgo(view.syncedAt) ? ` · Jira sincronizado ${syncedAgo(view.syncedAt)}` : ''}
        </p>
        <ModalButton onClick={() => void reload(true)} disabled={refreshing}>
          <RefreshCw aria-hidden="true" className={cn('h-4 w-4', refreshing && 'motion-safe:animate-spin')} strokeWidth={1.5} /> Atualizar
        </ModalButton>
      </div>

      {!canEdit && !sent && (
        <p role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground" data-testid="somente-leitura">
          Esta etapa está somente para consulta: só a liderança revisa e envia ao Jira.
        </p>
      )}
      {sent && (
        <p role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground" data-testid="enviado">
          Este planejamento já foi enviado ao Jira. Falta só iniciar a sprint, que continua sendo no Jira.
        </p>
      )}

      <Counters view={view} />

      {empty ? (
        <EmptyState title="Nada para revisar ainda" description="Adicione tarefas ao escopo e distribua as subtarefas para ver o resumo aqui." />
      ) : (
        <>
          <Pendings view={view} mobile={mobile} onJump={(t) => onJump(t.step, t.focus)} />
          <PeopleSummary people={view.people} />
          <TasksSummary tasks={view.tasks} />
          <JiraPreviewSection view={view} mobile={mobile} />
        </>
      )}

      <section aria-label="Enviar" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && onBack && !sent && (
            <ModalButton onClick={onBack} disabled={backing}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> Voltar para a Distribuição
            </ModalButton>
          )}
          <ModalButton variant="primary" onClick={() => void send()} disabled={!!reason || sending} aria-describedby="rev-motivo">
            <Send aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} /> {sending ? 'Enviando ao Jira…' : 'Enviar ao Jira'}
          </ModalButton>
          {view.jiraSprintUrl && (
            <a
              href={view.jiraSprintUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-sm font-semibold underline underline-offset-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Iniciar a sprint no Jira <ExternalLink aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          )}
        </div>
        <p id="rev-motivo" className="text-sm text-muted-foreground" data-testid="motivo-envio">
          {reason ?? 'Tudo pronto: o envio grava as mudanças acima no Jira. Iniciar a sprint continua sendo no Jira.'}
        </p>
        {sendError && <p role="alert" className="text-sm font-semibold text-destructive" data-testid="erro-envio">{sendError}</p>}
      </section>
    </div>
  );
}
