'use client';

import * as React from 'react';
import { FileUp, Loader2, TriangleAlert, Upload } from 'lucide-react';
import { Modal, ModalButton, FOCUS_RING } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { IMPORT_ACCEPT, IMPORT_FORMATS_LABEL } from '@/lib/knowledge-file-import';

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O artigo já tem texto: pede confirmação antes de substituir. */
  hasContent: boolean;
  /** Faz a importação; lança Error com a mensagem para mostrar na janela. Fecha sozinha quando termina. */
  onImport: (file: File) => Promise<void>;
}

/** Janela "Importar arquivo": área de arrastar e soltar (ou escolher), aviso de substituição e confirmação. */
export function ImportDialog(props: ImportDialogProps) {
  // Montada só enquanto aberta: o estado nasce a cada abertura, sem efeito para limpar.
  return props.open ? <ImportDialogBody {...props} /> : null;
}

function ImportDialogBody({ open, onOpenChange, hasContent, onImport }: ImportDialogProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [pending, setPending] = React.useState<File | null>(null);

  // Enquanto a janela está aberta, um arquivo solto fora da área não pode abrir no navegador.
  React.useEffect(() => {
    if (!open) return;
    const stop = (event: DragEvent) => event.preventDefault();
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, [open]);

  const run = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      await onImport(file);
      onOpenChange(false);
    } catch (e) {
      setPending(null);
      setError(e instanceof Error ? e.message : 'Não foi possível importar o arquivo.');
    } finally {
      setBusy(false);
    }
  };

  const choose = (file: File | undefined) => {
    if (!file || busy) return;
    setError('');
    if (hasContent) setPending(file);
    else void run(file);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files?.[0]);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      preventClose={busy}
      icon={FileUp}
      title="Importar arquivo"
      footer={
        pending ? (
          <>
            <ModalButton variant="secondary" disabled={busy} onClick={() => setPending(null)}>
              Voltar
            </ModalButton>
            <ModalButton variant="primary" disabled={busy} onClick={() => void run(pending)}>
              {busy ? 'Importando…' : 'Substituir texto'}
            </ModalButton>
          </>
        ) : (
          <ModalButton variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </ModalButton>
        )
      }
    >
      <div
        className="flex flex-col gap-4"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        {pending ? (
          <div role="alert" className="flex flex-col gap-1 rounded-[14px] border border-border bg-muted/50 p-4 text-sm">
            <p className="font-semibold text-foreground">Substituir o texto que já está escrito?</p>
            <p className="text-muted-foreground">
              O conteúdo de <strong className="text-foreground">{pending.name}</strong> vai tomar o lugar do texto atual do artigo. Se mudar de ideia, dá para desfazer com Ctrl+Z.
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed px-5 py-9 text-center transition-colors duration-fast',
              dragging ? 'border-primary bg-primary/10' : 'border-primary/50 bg-primary/5',
            )}
          >
            {busy ? (
              <Loader2 className="h-7 w-7 text-primary motion-safe:animate-spin [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Upload className="h-7 w-7 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
            )}
            <p className="text-[15px] font-bold text-foreground" role={busy ? 'status' : undefined}>
              {busy ? 'Importando o arquivo…' : 'Arraste o arquivo para cá'}
            </p>
            <p className="text-[13px] text-muted-foreground">{IMPORT_FORMATS_LABEL}</p>
            <ModalButton variant="secondary" disabled={busy} className={cn('mt-1.5', FOCUS_RING)} onClick={() => inputRef.current?.click()}>
              Escolher arquivo
            </ModalButton>
            <input
              ref={inputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-label="Arquivo para importar"
              onChange={(e) => {
                choose(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-[10px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-[13px]">
          <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
          <span className="text-muted-foreground">
            O texto importado <strong className="text-foreground">substitui</strong> o que já está escrito. Imagens e tabelas do Word não vêm; só o texto.
          </span>
        </div>
      </div>
    </Modal>
  );
}
