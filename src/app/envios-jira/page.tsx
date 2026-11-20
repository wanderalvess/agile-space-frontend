'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Send, Trash2 } from 'lucide-react';
import { PageShell } from '@/components/page/PageShell';
import { PageHeader } from '@/components/page/PageHeader';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/page/States';
import { ConfirmDialog } from '@/components/room-kit';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useActiveSquad } from '@/hooks/useActiveSquad';
import { cn } from '@/lib/utils';
import {
  jiraPublishApi,
  type JiraPublishEvent,
  type JiraPublishJob,
  type JiraPublishSquadQueue,
  type JiraVerifyResult,
} from '@/app/room/jira-publish-api';
import { JiraJobCard, type LogState } from './JiraJobCard';
import { applyFilter, countByFilter, defaultFilter, doneCount, FILTER_LABEL, type QueueFilter } from './queue-helpers';

type BusyAction = 'retry' | 'verify' | 'discard';

const FILTERS: QueueFilter[] = ['ERROR', 'RUNNING', 'DONE', 'ALL'];
const AUTO_REFRESH_MS = 15_000;

/**
 * Fila de envios ao Jira da squad: tudo que o Poker mandou (de qualquer sala), o que deu certo e o que deu erro,
 * com log de tentativas, nova tentativa a partir do passo que falhou, conferência no Jira e descarte.
 */
export default function JiraEnviosPage() {
  const { toast } = useToast();
  const { squadId } = useActiveSquad();

  const [queue, setQueue] = useState<JiraPublishSquadQueue | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<QueueFilter | null>(null);
  const [busy, setBusy] = useState<Record<string, BusyAction>>({});
  const [verifyById, setVerifyById] = useState<Record<string, JiraVerifyResult>>({});
  const [logById, setLogById] = useState<Record<string, LogState>>({});
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const [discardTarget, setDiscardTarget] = useState<JiraPublishJob | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(async (mode: 'first' | 'refresh' = 'first') => {
    if (!squadId) return;
    const seq = ++loadSeq.current;
    if (mode === 'first') setPhase('loading'); else setRefreshing(true);
    try {
      const data = await jiraPublishApi.squadQueue(squadId);
      if (seq !== loadSeq.current) return;
      setQueue(data);
      setLoadError(null);
      setPhase('ready');
    } catch (e) {
      if (seq !== loadSeq.current) return;
      if (mode === 'first') {
        setLoadError(e instanceof Error ? e.message : 'Falha ao carregar.');
        setPhase('error');
      } else {
        toast({ title: 'Não foi possível atualizar', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      }
    } finally {
      if (seq === loadSeq.current) setRefreshing(false);
    }
  }, [squadId, toast]);

  useEffect(() => { setQueue(null); setFilter(null); void load('first'); }, [load]);

  const jobs = useMemo(() => queue?.jobs ?? [], [queue]);
  const counts = useMemo(() => countByFilter(jobs), [jobs]);
  const activeFilter: QueueFilter = filter ?? defaultFilter(counts);
  const visible = useMemo(() => applyFilter(jobs, activeFilter), [jobs, activeFilter]);

  // Enquanto algum envio está andando, atualiza sozinho (o aviso em tempo real só existe dentro da sala).
  const anyRunning = counts.RUNNING > 0;
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => { void load('refresh'); }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [anyRunning, load]);

  const replaceJob = (fresh: JiraPublishJob) => {
    setQueue(prev => prev && {
      ...prev,
      jobs: prev.jobs.map(j => (j.id === fresh.id
        ? { ...fresh, requestedByName: j.requestedByName, roomTitle: j.roomTitle }
        : j)),
    });
  };
  const withBusy = async (jobId: string, action: BusyAction, fn: () => Promise<void>) => {
    setBusy(prev => ({ ...prev, [jobId]: action }));
    try { await fn(); } finally {
      setBusy(prev => { const next = { ...prev }; delete next[jobId]; return next; });
    }
  };
  const loadLog = async (jobId: string) => {
    setLogById(prev => ({ ...prev, [jobId]: 'loading' }));
    try {
      const events: JiraPublishEvent[] = await jiraPublishApi.events(jobId);
      setLogById(prev => ({ ...prev, [jobId]: events }));
    } catch {
      setLogById(prev => ({ ...prev, [jobId]: 'error' }));
    }
  };

  const onRetry = (job: JiraPublishJob) => void withBusy(job.id, 'retry', async () => {
    try {
      const fresh = await jiraPublishApi.retryJob(job.id);
      replaceJob(fresh);
      setVerifyById(prev => { const next = { ...prev }; delete next[job.id]; return next; });
      if (openLogs[job.id]) void loadLog(job.id);
      if (fresh.status === 'DONE') toast({ title: 'Envio concluído', description: `${job.parentKey} foi atualizado no Jira.` });
      else toast({ title: 'O envio parou de novo', description: fresh.errorMessage ?? 'Veja o motivo no envio.', variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Não foi possível tentar de novo', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      void load('refresh');
    }
  });

  const onVerify = (job: JiraPublishJob) => void withBusy(job.id, 'verify', async () => {
    try {
      const result = await jiraPublishApi.verify(job.id);
      setVerifyById(prev => ({ ...prev, [job.id]: result }));
      if (openLogs[job.id]) void loadLog(job.id);
    } catch (e) {
      toast({ title: 'Não foi possível conferir', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    }
  });

  const onToggleLog = (job: JiraPublishJob) => {
    const open = !openLogs[job.id];
    setOpenLogs(prev => ({ ...prev, [job.id]: open }));
    if (open) void loadLog(job.id);
  };

  const confirmDiscard = () => {
    const job = discardTarget;
    if (!job) return;
    void withBusy(job.id, 'discard', async () => {
      try {
        await jiraPublishApi.discard(job.id);
        setQueue(prev => prev && { ...prev, jobs: prev.jobs.filter(j => j.id !== job.id) });
        toast({ title: 'Envio descartado', description: `${job.parentKey} pode ser enviado de novo pelo Poker.` });
      } catch (e) {
        toast({ title: 'Não foi possível descartar', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      } finally {
        setDiscardTarget(null);
      }
    });
  };

  const discardDone = discardTarget ? doneCount(discardTarget) : 0;

  return (
    <PageShell documentTitle="Envios para o Jira">
      <PageHeader
        title="Envios para o Jira"
        subtitle="O que o Poker mandou para o Jira: o que deu certo, o que deu erro, e o que fazer a respeito."
        module="envios-jira"
        actions={
          <Button variant="outline" size="sm" onClick={() => void load('refresh')} disabled={!squadId || refreshing} className="gap-2">
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden />
            Atualizar
          </Button>
        }
      />

      {!squadId && <EmptyState icon={Send} title="Sem squad ativa" description="Escolha uma squad no cabeçalho para ver os envios dela." />}
      {squadId && phase === 'loading' && <LoadingSkeleton rows={4} label="Carregando envios" />}
      {squadId && phase === 'error' && <ErrorState title="Não foi possível carregar" description={loadError ?? undefined} onRetry={() => void load('first')} />}

      {squadId && phase === 'ready' && (
        <>
          {jobs.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Nenhum envio ainda"
              description={'Quando alguém clicar em "Enviar para o Jira" numa sala de Poker desta squad, o envio aparece aqui.'}
            />
          ) : (
            <>
              <div role="tablist" aria-label="Filtrar envios" className="flex flex-wrap gap-2">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11',
                      activeFilter === f ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {FILTER_LABEL[f]}
                    <span className={cn('tabular-nums', f === 'ERROR' && counts.ERROR > 0 && 'font-semibold text-destructive')}>{counts[f]}</span>
                  </button>
                ))}
              </div>

              {visible.length === 0 ? (
                <EmptyState embedded title="Nada neste filtro" description="Troque o filtro acima para ver os outros envios." />
              ) : (
                <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Envios para o Jira">
                  {visible.map(job => (
                    <JiraJobCard
                      key={job.id}
                      job={job}
                      jiraDomain={queue?.jiraDomain}
                      busy={busy[job.id] ?? null}
                      logOpen={!!openLogs[job.id]}
                      log={logById[job.id]}
                      verify={verifyById[job.id]}
                      onRetry={onRetry}
                      onVerify={onVerify}
                      onDiscard={setDiscardTarget}
                      onToggleLog={onToggleLog}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!discardTarget}
        onOpenChange={(o) => { if (!o) setDiscardTarget(null); }}
        tone="danger"
        icon={Trash2}
        title={discardTarget ? `Descartar o envio de ${discardTarget.parentKey}?` : 'Descartar envio?'}
        description="O registro some da fila e do log, e a tarefa pode ser montada e enviada de novo pelo Poker. Nada é desfeito no Jira."
        confirmLabel="Descartar envio"
        onConfirm={confirmDiscard}
        loading={!!discardTarget && busy[discardTarget.id] === 'discard'}
        loadingLabel="Descartando"
        keepOpenOnConfirm
      >
        {discardDone > 0 && (
          <p className="m-0 text-[13px] text-muted-foreground">
            {discardDone} {discardDone === 1 ? 'passo já foi feito' : 'passos já foram feitos'} no Jira e continua lá. Ao enviar de novo, título igual,
            sub-tarefas e comentários que já existem são reconhecidos e não se repetem.
          </p>
        )}
      </ConfirmDialog>
    </PageShell>
  );
}
