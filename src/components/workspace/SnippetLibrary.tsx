'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Code, Copy, FileCode, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Editor } from '@monaco-editor/react';
import { toast } from 'sonner';
import { ConfirmDialog, FIELD, IconButton, Modal, ModalButton, SelectField } from '@/components/room-kit';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/page';
import { PAGE_CARD } from '@/components/page/styles';
import { workspaceApi, Snippet } from '@/app/workspace/api';
import { useUserContext } from '@/context/UserContext';
import { copyToClipboard } from '@/lib/copy-to-clipboard';
import { cn } from '@/lib/utils';
import { Field, TEXT_INPUT, WorkspaceSectionHeader } from './workspace-ui';

/** As 11 linguagens do editor (o valor é o id do Monaco). */
export const SNIPPET_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'other', label: 'Other' },
] as const;

/** Filtra por título, código ou linguagem (sem diferenciar caixa). */
export function filterSnippets(snippets: Snippet[], search: string): Snippet[] {
  const q = search.trim().toLowerCase();
  if (!q) return snippets;
  return snippets.filter(
    (s) => s.title.toLowerCase().includes(q) || (s.content || '').toLowerCase().includes(q) || (s.language || '').toLowerCase().includes(q),
  );
}

interface SnippetLibraryProps {
  /** Pedido de abrir "Novo snippet" (vindo da paleta de comandos). */
  openNew?: boolean;
  onOpenNewHandled?: () => void;
}

export function SnippetLibrary({ openNew, onOpenNewHandled }: SnippetLibraryProps) {
  const uid = useId();
  const { userProfile } = useUserContext();
  const effectiveUserId = userProfile?.id || userProfile?.email;

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [toDelete, setToDelete] = useState<Snippet | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ title: '', content: '', language: 'javascript' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectiveUserId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setLoadError(false);
      try {
        const data = await workspaceApi.getSnippets(effectiveUserId);
        if (cancelled) return;
        data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setSnippets(data);
      } catch (err) {
        console.error('Erro ao buscar snippets:', err);
        if (!cancelled) {
          setLoadError(true);
          toast.error('Erro ao carregar snippets.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveUserId, reloadNonce]);

  const handleOpenEditor = useCallback((snippet?: Snippet) => {
    setEditingSnippet(snippet ?? null);
    setFormData(snippet ? { title: snippet.title, content: snippet.content || '', language: snippet.language || 'javascript' } : { title: '', content: '', language: 'javascript' });
    setIsEditorOpen(true);
  }, []);

  useEffect(() => {
    if (!openNew) return;
    handleOpenEditor();
    onOpenNewHandled?.();
  }, [openNew]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSnippets = useMemo(() => filterSnippets(snippets, search), [snippets, search]);
  const canSave = !!formData.title.trim() && !!formData.content.trim() && !saving;

  const handleSave = async () => {
    if (!effectiveUserId || !canSave) return;
    setSaving(true);
    const payload: Partial<Snippet> = {
      id: editingSnippet?.id,
      title: formData.title.trim(),
      content: formData.content.trim(),
      language: formData.language,
    };
    try {
      const saved = await workspaceApi.saveSnippet(effectiveUserId, payload);
      setSnippets((prev) => {
        const exists = prev.some((s) => s.id === saved.id);
        return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev];
      });
      toast.success('Snippet salvo com sucesso!');
      setIsEditorOpen(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const id = toDelete?.id;
    if (!id) return;
    try {
      await workspaceApi.deleteSnippet(id);
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      toast.success('Snippet removido.');
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    }
  };

  const handleCopyCode = async (code: string) => {
    if (await copyToClipboard(code)) toast.success('Código copiado!');
    else toast.error('Não foi possível copiar o código.');
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Snippet Library"
        subtitle="Organize seus fragmentos de código e utilitários técnicos"
        action={
          <>
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, linguagem ou código"
                aria-label="Buscar snippet"
                className={cn(FIELD, 'h-[42px] pl-9 text-sm')}
              />
            </div>
            <ModalButton variant="primary" onClick={() => handleOpenEditor()}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Novo snippet
            </ModalButton>
          </>
        }
      />

      {isLoading ? (
        <LoadingSkeleton variant="cards" rows={3} label="Carregando seus snippets" />
      ) : loadError ? (
        <ErrorState title="Não foi possível carregar os snippets" description="Verifique a conexão e tente de novo." onRetry={() => setReloadNonce((n) => n + 1)} />
      ) : filteredSnippets.length === 0 ? (
        <EmptyState
          icon={Code}
          title="Nenhum snippet encontrado"
          description="Sua biblioteca está vazia ou os filtros não retornaram resultados. Comece a documentar seus códigos reutilizáveis."
          actions={
            snippets.length === 0 ? (
              <ModalButton variant="primary" onClick={() => handleOpenEditor()}>
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Novo snippet
              </ModalButton>
            ) : (
              <ModalButton onClick={() => setSearch('')}>Limpar busca</ModalButton>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {filteredSnippets.map((snippet) => (
            <article key={snippet.id} className={cn(PAGE_CARD, 'flex flex-col gap-3 rounded-2xl p-4 transition-[border-color,box-shadow] duration-fast hover:border-primary/40 hover:shadow-md')}>
              <header className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
                    <FileCode className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{snippet.title}</h3>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {SNIPPET_LANGUAGES.find((l) => l.value === snippet.language)?.label ?? snippet.language}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton size="sm" icon={Pencil} label={`Editar snippet ${snippet.title}`} onClick={() => handleOpenEditor(snippet)} />
                  <IconButton size="sm" icon={Trash2} label={`Excluir snippet ${snippet.title}`} onClick={() => setToDelete(snippet)} className="hover:text-red-700 dark:hover:text-red-300" />
                </div>
              </header>
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted p-3.5 font-code text-xs text-foreground">
                <pre className="m-0 max-h-40 overflow-hidden pr-9 whitespace-pre-wrap break-all leading-snug [mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]">{snippet.content}</pre>
                <button
                  type="button"
                  onClick={() => handleCopyCode(snippet.content)}
                  aria-label={`Copiar código de ${snippet.title}`}
                  title="Copiar código"
                  className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-background/70 text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        size="lg"
        icon={FileCode}
        title={editingSnippet ? 'Ajustar snippet' : 'Novo snippet'}
        preventClose={saving}
        footer={
          <>
            <ModalButton onClick={() => setIsEditorOpen(false)} disabled={saving}>
              Cancelar
            </ModalButton>
            <ModalButton variant="primary" onClick={handleSave} disabled={!canSave}>
              Salvar snippet
            </ModalButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 pt-2 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Field label="Título do snippet" htmlFor={`${uid}-title`}>
              <input
                id={`${uid}-title`}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={255}
                autoComplete="off"
                placeholder="Ex: API Fetch Wrapper"
                className={TEXT_INPUT}
              />
            </Field>
            <Field label="Linguagem" htmlFor={`${uid}-lang`}>
              <SelectField id={`${uid}-lang`} value={formData.language} onChange={(language) => setFormData({ ...formData, language })} options={SNIPPET_LANGUAGES} className="h-[42px]" />
            </Field>
          </div>
          <div className="flex min-h-[320px] flex-col gap-1.5">
            <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Código fonte
              <span className="font-semibold normal-case tracking-normal text-primary [.theme-totvs:not(.dark)_&]:text-foreground">Editor Monaco</span>
            </span>
            {/* Intencional: o Monaco usa o tema vs-dark fixo, então o contêiner e o texto de carregamento ficam escuros nos dois modos. */}
            <div className="min-h-[320px] flex-1 overflow-hidden rounded-xl border border-border bg-slate-950 p-2">
              <Editor
                height="100%"
                language={formData.language}
                theme="vs-dark"
                value={formData.content}
                onChange={(value) => setFormData((prev) => ({ ...prev, content: value || '' }))}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  lineNumbers: 'on',
                  glyphMargin: false,
                  folding: true,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 3,
                  renderLineHighlight: 'all',
                  scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
                }}
                loading={
                  <div className="flex h-full items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
                    <span className="text-xs font-semibold">Carregando o editor...</span>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        tone="danger"
        icon={Trash2}
        title={`Excluir "${toDelete?.title ?? 'snippet'}"?`}
        description="Isso não pode ser desfeito."
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  );
}
