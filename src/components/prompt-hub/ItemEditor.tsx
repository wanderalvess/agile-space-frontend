'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, FolderUp, Info } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ConfirmDialog, FIELD, ModalButton } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { promptApi } from '@/app/prompt-hub/api';
import { canEditItem } from '@/app/prompt-hub/catalog-logic';
import { invalidateCatalogCache } from '@/app/prompt-hub/catalog-query';
import { IMPACT_META, IMPACT_ORDER, STATUS_META, STATUS_ORDER, TYPE_ORDER, VISIBILITY_META, VISIBILITY_ORDER, getTypeMeta } from '@/app/prompt-hub/constants';
import { EMPTY_FORM, LIMITS, buildPayload, publishBlock, type EditorForm } from '@/app/prompt-hub/editor-logic';
import { findSimilarPrompts } from '@/app/prompt-hub/findSimilar';
import { SKILL_TEMPLATE } from '@/app/prompt-hub/tutorial-sections';
import { extractVariables } from '@/app/prompt-hub/variables';
import type { PromptItem, PromptType, PromptVisibility } from '@/app/prompt-hub/types';
import { SelectField } from '@/components/room-kit';
import { HubFrame } from './HubFrame';
import { ImportDialog } from './ImportDialog';
import { SimilarItems, SkillCheck, SkillTutorialSheet, TagsField } from './EditorParts';
import { usePromptActions } from './usePromptActions';

const label = 'flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground';
const counter = 'font-medium tabular-nums';

/**
 * Editor de item em página própria (novo e edição). Tem tudo o que o antigo diálogo tinha: tipo,
 * título, descrição, conteúdo por tipo, conferência ao vivo do SKILL.md, itens parecidos, visibilidade,
 * etiquetas, detalhes de iniciativa e confirmação ao sair com alterações.
 */
export function ItemEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const actions = usePromptActions();
  const isEdit = !!id;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'forbidden'>(isEdit ? 'loading' : 'ready');
  const [original, setOriginal] = useState<PromptItem | null>(null);
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [pool, setPool] = useState<PromptItem[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [baseline, setBaseline] = useState(() => JSON.stringify(EMPTY_FORM));
  const [saved, setSaved] = useState(false);
  const sessionId = session?.id;

  const update = (patch: EditorForm) => setForm(prev => ({ ...prev, ...patch }));

  const loadItem = useCallback(async () => {
    if (!id) return;
    setLoadState('loading');
    try {
      const item = await promptApi.getPromptById(id);
      if (!canEditItem(item, sessionId)) {
        setLoadState('forbidden');
        return;
      }
      setOriginal(item);
      setBaseline(JSON.stringify(item));
      setForm(item);
      setLoadState('ready');
    } catch (err) {
      console.error(err);
      setLoadState('error');
    }
  }, [id, sessionId]);

  useEffect(() => {
    if (authLoading || !session) return;
    void loadItem();
  }, [authLoading, session, loadItem]);

  // Itens que a pessoa já enxerga, para avisar de duplicata antes de publicar (melhor esforço).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    promptApi
      .listAll({ sort: 'recent' }, 200, 3)
      .then(items => {
        if (!cancelled) setPool(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session]);

  const typeMeta = getTypeMeta(form.type);
  const isSkill = form.type === 'skill';
  const isDirty = !saved && (JSON.stringify(form) !== baseline || tagDraft.trim() !== '');
  const block = publishBlock(form);
  const similar = useMemo(() => findSimilarPrompts(form.title, form.content, pool, id), [form.title, form.content, pool, id]);
  const fields = useMemo(() => (isSkill || typeMeta.linkFirst ? [] : extractVariables(form.content)), [form.content, isSkill, typeMeta.linkFirst]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const goBack = () => router.push(isEdit && id ? `/prompt-hub/${encodeURIComponent(id)}` : '/prompt-hub');
  const requestLeave = () => {
    if (saving) return;
    if (isDirty) setLeaveOpen(true);
    else goBack();
  };

  const publish = async () => {
    if (saving) return;
    const built = buildPayload(form, tagDraft);
    if (!built.ok) {
      toast.error(built.title, { description: built.description });
      return;
    }
    if (!session) {
      toast.error('Sua sessão expirou. Entre de novo para salvar.');
      return;
    }
    setSaving(true);
    const loading = toast.loading('Salvando...');
    try {
      const payload: Partial<PromptItem> = {
        ...built.payload,
        status: built.payload.status || 'producao',
        impact: built.payload.impact || 'medio',
        // Quem edita (inclusive a administradora) não vira autora do item de outra pessoa.
        ...(original
          ? {
              authorId: original.authorId,
              authorName: original.authorName,
              authorRole: original.authorRole,
              authorSquad: original.authorSquad,
              authorAvatar: original.authorAvatar,
            }
          : { authorId: session.id, ...actions.authorSnapshot() }),
      };
      const saved = original ? await promptApi.updatePrompt(original.id, payload) : await promptApi.createPrompt(payload);
      invalidateCatalogCache();
      setSaved(true);
      toast.success(original ? 'Item atualizado' : built.payload.visibility === 'public' ? 'Item publicado' : 'Item salvo como privado', {
        id: loading,
        description: tagDraft.trim() ? 'A etiqueta pendente foi incluída.' : undefined,
      });
      router.push(`/prompt-hub/${encodeURIComponent(saved.id)}`);
    } catch (err) {
      toast.error('Erro ao salvar', { id: loading, description: err instanceof Error ? err.message : undefined });
      setSaving(false);
    }
  };

  const title = isEdit ? 'Editar item' : 'Novo item';

  if (authLoading || (isEdit && loadState === 'loading' && !!session)) {
    return (
      <HubFrame documentTitle={title} active="meus">
        <h1 className="sr-only">{title}</h1>
        <LoadingSkeleton variant="page" rows={4} label="Carregando o item" />
      </HubFrame>
    );
  }

  if (!session) {
    return (
      <HubFrame documentTitle={title} active="catalogo" title={title} breadcrumb={[{ label: 'Biblioteca de IA', href: '/prompt-hub' }, { label: title }]}>
        <EmptyState
          title="Entre para criar itens"
          description="Para publicar na biblioteca, entre na sua conta."
          actions={
            <ModalButton variant="primary" onClick={() => router.push('/login')}>
              Entrar
            </ModalButton>
          }
        />
      </HubFrame>
    );
  }

  if (loadState === 'forbidden' || loadState === 'error') {
    return (
      <HubFrame documentTitle={title} active="meus" title={title} breadcrumb={[{ label: 'Biblioteca de IA', href: '/prompt-hub' }, { label: title }]}>
        {loadState === 'error' ? (
          <ErrorState title="Não foi possível abrir o item" description="Confira a conexão e tente de novo." onRetry={() => void loadItem()} />
        ) : (
          <EmptyState
            title="Você não pode editar este item"
            description="Só a pessoa que criou o item e a administração podem editar."
            actions={<ModalButton onClick={() => router.push('/prompt-hub')}>Voltar ao catálogo</ModalButton>}
          />
        )}
      </HubFrame>
    );
  }

  const publishLabel = isEdit ? 'Salvar alterações' : form.visibility === 'public' ? 'Publicar para todos' : 'Salvar como privado';
  const dirtyNote = isDirty ? 'Alterações ainda não publicadas' : isEdit ? 'Sem alterações' : 'Item novo, ainda não publicado';

  return (
    <HubFrame documentTitle={title} active={isEdit ? 'meus' : 'catalogo'}>
      <section className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={requestLeave}
            aria-label={isEdit ? 'Voltar ao item' : 'Voltar ao catálogo'}
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-border text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">{title}</h1>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-full', isDirty ? 'bg-amber-500' : 'bg-emerald-500')} />
              {dirtyNote}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isEdit && (
            <ModalButton onClick={() => setImportOpen(true)} className="gap-2">
              <FolderUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Importar pasta
            </ModalButton>
          )}
          <ModalButton onClick={requestLeave} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={() => void publish()} disabled={!!block || saving}>
            {saving ? 'Salvando…' : publishLabel}
          </ModalButton>
        </div>
      </section>

      {block && (
        <div role="status" className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-sm text-foreground">
          {block}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Tipo" className={cn(PAGE_CARD, 'flex flex-col gap-3.5 p-5')}>
            <h2 className="text-base font-bold text-foreground">Que tipo de item é este?</h2>
            <div role="radiogroup" aria-label="Tipo de item" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {TYPE_ORDER.map(type => {
                const meta = getTypeMeta(type);
                const Icon = meta.icon;
                const on = form.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => update({ type: type as PromptType })}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on ? 'border-primary bg-primary/10 dark:bg-primary/15' : 'border-border bg-muted/30 hover:bg-accent'
                    )}
                  >
                    <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', on ? 'bg-primary/15 text-primary [.theme-totvs:not(.dark)_&]:text-foreground' : 'bg-muted text-muted-foreground')}>
                      <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-foreground">{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-sm leading-normal text-muted-foreground">{typeMeta.summary}</span>
          </section>

          <section aria-label="Conteúdo do item" className={cn(PAGE_CARD, 'flex flex-col gap-4 p-5')}>
            <label className={label}>
              <span className="flex justify-between">
                <span>Título</span>
                <span className={counter}>{(form.title ?? '').length} de {LIMITS.title}</span>
              </span>
              <input
                value={form.title ?? ''}
                maxLength={LIMITS.title}
                onChange={event => update({ title: event.target.value })}
                placeholder="Ex.: Resumir issue para refinamento"
                className={cn(FIELD, 'h-[46px] text-base font-semibold text-foreground')}
              />
            </label>

            <label className={label}>
              <span className="flex justify-between">
                <span>Descrição</span>
                <span className={counter}>{(form.description ?? '').length.toLocaleString('pt-BR')} de {LIMITS.description.toLocaleString('pt-BR')}</span>
              </span>
              <textarea
                rows={3}
                value={form.description ?? ''}
                maxLength={LIMITS.description}
                onChange={event => update({ description: event.target.value })}
                placeholder="Para que serve e quando usar. Aparece no cartão e ajuda na busca."
                className={cn(FIELD, 'resize-y py-3 leading-normal text-foreground')}
              />
            </label>

            {typeMeta.linkFirst && (
              <label className={label}>
                Link da ferramenta
                <input
                  value={form.gemLink ?? ''}
                  maxLength={LIMITS.short}
                  onChange={event => update({ gemLink: event.target.value })}
                  placeholder="https://gemini.google.com/gem/..."
                  className={cn(FIELD, 'h-[42px] text-foreground')}
                />
                <span className="font-medium">Precisa começar com http:// ou https://. Quem abrir o item vai direto para a ferramenta.</span>
              </label>
            )}

            <div className={label}>
              <span className="flex items-center justify-between gap-3">
                <label htmlFor="item-conteudo">
                  {typeMeta.contentLabel}
                  {typeMeta.linkFirst && <span className="ml-2 font-normal">(opcional)</span>}
                </label>
                <span className="inline-flex items-center gap-3">
                  {isSkill && (
                    <button
                      type="button"
                      onClick={() => (form.content?.trim() ? setTemplateOpen(true) : update({ content: SKILL_TEMPLATE }))}
                      className="h-7 rounded-lg border border-border px-2.5 text-[13px] font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Inserir modelo
                    </button>
                  )}
                  <span className={counter}>{(form.content ?? '').length.toLocaleString('pt-BR')} de {LIMITS.content.toLocaleString('pt-BR')}</span>
                </span>
              </span>
              {typeMeta.contentHint && (
                <p className="flex items-start gap-2 rounded-[10px] bg-muted px-3 py-2 text-[13px] font-medium leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  {typeMeta.contentHint}
                </p>
              )}
              <textarea
                id="item-conteudo"
                rows={isSkill ? 14 : 10}
                value={form.content ?? ''}
                maxLength={LIMITS.content}
                onChange={event => update({ content: event.target.value })}
                placeholder={typeMeta.contentPlaceholder}
                className={cn(
                  FIELD,
                  'resize-y py-3.5 leading-relaxed text-foreground',
                  typeMeta.mono ? 'font-mono text-[13px]' : 'text-sm'
                )}
              />
              {fields.length > 0 && (
                <span className="font-medium">
                  Campos encontrados: <strong className="text-foreground">{fields.join(', ')}</strong>. Quem usar preenche antes de copiar.
                </span>
              )}
            </div>
          </section>

          {isSkill && form.content?.trim() && (
            <div className="flex flex-col gap-2">
              <SkillCheck content={form.content} />
              <div className="flex justify-end">
                <ModalButton onClick={() => setTutorialOpen(true)}>Ver tutorial</ModalButton>
              </div>
            </div>
          )}
          {isSkill && !form.content?.trim() && (
            <div className="flex justify-end">
              <ModalButton onClick={() => setTutorialOpen(true)}>Ver tutorial</ModalButton>
            </div>
          )}
        </div>

        <aside aria-label="Detalhes" className="flex min-w-0 flex-col gap-3.5">
          <section className={cn(PAGE_CARD, 'flex flex-col gap-3 p-[18px]')}>
            <h2 className="text-base font-bold text-foreground">Quem pode ver</h2>
            <div role="radiogroup" aria-label="Visibilidade" className="flex flex-col gap-2">
              {VISIBILITY_ORDER.map(value => {
                const meta = VISIBILITY_META[value];
                const Icon = meta.icon;
                const on = (form.visibility ?? 'private') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => update({ visibility: value as PromptVisibility })}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent'
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 text-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                      <span className="text-[13px] text-muted-foreground">{meta.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <TagsField
            tags={form.tags ?? []}
            draft={tagDraft}
            onDraft={setTagDraft}
            onChange={tags => update({ tags })}
            onLimit={() => toast.error(`Use no máximo ${LIMITS.maxTags} etiquetas`)}
          />

          <SimilarItems similar={similar} />

          <details className={cn(PAGE_CARD, 'px-[18px]')} open={!!(form.businessGoal || form.targetAudience || form.architectureLink)}>
            <summary className="flex h-[54px] cursor-pointer list-none items-center justify-between text-base font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Detalhes de iniciativa
              <span className="text-[13px] font-medium text-muted-foreground">Opcional</span>
            </summary>
            <div className="flex flex-col gap-3 pb-[18px]">
              <label className={label}>
                Objetivo
                <input
                  value={form.businessGoal ?? ''}
                  maxLength={LIMITS.short}
                  onChange={event => update({ businessGoal: event.target.value })}
                  placeholder="O que se quer alcançar"
                  className={cn(FIELD, 'h-[42px] text-foreground')}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Situação
                  <SelectField
                    aria-label="Situação"
                    value={form.status ?? 'producao'}
                    onChange={value => update({ status: value as EditorForm['status'] })}
                    options={STATUS_ORDER.map(value => ({ value, label: STATUS_META[value].label }))}
                    className="h-[42px]"
                  />
                </label>
                <label className={label}>
                  Impacto
                  <SelectField
                    aria-label="Impacto"
                    value={form.impact ?? 'medio'}
                    onChange={value => update({ impact: value as EditorForm['impact'] })}
                    options={IMPACT_ORDER.map(value => ({ value, label: IMPACT_META[value].filterLabel }))}
                    className="h-[42px]"
                  />
                </label>
              </div>
              <label className={label}>
                Público-alvo
                <input
                  value={form.targetAudience ?? ''}
                  maxLength={LIMITS.short}
                  onChange={event => update({ targetAudience: event.target.value })}
                  placeholder="Quem deve usar"
                  className={cn(FIELD, 'h-[42px] text-foreground')}
                />
              </label>
              <label className={label}>
                Link da documentação
                <input
                  value={form.architectureLink ?? ''}
                  maxLength={LIMITS.short}
                  onChange={event => update({ architectureLink: event.target.value })}
                  placeholder="https://"
                  className={cn(FIELD, 'h-[42px] text-foreground')}
                />
              </label>
              <span className="text-[13px] text-muted-foreground">Para arquivar o item, escolha a situação &quot;Arquivado&quot;.</span>
            </div>
          </details>
        </aside>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Sair sem salvar?"
        description="Você tem alterações que ainda não foram publicadas. Se sair agora, elas se perdem."
        cancelLabel="Continuar editando"
        confirmLabel="Sair sem salvar"
        tone="danger"
        onConfirm={() => {
          setSaved(true);
          goBack();
        }}
      />
      <ConfirmDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        title="Trocar o texto pelo modelo?"
        description="O conteúdo que você já escreveu será substituído pelo modelo de SKILL.md."
        confirmLabel="Inserir modelo"
        onConfirm={() => update({ content: SKILL_TEMPLATE })}
      />
      <SkillTutorialSheet open={tutorialOpen} onOpenChange={setTutorialOpen} />
      {!isEdit && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          authorId={session.id}
          authorSnapshot={actions.authorSnapshot}
          onImported={() => {
            invalidateCatalogCache();
            setSaved(true);
            router.push('/prompt-hub?aba=meus');
          }}
        />
      )}
    </HubFrame>
  );
}
