'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, FolderUp, Inbox, Plus, Search, Star, User, X } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { ModuleIntegrationButton } from '@/components/shared/ModuleIntegrationDialog';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';
import { countPanelFilters, DEFAULT_FILTERS, hasAnyFilter } from '@/app/prompt-hub/catalog-logic';
import { fetchCatalog, invalidateCatalogCache, type CatalogResponse } from '@/app/prompt-hub/catalog-query';
import { TYPE_META, type SortKey } from '@/app/prompt-hub/constants';
import type { CatalogFilters, PromptItem } from '@/app/prompt-hub/types';
import { CatalogKpis, CatalogToolbar, FiltersPanel, MostUsed, TypePills } from './CatalogParts';
import { DeleteItemDialog } from './DeleteItemDialog';
import { HubFrame, type HubTab } from './HubFrame';
import { ImportDialog } from './ImportDialog';
import { ItemCard, type ItemCardHandlers } from './ItemCard';
import { ItemPanel } from './ItemPanel';
import { PromptGuide } from './PromptGuide';
import { usePromptActions } from './usePromptActions';

const PAGE_SIZE = 24;

interface CatalogProps {
  /** Logada, mas sem cargo e squad: o catálogo pede o perfil antes. */
  needsProfile: boolean;
  /** A pessoa escolheu "Apenas ver modelos públicos": só leitura, só itens públicos. */
  publicOnly: boolean;
  onSkipProfile: () => void;
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Tela principal da biblioteca: números, busca, tipos, filtros e cartões. Busca, filtros, ordem e
 * paginação acontecem no servidor ("Carregar mais" traz a próxima página); com o servidor antigo o
 * navegador faz o mesmo trabalho (ver catalog-query.ts).
 */
export function Catalog({ needsProfile, publicOnly, onSkipProfile }: CatalogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const { setIsEditProfileOpen } = useUserContext();
  const sessionId = session?.id;
  const anonymous = !session;
  const loggedIn = !!session && !publicOnly;

  const aba = searchParams.get('aba');
  const tab: HubTab = loggedIn && aba === 'favoritos' ? 'favoritos' : loggedIn && aba === 'meus' ? 'meus' : 'catalogo';
  const tagParam = searchParams.get('tag');

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [filters, setFilters] = useState<CatalogFilters>({ ...DEFAULT_FILTERS, tag: tagParam });
  const [favSwitch, setFavSwitch] = useState(false);
  const [sort, setSort] = useState<SortKey>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [result, setResult] = useState<CatalogResponse | null>(null);
  const [items, setItems] = useState<PromptItem[]>([]);
  const [page, setPage] = useState(0);
  const [state, setState] = useState<LoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [mostUsed, setMostUsed] = useState<PromptItem[]>([]);

  const [selected, setSelected] = useState<PromptItem | null>(null);
  const [toDelete, setToDelete] = useState<PromptItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const requestId = useRef(0);

  const patchItem = useCallback((id: string, patch: Partial<PromptItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const actions = usePromptActions({
    onUsed: id => {
      setItems(prev => prev.map(item => (item.id === id ? { ...item, useCount: (item.useCount || 0) + 1 } : item)));
      setSelected(prev => (prev && prev.id === id ? { ...prev, useCount: (prev.useCount || 0) + 1 } : prev));
    },
  });
  const { localFavorites } = actions;

  const favoritesOnly = tab === 'favoritos' || favSwitch;
  const mineOnly = tab === 'meus';
  /** O que a pessoa escolheu na tela. */
  const shown = useMemo<CatalogFilters>(
    () => ({ ...filters, search: search.trim(), visibility: mineOnly ? 'all' : filters.visibility }),
    [filters, search, mineOnly]
  );
  /** O que vai para a consulta: no modo "só públicos" a visibilidade é fixa. */
  const effective = useMemo<CatalogFilters>(() => (publicOnly ? { ...shown, visibility: 'public' } : shown), [shown, publicOnly]);
  const filtered = hasAnyFilter(shown, favoritesOnly, mineOnly);
  const refined = hasPanelOrTypeOrSearch(shown, favSwitch);
  const panelFilterCount = countPanelFilters(shown, favSwitch);

  const baseRequest = useCallback(
    (overrides: Partial<Parameters<typeof fetchCatalog>[0]> = {}) => ({
      filters: effective,
      sort,
      favoritesOnly,
      mineOnly,
      page: 0,
      size: PAGE_SIZE,
      sessionId,
      anonymous,
      ...overrides,
    }),
    [effective, sort, favoritesOnly, mineOnly, sessionId, anonymous]
  );

  // Legado: os favoritos locais entram na consulta; o que mudar neles só refaz a busca se a aba for "Favoritos".
  const favoritesForQuery = useRef(localFavorites);
  useEffect(() => {
    favoritesForQuery.current = localFavorites;
  }, [localFavorites]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setState(prev => (prev === 'ready' ? prev : 'loading'));
    try {
      const response = await fetchCatalog(baseRequest(), favoritesForQuery.current);
      if (id !== requestId.current) return;
      setResult(response);
      setItems(response.items);
      setPage(0);
      setState('ready');
    } catch (err) {
      console.error('[prompt-hub] erro ao carregar o catálogo', err);
      if (id !== requestId.current) return;
      setState('error');
    }
  }, [baseRequest]);

  useEffect(() => {
    if (needsProfile) return;
    void load();
  }, [load, needsProfile]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchCatalog(baseRequest({ page: page + 1 }), favoritesForQuery.current);
      setItems(prev => {
        const known = new Set(prev.map(item => item.id));
        return [...prev, ...next.items.filter(item => !known.has(item.id))];
      });
      setResult(prev => (prev ? { ...prev, total: next.total, totalPages: next.totalPages } : next));
      setPage(page + 1);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível carregar mais itens', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoadingMore(false);
    }
  };

  // "Mais usados": quatro atalhos, só na visão sem filtros.
  useEffect(() => {
    if (needsProfile || filtered || tab !== 'catalogo') {
      setMostUsed([]);
      return;
    }
    let cancelled = false;
    fetchCatalog(
      {
        filters: { ...DEFAULT_FILTERS, visibility: publicOnly ? 'public' : 'all' },
        sort: 'used',
        favoritesOnly: false,
        mineOnly: false,
        page: 0,
        size: 4,
        sessionId,
        anonymous,
      },
      favoritesForQuery.current
    )
      .then(response => {
        if (!cancelled) setMostUsed(response.items.filter(item => (item.useCount || 0) > 0).slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setMostUsed([]);
      });
    return () => {
      cancelled = true;
    };
  }, [filtered, needsProfile, tab, publicOnly, sessionId, anonymous]);

  const mode = result?.mode ?? 'server';
  /** Com o servidor antigo, o favorito é local; com o novo, vem no próprio item. */
  const viewItems = useMemo(
    () => (mode === 'legacy' ? items.map(item => ({ ...item, favorite: localFavorites.has(item.id) })) : items),
    [items, mode, localFavorites]
  );

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ ...DEFAULT_FILTERS });
    setFavSwitch(false);
    if (tab !== 'catalogo') router.push('/prompt-hub');
  };

  const selectTag = useCallback((tag: string) => {
    setSelected(null);
    setFilters(prev => ({ ...prev, tag: prev.tag === tag ? null : tag }));
    setFiltersOpen(true);
  }, []);

  const handlers: ItemCardHandlers = {
    onOpen: item => setSelected(items.find(candidate => candidate.id === item.id) ?? item),
    onCopy: item => actions.copyText(item, item.content ?? ''),
    onOpenTool: (item, link) => void actions.openTool(item, link),
    onToggleFavorite: async item => {
      const original = items.find(candidate => candidate.id === item.id) ?? item;
      const next = await actions.toggleFavorite(
        { id: item.id, favorite: mode === 'server' ? original.favorite : undefined },
        !!item.favorite
      );
      if (next === null) return;
      if (mode === 'server') patchItem(item.id, { favorite: next });
      if (!next && favoritesOnly) {
        setItems(prev => prev.filter(candidate => candidate.id !== item.id));
        setResult(prev => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));
      }
    },
    onCopyLink: item => void actions.copyLink(item),
    onEdit: item => router.push(`/prompt-hub/${encodeURIComponent(item.id)}/editar`),
    onDuplicate: item => void actions.duplicate(item),
    onDelete: item => setToDelete(item),
    onSelectTag: selectTag,
    onSelectAuthor: anonymous ? undefined : authorId => router.push(`/prompt-hub/autor/${encodeURIComponent(authorId)}`),
  };

  const removeFromList = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setSelected(null);
    setResult(prev => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));
    invalidateCatalogCache();
    void load();
  };

  const total = result?.total ?? 0;
  const facets = result?.facets ?? null;
  const canCreate = loggedIn && !needsProfile;

  const headerActions = (
    <>
      <ModalButton onClick={() => setGuideOpen(true)} className="gap-2">
        <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        Guia
      </ModalButton>
      <ModuleIntegrationButton moduleId="prompt-hub" label="Integração" className="h-10 rounded-[10px] px-4 text-sm font-medium" />
      {canCreate && (
        <>
          <ModalButton onClick={() => setImportOpen(true)} className="gap-2">
            <FolderUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Importar pasta
          </ModalButton>
          <ModalButton variant="primary" onClick={() => router.push('/prompt-hub/novo')} className="gap-2">
            <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Novo item
          </ModalButton>
        </>
      )}
    </>
  );

  const bannerVisitor = anonymous && (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-primary/30 bg-primary/10 px-4 py-3.5 text-sm text-foreground dark:bg-primary/15">
      <span className="min-w-[260px] flex-1 leading-relaxed">
        <strong>Você está vendo só os modelos públicos.</strong> Entre para guardar favoritos, duplicar, criar os seus e ver os seus itens privados.
      </span>
      <ModalButton variant="primary" onClick={() => router.push('/login')}>
        Entrar
      </ModalButton>
    </div>
  );

  const bannerPublicOnly = publicOnly && !anonymous && (
    <div role="status" className="rounded-[14px] border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
      Você está vendo só os modelos públicos. Complete o seu perfil para criar e duplicar itens.
    </div>
  );

  const title =
    tab === 'favoritos' ? 'Favoritos' : tab === 'meus' ? 'Meus itens' : 'Biblioteca de IA';
  const subtitle =
    tab === 'favoritos'
      ? 'Os itens que você salvou, na sua conta.'
      : tab === 'meus'
        ? 'Tudo o que você criou ou duplicou, públicos e privados.'
        : 'Prompts, skills, agentes e outros modelos da empresa, prontos para copiar.';

  return (
    <HubFrame documentTitle={title} active={tab} title={title} subtitle={subtitle} actions={headerActions}>
      {bannerVisitor}
      {bannerPublicOnly}

      {needsProfile ? (
        <EmptyState
          icon={User}
          title="Complete seu perfil para usar a biblioteca"
          description="Falta informar seu cargo e sua squad. Assim os itens que você criar levam o seu nome e o time certo."
          actions={
            <>
              <ModalButton variant="primary" onClick={() => setIsEditProfileOpen(true)}>
                Completar perfil
              </ModalButton>
              <ModalButton onClick={onSkipProfile}>Apenas ver modelos públicos</ModalButton>
            </>
          }
        />
      ) : (
        <>
          <CatalogKpis facets={facets} loggedIn={loggedIn} />

          <CatalogToolbar
            search={searchInput}
            onSearch={setSearchInput}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen(open => !open)}
            filterCount={panelFilterCount}
            sort={sort}
            onSort={setSort}
          />

          <TypePills
            active={filters.type}
            counts={facets ? facets.typeCounts : null}
            total={facets ? facets.total : null}
            onChange={type => setFilters(prev => ({ ...prev, type }))}
          />

          {filtersOpen && (
            <FiltersPanel
              filters={shown}
              onChange={patch => setFilters(prev => ({ ...prev, ...patch }))}
              loggedIn={loggedIn}
              hideVisibility={publicOnly || mineOnly}
              favoritesOnly={favSwitch}
              onFavoritesOnly={loggedIn && tab === 'catalogo' ? setFavSwitch : null}
              favoriteCount={mode === 'legacy' ? localFavorites.size : null}
              topTags={facets?.topTags ?? []}
            />
          )}

          <ActiveFilterLine
            count={state === 'ready' ? { shown: items.length, total } : null}
            filters={shown}
            favSwitch={favSwitch}
            onType={() => setFilters(prev => ({ ...prev, type: 'all' }))}
            onPatch={patch => setFilters(prev => ({ ...prev, ...patch }))}
            onFavSwitch={() => setFavSwitch(false)}
            onSearch={() => setSearchInput('')}
            onClear={clearFilters}
            publicOnly={publicOnly}
            show={refined}
          />

          {state === 'loading' && <LoadingSkeleton variant="cards" rows={6} label="Carregando a biblioteca" />}

          {state === 'error' && (
            <ErrorState
              title="Não foi possível carregar a biblioteca"
              description="A conexão caiu ou o servidor demorou a responder. Seus itens estão seguros."
              onRetry={() => {
                invalidateCatalogCache();
                void load();
              }}
            />
          )}

          {state === 'ready' && total === 0 && (
            <CatalogEmpty
              tab={tab}
              filtered={refined}
              search={shown.search}
              loggedIn={loggedIn}
              onClear={clearFilters}
              onNew={() => router.push('/prompt-hub/novo')}
              onImport={() => setImportOpen(true)}
              onCatalog={() => router.push('/prompt-hub')}
            />
          )}

          {state === 'ready' && total > 0 && (
            <>
              {mostUsed.length > 0 && !filtered && <MostUsed items={mostUsed} onOpen={handlers.onOpen} />}

              <section aria-label="Itens" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {viewItems.map(item => (
                  <ItemCard key={item.id} item={item} query={shown.search} sessionId={sessionId} handlers={handlers} />
                ))}
              </section>

              {page + 1 < (result?.totalPages ?? 1) && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <ModalButton onClick={() => void loadMore()} disabled={loadingMore} className="min-w-[200px]">
                    {loadingMore ? 'Carregando…' : 'Carregar mais'}
                  </ModalButton>
                  <span className="text-[13px] text-muted-foreground">
                    Mostrando {items.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </>
          )}
        </>
      )}

      <ItemPanel item={selected} onClose={() => setSelected(null)} onPatch={patchItem} onDeleted={removeFromList} onSelectTag={selectTag} />
      <DeleteItemDialog item={toDelete} sessionId={sessionId} onClose={() => setToDelete(null)} onDeleted={removeFromList} />
      {canCreate && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          authorSnapshot={actions.authorSnapshot}
          authorId={sessionId}
          onImported={() => {
            invalidateCatalogCache();
            void load();
          }}
        />
      )}
      <PromptGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </HubFrame>
  );
}

/** Há algo além da aba (tipo, busca, painel) mudando o resultado? Na aba "Favoritos" ou "Meus itens" só a aba não conta como filtro. */
function hasPanelOrTypeOrSearch(filters: CatalogFilters, favSwitch: boolean): boolean {
  return !!filters.search || filters.type !== 'all' || countPanelFilters(filters, favSwitch) > 0;
}

function ActiveFilterLine({
  count,
  filters,
  favSwitch,
  onType,
  onPatch,
  onFavSwitch,
  onSearch,
  onClear,
  publicOnly,
  show,
}: {
  count: { shown: number; total: number } | null;
  filters: CatalogFilters;
  favSwitch: boolean;
  onType: () => void;
  onPatch: (patch: Partial<CatalogFilters>) => void;
  onFavSwitch: () => void;
  onSearch: () => void;
  onClear: () => void;
  publicOnly: boolean;
  show: boolean;
}) {
  const chips: Array<{ label: string; remove: () => void }> = [];
  if (filters.type !== 'all') chips.push({ label: TYPE_META[filters.type].label, remove: onType });
  if (filters.visibility !== 'all' && !publicOnly) chips.push({ label: filters.visibility === 'public' ? 'Públicos' : 'Meus privados', remove: () => onPatch({ visibility: 'all' }) });
  if (filters.status !== 'active') chips.push({ label: `Situação: ${filters.status === 'all' ? 'todas' : filters.status}`, remove: () => onPatch({ status: 'active' }) });
  if (filters.impact !== 'all') chips.push({ label: `Impacto ${filters.impact === 'medio' ? 'médio' : filters.impact}`, remove: () => onPatch({ impact: 'all' }) });
  if (filters.tag) chips.push({ label: `Etiqueta: ${filters.tag}`, remove: () => onPatch({ tag: null }) });
  if (favSwitch) chips.push({ label: 'Favoritos', remove: onFavSwitch });
  if (filters.search) chips.push({ label: `Busca: ${filters.search}`, remove: onSearch });

  return (
    <section aria-live="polite" className="flex min-h-7 flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {count ? `Mostrando ${count.shown.toLocaleString('pt-BR')} de ${count.total.toLocaleString('pt-BR')} ${count.total === 1 ? 'item' : 'itens'}` : ''}
      </span>
      {show &&
        chips.map(chip => (
          <span key={chip.label} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/10 pl-3 pr-1 text-[13px] text-primary dark:bg-primary/15 [.theme-totvs:not(.dark)_&]:text-foreground">
            {chip.label}
            <button
              type="button"
              onClick={chip.remove}
              aria-label={`Remover filtro ${chip.label}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </span>
        ))}
      {show && chips.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="h-7 rounded-full px-3 text-[13px] font-bold text-primary underline underline-offset-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:text-foreground"
        >
          Limpar filtros
        </button>
      )}
    </section>
  );
}

function CatalogEmpty({
  tab,
  filtered,
  search,
  loggedIn,
  onClear,
  onNew,
  onImport,
  onCatalog,
}: {
  tab: HubTab;
  filtered: boolean;
  search: string;
  loggedIn: boolean;
  onClear: () => void;
  onNew: () => void;
  onImport: () => void;
  onCatalog: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        icon={Search}
        title={search ? `Nada encontrado para "${search}"` : 'Nenhum item com esses filtros'}
        description="Tente outro termo ou tire algum filtro."
        actions={
          <ModalButton variant="primary" onClick={onClear}>
            Limpar filtros
          </ModalButton>
        }
      />
    );
  }
  if (tab === 'favoritos') {
    return (
      <EmptyState
        icon={Star}
        title="Você ainda não tem favoritos"
        description="Toque na estrela de um item para guardá-lo aqui. Só você vê os seus favoritos."
        actions={<ModalButton variant="primary" onClick={onCatalog}>Ver o catálogo</ModalButton>}
      />
    );
  }
  if (tab === 'meus') {
    return (
      <EmptyState
        icon={Inbox}
        title="Você ainda não criou itens"
        description="Crie o primeiro prompt, skill ou agente, ou duplique um item do catálogo para ajustar."
        actions={
          <>
            <ModalButton variant="primary" onClick={onNew}>Criar o primeiro item</ModalButton>
            <ModalButton onClick={onImport}>Importar pasta</ModalButton>
          </>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={Inbox}
      title={loggedIn ? 'A biblioteca ainda está vazia' : 'Ainda não há modelos públicos'}
      description={loggedIn ? 'Crie o primeiro prompt ou traga uma pasta de skills.' : 'Volte em breve ou entre para ver os seus itens.'}
      actions={
        loggedIn ? (
          <>
            <ModalButton variant="primary" onClick={onNew}>Criar o primeiro item</ModalButton>
            <ModalButton onClick={onImport}>Importar pasta</ModalButton>
          </>
        ) : undefined
      }
    />
  );
}
