'use client';

import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, Loader2, RotateCw, ScrollText, Trash2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { StatusChip, type Tone } from '@/components/room-kit';
import { Button } from '@/components/ui/button';
import { PAGE_CARD } from '@/components/page/styles';
import { cn } from '@/lib/utils';
import type { JiraPublishEvent, JiraPublishJob, JiraVerifyResult } from '@/app/room/jira-publish-api';
import { StepStatusIcon } from '@/components/poker/JiraPublishDialog';
import {
  canDiscard,
  canRetry,
  canVerify,
  doneCount,
  eventLabel,
  eventTone,
  formatWhen,
  jiraIssueUrl,
  stepDetail,
  stepLabel,
} from './queue-helpers';

export type LogState = JiraPublishEvent[] | 'loading' | 'error';

interface JiraJobCardProps {
  job: JiraPublishJob;
  jiraDomain?: string | null;
  /** Ação em andamento neste envio, para travar os botões e mostrar o giro. */
  busy?: 'retry' | 'verify' | 'discard' | null;
  logOpen: boolean;
  log?: LogState;
  verify?: JiraVerifyResult;
  onRetry: (job: JiraPublishJob) => void;
  onVerify: (job: JiraPublishJob) => void;
  onDiscard: (job: JiraPublishJob) => void;
  onToggleLog: (job: JiraPublishJob) => void;
}

function chipFor(job: JiraPublishJob): { tone: Tone; label: string } {
  if (job.status === 'DONE') return { tone: 'success', label: 'Enviado' };
  if (job.status === 'ERROR') return { tone: 'danger', label: 'Erro' };
  if (job.stale) return { tone: 'warn', label: 'Travado' };
  if (job.status === 'RUNNING') return { tone: 'brand', label: 'Enviando' };
  return { tone: 'neutral', label: 'Na fila' };
}

function KeyLink({ domain, issueKey }: { domain?: string | null; issueKey?: string | null }) {
  if (!issueKey) return null;
  const url = jiraIssueUrl(domain, issueKey);
  if (!url) return <span className="font-mono text-xs">{issueKey}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded font-mono text-xs underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title="Abrir no Jira"
    >
      {issueKey}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

/** Um envio da fila: estado, passos com o que deu certo ou errado, e as ações (tentar de novo, conferir, log, descartar). */
export function JiraJobCard({ job, jiraDomain, busy, logOpen, log, verify, onRetry, onVerify, onDiscard, onToggleLog }: JiraJobCardProps) {
  const chip = chipFor(job);
  const failed = job.status === 'ERROR';
  const stale = !!job.stale && !failed;
  const working = !!busy;
  const checkByIndex = new Map((verify?.checks ?? []).map(c => [c.index, c]));

  return (
    <li className={cn(PAGE_CARD, 'flex flex-col gap-3 p-4', failed && 'border-destructive/40')} aria-label={`Envio de ${job.parentKey}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusChip tone={chip.tone} dot>{chip.label}</StatusChip>
        <KeyLink domain={jiraDomain} issueKey={job.parentKey} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={job.parentSummary ?? undefined}>{job.parentSummary}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{doneCount(job)}/{job.steps.length} passos</span>
      </div>

      <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <span>{formatWhen(job.createdAt)}</span>
        {job.requestedByName && <span>· por {job.requestedByName}</span>}
        {job.roomTitle && job.roomId && (
          <span>
            · sala{' '}
            <Link href={`/room/${job.roomId}`} className="underline-offset-2 hover:underline">{job.roomTitle}</Link>
          </span>
        )}
      </p>

      {(failed || stale) && (
        <div role="alert" className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', failed ? 'border-destructive/40 bg-destructive/10' : 'border-amber-500/50 bg-amber-500/10')}>
          <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', failed ? 'text-destructive' : 'text-amber-600')} aria-hidden />
          <p className="m-0 text-foreground">
            {failed
              ? (job.errorMessage ?? 'O envio falhou.')
              : 'Este envio parou de responder (o servidor pode ter reiniciado no meio). Tente novamente: o que já foi feito não se repete.'}
          </p>
        </div>
      )}

      <ol className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="Passos do envio">
        {job.steps.map(s => {
          const check = checkByIndex.get(s.index);
          return (
            <li key={s.index} className="flex flex-col gap-0.5 rounded-lg bg-muted/30 px-3 py-2 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <StepStatusIcon status={s.status ?? 'PENDING'} />
                <span className="font-medium">{stepLabel(s)}</span>
                {s.resultKey && s.kind === 'CREATE_SUBTASK' && <KeyLink domain={jiraDomain} issueKey={s.resultKey} />}
                {(s.attempts ?? 0) > 1 && <span className="text-xs text-muted-foreground">{s.attempts} tentativas</span>}
                {check && (
                  <span
                    className={cn(
                      'ml-auto inline-flex items-center gap-1 text-xs',
                      check.status === 'OK' ? 'text-emerald-600' : check.status === 'DIVERGENT' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {check.status === 'OK' ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
                    {check.status === 'OK' ? 'Confirmado no Jira' : check.status === 'DIVERGENT' ? 'Diferente no Jira' : 'Não enviado'}
                  </span>
                )}
              </div>
              {stepDetail(s) && <span className="truncate pl-6 text-xs text-muted-foreground" title={stepDetail(s, 400)}>{stepDetail(s)}</span>}
              {s.status === 'ERROR' && s.errorMessage && <span className="pl-6 text-xs text-destructive">{s.errorMessage}</span>}
              {check && check.status !== 'OK' && <span className="pl-6 text-xs text-muted-foreground">{check.detail}</span>}
            </li>
          );
        })}
      </ol>

      {verify && (
        <p
          role="status"
          className={cn('m-0 flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]', verify.allOk ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/50 bg-amber-500/10')}
        >
          {verify.allOk ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />}
          {verify.total === 0
            ? 'Nada concluído para conferir ainda.'
            : `Conferido no Jira agora: ${verify.confirmed} de ${verify.total} ${verify.total === 1 ? 'passo concluído confirmado' : 'passos concluídos confirmados'}.`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canRetry(job) && (
          <Button size="sm" onClick={() => onRetry(job)} disabled={working} className="gap-2">
            {busy === 'retry' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCw className="h-3.5 w-3.5" aria-hidden />}
            Tentar novamente
          </Button>
        )}
        {canVerify(job) && (
          <Button size="sm" variant="outline" onClick={() => onVerify(job)} disabled={working} className="gap-2">
            {busy === 'verify' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileSearch className="h-3.5 w-3.5" aria-hidden />}
            Conferir no Jira
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onToggleLog(job)} aria-expanded={logOpen} className="gap-2">
          <ScrollText className="h-3.5 w-3.5" aria-hidden />
          {logOpen ? 'Ocultar log' : 'Ver log'}
        </Button>
        {canDiscard(job) && (
          <Button size="sm" variant="ghost" onClick={() => onDiscard(job)} disabled={working} className="ml-auto gap-2 text-destructive hover:text-destructive">
            {busy === 'discard' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
            Descartar
          </Button>
        )}
      </div>

      {logOpen && (
        <section aria-label="Log do envio" className="rounded-lg border border-border bg-muted/20 p-3 text-[13px]">
          {log === 'loading' || log === undefined ? (
            <p className="m-0 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Carregando o log</p>
          ) : log === 'error' ? (
            <p className="m-0 text-destructive">Não foi possível carregar o log.</p>
          ) : log.length === 0 ? (
            <p className="m-0 text-muted-foreground">Sem registros para este envio (feito antes do log existir).</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {log.map(e => {
                const tone = eventTone(e);
                return (
                  <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatWhen(e.createdAt)}</span>
                    <span className={cn('font-medium', tone === 'ok' && 'text-emerald-600', tone === 'error' && 'text-destructive')}>{eventLabel(e)}</span>
                    {e.userName && <span className="text-xs text-muted-foreground">por {e.userName}</span>}
                    {e.message && <span className="basis-full pl-[4.5rem] text-xs text-muted-foreground max-sm:pl-0">{e.message}</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </li>
  );
}
