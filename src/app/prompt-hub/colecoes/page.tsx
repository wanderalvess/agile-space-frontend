'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Plus, Lock, Globe, MoreVertical } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CollectionEditor } from '../components/CollectionEditor';
import type { PromptCollection, PromptItem } from '../types';
import { promptApi, promptCollectionApi, type PromptCollectionDTO } from '../api';

/** Adapta o formato do backend (itens embutidos) para o formato que a UI e o
 *  CollectionEditor já conhecem (lista ordenada de IDs). */
function toUiCollection(dto: PromptCollectionDTO): PromptCollection {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    itemIds: (dto.items || []).map(item => item.id),
    visibility: dto.visibility === 'public' ? 'public' : 'private',
    ownerId: dto.ownerId,
    ownerName: dto.ownerName,
    createdAt: dto.createdAt,
    updatedAt: dto.createdAt
  };
}

export default function CollectionsPage() {
  const router = useRouter();
  const { userProfile, isInitializing } = useUserContext();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PromptCollection | null>(null);

  const [collectionsDto, setCollectionsDto] = useState<PromptCollectionDTO[]>([]);
  const [availableItems, setAvailableItems] = useState<PromptItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const userId = userProfile?.id;

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const publicRes = await promptCollectionApi.listCollections('public', undefined, 0, 100);
      let mineContent: PromptCollectionDTO[] = [];
      if (userId) {
        const mineRes = await promptCollectionApi.listCollections(undefined, userId, 0, 100);
        mineContent = mineRes.content;
      }

      const map = new Map<string, PromptCollectionDTO>();
      publicRes.content.forEach(c => map.set(c.id, c));
      mineContent.forEach(c => map.set(c.id, c));
      setCollectionsDto(Array.from(map.values()));

      // Itens disponíveis para montar a trilha: os públicos e os meus.
      const publicItemsRes = await promptApi.listPrompts(undefined, undefined, 0, 100);
      let myItemsContent: PromptItem[] = [];
      if (userId) {
        const myItemsRes = await promptApi.listPrompts(undefined, userId, 0, 100);
        myItemsContent = myItemsRes.content;
      }
      const itemsMap = new Map<string, PromptItem>();
      publicItemsRes.content.forEach(i => itemsMap.set(i.id, i));
      myItemsContent.forEach(i => itemsMap.set(i.id, i));
      setAvailableItems(Array.from(itemsMap.values()));
    } catch (err: any) {
      console.error('Erro ao buscar coleções', err);
      toast.error('Não foi possível carregar as coleções');
    } finally {
      setIsLoadingData(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isInitializing) return;
    loadData();
  }, [isInitializing, loadData]);

  const collections = useMemo(() => collectionsDto.map(toUiCollection), [collectionsDto]);

  React.useEffect(() => {
    document.title = 'Coleções | Biblioteca de IA';
  }, []);

  const handleSave = async (data: Partial<PromptCollection>) => {
    if (!userProfile?.id) return;
    const loadingToast = toast.loading('Salvando coleção...');
    try {
      const payload = {
        name: data.name,
        description: data.description,
        visibility: data.visibility,
        ownerId: userProfile.id,
        ownerName: userProfile.name || 'Membro',
        items: (data.itemIds || []).map(id => ({ id }))
      };

      if (data.id) {
        await promptCollectionApi.updateCollection(data.id, payload);
      } else {
        await promptCollectionApi.createCollection(payload);
      }

      toast.success(data.id ? 'Coleção atualizada' : 'Coleção criada', { id: loadingToast });
      setIsEditorOpen(false);
      setEditing(null);
      loadData();
    } catch (err: any) {
      toast.error('Erro ao salvar', { id: loadingToast, description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta coleção? Os itens continuam na biblioteca.')) return;
    try {
      await promptCollectionApi.deleteCollection(id);
      toast.success('Coleção removida');
      loadData();
    } catch (err: any) {
      toast.error('Erro ao remover', { description: err.message });
    }
  };

  if (isInitializing || isLoadingData) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <AgileSpinner size="lg" variant="indigo" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <RoomHeader
        title="Coleções"
        toolIcon={<Layers className="h-4 w-4" />}
        toolColorClass="text-primary"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/prompt-hub')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar à biblioteca</span>
            </Button>
            {userProfile && (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setIsEditorOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nova coleção</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
        <p className="mb-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Coleções agrupam itens numa ordem que faz sentido percorrer — o que tags, por serem
          planas, não conseguem expressar.
        </p>

        {collections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <Layers className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Nenhuma coleção ainda</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Monte a primeira trilha reunindo os itens que alguém precisa seguir em sequência.
            </p>
            {userProfile && (
              <Button
                size="sm"
                className="mt-5 gap-2"
                onClick={() => {
                  setEditing(null);
                  setIsEditorOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Nova coleção
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {collections.map(item => {
              const isOwner = item.ownerId === userProfile?.id;
              const VisibilityIcon = item.visibility === 'public' ? Globe : Lock;

              return (
                <article
                  key={item.id}
                  onClick={() => router.push(`/prompt-hub/colecoes/${item.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/prompt-hub/colecoes/${item.id}`);
                    }
                  }}
                  className={cn(
                    'group flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4',
                    'transition-colors hover:border-foreground/20 hover:bg-accent/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <header className="mb-2 flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <VisibilityIcon className="h-3.5 w-3.5" />
                      {item.visibility === 'public' ? 'Público' : 'Somente eu'}
                    </span>

                    {isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={e => {
                              e.stopPropagation();
                              setEditing(item);
                              setIsEditorOpen(true);
                            }}
                          >
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={e => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                          >
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </header>

                  <h2 className="mb-1 line-clamp-2 text-base font-semibold leading-snug text-foreground">
                    {item.name}
                  </h2>
                  <p className="mb-3 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {item.description?.trim() || 'Sem descrição.'}
                  </p>

                  <footer className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="truncate">
                      {isOwner ? 'Você' : item.ownerName?.split(' ')[0] || 'Membro'}
                    </span>
                    <span>
                      {item.itemIds?.length || 0}{' '}
                      {(item.itemIds?.length || 0) === 1 ? 'item' : 'itens'}
                    </span>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <CollectionEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        initialData={editing}
        availableItems={availableItems}
      />

      <Footer />
    </div>
  );
}
