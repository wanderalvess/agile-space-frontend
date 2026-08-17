'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Plus, Lock, Globe, MoreVertical } from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useUserContext } from '@/context/UserContext';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
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

export default function CollectionsPage() {
  const router = useRouter();
  const { firestore, user, isUserLoading } = useFirebase();
  const { userProfile } = useUserContext();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PromptCollection | null>(null);

  const publicQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'prompt_collections'),
      where('visibility', '==', 'public'),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore]);

  const mineQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'prompt_collections'),
      where('ownerId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, user]);

  // Itens disponíveis para montar a trilha: os públicos e os meus.
  const itemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'prompt_hub'),
      where('visibility', '==', 'public'),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore]);

  const myItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'prompt_hub'),
      where('authorId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, user]);

  const { data: publicCollections, isLoading: loadingPublic } =
    useCollection<PromptCollection>(publicQuery, { silent: true });
  const { data: myCollections, isLoading: loadingMine } =
    useCollection<PromptCollection>(mineQuery, { silent: true });
  const { data: publicItems } = useCollection<PromptItem>(itemsQuery, { silent: true });
  const { data: myItems } = useCollection<PromptItem>(myItemsQuery, { silent: true });

  const collections = useMemo(() => {
    const map = new Map<string, PromptCollection>();
    publicCollections?.forEach(c => map.set(c.id, c));
    myCollections?.forEach(c => map.set(c.id, c));
    return Array.from(map.values());
  }, [publicCollections, myCollections]);

  const availableItems = useMemo(() => {
    const map = new Map<string, PromptItem>();
    publicItems?.forEach(i => map.set(i.id, i));
    myItems?.forEach(i => map.set(i.id, i));
    return Array.from(map.values());
  }, [publicItems, myItems]);

  React.useEffect(() => {
    document.title = 'Coleções | Biblioteca de IA';
  }, []);

  const handleSave = async (data: Partial<PromptCollection>) => {
    if (!firestore || !user) return;
    const loadingToast = toast.loading('Salvando coleção...');
    try {
      const id = data.id || `col_${Date.now()}_${user.uid}`;
      const payload: any = {
        ...data,
        id,
        ownerId: user.uid,
        ownerName: userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Membro',
        ownerSquad: userProfile?.squadId || '',
        updatedAt: serverTimestamp()
      };
      if (!data.id) payload.createdAt = serverTimestamp();

      await setDoc(doc(firestore, 'prompt_collections', id), payload, { merge: true });
      toast.success(data.id ? 'Coleção atualizada' : 'Coleção criada', { id: loadingToast });
      setIsEditorOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error('Erro ao salvar', { id: loadingToast, description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !confirm('Excluir esta coleção? Os itens continuam na biblioteca.')) return;
    try {
      await deleteDoc(doc(firestore, 'prompt_collections', id));
      toast.success('Coleção removida');
    } catch (err: any) {
      toast.error('Erro ao remover', { description: err.message });
    }
  };

  if (isUserLoading || loadingPublic || (user && loadingMine)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <EliteSpinner size="lg" variant="indigo" />
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
            {user && (
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
            {user && (
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
              const isOwner = item.ownerId === user?.uid;
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
