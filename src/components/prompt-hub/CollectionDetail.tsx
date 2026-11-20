'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Link2, Lock, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ConfirmDialog, ModalButton, StatusChip } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { promptCollectionApi, publicCollectionApi, type PromptCollectionDTO } from '@/app/prompt-hub/api';
import { toCollectionView, type CollectionView } from '@/app/prompt-hub/collections-logic';
import { safeHttpUrl } from '@/app/prompt-hub/catalog-logic';
import type { PromptItem } from '@/app/prompt-hub/types';
import { AdminSeal, TypeChip } from './Chips';
import { HubFrame } from './HubFrame';
import { dateOnly } from './collection-format';
import { usePromptActions } from './usePromptActions';

/** Página de uma coleção: a trilha de itens em ordem, com o que a pessoa pode abrir e quanto está fora do seu alcance. */
export function CollectionDetail({ id }: { id: string }) {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const userId = session?.id;
  const [dto, setDto] = useState<PromptCollectionDTO | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const actions = usePromptActions({
    onUsed: itemId =>
      setDto(prev => (prev ? { ...prev, items: prev.items.map(i => (i.id === itemId ? { ...i, useCount: (i.useCount || 0) + 1 } : i)) } : prev)),
  });

  const load = useCallback(async () => {
    setState('loading');
    try {
      const result = userId ? await promptCollectionApi.getCollection(id) : await publicCollectionApi.get(id);
      if (!result) {
        setState('missing');
        return;
      }
      setDto(result);
      setState('ready');
    } catch (err) {
      console.error(err);
      setState('error');
    }
  }, [id, userId]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const remove = async () => {
    setDeleting(true);
    try {
      await promptCollectionApi.deleteCollection(id);
      toast.success('Coleção excluída');
      router.push('/prompt-hub/colecoes');
    } catch (err) {
      toast.error('Erro ao excluir', { description: err instanceof Error ? err.message : undefined });
      setDeleting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/prompt-hub/colecoes/${id}`);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const openItem = (item: PromptItem) => router.push(`/prompt-hub/${encodeURIComponent(item.id)}`);

  const crumbs = [{ label: 'Coleções', href: '/prompt-hub/colecoes' }];

  if (authLoading || state === 'loading') {
    return (
      <HubFrame documentTitle="Coleção" active="colecoes">
        <h1 className="sr-only">Carregando a coleção</h1>
        <LoadingSkeleton variant="cards" rows={3} label="Carregando a coleção" />
      </HubFrame>
    );
  }

  if (state !== 'ready' || !dto) {
    return (
      <HubFrame documentTitle="Coleção" active="colecoes" title="Coleção" breadcrumb={[...crumbs, { label: 'Coleção' }]}>
        {state === 'error' ? (
          <ErrorState title="Não foi possível abrir a coleção" description="Confira a conexão e tente de novo." onRetry={() => void load()} />
        ) : (
          <EmptyState
            title={userId ? 'Coleção não encontrada' : 'Entre para ver esta coleção'}
            description={userId ? 'Ela pode ter sido excluída, ou não é pública.' : 'Esta coleção só abre depois do login, ou não é pública.'}
            actions={
              <>
                <ModalButton onClick={() => router.push('/prompt-hub/colecoes')}>Ver coleções</ModalButton>
                {!userId && (
                  <ModalButton variant="primary" onClick={() => router.push('/login')}>
                    Entrar
                  </ModalButton>
                )}
              </>
            }
          />
        )}
      </HubFrame>
    );
  }

  const view: CollectionView = toCollectionView(dto, userId);
  const { collection, visible, hidden, total, canManage, adminOverride } = view;
  const copies = visible.reduce((sum, item) => sum + (item.useCount || 0), 0);
  const updated = dateOnly(collection.updatedAt);
  const isOwner = !!userId && collection.ownerId === userId;

  return (
    <HubFrame documentTitle={collection.name} active="colecoes">
      <div className="flex flex-wrap items-center gap-2.5">
        <nav aria-label="Caminho" className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Link href="/prompt-hub/colecoes" className="rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Coleções
          </Link>
          <ChevronRight className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
          <strong aria-current="page" className="font-semibold text-foreground">
            {collection.name}
          </strong>
        </nav>
        <span className="flex-1" />
        {adminOverride && <AdminSeal>Admin: você pode editar e excluir</AdminSeal>}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-2.5">
            <div className="flex gap-1.5">
              <StatusChip tone={collection.visibility === 'public' ? 'success' : 'neutral'} className="h-6 px-2.5">
                {collection.visibility === 'public' ? 'Pública' : 'Privada'}
              </StatusChip>
              <StatusChip tone="neutral" className="h-6 px-2.5">
                {total} {total === 1 ? 'item' : 'itens'}
              </StatusChip>
            </div>
            <h1 className="text-[34px] font-bold leading-tight tracking-tight text-foreground">{collection.name}</h1>
            {collection.description?.trim() && <p className="max-w-[820px] text-base leading-relaxed text-muted-foreground">{collection.description}</p>}
          </section>

          <section className="flex flex-wrap items-center gap-2">
            {visible.length > 0 && (
              <ModalButton variant="primary" onClick={() => openItem(visible[0])}>
                Começar pelo passo 1
              </ModalButton>
            )}
            <ModalButton onClick={() => void copyLink()} className="gap-2">
              <Link2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Copiar link
            </ModalButton>
            {canManage && (
              <>
                <span className="flex-1" />
                <ModalButton onClick={() => router.push(`/prompt-hub/colecoes/${encodeURIComponent(id)}/editar`)} className="gap-2">
                  <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Editar
                </ModalButton>
                <ModalButton onClick={() => setConfirmDelete(true)} className="gap-2 text-red-700 dark:text-red-300">
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Excluir
                </ModalButton>
              </>
            )}
          </section>

          {hidden > 0 && (
            <div role="status" className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-3 text-sm leading-relaxed text-foreground">
              <Lock className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={1.5} aria-hidden="true" />
              <span>
                <strong>
                  {hidden} {hidden === 1 ? 'item não visível' : 'itens não visíveis'} para você.
                </strong>{' '}
                São privados de outras pessoas. A trilha mostra só o que você pode abrir.
              </span>
            </div>
          )}

          {visible.length === 0 ? (
            <EmptyState title="Nada para mostrar" description="Os itens desta coleção foram removidos ou não estão visíveis para você." />
          ) : (
            <ol aria-label="Trilha" className="flex flex-col">
              {visible.map((item, index) => {
                const last = index === visible.length - 1;
                const link = !item.content?.trim() ? safeHttpUrl(item.gemLink) : null;
                return (
                  <li key={item.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3.5">
                    <div className="flex flex-col items-center">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">{index + 1}</span>
                      {!last && <span aria-hidden="true" className="my-1 w-0.5 flex-1 bg-border" />}
                    </div>
                    <div className={cn(PAGE_CARD, 'mb-3.5 flex flex-col gap-2 px-[18px] py-4')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeChip type={item.type} />
                        <span className="text-[13px] text-muted-foreground">por {item.authorId && item.authorId === userId ? 'você' : item.authorName || 'Membro'}</span>
                      </div>
                      <h2 className="text-[17px] font-bold text-foreground">{item.title?.trim() || 'Item sem título'}</h2>
                      {item.description?.trim() && <p className="text-sm leading-normal text-muted-foreground">{item.description}</p>}
                      <div className="flex gap-2">
                        <ModalButton onClick={() => openItem(item)} className="h-9">
                          Abrir item
                        </ModalButton>
                        {item.content?.trim() && (
                          <ModalButton onClick={() => void actions.copyText(item, item.content ?? '')} className="h-9">
                            Copiar
                          </ModalButton>
                        )}
                        {link && (
                          <ModalButton onClick={() => void actions.openTool(item, link)} className="h-9">
                            Abrir ferramenta
                          </ModalButton>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <aside aria-label="Sobre a coleção" className="flex flex-col gap-3.5">
          <section className={cn(PAGE_CARD, 'flex flex-col gap-3 p-[18px]')}>
            <h2 className="text-base font-bold text-foreground">Sobre a coleção</h2>
            <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2.5 text-sm">
              <dt className="text-muted-foreground">Dono</dt>
              <dd>
                {collection.ownerId ? (
                  <Link
                    href={`/prompt-hub/autor/${encodeURIComponent(collection.ownerId)}`}
                    className="font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {isOwner ? 'Você' : collection.ownerName || 'Membro'}
                  </Link>
                ) : (
                  <span className="font-semibold">{collection.ownerName || 'Membro'}</span>
                )}
              </dd>
              {updated && (
                <>
                  <dt className="text-muted-foreground">Atualizada</dt>
                  <dd className="text-foreground">{updated}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Itens</dt>
              <dd className="text-foreground">{total} no total</dd>
              <dt className="text-muted-foreground">Cópias</dt>
              <dd className="tabular-nums text-foreground">{copies.toLocaleString('pt-BR')} somando os itens</dd>
            </dl>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        tone="danger"
        icon={Trash2}
        title={`Excluir "${collection.name}"?`}
        description="Os itens continuam na biblioteca. Só a trilha é excluída."
        confirmLabel="Excluir coleção"
        loading={deleting}
        loadingLabel="Excluindo…"
        keepOpenOnConfirm
        onConfirm={remove}
      >
        {adminOverride && (
          <p className="rounded-[10px] border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-[13px] text-foreground">
            Você está excluindo a coleção de outra pessoa, como administrador.
          </p>
        )}
      </ConfirmDialog>
    </HubFrame>
  );
}
