'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Send, XCircle } from 'lucide-react';
import type { Issue } from '@/lib/types';
import { Modal, ModalButton } from '@/components/room-kit';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { jiraPublishApi, type JiraPublishJob } from '@/app/room/jira-publish-api';
import { buildSteps, countsLabel, draftCounts, draftFromPreview, JiraPublishEditor, validateDraft, type JiraDraft } from './jira-publish-draft';

interface JiraPublishDialogProps {
  roomId: string;
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado com o job final (concluído ou com erro) para a sala atualizar a fila. */
  onPublished?: (job: JiraPublishJob) => void;
}

/**
 * Revisão antes de enviar uma tarefa ao Jira: novo título da pai, as sub-tarefas (título, horas) e o comentário
 * de cada uma — tudo editável. Nada é gravado no Jira até "Enviar"; o que sai daqui vira um envio na fila.
 */
export function JiraPublishDialog({ roomId, issue, open, onOpenChange, onPublished }: JiraPublishDialogProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<JiraDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<JiraPublishJob | null>(null);

  const issueId = issue?.id ?? null;

  const load = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    setLoadError(null);
    setResult(null);
    try {
      setDraft(draftFromPreview(await jiraPublishApi.preview(roomId, issueId)));
    } catch (e) {
      setDraft(null);
      setLoadError(e instanceof Error ? e.message : 'Falha ao montar a prévia do envio.');
    } finally {
      setLoading(false);
    }
  }, [roomId, issueId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const invalid = draft ? validateDraft(draft) : null;

  const send = async () => {
    if (!issueId || !draft || invalid) return;
    setSending(true);
    try {
      const job = await jiraPublishApi.submit(roomId, issueId, buildSteps(draft));
      setResult(job);
      onPublished?.(job);
      if (job.status === 'DONE') {
        toast({ title: 'Publicado no Jira', description: `${job.parentKey}: ${job.steps.length} ação(ões) concluída(s).` });
      } else {
        toast({ title: 'O envio parou com erro', description: job.errorMessage ?? 'Veja a fila do Jira para tentar novamente.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Não foi possível enviar', description: e instanceof Error ? e.message : 'Erro inesperado.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const title = issue?.key ? `Enviar ${issue.key} para o Jira` : 'Enviar para o Jira';

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!sending) onOpenChange(o); }}
      size="lg"
      icon={Send}
      title={title}
      description="Revise antes de enviar. O portal só renomeia a pai, cria sub-tarefas e comenta nelas; nada é apagado."
      preventClose={sending}
      footerStart={draft && !result ? <span className="text-[13px] text-muted-foreground">{countsLabel(draftCounts(draft))}</span> : undefined}
      footer={
        result ? (
          <ModalButton variant="primary" onClick={() => onOpenChange(false)}>Fechar</ModalButton>
        ) : (
          <>
            <ModalButton onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={send} disabled={!draft || sending || !!invalid} title={invalid ?? undefined} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {sending ? 'Enviando…' : 'Enviar para o Jira'}
            </ModalButton>
          </>
        )
      }
    >
      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Montando a prévia…
        </div>
      )}

      {!loading && loadError && <PreviewError message={loadError} />}

      {!loading && draft && !result && <JiraPublishEditor draft={draft} onChange={setDraft} idPrefix="jira-publish" />}

      {result && <JobResult job={result} />}
    </Modal>
  );
}

export function PreviewError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="font-semibold text-foreground">Não dá para montar o envio</p>
        <p className="text-muted-foreground">{message}</p>
        {/Sub-tarefas do time/i.test(message) && (
          <a href="/subtarefas" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline">
            Abrir Sub-tarefas do time <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}

/** Resultado do envio: cada passo com seu estado; o erro aponta o passo e o motivo devolvido pelo Jira. */
function JobResult({ job }: { job: JiraPublishJob }) {
  const done = job.status === 'DONE';
  return (
    <div className="flex flex-col gap-3" role="status">
      <div className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', done ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-destructive/40 bg-destructive/10')}>
        {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />}
        <div>
          <p className="font-semibold">{done ? 'Publicado no Jira' : 'O envio parou com erro'}</p>
          {!done && <p className="text-muted-foreground">{job.errorMessage ?? 'Use "Tentar novamente" na fila do Jira: os passos concluídos não se repetem.'}</p>}
        </div>
      </div>
      <ol className="flex flex-col gap-1 text-sm">
        {job.steps.map(s => (
          <li key={s.index} className="flex items-center gap-2">
            <StepStatusIcon status={s.status ?? 'PENDING'} />
            <span className="min-w-0 flex-1 truncate">
              {s.kind === 'RENAME_PARENT' && <>Renomear <span className="font-mono text-xs">{s.targetKey}</span></>}
              {s.kind === 'CREATE_SUBTASK' && <>Criar {s.issueType}{s.resultKey && <> → <span className="font-mono text-xs">{s.resultKey}</span></>}</>}
              {s.kind === 'ADD_COMMENT' && <>Comentar em <span className="font-mono text-xs">{s.targetKey ?? '…'}</span></>}
            </span>
            {s.errorMessage && <span className="truncate text-xs text-destructive" title={s.errorMessage}>{s.errorMessage}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StepStatusIcon({ status }: { status: string }) {
  if (status === 'DONE') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Concluído" />;
  if (status === 'ERROR') return <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-label="Erro" />;
  return <span className="inline-block h-4 w-4 shrink-0 rounded-full border border-border" aria-label="Pendente" />;
}

export { ExternalLink as JiraExternalIcon };
