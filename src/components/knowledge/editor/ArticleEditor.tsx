'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { knowledgeApi } from '@/app/knowledge/api';
import { useAuth } from '@/context/AuthContext';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ConfirmDialog, ModalButton, useBelowBreakpoint } from '@/components/room-kit';
import { cn } from '@/lib/utils';
import { importArticleFile, KIND_LABEL } from '@/lib/knowledge-file-import';
import {
  DEFAULT_CATEGORY,
  EMPTY_DOC_HTML,
  SERVER_SUPPORTS_DRAFT_ARCHIVED,
  buildCategoryOptions,
  buildSavePayload,
  byteSizeOf,
  countWords,
  formatKb,
  formatReadingTime,
  formatWords,
  headerStatus,
  isContentEmpty,
  isDirty,
  primaryAction,
  saveIndicator,
  suggestFolders,
  toEditorStatus,
  validateArticle,
  type ArticleErrors,
  type ArticleSnapshot,
  type EditorStatus,
} from '@/lib/knowledge-editor';
import { ARTICLE_PROSE } from './article-prose';
import { ArticleDetailsPanel } from './ArticleDetailsPanel';
import { ArticlePreview } from './ArticlePreview';
import { ArticleTopBar, type EditorMode } from './ArticleTopBar';
import { FormatToolbar } from './FormatToolbar';
import { ImportDialog } from './ImportDialog';
import { LinkDialog, type LinkDialogValue } from './LinkDialog';
import { NoEditPermission } from './NoEditPermission';
import { applyLink, readLinkContext, removeLink } from './editor-link';

interface FormState {
  title: string;
  category: string;
  fullPath: string;
  status: EditorStatus;
  tags: string[];
}

const NEW_STATUS: EditorStatus = SERVER_SUPPORTS_DRAFT_ARCHIVED ? 'draft' : 'published';
const NEW_FORM: FormState = { title: '', category: DEFAULT_CATEGORY, fullPath: '', status: NEW_STATUS, tags: [] };

/** Em telas a partir deste tamanho (xl) o painel Detalhes fica fixo à direita; abaixo, vira folha lateral. */
const DETAILS_DOCKED_FROM = 1280;

const snapshotOf = (form: FormState, content: string): ArticleSnapshot => ({ ...form, content });

export function ArticleEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assetId = searchParams.get('id');
  const { session } = useAuth();
  const titleId = React.useId();
  const titleErrorId = React.useId();
  const bodyErrorId = React.useId();
  const titleRef = React.useRef<HTMLInputElement>(null);
  const belowXl = useBelowBreakpoint(DETAILS_DOCKED_FROM);

  const [form, setForm] = React.useState<FormState>(NEW_FORM);
  const [html, setHtml] = React.useState(EMPTY_DOC_HTML);
  const [baseline, setBaseline] = React.useState<ArticleSnapshot>(() => snapshotOf(NEW_FORM, EMPTY_DOC_HTML));
  const [articleId, setArticleId] = React.useState<string | null>(assetId);
  /** Id que esta tela já carregou/salvou: evita recarregar quando o endereço ganha `?id=` depois do primeiro rascunho. */
  const knownIdRef = React.useRef<string | null>(null);
  const originalStatusRef = React.useRef<string | null>(null);

  const [loading, setLoading] = React.useState(Boolean(assetId));
  const [loadError, setLoadError] = React.useState('');
  const [reloadKey, setReloadKey] = React.useState(0);
  const [noPermission, setNoPermission] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);
  const [versionsKey, setVersionsKey] = React.useState(0);
  const [errors, setErrors] = React.useState<ArticleErrors>({});
  const [mode, setMode] = React.useState<EditorMode>('write');
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkInitial, setLinkInitial] = React.useState<LinkDialogValue>({ href: '', text: '' });
  const [linkHasLink, setLinkHasLink] = React.useState(false);
  const [folderSuggestions, setFolderSuggestions] = React.useState<string[]>([]);

  // Ctrl+K abre a janela de link; o editor é criado uma vez, então a função vai por ref.
  const openLinkRef = React.useRef<() => void>(() => {});

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
        },
      }),
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(ARTICLE_PROSE, 'min-h-[26rem] focus:outline-none'),
        'aria-label': 'Conteúdo do artigo',
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          openLinkRef.current();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => setHtml(e.getHTML()),
  });

  const openLink = React.useCallback(() => {
    if (!editor) return;
    const ctx = readLinkContext(editor);
    setLinkInitial(ctx.initial);
    setLinkHasLink(ctx.hasLink);
    setLinkOpen(true);
  }, [editor]);
  React.useEffect(() => {
    openLinkRef.current = openLink;
  }, [openLink]);

  // Pastas já usadas na base, para os atalhos.
  React.useEffect(() => {
    if (!session) return;
    knowledgeApi
      .listDocuments(undefined, undefined, 0, 200)
      .then((response) => setFolderSuggestions(suggestFolders(response.content)))
      .catch((err) => console.error('Erro ao carregar sugestões de pasta:', err));
  }, [session]);

  // Carrega o artigo existente (`?id=`).
  React.useEffect(() => {
    if (!editor || !assetId || knownIdRef.current === assetId) return;
    let alive = true;
    setLoading(true);
    setLoadError('');
    setNoPermission(false);
    knowledgeApi
      .getDocumentById(assetId)
      .then((data) => {
        if (!alive) return;
        if (data.canEdit === false) {
          setNoPermission(true);
          setLoading(false);
          return;
        }
        originalStatusRef.current = data.status ?? null;
        const next: FormState = {
          title: data.title || '',
          category: data.category || DEFAULT_CATEGORY,
          fullPath: data.fullPath || '',
          status: toEditorStatus(data.status),
          tags: data.tags ?? [],
        };
        editor.commands.setContent(data.content || '', { emitUpdate: false });
        // O TipTap reescreve o HTML ao carregar; a base de comparação usa a versão dele, não a do servidor.
        const loaded = editor.getHTML();
        setForm(next);
        setHtml(loaded);
        setBaseline(snapshotOf(next, loaded));
        knownIdRef.current = assetId;
        setArticleId(assetId);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setLoadError(err.message || 'Não foi possível carregar o artigo.');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [assetId, editor, reloadKey]);

  const current = snapshotOf(form, html);
  const dirty = isDirty(baseline, current);
  const isNew = !articleId;
  const hasText = !isContentEmpty(html);

  // Alterações pendentes: o navegador avisa antes de fechar a aba ou recarregar.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const patch = (changes: Partial<FormState>) => setForm((prev) => ({ ...prev, ...changes }));

  const goBack = () => (dirty ? setLeaveOpen(true) : router.push('/knowledge/kb'));

  const save = async (target: EditorStatus) => {
    if (!session || !editor) {
      toast.error('Entre na sua conta para salvar.');
      return;
    }
    const content = editor.getHTML();
    const found = validateArticle({ title: form.title, content });
    setErrors(found);
    if (found.title || found.content) {
      toast.error(found.title ?? found.content ?? 'Preencha título e conteúdo.');
      if (found.title) titleRef.current?.focus();
      else editor.commands.focus();
      return;
    }
    setSaving(true);
    try {
      const payload = buildSavePayload({ ...form, content, status: target, originalStatus: originalStatusRef.current, userId: session.id });
      const wasNew = !articleId;
      const saved = articleId ? await knowledgeApi.updateDocument(articleId, payload) : await knowledgeApi.saveOrUpdateDocument(payload);
      const id = saved?.id ?? articleId;
      const next: FormState = { ...form, status: target };
      originalStatusRef.current = String(payload.status ?? '');
      setForm(next);
      setHtml(content);
      setBaseline(snapshotOf(next, content));
      setJustSaved(true);
      setVersionsKey((n) => n + 1);
      if (id) {
        knownIdRef.current = id;
        setArticleId(id);
      }
      if (target === 'draft') {
        toast.success('Rascunho salvo');
        if (wasNew && id) router.replace(`/knowledge/admin/new-asset?id=${id}`, { scroll: false });
      } else if (target === 'published') {
        toast.success(wasNew ? 'Artigo publicado' : 'Artigo atualizado');
        router.push(id ? `/knowledge/kb?id=${id}` : '/knowledge/kb');
      } else {
        toast.success('Artigo arquivado');
        router.push('/knowledge/kb');
      }
    } catch (error) {
      toast.error('Erro ao salvar: ' + (error instanceof Error ? error.message : 'tente de novo.'));
    } finally {
      setSaving(false);
    }
  };

  const importFile = async (file: File) => {
    if (!editor) return;
    const { html: imported, title, kind } = await importArticleFile(file);
    editor.commands.setContent(imported);
    setHtml(editor.getHTML());
    setForm((prev) => ({ ...prev, title: prev.title || title }));
    setErrors({});
    toast.success(`${KIND_LABEL[kind]} importado!`);
  };

  if (noPermission && assetId) return <NoEditPermission documentId={assetId} />;

  const indicator = saveIndicator({ isNew, dirty, saving, justSaved });
  const chip = headerStatus(form.status, isNew, SERVER_SUPPORTS_DRAFT_ARCHIVED);
  const primary = primaryAction(form.status, !isNew);
  const words = countWords(html);

  const detailsPanel = (
    <ArticleDetailsPanel
      status={form.status}
      onStatusChange={(status) => patch({ status })}
      allowDraftArchived={SERVER_SUPPORTS_DRAFT_ARCHIVED}
      category={form.category}
      categoryOptions={buildCategoryOptions(form.category)}
      onCategoryChange={(category) => patch({ category })}
      fullPath={form.fullPath}
      onFullPathChange={(fullPath) => patch({ fullPath })}
      folderSuggestions={folderSuggestions}
      tags={form.tags}
      onTagsChange={(tags) => patch({ tags })}
      documentId={articleId}
      versionsRefreshKey={versionsKey}
    />
  );

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-2.5 px-4 py-2.5 sm:px-8 2xl:px-12">
          <ArticleTopBar
            crumb={form.title.trim() || (isNew ? 'Novo artigo' : 'Sem título')}
            statusLabel={chip.label}
            statusTone={chip.tone}
            saveLabel={indicator.label}
            saveTone={indicator.tone}
            mode={mode}
            onModeChange={setMode}
            saving={saving}
            onBack={goBack}
            onOpenDetails={() => setDetailsOpen(true)}
            onImport={() => setImportOpen(true)}
            onSaveDraft={SERVER_SUPPORTS_DRAFT_ARCHIVED ? () => void save('draft') : undefined}
            onPrimary={() => void save(primary.target)}
            primaryLabel={primary.label}
          />
          {mode === 'write' && editor && (
            <div className="xl:max-w-[calc(100%-360px-1.5rem)]">
              <FormatToolbar editor={editor} onLinkClick={openLink} />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1680px] flex-1 items-start gap-6 px-4 py-6 sm:px-8 2xl:px-12">
        <main className="flex min-w-0 flex-1 flex-col gap-3">
          <article
            aria-busy={loading}
            className="relative flex min-h-[32rem] flex-col gap-5 rounded-[18px] border border-border bg-card px-6 py-9 shadow-[0_4px_14px_rgba(15,23,42,0.05)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.3)] sm:px-10 lg:px-14 2xl:px-20 2xl:py-12"
          >
            {loading && (
              <div role="status" className="absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-card/80">
                <AgileSpinner size="md" />
                <span className="sr-only">Carregando o artigo…</span>
              </div>
            )}

            {loadError ? (
              <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                  <TriangleAlert className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Não foi possível abrir o artigo. {loadError}
                </p>
                <div className="flex gap-2">
                  <ModalButton variant="secondary" onClick={() => setReloadKey((n) => n + 1)}>
                    Tentar de novo
                  </ModalButton>
                  <ModalButton variant="secondary" onClick={() => router.push('/knowledge/kb')}>
                    Voltar para a base
                  </ModalButton>
                </div>
              </div>
            ) : (
              <>
                <div className={cn('flex flex-col gap-5', mode === 'read' && 'hidden')}>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={titleId} className="sr-only">
                      Título do artigo
                    </label>
                    <input
                      id={titleId}
                      ref={titleRef}
                      value={form.title}
                      maxLength={255}
                      onChange={(e) => {
                        patch({ title: e.target.value });
                        if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                      }}
                      placeholder="Título do artigo"
                      autoComplete="off"
                      aria-invalid={errors.title ? true : undefined}
                      aria-describedby={errors.title ? titleErrorId : undefined}
                      className="w-full rounded-md bg-transparent text-[2.375rem] font-bold leading-[1.15] tracking-tight text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
                    />
                    {errors.title && (
                      <p id={titleErrorId} role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
                        {errors.title}
                      </p>
                    )}
                  </div>

                  <div
                    className="relative"
                    onInput={() => errors.content && setErrors((prev) => ({ ...prev, content: undefined }))}
                    aria-describedby={errors.content ? bodyErrorId : undefined}
                  >
                    {editor?.isEmpty && (
                      <p aria-hidden="true" className="pointer-events-none absolute left-0 top-0 text-lg text-muted-foreground/70">
                        Comece a escrever, ou use Importar arquivo para trazer um texto pronto.
                      </p>
                    )}
                    <EditorContent editor={editor} />
                  </div>
                  {errors.content && (
                    <p id={bodyErrorId} role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
                      {errors.content}
                    </p>
                  )}
                </div>

                {mode === 'read' && <ArticlePreview title={form.title} category={form.category} folder={form.fullPath} html={html} />}
              </>
            )}
          </article>

          <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1.5 text-xs text-muted-foreground">
            <span>{formatWords(words)}</span>
            <span>{formatKb(byteSizeOf(html))}</span>
            <span>{hasText ? formatReadingTime(words) : 'Sem texto ainda'}</span>
            <span className="flex-1" />
            <span>{indicator.label}</span>
          </footer>
        </main>

        {!belowXl && (
          <aside
            aria-label="Detalhes do artigo"
            className="hidden w-[360px] shrink-0 xl:sticky xl:top-[8.5rem] xl:block xl:max-h-[calc(100dvh-17rem)] xl:self-start xl:overflow-y-auto xl:pb-2"
          >
            {detailsPanel}
          </aside>
        )}
      </div>

      {belowXl && (
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent side="right" className="w-[92vw] max-w-md overflow-y-auto p-5">
            <SheetTitle className="mb-1">Detalhes do artigo</SheetTitle>
            <SheetDescription className="mb-4">Publicação, onde fica, etiquetas e versões.</SheetDescription>
            {detailsPanel}
          </SheetContent>
        </Sheet>
      )}

      <LinkDialog
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open);
          if (!open) requestAnimationFrame(() => editor?.commands.focus());
        }}
        initial={linkInitial}
        hasLink={linkHasLink}
        onApply={(value) => editor && applyLink(editor, value)}
        onRemove={() => editor && removeLink(editor)}
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} hasContent={hasText} onImport={importFile} />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        tone="danger"
        icon={TriangleAlert}
        title="Sair sem salvar?"
        description="Você tem alterações que ainda não foram salvas. Se sair agora, elas se perdem."
        cancelLabel="Continuar editando"
        confirmLabel="Sair sem salvar"
        onConfirm={() => router.push('/knowledge/kb')}
      />
    </div>
  );
}
