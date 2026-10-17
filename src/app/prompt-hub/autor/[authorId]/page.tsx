'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, GitFork } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { useAuth } from '@/context/AuthContext';
import { EmptyState, ErrorState, LoadingSkeleton, PageHeader, PageShell } from '@/components/page';
import { Button } from '@/components/ui/button';
import { promptApi } from '../../api';
import { PromptCard } from '../../components/PromptCard';
import type { PromptItem } from '../../types';

export default function AuthorPage(props: { params: Promise<{ authorId: string }> }) {
  const params = React.use(props.params);
  const router = useRouter();
  const { session, isLoading: isUserLoading } = useAuth();

  const isSelf = !!session && session.id === params.authorId;

  const [items, setItems] = useState<PromptItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // No próprio perfil trazemos tudo. No perfil de outra pessoa, o endpoint
  // /api/prompts?authorId= devolve todos os itens do autor independente da
  // visibilidade (o filtro por dono é responsabilidade de quem consome) —
  // então replicamos aqui a regra que antes vinha da query do Firestore,
  // mostrando só os públicos.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);

    // O servidor já devolve só os públicos para quem não é a própria pessoa; o filtro aqui é uma segunda trava.
    promptApi.listAllPrompts(params.authorId)
      .then(all => {
        if (cancelled) return;
        setItems(isSelf ? all : all.filter(item => item.visibility === 'public'));
      })
      .catch(err => {
        console.error('Erro ao carregar itens do autor', err);
        if (!cancelled) {
          setItems([]);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.authorId, isSelf, reloadKey]);

  const author = items?.[0];
  const totals = React.useMemo(() => {
    const list = items || [];
    return {
      itens: list.length,
      copias: list.reduce((sum, item) => sum + (item.useCount || 0), 0),
      clones: list.reduce((sum, item) => sum + (item.forkCount || 0), 0)
    };
  }, [items]);

  const handleCopy = async (id: string) => {
    if (!session) return;
    try {
      await promptApi.usePrompt(id);
      // O backend já incrementa o contador; atualizamos o estado local para
      // refletir na hora, já que a busca aqui é pontual (não é mais um
      // listener em tempo real como era com o Firestore).
      setItems(prev => prev ? prev.map(item => item.id === id ? { ...item, useCount: (item.useCount || 0) + 1 } : item) : prev);
    } catch (err) {
      console.warn('Não foi possível atualizar o contador de uso.', err);
    }
  };

  const pageTitle = isSelf ? 'Meus itens' : author?.authorName || 'Autor';
  const crumbs = [{ label: 'Prompt Hub', href: '/prompt-hub' }, { label: pageTitle }];

  if (isUserLoading || isLoading) {
    return (
      <PageShell documentTitle="Prompt Hub">
        <PageHeader title="Prompt Hub" module="prompt-hub" breadcrumb={[{ label: 'Prompt Hub', href: '/prompt-hub' }]} />
        <LoadingSkeleton variant="cards" label="Carregando os itens do autor" />
      </PageShell>
    );
  }

  return (
    <PageShell documentTitle={`${pageTitle} | Prompt Hub`} feedbackName="Prompt Hub">
      <PageHeader
        title={pageTitle}
        module="prompt-hub"
        breadcrumb={crumbs}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/prompt-hub')} className="gap-2">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Voltar à biblioteca
          </Button>
        }
      />

      <div className="w-full flex-1">
        <header className="mb-6 flex flex-wrap items-center gap-4 border-b border-border pb-6">
          <InitialsAvatar name={author?.authorName} className="h-14 w-14 text-xl" />

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-foreground">
              {isSelf ? 'Você' : author?.authorName || 'Autor sem itens públicos'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[author?.authorRole, author?.authorSquad].filter(Boolean).join(' · ') ||
                'Sem informações de cargo ou squad'}
            </p>
          </div>

          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Itens</dt>
              <dd className="text-lg font-semibold text-foreground">{totals.itens}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUpRight className="h-3 w-3" /> Cópias
              </dt>
              <dd className="text-lg font-semibold text-foreground">{totals.copias}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitFork className="h-3 w-3" /> Clones
              </dt>
              <dd className="text-lg font-semibold text-foreground">{totals.clones}</dd>
            </div>
          </dl>
        </header>

        {loadFailed ? (
          <ErrorState
            title="Não foi possível carregar os itens"
            description="Verifique a conexão e tente de novo."
            onRetry={() => setReloadKey(k => k + 1)}
          />
        ) : !items || items.length === 0 ? (
          <EmptyState
            title="Nada publicado ainda"
            description={
              isSelf
                ? 'Os itens que você publicar aparecem aqui.'
                : 'Esta pessoa ainda não tem itens públicos na biblioteca.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
            {items.map(item => (
              <PromptCard
                key={item.id}
                prompt={item}
                isOwner={item.authorId === session?.id}
                isReadOnly
                onFork={() => router.push(`/prompt-hub/${item.id}`)}
                onView={() => router.push(`/prompt-hub/${item.id}`)}
                onCopy={handleCopy}
                onSelectTag={() => router.push('/prompt-hub')}
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
