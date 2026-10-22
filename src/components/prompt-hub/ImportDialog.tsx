'use client';

import { useRef, useState } from 'react';
import { CircleAlert, CircleCheck, FileText, FolderUp, TriangleAlert, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Modal, ModalButton, StatusChip, FIELD } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { promptApi } from '@/app/prompt-hub/api';
import {
  MAX_IMPORT_ITEMS,
  buildDrafts,
  buildPayloads,
  isImportCandidate,
  selectedDrafts,
  type ImportDraft,
  type ImportFile
} from '@/app/prompt-hub/import-logic';
import type { PromptVisibility } from '@/app/prompt-hub/types';
import { getTypeMeta } from '@/app/prompt-hub/constants';

type Step = 'pick' | 'preview' | 'importing' | 'result';

interface Failure {
  draft: ImportDraft;
  error: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorId?: string | null;
  authorSnapshot: () => { authorName: string; authorRole: string; authorSquad: string; authorAvatar: string };
  onImported: () => void;
}

const LEVEL_TONE = { ok: 'success', aviso: 'warn', erro: 'danger' } as const;
const LEVEL_LABEL = { ok: 'Válido', aviso: 'Aviso', erro: 'Erro' } as const;

/** Lê os arquivos .md de uma lista bruta (a pasta escolhida, os arquivos escolhidos ou o que foi arrastado). */
async function readFiles(list: Array<{ file: File; path: string }>): Promise<ImportFile[]> {
  const out: ImportFile[] = [];
  for (const { file, path } of list) {
    if (!isImportCandidate(path)) continue;
    try {
      out.push({ path, text: await file.text() });
    } catch (err) {
      console.warn(`[prompt-hub] não foi possível ler ${path}`, err);
    }
  }
  return out;
}

/** Percorre pastas e arquivos arrastados (API de entradas do navegador). */
async function collectDropped(dataTransfer: DataTransfer): Promise<Array<{ file: File; path: string }>> {
  const collected: Array<{ file: File; path: string }> = [];

  const traverse = async (entry: FileSystemEntry | null, parent: string): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      try {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
        collected.push({ file, path: `${parent}${file.name}` });
      } catch {
        // arquivo inacessível: segue
      }
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readAll = async (): Promise<FileSystemEntry[]> => {
        const batch: FileSystemEntry[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        return batch.length > 0 ? [...batch, ...(await readAll())] : batch;
      };
      try {
        for (const child of await readAll()) await traverse(child, `${parent}${entry.name}/`);
      } catch {
        // pasta inacessível: segue
      }
    }
  };

  const entries = Array.from(dataTransfer.items ?? []).map(item => item.webkitGetAsEntry?.() ?? null);
  await Promise.all(entries.map(entry => traverse(entry, '')));
  if (collected.length === 0) {
    // Navegador sem a API de entradas: só os arquivos soltos.
    Array.from(dataTransfer.files).forEach(file => collected.push({ file, path: file.name }));
  }
  return collected;
}

/**
 * Importar pasta: escolher (pasta, arquivos .md ou arrastar e soltar), conferir a prévia e importar em
 * lote de até 200 itens. Se o lote falha, o portal tenta item a item e mostra o que não passou.
 */
export function ImportDialog({ open, onOpenChange, authorId, authorSnapshot, onImported }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [visibility, setVisibility] = useState<PromptVisibility>('private');
  const [dragOver, setDragOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [imported, setImported] = useState<ImportDraft[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [retrying, setRetrying] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('pick');
    setDrafts([]);
    setImported([]);
    setFailures([]);
    setScanning(false);
    setDragOver(false);
  };

  const close = () => {
    if (step === 'importing') return;
    const hadImports = imported.length > 0;
    reset();
    onOpenChange(false);
    if (hadImports) onImported();
  };

  const scan = async (list: Array<{ file: File; path: string }>) => {
    setScanning(true);
    try {
      const files = await readFiles(list);
      if (files.length === 0) {
        toast.error('Nenhum arquivo .md encontrado', { description: 'Escolha uma pasta com SKILL.md ou arquivos .md.' });
        return;
      }
      setDrafts(buildDrafts(files));
      setStep('preview');
    } catch (err) {
      toast.error('Erro ao ler os arquivos', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setScanning(false);
    }
  };

  const onFolder = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) await scan(files.map(file => ({ file, path: file.webkitRelativePath || file.name })));
  };

  const onFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) await scan(files.map(file => ({ file, path: file.name })));
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    setScanning(true);
    try {
      await scan(await collectDropped(event.dataTransfer));
    } catch (err) {
      toast.error('Falha ao processar o que foi arrastado', { description: err instanceof Error ? err.message : undefined });
      setScanning(false);
    }
  };

  const patchDraft = (key: string, patch: Partial<ImportDraft>) =>
    setDrafts(prev => prev.map(draft => (draft.key === key ? { ...draft, ...patch } : draft)));

  const chosen = selectedDrafts(drafts);
  const blockedCount = drafts.filter(draft => draft.blocked).length;
  const overLimit = chosen.length > MAX_IMPORT_ITEMS;

  const author = () => ({ authorId: authorId || 'anonymous', ...authorSnapshot() });

  const runImport = async () => {
    if (chosen.length === 0 || overLimit) return;
    setStep('importing');
    const { payloads, byPayload } = buildPayloads(chosen, visibility, author());
    try {
      const { failures: failed } = await promptApi.createPromptsBatch(payloads);
      const failedDrafts = failed.map(f => ({ draft: byPayload.get(f.prompt)!, error: f.error })).filter(f => f.draft);
      const failedKeys = new Set(failedDrafts.map(f => f.draft.key));
      setImported(chosen.filter(draft => !failedKeys.has(draft.key)));
      setFailures(failedDrafts);
      setStep('result');
    } catch (err) {
      toast.error('Erro ao importar', { description: err instanceof Error ? err.message : 'Tente novamente.' });
      setStep('preview');
    }
  };

  const retryFailed = async () => {
    setRetrying(true);
    const { payloads, byPayload } = buildPayloads(
      failures.map(f => f.draft),
      visibility,
      author()
    );
    try {
      const { failures: failed } = await promptApi.createOneByOne(payloads);
      const failedDrafts = failed.map(f => ({ draft: byPayload.get(f.prompt)!, error: f.error })).filter(f => f.draft);
      const failedKeys = new Set(failedDrafts.map(f => f.draft.key));
      setImported(prev => [...prev, ...failures.map(f => f.draft).filter(draft => !failedKeys.has(draft.key))]);
      setFailures(failedDrafts);
    } finally {
      setRetrying(false);
    }
  };

  const stepLine =
    step === 'pick' ? 'Etapa 1 de 3 · Escolher' : step === 'preview' ? 'Etapa 2 de 3 · Conferir' : 'Etapa 3 de 3 · Resultado';

  let footer: React.ReactNode = null;
  let footerStart: React.ReactNode = null;
  if (step === 'pick') {
    footer = <ModalButton onClick={close}>Cancelar</ModalButton>;
  } else if (step === 'preview') {
    footerStart = <ModalButton onClick={() => setStep('pick')}>Voltar</ModalButton>;
    footer = (
      <>
        <ModalButton onClick={close}>Cancelar</ModalButton>
        <ModalButton variant="primary" disabled={chosen.length === 0 || overLimit} onClick={() => void runImport()}>
          Importar {chosen.length} {chosen.length === 1 ? 'item' : 'itens'}
        </ModalButton>
      </>
    );
  } else if (step === 'result') {
    footer = (
      <>
        {failures.length > 0 && (
          <ModalButton onClick={() => void retryFailed()} disabled={retrying}>
            {retrying ? 'Tentando…' : 'Tentar de novo os que falharam'}
          </ModalButton>
        )}
        <ModalButton variant="primary" onClick={close}>
          Concluir
        </ModalButton>
      </>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={next => {
        if (!next) close();
      }}
      preventClose={step === 'importing'}
      dismissible={step !== 'importing'}
      icon={FolderUp}
      title="Importar pasta"
      description={stepLine}
      className="sm:max-w-[1100px]"
      footer={footer}
      footerStart={footerStart}
    >
      <input
        ref={folderInput}
        type="file"
        className="hidden"
        // @ts-expect-error webkitdirectory é atributo HTML de escolher pasta, ainda fora dos tipos do React
        webkitdirectory=""
        multiple
        onChange={onFolder}
        aria-label="Escolher pasta"
      />
      <input ref={filesInput} type="file" className="hidden" accept=".md" multiple onChange={onFiles} aria-label="Escolher arquivos .md" />

      {step === 'pick' && (
        <div className="flex flex-col gap-3">
          <div
            onDragOver={event => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={event => void onDrop(event)}
            className={cn(
              'flex flex-col items-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed px-5 py-11 text-center transition-colors duration-fast',
              dragOver ? 'border-primary bg-primary/10' : 'border-primary/40 bg-primary/5'
            )}
          >
            <Upload className="h-8 w-8 text-primary [.theme-totvs:not(.dark)_&]:text-foreground" strokeWidth={1.5} aria-hidden="true" />
            <span className="text-base font-bold text-foreground">Arraste uma pasta ou arquivos .md para cá</span>
            <span className="max-w-xl text-sm text-muted-foreground">
              O portal reconhece as pastas com SKILL.md como skills. Os outros arquivos viram recursos.
            </span>
            {scanning ? (
              <span role="status" className="text-sm font-semibold text-foreground">
                Lendo os arquivos e conferindo os cabeçalhos…
              </span>
            ) : (
              <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                <ModalButton variant="primary" onClick={() => folderInput.current?.click()} className="gap-2">
                  <FolderUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Escolher pasta
                </ModalButton>
                <ModalButton onClick={() => filesInput.current?.click()} className="gap-2">
                  <FileText className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Escolher arquivos .md
                </ModalButton>
              </div>
            )}
          </div>
          <span className="text-[13px] text-muted-foreground">
            Até {MAX_IMPORT_ITEMS} itens por vez. Tudo entra como privado, a menos que você mude na próxima etapa. Skills com o mesmo nome são atualizadas, não duplicadas.
          </span>
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-foreground" aria-live="polite">
              {chosen.length} de {drafts.length} selecionados
              {blockedCount > 0 && ` · ${blockedCount} com erro não pode ser importado`}
            </span>
            <span className="flex-1" />
            <div role="group" aria-label="Quem pode ver os itens importados" className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">Quem pode ver</span>
              <div className="flex rounded-[10px] border border-border bg-muted/40 p-0.5">
                {(['private', 'public'] as const).map(value => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={visibility === value}
                    onClick={() => setVisibility(value)}
                    className={cn(
                      'h-[30px] rounded-[7px] px-3.5 text-[13px] font-semibold transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      visibility === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {value === 'private' ? 'Privada' : 'Pública'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {overLimit && (
            <p role="alert" className="rounded-[10px] border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[13px] text-foreground">
              Selecione no máximo {MAX_IMPORT_ITEMS} itens por vez. Desmarque {chosen.length - MAX_IMPORT_ITEMS} e importe o resto depois.
            </p>
          )}
          <div className="overflow-x-auto rounded-[14px] border border-border">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[36px_1.1fr_0.5fr_1.2fr_1.5fr_190px] gap-3 bg-muted/40 px-3.5 py-2.5 text-xs font-bold tracking-wide text-muted-foreground">
                <span />
                <span>ARQUIVO</span>
                <span>TIPO</span>
                <span>TÍTULO</span>
                <span>DESCRIÇÃO</span>
                <span>CONFERÊNCIA</span>
              </div>
              {drafts.map(draft => {
                const tone = LEVEL_TONE[draft.level];
                return (
                  <div
                    key={draft.key}
                    className={cn(
                      'grid grid-cols-[36px_1.1fr_0.5fr_1.2fr_1.5fr_190px] items-center gap-3 border-t border-border px-3.5 py-2.5',
                      draft.blocked && 'bg-red-500/5'
                    )}
                  >
                    <Checkbox
                      checked={draft.selected && !draft.blocked}
                      disabled={draft.blocked}
                      aria-label={`Selecionar ${draft.path}`}
                      onCheckedChange={checked => patchDraft(draft.key, { selected: !!checked })}
                    />
                    <span className="truncate font-mono text-[13px] text-foreground" title={draft.path}>
                      {draft.path}
                    </span>
                    <StatusChip tone="brand" className="h-6 justify-self-start px-2.5">
                      {getTypeMeta(draft.type).label}
                    </StatusChip>
                    <input
                      value={draft.title}
                      maxLength={255}
                      onChange={event => patchDraft(draft.key, { title: event.target.value })}
                      aria-label={`Título de ${draft.path}`}
                      className={cn(FIELD, 'h-9 text-[13px]')}
                    />
                    <input
                      value={draft.description}
                      maxLength={10000}
                      onChange={event => patchDraft(draft.key, { description: event.target.value })}
                      aria-label={`Descrição de ${draft.path}`}
                      className={cn(FIELD, 'h-9 text-[13px]')}
                    />
                    <span className="flex flex-col gap-0.5">
                      <StatusChip tone={tone} className="gap-1 self-start">
                        {draft.level === 'ok' ? <CircleCheck className="h-3 w-3" aria-hidden="true" /> : draft.level === 'aviso' ? <TriangleAlert className="h-3 w-3" aria-hidden="true" /> : <CircleAlert className="h-3 w-3" aria-hidden="true" />}
                        {LEVEL_LABEL[draft.level]}
                      </StatusChip>
                      <span className="text-xs leading-snug text-muted-foreground">{draft.message}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div role="status" className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span className="text-base font-bold text-foreground">Importando {chosen.length} {chosen.length === 1 ? 'item' : 'itens'}…</span>
          <span className="text-sm text-muted-foreground">Não feche esta janela. Se o envio em lote falhar, o portal tenta item por item.</span>
        </div>
      )}

      {step === 'result' && (
        <div className="flex flex-col gap-4">
          <div
            role="status"
            className={cn(
              'flex items-center gap-3.5 rounded-[14px] border px-[18px] py-4',
              failures.length > 0 ? 'border-amber-500/35 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10'
            )}
          >
            {failures.length > 0 ? (
              <TriangleAlert className="h-6 w-6 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <CircleCheck className="h-6 w-6 shrink-0 text-emerald-700 dark:text-emerald-300" strokeWidth={1.5} aria-hidden="true" />
            )}
            <span className="flex flex-col gap-0.5">
              <strong className="text-base text-foreground">
                {failures.length > 0
                  ? `${imported.length} de ${imported.length + failures.length} itens importados`
                  : `${imported.length} ${imported.length === 1 ? 'item importado' : 'itens importados'}`}
              </strong>
              <span className="text-sm text-muted-foreground">
                {failures.length > 0
                  ? `O envio em lote falhou e o portal tentou item por item. ${failures.length} não ${failures.length === 1 ? 'passou' : 'passaram'}.`
                  : `Todos entraram como ${visibility === 'private' ? 'privados' : 'públicos'} e já estão em "Meus itens".`}
              </span>
            </span>
          </div>
          {failures.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[15px] font-bold text-foreground">Não foram importados</h3>
              {failures.map(f => (
                <div key={f.draft.key} className="flex flex-wrap gap-3 rounded-[10px] border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-foreground">
                  <span className="min-w-[200px] font-mono text-[13px]">{f.draft.path}</span>
                  <span className="min-w-0 flex-1">{f.error}</span>
                </div>
              ))}
            </div>
          )}
          {imported.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-[15px] font-bold text-foreground">Importados</h3>
              <div className="flex flex-wrap gap-1.5">
                {imported.map(draft => (
                  <StatusChip key={draft.key} tone="success" className="h-7 px-3 text-[13px]">
                    {draft.title}
                  </StatusChip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
