'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronLeft, GripVertical, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ConfirmDialog, FIELD, ModalButton } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { promptCollectionApi } from '@/app/prompt-hub/api';
import { DEFAULT_FILTERS } from '@/app/prompt-hub/catalog-logic';
import { fetchCatalog } from '@/app/prompt-hub/catalog-query';
import { collectionSaveBlock, moveInList, toCollectionView } from '@/app/prompt-hub/collections-logic';
import { VISIBILITY_META, VISIBILITY_ORDER, getTypeMeta } from '@/app/prompt-hub/constants';
import type { PromptItem } from '@/app/prompt-hub/types';
import { HubFrame } from './HubFrame';

type Visibility = 'private' | 'public';

const label = 'flex flex-col gap-1.5 text-[13px] font-semibold text-muted-foreground';

/** Editor de coleção em página própria: nome, descrição, visibilidade e a trilha (arrastar ou usar as setas). */
export function CollectionEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const { userProfile } = useUserContext();
  const isEdit = !!id;

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error' | 'forbidden'>(isEdit ? 'loading' : 'ready');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [itemIds, setItemIds] = useState<string[]>([]);
  /** Itens da trilha que a pessoa não pode ver (privados de outras pessoas): ficam na coleção, fora da tela. */
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [known, setKnown] = useState<Map<string, PromptItem>>(new Map());
  const [ownerName, setOwnerName] = useState<string | undefined>();
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [results, setResults] = useState<PromptItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ name: '', description: '', visibility: 'private', itemIds: [] }));
  const [saved, setSaved] = useState(false);
  const sessionId = session?.id;

  const snapshot = JSON.stringify({ name, description, visibility, itemIds });
  const isDirty = !saved && snapshot !== baseline;

  const remember = useCallback((items: PromptItem[]) => {
    setKnown(prev => {
      const next = new Map(prev);
      items.forEach(item => next.set(item.id, item));
      return next;
    });
  }, []);

  const loadCollection = useCallback(async () => {
    if (!id) return;
    setLoadState('loading');
    try {
      const dto = await promptCollectionApi.getCollection(id);
      const view = toCollectionView(dto, sessionId);
      if (!view.canManage) {
        setLoadState('forbidden');
        return;
      }
      const { collection } = view;
      // Só os itens que a pessoa vê aparecem no editor; os privados de outras pessoas continuam na trilha ao salvar.
      const ids = view.visible.map(item => item.id);
      const visibleSet = new Set(ids);
      setHiddenIds((dto.items ?? []).map(item => item.id).filter(itemId => !visibleSet.has(itemId)));
      setName(collection.name);
      setDescription(collection.description ?? '');
      setVisibility(collection.visibility);
      setItemIds(ids);
      setOwnerId(collection.ownerId);
      setOwnerName(collection.ownerName);
      remember(view.visible);
      setBaseline(JSON.stringify({ name: collection.name, description: collection.description ?? '', visibility: collection.visibility, itemIds: ids }));
      setLoadState('ready');
    } catch (err) {
      console.error(err);
      setLoadState('error');
    }
  }, [id, sessionId, remember]);

  useEffect(() => {
    if (authLoading || !session) return;
    void loadCollection();
  }, [authLoading, session, loadCollection]);

  // Busca de itens para adicionar: no servidor, 300 ms depois da última tecla.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setSearching(true);
    fetchCatalog(
      {
        filters: { ...DEFAULT_FILTERS, search: search.trim() },
        sort: search.trim() ? 'recent' : 'used',
        favoritesOnly: false,
        mineOnly: false,
        page: 0,
        size: 8,
        sessionId: session.id,
        anonymous: false,
      },
      new Set()
    )
      .then(response => {
        if (cancelled) return;
        setResults(response.items);
        remember(response.items);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, session, remember]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const rows = useMemo(() => itemIds.map(itemId => known.get(itemId)).filter((item): item is PromptItem => !!item), [itemIds, known]);
  const block = collectionSaveBlock(name, [...itemIds, ...hiddenIds]);
  const title = isEdit ? 'Editar coleção' : 'Nova coleção';
  const back = isEdit && id ? `/prompt-hub/colecoes/${encodeURIComponent(id)}` : '/prompt-hub/colecoes';

  const requestLeave = () => {
    if (saving) return;
    if (isDirty) setLeaveOpen(true);
    else router.push(back);
  };

  const add = (itemId: string) => setItemIds(prev => (prev.includes(itemId) ? prev : [...prev, itemId]));
  const remove = (itemId: string) => setItemIds(prev => prev.filter(i => i !== itemId));
  const move = (from: number, to: number) => setItemIds(prev => moveInList(prev, from, to));

  const save = async () => {
    if (saving || block) return;
    if (!session) {
      toast.error('Sua sessão expirou. Entre de novo para salvar.');
      return;
    }
    setSaving(true);
    const loading = toast.loading('Salvando coleção...');
    try {
      const payload = {
        name: name.trim(),
        description,
        visibility,
        // Edição por quem não é dona (administradora) mantém a dona original.
        ownerId: ownerId ?? session.id,
        ownerName: ownerName ?? userProfile?.name ?? session.name ?? 'Membro',
        items: [...itemIds, ...hiddenIds].map(itemId => ({ id: itemId })),
      };
      const saved = id ? await promptCollectionApi.updateCollection(id, payload) : await promptCollectionApi.createCollection(payload);
      setSaved(true);
      toast.success(id ? 'Coleção atualizada' : 'Coleção criada', { id: loading });
      router.push(`/prompt-hub/colecoes/${encodeURIComponent(saved.id)}`);
    } catch (err) {
      toast.error('Erro ao salvar', { id: loading, description: err instanceof Error ? err.message : undefined });
      setSaving(false);
    }
  };

  if (authLoading || (isEdit && loadState === 'loading' && !!session)) {
    return (
      <HubFrame documentTitle={title} active="colecoes">
        <h1 className="sr-only">{title}</h1>
        <LoadingSkeleton variant="cards" rows={3} label="Carregando a coleção" />
      </HubFrame>
    );
  }

  if (!session) {
    return (
      <HubFrame documentTitle={title} active="colecoes" title={title} breadcrumb={[{ label: 'Coleções', href: '/prompt-hub/colecoes' }, { label: title }]}>
        <EmptyState
          title="Entre para criar coleções"
          actions={
            <ModalButton variant="primary" onClick={() => router.push('/login')}>
              Entrar
            </ModalButton>
          }
        />
      </HubFrame>
    );
  }

  if (loadState === 'error' || loadState === 'forbidden') {
    return (
      <HubFrame documentTitle={title} active="colecoes" title={title} breadcrumb={[{ label: 'Coleções', href: '/prompt-hub/colecoes' }, { label: title }]}>
        {loadState === 'error' ? (
          <ErrorState title="Não foi possível abrir a coleção" onRetry={() => void loadCollection()} />
        ) : (
          <EmptyState
            title="Você não pode editar esta coleção"
            description="Só a pessoa que criou a coleção e a administração podem editar."
            actions={<ModalButton onClick={() => router.push('/prompt-hub/colecoes')}>Ver coleções</ModalButton>}
          />
        )}
      </HubFrame>
    );
  }

  return (
    <HubFrame documentTitle={title} active="colecoes">
      <section className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={requestLeave}
            aria-label={isEdit ? 'Voltar à coleção' : 'Voltar às coleções'}
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-border text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">{title}</h1>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <span aria-hidden="true" className={cn('h-[7px] w-[7px] rounded-full', isDirty ? 'bg-amber-500' : 'bg-emerald-500')} />
              {isDirty ? 'Alterações ainda não salvas' : isEdit ? 'Sem alterações' : 'Coleção nova, ainda não salva'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <ModalButton onClick={requestLeave} disabled={saving}>
            Cancelar
          </ModalButton>
          <ModalButton variant="primary" onClick={() => void save()} disabled={!!block || saving}>
            {saving ? 'Salvando…' : 'Salvar coleção'}
          </ModalButton>
        </div>
      </section>

      {block && (
        <div role="status" className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-sm text-foreground">
          {block}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_480px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className={cn(PAGE_CARD, 'flex flex-col gap-3.5 p-5')}>
            <label className={label}>
              Nome
              <input
                value={name}
                maxLength={255}
                onChange={event => setName(event.target.value)}
                placeholder="Ex.: Refinamento sem sofrimento"
                className={cn(FIELD, 'h-[46px] text-base font-semibold text-foreground')}
              />
            </label>
            <label className={label}>
              Descrição
              <textarea
                rows={2}
                value={description}
                maxLength={5000}
                onChange={event => setDescription(event.target.value)}
                placeholder="Para quem é e o que a pessoa aprende ao seguir a trilha"
                className={cn(FIELD, 'resize-y py-3 leading-normal text-foreground')}
              />
            </label>
            <div role="radiogroup" aria-label="Quem pode ver" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {VISIBILITY_ORDER.map(value => {
                const meta = VISIBILITY_META[value];
                const Icon = meta.icon;
                const on = visibility === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setVisibility(value)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on ? 'border-primary/60 bg-primary/10 dark:bg-primary/15' : 'border-border hover:bg-accent'
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 text-foreground" strokeWidth={1.5} aria-hidden="true" />
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                      <span className={cn('text-[13px]', on ? 'text-foreground/80' : 'text-muted-foreground')}>{meta.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[13px] text-muted-foreground">
              A coleção não muda a visibilidade dos itens: quem não pode ver um item continua sem vê-lo, mesmo abrindo a trilha.
            </p>
          </section>

          <section aria-label="Itens da coleção" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-5')}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-foreground">Itens, na ordem da trilha</h2>
              <span className="text-[13px] text-muted-foreground" aria-live="polite">
                {itemIds.length} {itemIds.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            {hiddenIds.length > 0 && (
              <p className="rounded-[10px] border border-border bg-muted/40 px-3 py-2 text-[13px] text-muted-foreground">
                {hiddenIds.length} {hiddenIds.length === 1 ? 'item de outra pessoa continua' : 'itens de outras pessoas continuam'} na trilha, mas {hiddenIds.length === 1 ? 'não aparece' : 'não aparecem'} aqui porque {hiddenIds.length === 1 ? 'é privado' : 'são privados'}.
              </p>
            )}
            {rows.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">
                Nenhum item ainda. Busque ao lado e clique em Adicionar.
              </div>
            )}
            <ol className="flex flex-col gap-2">
              {rows.map((item, index) => {
                const meta = getTypeMeta(item.type);
                return (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={event => {
                      setDragFrom(index);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={event => {
                      event.preventDefault();
                      setDragOver(index);
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      if (dragFrom !== null) move(dragFrom, index);
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors duration-fast',
                      dragOver === index && dragFrom !== null && dragFrom !== index ? 'border-primary bg-primary/10' : 'border-border',
                      dragFrom === index && 'opacity-60'
                    )}
                  >
                    <span title="Arraste para mudar a ordem" aria-hidden="true" className="flex cursor-grab text-muted-foreground active:cursor-grabbing">
                      <GripVertical className="h-[18px] w-[18px]" strokeWidth={1.5} />
                    </span>
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">{index + 1}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">{item.title?.trim() || 'Item sem título'}</span>
                      <span className="text-xs text-muted-foreground">
                        {meta.label} · {item.authorName || 'Membro'}
                      </span>
                    </span>
                    <RowButton label={`Subir ${item.title}`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                      <ArrowUp className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />
                    </RowButton>
                    <RowButton label={`Descer ${item.title}`} disabled={index === rows.length - 1} onClick={() => move(index, index + 1)}>
                      <ArrowDown className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />
                    </RowButton>
                    <RowButton label={`Remover ${item.title} da coleção`} danger onClick={() => remove(item.id)}>
                      <X className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />
                    </RowButton>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside aria-label="Buscar itens" className={cn(PAGE_CARD, 'flex flex-col gap-3 p-5')}>
          <h2 className="text-base font-bold text-foreground">Buscar e adicionar</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <input
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              aria-label="Buscar item para adicionar"
              placeholder="Título, autor ou etiqueta"
              className={cn(FIELD, 'h-[42px] pl-9 text-foreground')}
            />
          </div>
          <ul className="flex flex-col gap-1.5" aria-busy={searching}>
            {results.map(item => {
              const meta = getTypeMeta(item.type);
              const Icon = meta.icon;
              const added = itemIds.includes(item.id);
              return (
                <li key={item.id} className="flex items-center gap-2.5 rounded-[10px] border border-border px-2.5 py-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{item.title?.trim() || 'Item sem título'}</span>
                    <span className="text-xs text-muted-foreground">
                      {meta.label} · {item.authorName || 'Membro'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => add(item.id)}
                    disabled={added}
                    aria-label={added ? `${item.title} já está na coleção` : `Adicionar ${item.title}`}
                    className={cn(
                      'h-[30px] rounded-lg border border-border px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      added ? 'text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    )}
                  >
                    {added ? 'Adicionado' : 'Adicionar'}
                  </button>
                </li>
              );
            })}
          </ul>
          {!searching && results.length === 0 && <span className="px-0.5 py-2 text-sm text-muted-foreground">Nenhum item encontrado.</span>}
        </aside>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        tone="danger"
        title="Sair sem salvar?"
        description="Você tem alterações que ainda não foram salvas. Se sair agora, elas se perdem."
        cancelLabel="Continuar editando"
        confirmLabel="Sair sem salvar"
        onConfirm={() => {
          setSaved(true);
          router.push(back);
        }}
      />
    </HubFrame>
  );
}

function RowButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        danger ? 'text-red-700 dark:text-red-300' : 'text-foreground'
      )}
    >
      {children}
    </button>
  );
}
