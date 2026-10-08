'use client';

import React from 'react';
import { FileImage, FileText, Loader2, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-2" data-testid="task-attachments">
      <div className="flex items-center justify-between">
        <FieldLabel icon={Paperclip} label="Arquivos anexados" color="text-slate-500 dark:text-slate-400" />
        <span className={cn('text-[11px] font-bold tabular-nums', isFull ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500')}>
          {files.length}/{TASK_FILE_MAX_COUNT}
        </span>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map(file => {
            const isPdf = file.contentType === 'application/pdf';
            const Icon = isPdf ? FileText : FileImage;
            const confirming = confirmingId === file.id;
            return (
              <li
                key={file.id}
                className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 h-8"
              >
                <Icon className={cn('h-3.5 w-3.5 shrink-0', isPdf ? 'text-rose-500' : 'text-sky-500')} />
                <button
                  type="button"
                  onClick={() => openFile(file)}
                  title={`Abrir ${file.name}`}
                  className="flex-1 min-w-0 text-left text-[11px] font-medium text-slate-700 dark:text-slate-200 truncate hover:text-violet-600 dark:hover:text-violet-400"
                >
                  {file.name}
                </button>
                <span className="text-[10px] font-semibold text-slate-400 shrink-0 tabular-nums">{formatFileSize(file.size)}</span>
                {confirming ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => removeFile(file)}
                      disabled={deletingId === file.id}
                      className="text-[10px] font-bold text-rose-600 hover:underline disabled:opacity-50"
                    >
                      {deletingId === file.id ? 'Removendo…' : 'Remover'}
                    </button>
                    <button type="button" onClick={() => setConfirmingId(null)} className="text-[10px] font-bold text-slate-400 hover:underline">
                      Manter
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(file.id)}
                    title={`Remover ${file.name}`}
                    aria-label={`Remover ${file.name}`}
                    className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
        onChange={e => sendFiles(Array.from(e.target.files || []))}
      />
      <Button
        type="button"
        variant="outline"
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
          'w-full h-auto min-h-9 py-2 rounded-lg border-dashed text-[11px] font-bold gap-2 whitespace-normal',
          dragOver ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20 text-violet-600' : 'text-slate-500 dark:text-slate-400'
        )}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
        {uploading
          ? 'Enviando…'
          : isFull
            ? `Limite de ${TASK_FILE_MAX_COUNT} arquivos atingido`
            : 'Anexar arquivo ou arrastar aqui'}
      </Button>
      <p className="text-[10px] text-slate-400 dark:text-slate-500">PNG, JPEG ou PDF · até 10 MB cada · máximo de {TASK_FILE_MAX_COUNT} por card.</p>
    </div>
  );
}
