'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Lock, Globe, ShieldAlert, EyeOff } from 'lucide-react';
import { doc, getDoc, getDocs, collection, query, where, documentId, updateDoc, increment } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { EliteSpinner } from '@/components/ui/EliteSpinner';
import { PromptCard } from '../../components/PromptCard';
import type { PromptCollection, PromptItem } from '../../types';

/** Firestore aceita no máximo 30 valores por consulta `in`. */
const IN_LIMIT = 30;

export default function CollectionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params);
  const router = useRouter();
  const { firestore, user, isUserLoading } = useFirebase();

  const [data, setData] = React.useState<PromptCollection | null>(null);
  const [items, setItems] = React.useState<PromptItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (authPending()) return;

    async function load() {
      try {
        const snap = await getDoc(doc(firestore, 'prompt_collections', params.id));
        if (!snap.exists()) {
          setError('Coleção não encontrada.');
          return;
        }

        const collectionData = { ...(snap.data() as PromptCollection), id: snap.id };
        setData(collectionData);

        const ids = collectionData.itemIds || [];
        if (ids.length === 0) {
          setItems([]);
          return;
        }

        // Busca em blocos por causa do limite do operador `in`. Itens que a
        // pessoa não pode ler simplesmente não voltam — as regras continuam
        // valendo dentro da coleção.
        const found: PromptItem[] = [];
        for (let i = 0; i < ids.length; i += IN_LIMIT) {
          const bloco = ids.slice(i, i + IN_LIMIT);
          const snapshot = await getDocs(
            query(collection(firestore, 'prompt_hub'), where(documentId(), 'in', bloco))
          );
          snapshot.forEach(d => found.push({ ...(d.data() as PromptItem), id: d.id }));
        }

        // Reordena conforme a trilha definida por quem montou a coleção.
        const byId = new Map(found.map(item => [item.id, item]));
        setItems(ids.map(id => byId.get(id)).filter((i): i is PromptItem => !!i));
      } catch (err: any) {
        console.error(err);
        setError(
          err?.code === 'permission-denied'
            ? 'Esta coleção não é pública.'
            : 'Erro ao carregar a coleção.'
        );
      } finally {
        setLoading(false);
      }
    }

    function authPending() {
      return isUserLoading || !firestore;
    }

    load();
  }, [firestore, params.id, isUserLoading, user]);

  React.useEffect(() => {
    document.title = data?.name ? `${data.name} | Coleções` : 'Coleção | Biblioteca de IA';
  }, [data?.name]);

  const handleCopy = async (id: string) => {
    if (!firestore || !user) return;
    try {
      await updateDoc(doc(firestore, 'prompt_hub', id), { useCount: increment(1) });
    } catch (err) {
      console.warn('Não foi possível atualizar o contador de uso.', err);
    }
  };

  if (isUserLoading || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <EliteSpinner size="lg" variant="indigo" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-5 bg-background px-6 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <p className="max-w-md text-base font-medium text-foreground">{error}</p>
        <Button variant="outline" onClick={() => router.push('/prompt-hub/colecoes')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Ver coleções
        </Button>
      </div>
    );
  }

  const VisibilityIcon = data.visibility === 'public' ? Globe : Lock;
  const hidden = (data.itemIds?.length || 0) - items.length;

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <RoomHeader
        title={data.name}
        toolIcon={<Layers className="h-4 w-4" />}
        toolColorClass="text-primary"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/prompt-hub/colecoes')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Todas as coleções</span>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
        <header className="mb-6 space-y-2 border-b border-border pb-5">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <VisibilityIcon className="h-3.5 w-3.5" />
              {data.visibility === 'public' ? 'Público' : 'Somente eu'}
            </span>
            <span>·</span>
            <span>Por {data.ownerId === user?.uid ? 'você' : data.ownerName || 'Membro'}</span>
            <span>·</span>
            <span>
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.name}</h1>

          {data.description?.trim() && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {data.description}
            </p>
          )}
        </header>

        {hidden > 0 && (
          <p className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5 shrink-0" />
            {hidden} {hidden === 1 ? 'item desta trilha não está' : 'itens desta trilha não estão'}{' '}
            visível para você — a coleção não altera a visibilidade de quem publicou.
          </p>
        )}

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <h2 className="text-base font-semibold text-foreground">Nada para mostrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Os itens desta coleção foram removidos ou não estão visíveis para você.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {items.map((item, index) => (
              <li key={item.id} className="flex gap-4">
                <span className="mt-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <PromptCard
                    prompt={item}
                    isOwner={item.authorId === user?.uid}
                    isReadOnly
                    onFork={() => router.push(`/prompt-hub/${item.id}`)}
                    onView={() => router.push(`/prompt-hub/${item.id}`)}
                    onCopy={handleCopy}
                    onSelectAuthor={authorId => router.push(`/prompt-hub/autor/${authorId}`)}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Footer />
    </div>
  );
}
