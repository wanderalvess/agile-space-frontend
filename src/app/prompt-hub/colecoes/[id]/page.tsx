'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock, Globe, EyeOff } from 'lucide-react';
import { useUserContext } from '@/context/UserContext';
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, PageShell } from '@/components/page';
import { Button } from '@/components/ui/button';
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

  const baseCrumbs = [{ label: 'Prompt Hub', href: '/prompt-hub' }, { label: 'Coleções', href: '/prompt-hub/colecoes' }];

  if (isInitializing || loading) {
    return (
      <PageShell documentTitle="Coleção | Prompt Hub" feedbackName="Prompt Hub">
        <PageHeader title="Coleção" module="prompt-hub" breadcrumb={[...baseCrumbs, { label: 'Coleção' }]} />
        <LoadingSkeleton variant="cards" label="Carregando a coleção" />
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell documentTitle="Coleção | Prompt Hub" feedbackName="Prompt Hub">
        <PageHeader title="Coleção" module="prompt-hub" breadcrumb={[...baseCrumbs, { label: 'Coleção' }]} />
        <ErrorState
          title="Não foi possível abrir a coleção"
          description={error || 'Coleção não encontrada.'}
        />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => router.push('/prompt-hub/colecoes')} className="gap-2">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Ver coleções
          </Button>
        </div>
      </PageShell>
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
    <PageShell documentTitle={`${data.name} | Coleções`} feedbackName="Prompt Hub">
      <PageHeader
        title={data.name}
        module="prompt-hub"
        breadcrumb={[...baseCrumbs, { label: data.name }]}
        subtitle={data.description?.trim() || undefined}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/prompt-hub/colecoes')} className="gap-2">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Todas as coleções
          </Button>
        }
      />

      <div className="w-full flex-1">
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <VisibilityIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            {data.visibility === 'public' ? 'Público' : 'Somente eu'}
          </span>
          <span>·</span>
          <span>Por {data.ownerId === userProfile?.id ? 'você' : data.ownerName || 'Membro'}</span>
          <span>·</span>
          <span>
            {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {hidden > 0 && (
          <p className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5 shrink-0" />
            {hidden} {hidden === 1 ? 'item desta trilha não está' : 'itens desta trilha não estão'}{' '}
            visível para você — a coleção não altera a visibilidade de quem publicou.
          </p>
        )}

        {visibleItems.length === 0 ? (
          <EmptyState
            title="Nada para mostrar"
            description="Os itens desta coleção foram removidos ou não estão visíveis para você."
          />
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
    </PageShell>
  );
}
