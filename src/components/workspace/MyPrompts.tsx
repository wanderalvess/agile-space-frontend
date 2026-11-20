'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/page';
import { FIELD, ModalButton } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { DEFAULT_FILTERS } from '@/app/prompt-hub/catalog-logic';
import { fetchCatalog, invalidateCatalogCache, type CatalogResponse } from '@/app/prompt-hub/catalog-query';
import type { PromptItem } from '@/app/prompt-hub/types';
import { DeleteItemDialog } from '@/components/prompt-hub/DeleteItemDialog';
import { ItemCard, type ItemCardHandlers } from '@/components/prompt-hub/ItemCard';
import { ItemPanel } from '@/components/prompt-hub/ItemPanel';
import { usePromptActions } from '@/components/prompt-hub/usePromptActions';
import { WorkspaceSectionHeader } from './workspace-ui';

const PAGE_SIZE = 24;

/**
 * Aba "Prompts" do Meu espaço: os itens da própria pessoa, com os mesmos cartões, painel lateral e
 * editor da Biblioteca de IA (o filtro "Meus itens" do catálogo). Busca e paginação são do servidor.
 */
export function MyPrompts({ userProfile }: { userProfile: any }) {
  const router = useRouter();
  const { session } = useAuth();
  const effectiveUserId: string | undefined = userProfile?.id || userProfile?.email || session?.id;

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300).trim();
  const [items, setItems] = useState<PromptItem[]>([]);
  const [result, setResult] = useState<CatalogResponse | null>(null);
  const [page, setPage] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<PromptItem | null>(null);
  const [toDelete, setToDelete] = useState<PromptItem | null>(null);
  const requestId = useRef(0);

  const actions = usePromptActions({
    onUsed: id => {
      setItems(prev => prev.map(item => (item.id === id ? { ...item, useCount: (item.useCount || 0) + 1 } : item)));
      setSelected(prev => (prev && prev.id === id ? { ...prev, useCount: (prev.useCount || 0) + 1 } : prev));
    },
  });

  const request = useCallback(
    (pageNumber: number) => ({
      filters: { ...DEFAULT_FILTERS, search, status: 'all' as const },
      sort: 'recent' as const,
      favoritesOnly: false,
      mineOnly: true,
      page: pageNumber,
      size: PAGE_SIZE,
      sessionId: effectiveUserId,
      anonymous: false,
    }),
    [search, effectiveUserId]
  );

  const load = useCallback(async () => {
    if (!effectiveUserId) {
      setState('ready');
      setItems([]);
      return;
    }
    const id = ++requestId.current;
    setState(prev => (prev === 'ready' ? prev : 'loading'));
    try {
      const response = await fetchCatalog(request(0), actions.localFavorites);
      if (id !== requestId.current) return;
      setResult(response);
      setItems(response.items);
      setPage(0);
      setState('ready');
    } catch (err) {
      console.error('[meu-espaco] erro ao carregar os itens da pessoa', err);
      if (id === requestId.current) setState('error');
    }
    // localFavorites só importa ao servidor antigo e não deve refazer a busca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId, request]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await fetchCatalog(request(page + 1), actions.localFavorites);
      setItems(prev => {
        const known = new Set(prev.map(item => item.id));
        return [...prev, ...next.items.filter(item => !known.has(item.id))];
      });
      setResult(prev => (prev ? { ...prev, total: next.total, totalPages: next.totalPages } : next));
      setPage(page + 1);
    } catch (err) {
      toast.error('Não foi possível carregar mais itens', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoadingMore(false);
    }
  };

  const patchItem = (id: string, patch: Partial<PromptItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  const afterDelete = () => {
    setSelected(null);
    invalidateCatalogCache();
    void load();
  };

  const handlers: ItemCardHandlers = {
    onOpen: item => setSelected(items.find(candidate => candidate.id === item.id) ?? item),
    onCopy: item => actions.copyText(item, item.content ?? ''),
    onOpenTool: (item, link) => void actions.openTool(item, link),
    onToggleFavorite: async item => {
      const next = await actions.toggleFavorite({ id: item.id, favorite: item.favorite }, !!item.favorite);
      if (next !== null && typeof item.favorite === 'boolean') patchItem(item.id, { favorite: next });
    },
    onCopyLink: item => void actions.copyLink(item),
    onEdit: item => router.push(`/prompt-hub/${encodeURIComponent(item.id)}/editar`),
    onDuplicate: item => void actions.duplicate(item),
    onDelete: item => setToDelete(item),
    onSelectTag: tag => setSearchInput(tag),
  };

  const total = result?.total ?? 0;
  const newItem = () => router.push('/prompt-hub/novo');

  return (
    <div className="flex w-full flex-col gap-4">
      <WorkspaceSectionHeader
        title="Meus prompts"
        subtitle="Sua biblioteca de prompts, skills, agentes e outros modelos. Os públicos também aparecem na Biblioteca de IA."
        action={
          <>
            <div className="relative w-full sm:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                placeholder="Filtrar meus itens..."
                aria-label="Filtrar meus itens"
                className={cn(FIELD, 'h-[42px] pl-9 text-sm')}
              />
            </div>
            <ModalButton variant="primary" onClick={newItem}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Novo
            </ModalButton>
          </>
        }
      />

      {state === 'loading' && <LoadingSkeleton variant="cards" rows={3} label="Carregando seus itens" />}
      {state === 'error' && (
        <ErrorState title="Não foi possível carregar os itens" description="Confira a conexão e tente de novo." onRetry={() => void load()} />
      )}
      {state === 'ready' && total === 0 && (
        <EmptyState
          icon={MessageSquare}
          title="Nenhum item encontrado"
          description={
            search
              ? `Nenhum item combina com "${search}".`
              : 'Você ainda não possui itens nesta conta. Comece criando um novo modelo para acelerar seu trabalho.'
          }
          actions={
            search ? (
              <ModalButton onClick={() => setSearchInput('')}>Limpar filtro</ModalButton>
            ) : (
              <ModalButton variant="primary" onClick={newItem}>
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Criar primeiro item
              </ModalButton>
            )
          }
        />
      )}
      {state === 'ready' && total > 0 && (
        <>
          <section aria-label="Meus itens" className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
            {(result?.mode === 'legacy' ? items.map(item => ({ ...item, favorite: actions.localFavorites.has(item.id) })) : items).map(item => (
              <ItemCard key={item.id} item={item} query={search} sessionId={effectiveUserId} handlers={handlers} />
            ))}
          </section>
          {page + 1 < (result?.totalPages ?? 1) && (
            <div className="flex flex-col items-center gap-2">
              <ModalButton onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </ModalButton>
              <span className="text-[13px] text-muted-foreground">
                Mostrando {items.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
              </span>
            </div>
          )}
        </>
      )}

      <ItemPanel item={selected} onClose={() => setSelected(null)} onPatch={patchItem} onDeleted={afterDelete} onSelectTag={tag => { setSelected(null); setSearchInput(tag); }} />
      <DeleteItemDialog item={toDelete} sessionId={effectiveUserId} onClose={() => setToDelete(null)} onDeleted={afterDelete} />
    </div>
  );
}
