'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, GitFork, Library, User } from 'lucide-react';
import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { useAuth } from '@/context/AuthContext';
import { RoomHeader } from '@/components/layout/RoomHeader';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { AgileSpinner } from '@/components/ui/AgileSpinner';
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

  // No próprio perfil trazemos tudo. No perfil de outra pessoa, o endpoint
  // /api/prompts?authorId= devolve todos os itens do autor independente da
  // visibilidade (o filtro por dono é responsabilidade de quem consome) —
  // então replicamos aqui a regra que antes vinha da query do Firestore,
  // mostrando só os públicos.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    promptApi.listPrompts(undefined, params.authorId, 0, 200)
      .then(response => {
        if (cancelled) return;
        const content = isSelf
          ? response.content
          : response.content.filter(item => item.visibility === 'public');
        setItems(content);
      })
      .catch(err => {
        console.error('Erro ao carregar itens do autor', err);
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.authorId, isSelf]);

  const author = items?.[0];
  const totals = React.useMemo(() => {
    const list = items || [];
    return {
      itens: list.length,
      copias: list.reduce((sum, item) => sum + (item.useCount || 0), 0),
      clones: list.reduce((sum, item) => sum + (item.forkCount || 0), 0)
    };
  }, [items]);

  React.useEffect(() => {
    document.title = author?.authorName
      ? `${author.authorName} | Biblioteca de IA`
      : 'Autor | Biblioteca de IA';
  }, [author?.authorName]);

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

  let avatarConfig: any = null;
  try {
    avatarConfig = author?.authorAvatar ? genConfig(JSON.parse(author.authorAvatar)) : null;
  } catch {
    avatarConfig = null;
  }

  if (isUserLoading || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <AgileSpinner size="lg" variant="indigo" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <RoomHeader
        title={isSelf ? 'Meus itens' : author?.authorName || 'Autor'}
        toolIcon={<Library className="h-4 w-4" />}
        toolColorClass="text-primary"
        actions={
          <Button variant="ghost" size="sm" onClick={() => router.push('/prompt-hub')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar à biblioteca
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center gap-4 border-b border-border pb-6">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
            {avatarConfig ? (
              <NiceAvatar className="h-full w-full" {...avatarConfig} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <User className="h-6 w-6" />
              </div>
            )}
          </div>

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

        {!items || items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
            <h2 className="text-base font-semibold text-foreground">Nada publicado ainda</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSelf
                ? 'Os itens que você publicar aparecem aqui.'
                : 'Esta pessoa ainda não tem itens públicos na biblioteca.'}
            </p>
          </div>
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

      <Footer className="mt-8 shrink-0" />
    </div>
  );
}
