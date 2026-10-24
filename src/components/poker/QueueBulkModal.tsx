"use client";

import { useRef, useState } from 'react';
import { Bug, Code, Copy, ExternalLink, FileUp, Import, Layers, Palette, type LucideIcon } from 'lucide-react';
import { FIELD, Modal, ModalButton, StatusChip } from '@/components/room-kit';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { decorateBulkPreview, importSummary, parseBulkCsv, parseBulkText, type BulkPreviewItem, type BulkRow } from '@/lib/poker-queue';
import type { Issue } from '@/lib/types';

const TYPE_ICON: Record<string, LucideIcon> = { dev: Code, qa: Bug, design: Palette, other: Layers };
const TYPE_LABEL: Record<string, string> = { dev: 'Dev', qa: 'QA', design: 'Design', other: 'Outro' };

interface QueueBulkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: Issue[];
  onImport: (items: Partial<Issue>[]) => number | void;
}

/** Importar em lote: texto (uma tarefa por linha) ou CSV, com revisão antes de entrar na fila. */
export function QueueBulkModal({ open, onOpenChange, issues, onImport }: QueueBulkModalProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<BulkPreviewItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setText(''); setPreview(null); setSelected(new Set());
    onOpenChange(false);
  };

  const review = (rows: BulkRow[]) => {
    if (rows.length === 0) {
      toast({ title: 'Nenhuma tarefa encontrada', description: 'O texto está vazio.', variant: 'destructive' });
      return;
    }
    const decorated = decorateBulkPreview(rows, issues);
    setPreview(decorated);
    // Duplicatas entram desmarcadas, mas continuam visíveis e selecionáveis.
    setSelected(new Set(decorated.filter((i) => !i.duplicate).map((i) => i.id)));
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string' && content) review(parseBulkCsv(content));
    };
    reader.readAsText(file);
  };

  const confirm = () => {
    if (!preview) return;
    const items = preview
      .filter((i) => selected.has(i.id))
      .map((i) => ({ title: i.title, jiraLink: i.link, key: i.key || undefined, type: i.type }));
    if (items.length === 0) return;
    const { count } = importSummary(items.length, onImport(items), { one: 'tarefa', many: 'tarefas' });
    close();
    toast({
      title: count > 0 ? 'Importado!' : 'Nada novo para importar',
      description: count > 0 ? `${count} tarefa${count > 1 ? 's' : ''} adicionada${count > 1 ? 's' : ''}.` : 'Todas as tarefas já estavam na fila.',
    });
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const allSelected = !!preview && selected.size === preview.length;
  const dupCount = preview?.filter((i) => i.duplicate).length ?? 0;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (o) onOpenChange(true); else close(); }}
      size={preview ? 'lg' : 'md'}
      icon={Import}
      title={preview ? 'Revisar importação' : 'Importar em lote'}
      headerExtra={
        preview ? (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 pb-3">
            <span className="text-xs tabular-nums text-muted-foreground">{selected.size} de {preview.length} selecionadas</span>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(preview.map((i) => i.id)))}
              className="rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground"
            >
              {allSelected ? 'Desmarcar tudo' : 'Selecionar tudo'}
            </button>
          </div>
        ) : undefined
      }
      footerStart={
        preview ? (
          <>
            <ModalButton variant="ghost" onClick={() => setPreview(null)}>Voltar ao texto</ModalButton>
            <span className="ml-1 flex items-center gap-1.5 max-sm:hidden">
              <StatusChip tone="neutral">{preview.length} {preview.length === 1 ? 'tarefa' : 'tarefas'}</StatusChip>
              {dupCount > 0 && <StatusChip tone="warn">{dupCount} {dupCount === 1 ? 'duplicada' : 'duplicadas'}</StatusChip>}
            </span>
          </>
        ) : undefined
      }
      footer={
        !preview ? (
          <>
            <ModalButton onClick={close}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={() => review(parseBulkText(text))} disabled={!text.trim()}>Revisar</ModalButton>
          </>
        ) : (
          <>
            <ModalButton onClick={close}>Cancelar</ModalButton>
            <ModalButton variant="primary" onClick={confirm} disabled={selected.size === 0}>
              Importar {selected.size}<span className="max-sm:hidden">{selected.size === 1 ? 'selecionada' : 'selecionadas'}</span>
            </ModalButton>
          </>
        )
      }
    >
      {!preview ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="queue-bulk-text" className="text-[13px] font-semibold text-foreground">Lista de tarefas</label>
            <textarea
              id="queue-bulk-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'EX-101 | Ajustar botões | https://jira.com/101\nEX-102 | Refatorar API\nApenas um título sem chave'}
              className={cn(FIELD, 'min-h-[180px] resize-none py-2.5 font-code text-xs')}
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            aria-label="Arquivo CSV"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = '';
            }}
          />
          <ModalButton onClick={() => fileRef.current?.click()} className="w-full justify-center gap-2 border-dashed">
            <FileUp className="h-4 w-4" strokeWidth={1.5} /> Carregar arquivo CSV
          </ModalButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {preview.map((item) => {
              const TypeIcon = TYPE_ICON[item.type] || Code;
              const checked = selected.has(item.id);
              return (
                <li key={item.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors duration-fast',
                      checked ? 'border-primary/40 bg-primary/5' : item.duplicate ? 'border-amber-500/30 bg-amber-500/5' : 'border-border hover:bg-accent/40'
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(item.id)} className="mt-0.5" aria-label={item.title} />
                    <span className="mt-0.5 shrink-0 rounded-md bg-muted p-1 text-muted-foreground" title={TYPE_LABEL[item.type]}>
                      <TypeIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        {item.key && <span className="text-xs font-bold tabular-nums text-primary [.theme-totvs:not(.dark)_&]:text-foreground">{item.key}</span>}
                        <span className="min-w-0 truncate text-[13px] font-semibold">{item.title}</span>
                        {item.duplicate && (
                          <StatusChip tone="warn"><Copy className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" /> Duplicada</StatusChip>
                        )}
                      </span>
                      {item.link && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                          <span className="truncate">{item.link}</span>
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
