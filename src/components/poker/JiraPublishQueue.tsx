'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RotateCw, Send } from 'lucide-react';
import { StatusChip, type Tone } from '@/components/room-kit';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JiraPublishJob } from '@/app/room/jira-publish-api';
import { StepStatusIcon } from './JiraPublishDialog';

interface JiraPublishQueueProps {
  jobs: JiraPublishJob[];
  onRetry: (jobId: string) => Promise<void> | void;
  retryingId?: string | null;
  className?: string;
}

const STATUS_LABEL: Record<JiraPublishJob['status'], string> = {
  PENDING: 'Na fila',
  RUNNING: 'Enviando',
  DONE: 'Enviado',
  ERROR: 'Erro',
};

const STATUS_TONE: Record<JiraPublishJob['status'], Tone> = {
  PENDING: 'neutral',
  RUNNING: 'brand',
  DONE: 'success',
  ERROR: 'danger',
};

/**
 * Fila dos envios da sala para o Jira. Cada envio mostra o estado, quantos passos foram, e — em erro — o
 * motivo e o botão de tentar de novo (que continua do passo que falhou, sem repetir o que já foi feito).
 */
export function JiraPublishQueue({ jobs, onRetry, retryingId, className }: JiraPublishQueueProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (jobs.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground', className)}>
        <p className="flex items-center gap-2"><Send className="h-3.5 w-3.5" aria-hidden /> Nenhum envio para o Jira nesta sala ainda.</p>
      </div>
    );
  }

  return (
    <ul className={cn('flex flex-col gap-2', className)} aria-label="Envios para o Jira">
      {jobs.map(job => {
        const done = job.steps.filter(s => s.status === 'DONE').length;
        const expanded = openId === job.id;
        return (
          <li key={job.id} className="rounded-lg border border-border/60 bg-card/60 p-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary">{job.parentKey}</span>
              <StatusChip tone={STATUS_TONE[job.status]} dot>{STATUS_LABEL[job.status]}</StatusChip>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">{done}/{job.steps.length}</span>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-accent"
                onClick={() => setOpenId(expanded ? null : job.id)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Recolher passos' : 'Ver passos'}
              >
                {expanded ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            {job.parentSummary && <p className="mt-1 truncate text-xs text-muted-foreground" title={job.parentSummary}>{job.parentSummary}</p>}
            {job.status === 'ERROR' && (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-xs text-destructive" role="alert">{job.errorMessage ?? 'Falha no envio.'}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full gap-2"
                  onClick={() => onRetry(job.id)}
                  disabled={retryingId === job.id}
                >
                  {retryingId === job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RotateCw className="h-3.5 w-3.5" aria-hidden />}
                  Tentar novamente
                </Button>
              </div>
            )}
            {expanded && (
              <ol className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2 text-xs">
                {job.steps.map(s => (
                  <li key={s.index} className="flex items-center gap-2">
                    <StepStatusIcon status={s.status ?? 'PENDING'} />
                    <span className="min-w-0 flex-1 truncate">
                      {s.kind === 'RENAME_PARENT' && <>Renomear {s.targetKey}</>}
                      {s.kind === 'CREATE_SUBTASK' && <>Criar {s.issueType}{s.resultKey ? ` → ${s.resultKey}` : ''}</>}
                      {s.kind === 'ADD_COMMENT' && <>Comentar em {s.targetKey ?? '…'}</>}
                    </span>
                    {s.errorMessage && <span className="truncate text-destructive" title={s.errorMessage}>{s.errorMessage}</span>}
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ul>
  );
}
