'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Loader2, RotateCw, Send } from 'lucide-react';
import type { Issue } from '@/lib/types';
import { FOCUS_RING, Modal, ModalButton } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { jiraPublishApi, type JiraPublishJob, type JiraPublishStep } from '@/app/room/jira-publish-api';
import { buildSteps, countsLabel, draftAttention, draftCounts, draftFromPreview, JiraPublishEditor, validateDraft, type JiraDraft } from './jira-publish-draft';
import { PreviewError } from './JiraPublishDialog';

interface JiraBatchPublishDialogProps {
  roomId: string;
  /** Tarefas candidatas (estimadas, com chave do Jira e ainda não enviadas). */
  issues: Issue[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Envios da sala (mantidos pela sala com o WebSocket): o andamento de cada passo vem daqui. */
  jobs: JiraPublishJob[];
  onPublished?: (job: JiraPublishJob) => void;
  onRetry: (jobId: string) => void;
  retryingId?: string | null;
}

type Entry = { loading: boolean; draft: JiraDraft | null; error: string | null };

const CHECK = 'h-4 w-4 shrink-0 accent-[hsl(var(--primary))]';
const BADGE = 'inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2 text-xs font-semibold';

/**
 * Enviar várias tarefas ao Jira: primeiro a prévia de todas (lista à esquerda, a selecionada editável à direita),
 * depois o andamento — uma de cada vez, passo a passo. Se algo falha, o envio daquela tarefa para no passo
 * e a nova tentativa continua dali, sem duplicar.
 */
export function JiraBatchPublishDialog({ roomId, issues, open, onOpenChange, jobs, onPublished, onRetry, retryingId }: JiraBatchPublishDialogProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'review' | 'sending'>('review');
  const [order, setOrder] = useState<string[]>([]);
  const [sendingIndex, setSendingIndex] = useState(-1);
  const [jobByIssue, setJobByIssue] = useState<Record<string, string>>({});
  const loadedFor = useRef<string>('');

  // Abre na prévia: carrega a de cada tarefa em paralelo (uma falha não derruba as outras).
  useEffect(() => {
    if (!open || phase === 'sending') return;
    const key = issues.map(i => i.id).join(',');
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setSelected(new Set(issues.map(i => i.id)));
    setCurrentId(issues[0]?.id ?? null);
    setEntries(Object.fromEntries(issues.map(i => [i.id, { loading: true, draft: null, error: null }])));
    issues.forEach(i => {
      jiraPublishApi.preview(roomId, i.id)
        .then(p => setEntries(prev => ({ ...prev, [i.id]: { loading: false, draft: draftFromPreview(p), error: null } })))
        .catch(e => setEntries(prev => ({ ...prev, [i.id]: { loading: false, draft: null, error: e instanceof Error ? e.message : 'Falha ao montar a prévia.' } })));
    });
  }, [open, issues, roomId, phase]);

  // Fechou depois de tudo enviado: a próxima abertura recomeça da prévia.
  useEffect(() => {
    if (open || phase !== 'sending' || sendingIndex < order.length) return;
    setPhase('review');
    loadedFor.current = '';
  }, [open, phase, sendingIndex, order.length]);

  const list = issues;
  const sendable = list.filter(i => selected.has(i.id) && entries[i.id]?.draft);
  const totals = useMemo(() => {
    let rename = 0, subtasks = 0, comments = 0, attention = 0;
    for (const i of sendable) {
      const d = entries[i.id]!.draft!;
      const c = draftCounts(d);
      rename += c.rename; subtasks += c.subtasks; comments += c.comments;
      if (draftAttention(d).length > 0) attention += 1;
    }
    return { rename, subtasks, comments, attention };
  }, [sendable, entries]);
  const invalid = sendable.map(i => ({ i, why: validateDraft(entries[i.id]!.draft!) })).find(x => x.why);
  const stillLoading = list.some(i => selected.has(i.id) && entries[i.id]?.loading);

  const current = list.find(i => i.id === currentId) ?? null;
  const currentEntry = current ? entries[current.id] : undefined;
  const currentPos = current ? list.indexOf(current) : -1;

  const send = async () => {
    const ids = sendable.map(i => i.id);
    if (ids.length === 0) return;
    setOrder(ids);
    setPhase('sending');
    for (let n = 0; n < ids.length; n++) {
      setSendingIndex(n);
      const id = ids[n];
      try {
        const job = await jiraPublishApi.submit(roomId, id, buildSteps(entries[id]!.draft!));
        setJobByIssue(prev => ({ ...prev, [id]: job.id }));
        onPublished?.(job);
      } catch (e) {
        const issue = list.find(i => i.id === id);
        toast({ title: `Não foi possível enviar ${issue?.key ?? 'a tarefa'}`, description: e instanceof Error ? e.message : 'Erro inesperado.', variant: 'destructive' });
        setJobByIssue(prev => ({ ...prev, [id]: '' }));
      }
    }
    setSendingIndex(ids.length);
  };

  if (phase === 'sending') {
    return (
      <SendingView
        open={open}
        onOpenChange={onOpenChange}
        issues={order.map(id => list.find(i => i.id === id)).filter((i): i is Issue => !!i)}
        sendingIndex={sendingIndex}
        jobByIssue={jobByIssue}
        jobs={jobs}
        onRetry={onRetry}
        retryingId={retryingId}
      />
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      icon={Send}
      title={list.length === 1 ? 'Enviar 1 tarefa para o Jira' : `Enviar ${list.length} tarefas para o Jira`}
      description="Confira cada uma à esquerda. O portal só renomeia a pai, cria sub-tarefas e comenta nelas; nada é apagado."
      bodyClassName="p-0"
      footerStart={
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">
            {sendable.length} {sendable.length === 1 ? 'tarefa' : 'tarefas'} · {countsLabel(totals)}
            {totals.attention > 0 && <span className="text-amber-700 dark:text-amber-300"> · {totals.attention} com atenção</span>}
          </span>
          <span className="text-xs text-muted-foreground">As estimativas ficam salvas no portal. Dá para enviar depois pelo relatório.</span>
        </div>
      }
      footer={
        <>
          <ModalButton onClick={() => onOpenChange(false)}>Agora não</ModalButton>
          <ModalButton
            variant="primary"
            onClick={send}
            disabled={sendable.length === 0 || !!invalid || stillLoading}
            title={invalid ? `${invalid.i.key}: ${invalid.why}` : undefined}
            className="gap-2"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {sendable.length === 1 ? 'Enviar 1 para o Jira' : `Enviar ${sendable.length} para o Jira`}
          </ModalButton>
        </>
      }
    >
      <div className="grid h-[min(64vh,680px)] min-h-0 md:grid-cols-[22rem_minmax(0,1fr)]">
        <aside aria-label="Tarefas do envio" className="flex min-h-0 flex-col gap-2.5 border-border bg-muted/30 p-4 max-md:max-h-[40vh] max-md:border-b md:border-r">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input
                type="checkbox"
                className={CHECK}
                checked={selected.size === list.length && list.length > 0}
                onChange={(e) => setSelected(e.target.checked ? new Set(list.map(i => i.id)) : new Set())}
              />
              Todas
            </label>
            <span className="flex-1" />
            <span className="text-xs text-emerald-700 dark:text-emerald-300">{list.filter(i => entries[i.id]?.draft && draftAttention(entries[i.id]!.draft!).length === 0).length} prontas</span>
            {totals.attention > 0 && <span className="text-xs text-amber-700 dark:text-amber-300">{totals.attention} com atenção</span>}
          </div>
          <ul className="m-0 flex min-h-0 list-none flex-col gap-2 overflow-y-auto p-0">
            {list.map(i => {
              const e = entries[i.id];
              const att = e?.draft ? draftAttention(e.draft) : [];
              const badge = e?.loading
                ? { text: 'Carregando', cls: 'bg-muted text-muted-foreground' }
                : e?.error
                  ? { text: 'Sem prévia', cls: 'bg-red-500/10 text-red-700 dark:text-red-300' }
                  : att.length > 0
                    ? { text: 'Atenção', cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-200' }
                    : { text: 'Pronta', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' };
              const active = i.id === currentId;
              return (
                <li key={i.id}>
                  <div className={cn('flex items-start gap-2.5 rounded-xl border p-3', active ? 'border-primary/60 bg-primary/5' : att.length > 0 ? 'border-amber-500/40' : 'border-border bg-card')}>
                    <input
                      type="checkbox"
                      className={cn(CHECK, 'mt-0.5')}
                      checked={selected.has(i.id)}
                      disabled={!e?.draft}
                      onChange={(ev) => setSelected(prev => { const n = new Set(prev); if (ev.target.checked) n.add(i.id); else n.delete(i.id); return n; })}
                      aria-label={`Enviar ${i.key ?? i.title}`}
                    />
                    <button type="button" onClick={() => setCurrentId(i.id)} aria-current={active} className={cn('flex min-w-0 flex-1 flex-col gap-1.5 rounded text-left', FOCUS_RING)}>
                      <span className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{i.key}</span>
                        <span className="flex-1" />
                        <span className={cn(BADGE, badge.cls)}>{badge.text}</span>
                      </span>
                      <span className="line-clamp-2 text-[13px] font-medium leading-snug">{i.title}</span>
                      {e?.draft && <span className="text-xs text-muted-foreground">{countsLabel(draftCounts(e.draft))}</span>}
                      {att[0] && <span className="line-clamp-2 text-xs leading-snug text-amber-700 dark:text-amber-300">{att[0]}</span>}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>

        <section aria-label={current ? `Detalhe de ${current.key}` : 'Detalhe'} className="flex min-h-0 flex-col gap-3.5 overflow-y-auto px-6 py-5">
          {current && (
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs font-bold">{current.key}</span>
              <span className="text-[13px] text-muted-foreground">{currentPos + 1} de {list.length}</span>
              <span className="flex-1" />
              <button type="button" aria-label="Tarefa anterior" disabled={currentPos <= 0} onClick={() => setCurrentId(list[currentPos - 1]?.id ?? currentId)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent disabled:opacity-40', FOCUS_RING)}>
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button type="button" aria-label="Próxima tarefa" disabled={currentPos >= list.length - 1} onClick={() => setCurrentId(list[currentPos + 1]?.id ?? currentId)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent disabled:opacity-40', FOCUS_RING)}>
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          )}
          {currentEntry?.loading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Montando a prévia…
            </div>
          )}
          {currentEntry?.error && <PreviewError message={currentEntry.error} />}
          {current && currentEntry?.draft && (
            <JiraPublishEditor
              key={current.id}
              draft={currentEntry.draft}
              onChange={(d) => setEntries(prev => ({ ...prev, [current.id]: { ...prev[current.id]!, draft: d } }))}
              idPrefix={`jira-batch-${current.id}`}
            />
          )}
        </section>
      </div>
    </Modal>
  );
}

const STEP_LABEL: Record<string, string> = { DONE: 'Feito', ERROR: 'Falhou', SKIPPED: 'Pulado', PENDING: 'Na fila' };

function stepLabel(s: JiraPublishStep, steps: JiraPublishStep[]): string {
  if (s.kind === 'RENAME_PARENT') return 'Renomear a pai';
  if (s.kind === 'CREATE_SUBTASK') return `Criar ${s.summary || s.issueType || 'sub-tarefa'}`;
  const parent = steps.find(x => x.index === s.dependsOnIndex);
  return `Comentar em ${parent?.summary || parent?.issueType || 'sub-tarefa'}`;
}

/** Andamento do envio em lote: uma linha por tarefa, os passos da que está indo e o erro com "Tentar novamente". */
function SendingView({ open, onOpenChange, issues, sendingIndex, jobByIssue, jobs, onRetry, retryingId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: Issue[];
  sendingIndex: number;
  jobByIssue: Record<string, string>;
  jobs: JiraPublishJob[];
  onRetry: (jobId: string) => void;
  retryingId?: string | null;
}) {
  const jobOf = (issueId: string) => {
    const id = jobByIssue[issueId];
    return id ? jobs.find(j => j.id === id) ?? null : null;
  };
  const doneCount = issues.filter(i => jobOf(i.id)?.status === 'DONE').length;
  const pct = issues.length ? Math.round((doneCount / issues.length) * 100) : 0;
  const finished = sendingIndex >= issues.length;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      icon={Send}
      title={issues.length === 1 ? 'Enviando 1 tarefa para o Jira' : `Enviando ${issues.length} tarefas para o Jira`}
      description="Uma de cada vez, passo a passo. Se algo falhar, o envio para naquele passo e você tenta de novo sem duplicar nada."
      headerExtra={
        <div className="flex items-center gap-3 border-b border-border px-6 pb-3.5">
          <span className="text-[13px] font-semibold tabular-nums">{doneCount} de {issues.length} {doneCount === 1 ? 'concluída' : 'concluídas'}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="block h-full rounded-full bg-primary transition-[width] duration-slow" style={{ width: `${pct}%` }} />
          </span>
        </div>
      }
      footerStart={<span className="text-[13px] text-muted-foreground">Pode fechar: o envio continua enquanto a sala estiver aberta e fica no Histórico da sala, em &quot;Envios para o Jira&quot;.</span>}
      footer={<ModalButton variant={finished ? 'primary' : 'secondary'} onClick={() => onOpenChange(false)}>Fechar</ModalButton>}
    >
      <ul aria-live="polite" className="m-0 flex list-none flex-col gap-2.5 p-0 pt-3">
        {issues.map((i, n) => {
          const job = jobOf(i.id);
          const failedToStart = jobByIssue[i.id] === '';
          const state: 'done' | 'run' | 'err' | 'wait' =
            job?.status === 'DONE' ? 'done'
              : job?.status === 'ERROR' || failedToStart ? 'err'
                : job || n === sendingIndex ? 'run'
                  : 'wait';
          const steps = job?.steps ?? [];
          const doneSteps = steps.filter(s => s.status === 'DONE' || s.status === 'SKIPPED').length;
          const tone = {
            done: { row: 'border-border', icon: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', text: 'Enviado' },
            run: { row: 'border-primary/60 bg-primary/5', icon: 'bg-primary/15 text-primary', badge: 'bg-primary/10 text-primary', text: 'Enviando' },
            err: { row: 'border-red-500/50', icon: 'bg-red-500/15 text-red-700 dark:text-red-300', badge: 'bg-red-500/10 text-red-700 dark:text-red-300', text: 'Erro' },
            wait: { row: 'border-border', icon: 'bg-muted text-muted-foreground', badge: 'bg-muted text-muted-foreground', text: 'Na fila' },
          }[state];
          const errorStep = steps.find(s => s.status === 'ERROR');
          return (
            <li key={i.id} className={cn('flex flex-col gap-2.5 rounded-xl border px-3.5 py-3', tone.row)}>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={cn('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] text-sm font-bold', tone.icon)}>
                  {state === 'done' ? <Check className="h-4 w-4" strokeWidth={2} /> : state === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'err' ? '!' : '…'}
                </span>
                <span className="w-32 shrink-0 text-[13px] font-bold text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{i.key}</span>
                <span className="min-w-0 flex-1 truncate text-sm" title={i.title}>{i.title}</span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">{steps.length > 0 ? `${doneSteps} de ${steps.length} passos` : state === 'wait' ? 'aguardando' : ''}</span>
                <span className={cn(BADGE, tone.badge)}>{tone.text}</span>
              </div>
              {(state === 'run' || state === 'err') && steps.length > 0 && (
                <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-5 md:pl-[42px]">
                  {steps.map(s => {
                    const st = s.status ?? 'PENDING';
                    return (
                      <li
                        key={s.index}
                        className={cn(
                          'flex flex-col gap-0.5 rounded-[9px] border px-2.5 py-2 text-xs',
                          st === 'DONE' || st === 'SKIPPED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                            : st === 'ERROR' ? 'border-red-500/45 bg-red-500/10 text-red-800 dark:text-red-200'
                              : 'border-dashed border-border text-muted-foreground'
                        )}
                      >
                        <span className="font-bold">{STEP_LABEL[st] ?? st}</span>
                        <span className="leading-snug">{stepLabel(s, steps)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
              {state === 'err' && (
                <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-red-500/45 bg-red-500/10 px-3 py-2.5 md:ml-[42px]">
                  <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-red-800 dark:text-red-200">
                    {failedToStart
                      ? 'Não deu para começar o envio desta tarefa. Abra pelo relatório e tente de novo.'
                      : `${errorStep ? `${stepLabel(errorStep, steps)}: ` : ''}${errorStep?.errorMessage ?? job?.errorMessage ?? 'o Jira recusou o passo.'} Os passos já feitos ficam; a nova tentativa começa daqui.`}
                  </span>
                  <Link href="/subtarefas" className={cn('whitespace-nowrap text-[13px] font-medium text-primary underline-offset-2 hover:underline [.theme-totvs:not(.dark)_&]:text-foreground', FOCUS_RING)}>
                    Corrigir em Sub-tarefas do time
                  </Link>
                  {job && (
                    <ModalButton variant="primary" onClick={() => onRetry(job.id)} disabled={retryingId === job.id} className="h-9 gap-2 px-3">
                      {retryingId === job.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCw className="h-4 w-4" aria-hidden />}
                      Tentar novamente
                    </ModalButton>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
