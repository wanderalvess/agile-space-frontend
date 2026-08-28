'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Lock, Globe, ShieldAlert, EyeOff } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
import { PromptCard } from '../../components/PromptCard';
import { promptApi, promptCollectionApi, type PromptCollectionDTO } from '../../api';

export default function CollectionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = React.use(props.params);
  const router = useRouter();
  const { userProfile, isInitializing } = useUserContext();

  const [data, setData] = React.useState<PromptCollectionDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (isInitializing) return;

    async function load() {
      try {
        const result = await promptCollectionApi.getCollection(params.id);
        setData(result);
      } catch (err: any) {
        console.error(err);
        setError('Coleção não encontrada ou erro ao carregar.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [params.id, isInitializing]);

  React.useEffect(() => {
    document.title = data?.name ? `${data.name} | Coleções` : 'Coleção | Biblioteca de IA';
  }, [data?.name]);

  const handleCopy = async (id: string) => {
    try {
      await promptApi.usePrompt(id);
      setData(prev =>
        prev
          ? {
              ...prev,
              items: prev.items.map(item =>
                item.id === id ? { ...item, useCount: (item.useCount || 0) + 1 } : item
              )
            }
          : prev
      );
    } catch (err) {
      console.warn('Não foi possível atualizar o contador de uso.', err);
    }
  };

  if (isInitializing || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <AgileSpinner size="lg" variant="indigo" />
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

  // Os itens já vêm embutidos na resposta — sem consulta separada, a coleção
  // não muda a visibilidade de quem publicou, então itens privados de outra
  // pessoa continuam escondidos aqui mesmo estando na trilha.
  const allItems = data.items || [];
  const visibleItems = allItems.filter(
    item => item.visibility === 'public' || item.authorId === userProfile?.id
  );
  const hidden = allItems.length - visibleItems.length;

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
            <span>Por {data.ownerId === userProfile?.id ? 'você' : data.ownerName || 'Membro'}</span>
            <span>·</span>
            <span>
              {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'itens'}
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

        {visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <h2 className="text-base font-semibold text-foreground">Nada para mostrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Os itens desta coleção foram removidos ou não estão visíveis para você.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {visibleItems.map((item, index) => (
              <li key={item.id} className="flex gap-4">
                <span className="mt-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <PromptCard
                    prompt={item}
                    isOwner={item.authorId === userProfile?.id}
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

      <Footer className="mt-8 shrink-0" />
    </div>
  );
}
