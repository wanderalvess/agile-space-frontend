'use client';

import React from 'react';
import { FileImage, FileText, Loader2, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { FOCUS_RING } from '@/components/room-kit/tokens';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { showcaseApi } from '@/app/showcase/api';
import { ShowcaseTask, TaskFile, TASK_FILE_ACCEPT, TASK_FILE_MAX_BYTES, TASK_FILE_MAX_COUNT } from './types';
import { formatFileSize } from './utils';
import { FieldLabel } from './TaskCardFields';

interface TaskCardAttachmentsProps {
  task: ShowcaseTask;
  sessionId: string;
  /** Envia o arquivo e recarrega a Review; lança erro com mensagem em português se o servidor recusar. */
  onUploadFile: (taskId: string, file: File) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
const ALLOWED_EXT = /\.(png|jpe?g|pdf)$/i;

/** Confere tipo e tamanho antes de gastar upload. O servidor repete a checagem pelo conteúdo do arquivo. */
export function validateTaskFile(file: File): string | null {
  const typeOk = ALLOWED_TYPES.includes(file.type) || (!file.type && ALLOWED_EXT.test(file.name));
  if (!typeOk || !ALLOWED_EXT.test(file.name)) return `"${file.name}": formato não aceito. Envie PNG, JPEG ou PDF.`;
  if (file.size === 0) return `"${file.name}": o arquivo está vazio.`;
  if (file.size > TASK_FILE_MAX_BYTES) return `"${file.name}": passa de 10 MB (${formatFileSize(file.size)}).`;
  return null;
}

export function TaskCardAttachments({ task, sessionId, onUploadFile, onDeleteFile }: TaskCardAttachmentsProps) {
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const files: TaskFile[] = task.attachments || [];
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const remaining = TASK_FILE_MAX_COUNT - files.length;
  const isFull = remaining <= 0;

  const sendFiles = async (picked: File[]) => {
    if (picked.length === 0 || uploading) return;
    if (isFull) {
      toast({ title: 'Limite de arquivos', description: `Cada card aceita no máximo ${TASK_FILE_MAX_COUNT} arquivos. Remova um para anexar outro.`, variant: 'destructive' });
      return;
    }
    const problems: string[] = [];
    const valid = picked.filter(f => {
      const problem = validateTaskFile(f);
      if (problem) problems.push(problem);
      return !problem;
    });
    const toSend = valid.slice(0, remaining);
    if (valid.length > toSend.length) {
      problems.push(`Só cabem mais ${remaining} arquivo${remaining === 1 ? '' : 's'} neste card; ${valid.length - toSend.length} ficou de fora.`);
    }

    setUploading(true);
    let sent = 0;
    try {
      // Um por vez: o servidor confere o limite de 5 a cada envio.
      for (const file of toSend) {
        try {
          await onUploadFile(task.id, file);
          sent++;
        } catch (e) {
          problems.push(`"${file.name}": ${e instanceof Error ? e.message : 'não foi possível enviar.'}`);
        }
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
    if (sent > 0) toast({ title: sent === 1 ? 'Arquivo anexado' : `${sent} arquivos anexados` });
    if (problems.length > 0) {
      toast({ title: 'Alguns arquivos não foram anexados', description: problems.join('\n'), variant: 'destructive' });
    }
  };

  const openFile = async (file: TaskFile) => {
    // Abre a aba já no clique (senão o bloqueador de pop-up barra) e troca o endereço quando o arquivo chega.
    const tab = window.open('', '_blank');
    try {
      const blob = await showcaseApi.fetchTaskFileBlob(sessionId, file.id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      toast({ title: 'Não foi possível abrir o arquivo', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    }
  };

  const removeFile = async (file: TaskFile) => {
    setDeletingId(file.id);
    try {
      await onDeleteFile(file.id);
      toast({ title: 'Arquivo removido' });
    } catch (e) {
      toast({ title: 'Não foi possível remover', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid="task-attachments">
      <div className="flex items-center justify-between">
        <FieldLabel icon={Paperclip} label="Arquivos anexados" />
        <span className={cn('text-xs font-semibold tabular-nums', isFull ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>
          {files.length}/{TASK_FILE_MAX_COUNT}
        </span>
      </div>

      {files.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {files.map(file => {
            const isPdf = file.contentType === 'application/pdf';
            const Icon = isPdf ? FileText : FileImage;
            const confirming = confirmingId === file.id;
            return (
              <li key={file.id} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2 max-sm:h-11">
                <Icon className={cn('h-3.5 w-3.5 shrink-0', isPdf ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400')} strokeWidth={1.5} aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => openFile(file)}
                  title={`Abrir ${file.name}`}
                  className={cn('min-w-0 flex-1 truncate rounded text-left text-xs font-medium hover:text-primary [.theme-totvs:not(.dark)_&]:hover:text-foreground [.theme-totvs:not(.dark)_&]:hover:underline', FOCUS_RING)}
                >
                  {file.name}
                </button>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatFileSize(file.size)}</span>
                {confirming ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => removeFile(file)}
                      disabled={deletingId === file.id}
                      className={cn('rounded px-1 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50 dark:text-red-300', FOCUS_RING)}
                    >
                      {deletingId === file.id ? 'Removendo…' : 'Remover'}
                    </button>
                    <button type="button" onClick={() => setConfirmingId(null)} className={cn('rounded px-1 text-xs font-semibold text-muted-foreground hover:underline', FOCUS_RING)}>
                      Manter
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(file.id)}
                    title={`Remover ${file.name}`}
                    aria-label={`Remover ${file.name}`}
                    className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-red-700 dark:hover:text-red-300', FOCUS_RING)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={TASK_FILE_ACCEPT}
        className="hidden"
        data-testid="task-file-input"
        aria-label="Anexar arquivos ao card"
        onChange={e => sendFiles(Array.from(e.target.files || []))}
      />
      <button
        type="button"
        disabled={uploading || isFull}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!isFull) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          sendFiles(Array.from(e.dataTransfer.files || []));
        }}
        className={cn(
          'flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-semibold transition-colors max-sm:min-h-11',
          'disabled:cursor-not-allowed disabled:opacity-60',
          dragOver ? 'border-primary bg-primary/10 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          FOCUS_RING
        )}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" strokeWidth={1.5} aria-hidden="true" /> : <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
        {uploading
          ? 'Enviando…'
          : isFull
            ? `Limite de ${TASK_FILE_MAX_COUNT} arquivos atingido`
            : 'Anexar arquivo ou arrastar aqui'}
      </button>
      <p className="m-0 text-xs text-muted-foreground">PNG, JPEG ou PDF · até 10 MB cada · máximo de {TASK_FILE_MAX_COUNT} por card.</p>
    </div>
  );
}
