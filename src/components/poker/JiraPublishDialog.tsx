'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Send, XCircle } from 'lucide-react';
import type { Issue } from '@/lib/types';
import { Modal, ModalButton, StatusChip } from '@/components/room-kit';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  jiraPublishApi,
  type JiraPublishJob,
  type JiraPublishPreview,
  type JiraPublishStep,
} from '@/app/room/jira-publish-api';

interface JiraPublishDialogProps {
  roomId: string;
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado com o job final (concluído ou com erro) para a sala atualizar a fila. */
  onPublished?: (job: JiraPublishJob) => void;
}

/** Sub-tarefa editável na prévia: o passo de criação e, se houver, o comentário que vai nela. */
interface EditableSubtask {
  key: string;
  include: boolean;
  create: JiraPublishStep;
  comment: JiraPublishStep | null;
}

const ROLE_TONE: Record<string, 'brand' | 'success' | 'neutral'> = { DEV: 'brand', QA: 'success' };

function parseHoursInput(raw: string): number | null {
  const s = raw.trim().replace(',', '.').replace(/h$/i, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Revisão antes de enviar ao Jira: novo título da pai, as sub-tarefas (tipo, título, horas) e o comentário
 * de cada uma — tudo editável. Nada é gravado no Jira até "Enviar"; o que sai daqui vira um envio na fila.
 */
export function JiraPublishDialog({ roomId, issue, open, onOpenChange, onPublished }: JiraPublishDialogProps) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<JiraPublishPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renameSummary, setRenameSummary] = useState('');
  const [renameEnabled, setRenameEnabled] = useState(true);
  const [subtasks, setSubtasks] = useState<EditableSubtask[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<JiraPublishJob | null>(null);

  const issueId = issue?.id ?? null;

  const load = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    setLoadError(null);
    setResult(null);
    try {
      const p = await jiraPublishApi.preview(roomId, issueId);
      setPreview(p);
      const rename = p.steps.find(s => s.kind === 'RENAME_PARENT');
      setRenameSummary(rename?.summary ?? '');
      setRenameEnabled(!!rename);
      const creates = p.steps.filter(s => s.kind === 'CREATE_SUBTASK');
      setSubtasks(creates.map(c => ({
        key: `${c.index}`,
        include: true,
        create: { ...c },
        comment: p.steps.find(s => s.kind === 'ADD_COMMENT' && s.dependsOnIndex === c.index) ?? null,
      })));
    } catch (e) {
      setPreview(null);
      setLoadError(e instanceof Error ? e.message : 'Falha ao montar a prévia do envio.');
    } finally {
      setLoading(false);
    }
  }, [roomId, issueId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const updateSubtask = (key: string, patch: Partial<EditableSubtask> | ((s: EditableSubtask) => EditableSubtask)) => {
    setSubtasks(prev => prev.map(s => (s.key === key ? (typeof patch === 'function' ? patch(s) : { ...s, ...patch }) : s)));
  };

  /** Monta a lista final reindexada: renomear (opcional) + cada sub incluída, seguida do seu comentário. */
  const buildSteps = (): JiraPublishStep[] => {
    const out: JiraPublishStep[] = [];
    if (renameEnabled && renameSummary.trim()) {
      out.push({ index: out.length, kind: 'RENAME_PARENT', targetKey: preview?.parentKey, summary: renameSummary.trim() });
    }
    for (const s of subtasks) {
      if (!s.include) continue;
      const createIndex = out.length;
      out.push({
        index: createIndex,
        kind: 'CREATE_SUBTASK',
        issueType: s.create.issueType,
        summary: (s.create.summary ?? '').trim(),
        estimateHours: s.create.estimateHours ?? null,
        role: s.create.role,
        templateId: s.create.templateId,
      });
      const body = (s.comment?.comment ?? '').trim();
      if (body) {
        out.push({ index: out.length, kind: 'ADD_COMMENT', dependsOnIndex: createIndex, comment: body });
      }
    }
    return out;
  };

  const includedCount = useMemo(() => subtasks.filter(s => s.include).length, [subtasks]);
  const invalid = useMemo(() => {
    if (renameEnabled && (!renameSummary.trim() || renameSummary.trim().length > 255)) return 'O novo título da pai precisa ter de 1 a 255 caracteres.';
    for (const s of subtasks) {
      if (s.include && !(s.create.summary ?? '').trim()) return `Título vazio na sub-tarefa ${s.create.issueType ?? ''}.`;
    }
    if (!renameEnabled && includedCount === 0) return 'Nada selecionado para enviar.';
    return null;
  }, [renameEnabled, renameSummary, subtasks, includedCount]);

  const send = async () => {
    if (!issueId || invalid) return;
    setSending(true);
    try {
      const job = await jiraPublishApi.submit(roomId, issueId, buildSteps());
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
      description="Revise o que será feito no Jira. Só estas três ações existem: renomear a issue pai, criar sub-tarefas e comentar nelas."
      preventClose={sending}
      footerStart={preview && !result ? (
        <span className="text-xs text-muted-foreground">
          {renameEnabled ? '1 renomeação · ' : ''}{includedCount} sub-tarefa(s)
        </span>
      ) : undefined}
      footer={
        result ? (
          <ModalButton variant="primary" onClick={() => onOpenChange(false)}>Fechar</ModalButton>
        ) : (
          <>
            <ModalButton variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={send} disabled={!preview || sending || !!invalid} title={invalid ?? undefined}>
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

      {!loading && loadError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Não dá para montar o envio</p>
            <p className="text-muted-foreground">{loadError}</p>
          </div>
        </div>
      )}

      {!loading && preview && !result && (
        <div className="flex flex-col gap-4">
          {preview.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
              {preview.warnings.map(w => (
                <li key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />{w}</li>
              ))}
            </ul>
          )}

          <section className="rounded-lg border border-border/60 p-3" aria-labelledby="jira-publish-rename">
            <div className="mb-2 flex items-center gap-2">
              <Checkbox id="jira-publish-rename-on" checked={renameEnabled} onCheckedChange={(v) => setRenameEnabled(v === true)} />
              <label id="jira-publish-rename" htmlFor="jira-publish-rename-on" className="text-sm font-semibold">
                Renomear a issue pai <span className="font-mono text-xs text-primary">{preview.parentKey}</span>
              </label>
              {preview.parentIssueType && <StatusChip tone="neutral">{preview.parentIssueType}</StatusChip>}
            </div>
            <p className="mb-1 truncate text-xs text-muted-foreground" title={preview.currentSummary ?? ''}>Hoje: {preview.currentSummary || '—'}</p>
            <Input
              value={renameSummary}
              onChange={(e) => setRenameSummary(e.target.value)}
              disabled={!renameEnabled}
              maxLength={255}
              aria-label="Novo título da issue pai"
            />
          </section>

          <section className="flex flex-col gap-3" aria-label="Sub-tarefas a criar">
            <h3 className="text-sm font-semibold">Sub-tarefas ({includedCount}/{subtasks.length})</h3>
            {subtasks.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma sub-tarefa configurada para esta squad e tipo de issue.</p>
            )}
            {subtasks.map(s => (
              <div key={s.key} className={cn('rounded-lg border border-border/60 p-3', !s.include && 'opacity-60')}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Checkbox id={`jira-sub-${s.key}`} checked={s.include} onCheckedChange={(v) => updateSubtask(s.key, { include: v === true })} />
                  <label htmlFor={`jira-sub-${s.key}`} className="text-sm font-semibold">{s.create.issueType}</label>
                  {s.create.role && s.create.role !== 'NONE' && <StatusChip tone={ROLE_TONE[s.create.role] ?? 'neutral'}>{s.create.role}</StatusChip>}
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                  <Input
                    value={s.create.summary ?? ''}
                    onChange={(e) => updateSubtask(s.key, st => ({ ...st, create: { ...st.create, summary: e.target.value } }))}
                    disabled={!s.include}
                    maxLength={255}
                    aria-label={`Título da sub-tarefa ${s.create.issueType ?? ''}`}
                  />
                  <Input
                    value={s.create.estimateHours == null ? '' : String(s.create.estimateHours).replace('.', ',')}
                    onChange={(e) => updateSubtask(s.key, st => ({ ...st, create: { ...st.create, estimateHours: parseHoursInput(e.target.value) } }))}
                    disabled={!s.include || !preview.hoursDeck}
                    placeholder={preview.hoursDeck ? 'horas' : 'sem horas'}
                    inputMode="decimal"
                    aria-label={`Horas da sub-tarefa ${s.create.issueType ?? ''}`}
                  />
                </div>
                <Textarea
                  className="mt-2 min-h-[64px] text-sm"
                  value={s.comment?.comment ?? ''}
                  onChange={(e) => updateSubtask(s.key, st => ({
                    ...st,
                    comment: { ...(st.comment ?? { index: -1, kind: 'ADD_COMMENT' as const }), comment: e.target.value },
                  }))}
                  disabled={!s.include}
                  placeholder="Comentário nesta sub-tarefa (vazio = não comenta)"
                  aria-label={`Comentário da sub-tarefa ${s.create.issueType ?? ''}`}
                />
              </div>
            ))}
          </section>
        </div>
      )}

      {result && <JobResult job={result} />}
    </Modal>
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
