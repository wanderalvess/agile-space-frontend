import { normalize } from '@/lib/text-normalize';
import type { PromptCollectionDTO } from './api';
import type { PromptCollection, PromptItem } from './types';

/** Move o item de `from` para `to` e devolve uma lista nova (a original não muda). Posições fora da lista não fazem nada. */
export function moveInList<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** O que a pessoa consegue abrir numa trilha: itens públicos, os próprios e os que o servidor diz que pode editar. */
export function canSeeItem(item: PromptItem, userId?: string | null): boolean {
  return item.visibility === 'public' || (!!userId && item.authorId === userId) || item.canEdit === true;
}

export interface CollectionView {
  collection: PromptCollection;
  /** Itens que a pessoa pode abrir, na ordem da trilha. */
  visible: PromptItem[];
  /** Quantos itens da trilha são privados de outras pessoas. */
  hidden: number;
  /** Total da trilha, visíveis ou não. */
  total: number;
  canManage: boolean;
  /** Administradora mexendo na coleção de outra pessoa. */
  adminOverride: boolean;
}

/** Adapta o formato do servidor (itens embutidos) para o que as telas usam. Nunca inventa datas. */
export function toCollectionView(dto: PromptCollectionDTO, userId?: string | null): CollectionView {
  const items = dto.items ?? [];
  const visible = items.filter(item => canSeeItem(item, userId));
  const isOwner = !!userId && dto.ownerId === userId;
  const canManage = typeof dto.canEdit === 'boolean' ? dto.canEdit : isOwner;
  return {
    collection: {
      id: dto.id,
      name: dto.name,
      description: dto.description,
      itemIds: items.map(item => item.id),
      visibility: dto.visibility === 'public' ? 'public' : 'private',
      ownerId: dto.ownerId,
      ownerName: dto.ownerName,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
    },
    visible,
    hidden: dto.hiddenCount ?? items.length - visible.length,
    total: dto.itemCount ?? items.length,
    canManage,
    adminOverride: canManage && !isOwner,
  };
}

export type CollectionFilter = 'todas' | 'minhas' | 'publicas' | 'privadas';

/** Busca por nome ou descrição e o filtro "Todas / Minhas / Públicas / Privadas". */
export function filterCollections(views: CollectionView[], query: string, filter: CollectionFilter, userId?: string | null): CollectionView[] {
  const term = normalize(query);
  return views.filter(({ collection }) => {
    if (term && !normalize(`${collection.name} ${collection.description ?? ''}`).includes(term)) return false;
    if (filter === 'minhas') return !!userId && collection.ownerId === userId;
    if (filter === 'publicas') return collection.visibility === 'public';
    if (filter === 'privadas') return collection.visibility === 'private';
    return true;
  });
}

/** Mensagem do que falta para salvar a coleção (vazia quando pode salvar). */
export function collectionSaveBlock(name: string | undefined, itemIds: readonly string[] | undefined): string {
  if (!name?.trim()) return 'Dê um nome à coleção para poder salvar.';
  if (!itemIds?.length) return 'Adicione pelo menos 1 item para poder salvar.';
  return '';
}
