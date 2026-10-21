'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ConfirmDialog, FIELD, ModalButton, StatusChip } from '@/components/room-kit';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { promptCollectionApi, publicCollectionApi, type PromptCollectionDTO } from '@/app/prompt-hub/api';
import { filterCollections, toCollectionView, type CollectionFilter, type CollectionView } from '@/app/prompt-hub/collections-logic';
import { getTypeMeta } from '@/app/prompt-hub/constants';
import { AdminSeal } from './Chips';
import { HubFrame } from './HubFrame';
import { dateOnly } from './collection-format';

const FILTERS: Array<{ id: CollectionFilter; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'minhas', label: 'Minhas' },
  { id: 'publicas', label: 'Públicas' },
  { id: 'privadas', label: 'Privadas' },
];

const MAX_ICONS = 4;

/** Lista de coleções: trilhas de itens em ordem. Visitante vê só as públicas; quem entra cria e gerencia as suas. */
export function CollectionsList() {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.id;
  const [views, setViews] = useState<CollectionView[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'needs-login'>('loading');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CollectionFilter>('todas');
  const [toDelete, setToDelete] = useState<CollectionView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setState(prev => (prev === 'ready' ? prev : 'loading'));
    try {
      let list: PromptCollectionDTO[] | null;
      if (userId) {
        const [shared, mine] = await Promise.all([
          promptCollectionApi.listAllCollections('public'),
          promptCollectionApi.listAllCollections(undefined, userId),
        ]);
        const map = new Map<string, PromptCollectionDTO>();
        shared.forEach(c => map.set(c.id, c));
        mine.forEach(c => map.set(c.id, c));
        list = Array.from(map.values());
      } else {
        list = await publicCollectionApi.list();
      }
      if (list === null) {
        setState('needs-login');
        return;
      }
      setViews(list.map(dto => toCollectionView(dto, userId)));
      setState('ready');
    } catch (err) {
      console.error('[prompt-hub] erro ao carregar coleções', err);
      setState('error');
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const shown = useMemo(() => filterCollections(views, query, filter, userId), [views, query, filter, userId]);

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await promptCollectionApi.deleteCollection(toDelete.collection.id);
      toast.success('Coleção excluída');
      setToDelete(null);
      void load();
    } catch (err) {
      toast.error('Erro ao excluir', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  };

  const create = userId ? (
    <ModalButton variant="primary" onClick={() => router.push('/prompt-hub/colecoes/nova')} className="gap-2">
      <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
      Nova coleção
    </ModalButton>
  ) : undefined;

  return (
    <HubFrame
      documentTitle="Coleções"
      active="colecoes"
      title="Coleções"
      subtitle="Trilhas de itens em ordem, para estudar ou aplicar passo a passo."
      actions={create}
    >
      {!userId && !authLoading && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3 text-sm text-foreground dark:bg-primary/15">
          <span className="flex-1">Você está vendo só as coleções públicas. Entre para criar as suas.</span>
          <ModalButton variant="primary" onClick={() => router.push('/login')}>
            Entrar
          </ModalButton>
        </div>
      )}

      {state === 'loading' && <LoadingSkeleton variant="cards" rows={6} label="Carregando as coleções" />}
      {state === 'error' && <ErrorState title="Não foi possível carregar as coleções" onRetry={() => void load()} />}
      {state === 'needs-login' && (
        <EmptyState
          icon={Layers}
          title="Entre para ver as coleções"
          description="As coleções ficam disponíveis depois do login."
          actions={<ModalButton variant="primary" onClick={() => router.push('/login')}>Entrar</ModalButton>}
        />
      )}

      {state === 'ready' && (
        <>
          <section aria-label="Busca e filtro" className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[300px] max-w-[640px] flex-1">
              <label htmlFor="co-busca" className="sr-only">
                Buscar coleção
              </label>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
              <input
                id="co-busca"
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar por nome ou descrição"
                className={cn(FIELD, 'h-11 rounded-xl bg-card pl-11 text-[15px]')}
              />
            </div>
            {userId && (
              <div role="group" aria-label="Mostrar" className="flex rounded-[10px] border border-border bg-muted/40 p-0.5">
                {FILTERS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={filter === option.id}
                    onClick={() => setFilter(option.id)}
                    className={cn(
                      'h-9 rounded-[7px] px-3.5 text-[13px] font-semibold transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      filter === option.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {shown.length} {shown.length === 1 ? 'coleção' : 'coleções'}
            </span>
          </section>

          {shown.length === 0 ? (
            <EmptyState
              icon={Layers}
              title={views.length === 0 ? 'Nenhuma coleção ainda' : 'Nenhuma coleção com esse filtro'}
              description={
                views.length === 0
                  ? 'Monte a primeira trilha reunindo os itens que alguém precisa seguir em sequência.'
                  : 'Tente outro termo ou mude o filtro.'
              }
              actions={
                views.length === 0 ? (
                  userId ? (
                    <ModalButton variant="primary" onClick={() => router.push('/prompt-hub/colecoes/nova')}>
                      Criar coleção
                    </ModalButton>
                  ) : undefined
                ) : (
                  <ModalButton
                    variant="primary"
                    onClick={() => {
                      setQuery('');
                      setFilter('todas');
                    }}
                  >
                    Limpar filtros
                  </ModalButton>
                )
              }
            />
          ) : (
            <section aria-label="Coleções" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map(view => {
                const { collection } = view;
                const isOwner = !!userId && collection.ownerId === userId;
                const types = Array.from(new Set(view.visible.map(item => item.type)));
                const updated = dateOnly(collection.updatedAt);
                return (
                  <article key={collection.id} className={cn(PAGE_CARD, 'group relative flex flex-col gap-3 p-5 transition-colors duration-base hover:border-primary/40')}>
                    <div className="flex items-center gap-2 pr-10">
                      <StatusChip tone={collection.visibility === 'public' ? 'success' : 'neutral'} className="h-6 px-2.5">
                        {collection.visibility === 'public' ? 'Pública' : 'Privada'}
                      </StatusChip>
                      <span className="text-[13px] text-muted-foreground">
                        {view.total} {view.total === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    {view.canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Mais ações da coleção ${collection.name}`}
                            className="absolute right-3.5 top-3.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-40">
                          <DropdownMenuItem onSelect={() => router.push(`/prompt-hub/colecoes/${encodeURIComponent(collection.id)}/editar`)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300" onSelect={() => setToDelete(view)}>
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <h2 className="text-lg font-bold leading-snug text-foreground">
                      <button
                        type="button"
                        onClick={() => router.push(`/prompt-hub/colecoes/${encodeURIComponent(collection.id)}`)}
                        className="rounded-md text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [.theme-totvs:not(.dark)_&]:hover:text-foreground"
                      >
                        {collection.name}
                      </button>
                    </h2>
                    <p className="line-clamp-2 text-sm leading-normal text-muted-foreground">{collection.description?.trim() || 'Sem descrição.'}</p>
                    <div className="flex items-center gap-1.5" aria-label="Tipos de itens">
                      {types.slice(0, MAX_ICONS).map(type => {
                        const Icon = getTypeMeta(type).icon;
                        return (
                          <span key={type} title={getTypeMeta(type).label} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Icon className="h-[15px] w-[15px]" strokeWidth={1.5} aria-hidden="true" />
                          </span>
                        );
                      })}
                      {types.length > MAX_ICONS && <span className="text-[13px] text-muted-foreground">+{types.length - MAX_ICONS}</span>}
                    </div>
                    <div className="mt-auto flex items-center gap-2 text-[13px] text-muted-foreground">
                      {collection.ownerId ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/prompt-hub/autor/${encodeURIComponent(collection.ownerId)}`)}
                          className="rounded-md font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {isOwner ? 'Você' : collection.ownerName?.trim() || 'Membro'}
                        </button>
                      ) : (
                        <span className="font-semibold text-foreground">{collection.ownerName?.trim() || 'Membro'}</span>
                      )}
                      {updated && <span>· atualizada {updated}</span>}
                      <span className="flex-1" />
                      {view.adminOverride && <AdminSeal />}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={open => {
          if (!open) setToDelete(null);
        }}
        tone="danger"
        icon={Trash2}
        title={`Excluir "${toDelete?.collection.name ?? 'coleção'}"?`}
        description="Os itens continuam na biblioteca. Só a trilha é excluída."
        confirmLabel="Excluir coleção"
        loading={deleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={remove}
      >
        {toDelete?.adminOverride && (
          <p className="rounded-[10px] border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[13px] text-foreground">
            Você está excluindo a coleção de outra pessoa, como administrador.
          </p>
        )}
      </ConfirmDialog>
    </HubFrame>
  );
}
