'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton, PAGE_CARD } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { promptApi, promptCollectionApi, type PromptCollectionDTO } from '@/app/prompt-hub/api';
import type { PromptItem } from '@/app/prompt-hub/types';
import { TypeChip, VisibilityChip } from './Chips';
import { HubFrame } from './HubFrame';

/** Página de uma pessoa: quem é, quanto os itens dela foram usados, os itens e as coleções. */
export function AuthorPage({ authorId }: { authorId: string }) {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const isSelf = !!session && session.id === authorId;
  const [items, setItems] = useState<PromptItem[]>([]);
  const [collections, setCollections] = useState<PromptCollectionDTO[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const all = await promptApi.listAll({ authorId, sort: 'recent' });
      // O servidor já devolve só os públicos para quem não é a própria pessoa; o filtro é uma segunda trava.
      setItems(all.filter(item => isSelf || item.visibility === 'public' || item.canEdit === true));
      try {
        const cols = await promptCollectionApi.listAllCollections(undefined, authorId);
        setCollections(cols.filter(col => isSelf || col.visibility === 'public'));
      } catch {
        setCollections([]);
      }
      setState('ready');
    } catch (err) {
      console.error('[prompt-hub] erro ao carregar a página da pessoa', err);
      setState('error');
    }
  }, [authorId, isSelf]);

  useEffect(() => {
    if (authLoading || !session) return;
    void load();
  }, [authLoading, session, load]);

  const author = items[0];
  const name = isSelf ? 'Você' : author?.authorName || collections[0]?.ownerName || 'Pessoa sem itens públicos';
  const stats = useMemo(
    () => [
      { value: items.length, label: items.length === 1 ? 'item' : 'itens' },
      { value: items.reduce((sum, item) => sum + (item.useCount || 0), 0), label: 'cópias recebidas' },
      { value: items.reduce((sum, item) => sum + (item.forkCount || 0), 0), label: 'duplicações' },
      { value: collections.length, label: collections.length === 1 ? 'coleção' : 'coleções' },
    ],
    [items, collections]
  );
  const first = isSelf ? 'você' : (author?.authorName || collections[0]?.ownerName || 'esta pessoa').split(' ')[0];

  if (authLoading || (session && state === 'loading')) {
    return (
      <HubFrame documentTitle="Pessoa" active="catalogo">
        <h1 className="sr-only">Carregando</h1>
        <LoadingSkeleton variant="cards" rows={3} label="Carregando os itens da pessoa" />
      </HubFrame>
    );
  }

  if (!session) {
    return (
      <HubFrame documentTitle="Pessoa" active="catalogo" title="Itens da pessoa" breadcrumb={[{ label: 'Biblioteca de IA', href: '/prompt-hub' }, { label: 'Pessoa' }]}>
        <EmptyState
          title="Entre para ver a página da pessoa"
          description="Os itens e as coleções de cada pessoa ficam disponíveis depois do login."
          actions={<ModalButton variant="primary" onClick={() => router.push('/login')}>Entrar</ModalButton>}
        />
      </HubFrame>
    );
  }

  if (state === 'error') {
    return (
      <HubFrame documentTitle="Pessoa" active="catalogo" title="Itens da pessoa" breadcrumb={[{ label: 'Biblioteca de IA', href: '/prompt-hub' }, { label: 'Pessoa' }]}>
        <ErrorState title="Não foi possível carregar os itens" description="Confira a conexão e tente de novo." onRetry={() => void load()} />
      </HubFrame>
    );
  }

  return (
    <HubFrame documentTitle={name} active={isSelf ? 'meus' : 'catalogo'}>
      <nav aria-label="Caminho" className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/prompt-hub" className="rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Biblioteca de IA
        </Link>
        <ChevronRight className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
        <strong aria-current="page" className="font-semibold text-foreground">
          {name}
        </strong>
      </nav>

      <section className={cn(PAGE_CARD, 'flex flex-wrap items-center gap-5 p-6')}>
        <InitialsAvatar name={isSelf ? session.name : author?.authorName} className="h-[72px] w-[72px] text-2xl" />
        <div className="flex min-w-[240px] flex-col gap-1">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">{name}</h1>
          <span className="text-sm text-muted-foreground">{author?.authorRole || 'Sem cargo informado'}</span>
          {isSelf && <span className="text-[13px] text-muted-foreground">Esta é a sua página. Os itens privados aparecem só para você.</span>}
        </div>
        <span className="flex-1" />
        <dl className="grid grid-cols-2 gap-x-7 gap-y-3 sm:grid-cols-4">
          {stats.map(stat => (
            <div key={stat.label} className="flex flex-col">
              <dd className="order-1 text-[26px] font-bold tabular-nums text-foreground">{stat.value.toLocaleString('pt-BR')}</dd>
              <dt className="order-2 text-[13px] text-muted-foreground">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Itens da pessoa" className="flex flex-col gap-2.5">
        <h2 className="text-base font-bold text-foreground">Itens de {first}</h2>
        {items.length === 0 ? (
          <EmptyState
            title="Nada publicado ainda"
            description={isSelf ? 'Os itens que você publicar aparecem aqui.' : 'Esta pessoa ainda não tem itens públicos na biblioteca.'}
            actions={isSelf ? <ModalButton variant="primary" onClick={() => router.push('/prompt-hub/novo')}>Criar o primeiro item</ModalButton> : undefined}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {items.map(item => (
              <li key={item.id}>
                <Link
                  href={`/prompt-hub/${encodeURIComponent(item.id)}`}
                  className={cn(
                    PAGE_CARD,
                    'flex h-full flex-col gap-2 rounded-[14px] p-4 text-foreground transition-colors duration-fast hover:border-primary/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <span className="flex flex-wrap gap-1.5">
                    <TypeChip type={item.type} />
                    <VisibilityChip visibility={item.visibility} />
                  </span>
                  <span className="text-[15px] font-bold leading-snug">{item.title?.trim() || 'Item sem título'}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {(item.useCount || 0).toLocaleString('pt-BR')} cópias · {(item.forkCount || 0).toLocaleString('pt-BR')} duplicações
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {collections.length > 0 && (
        <section aria-label="Coleções da pessoa" className="flex flex-col gap-2.5">
          <h2 className="text-base font-bold text-foreground">Coleções de {first}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map(col => (
              <li key={col.id}>
                <Link
                  href={`/prompt-hub/colecoes/${encodeURIComponent(col.id)}`}
                  className={cn(
                    PAGE_CARD,
                    'flex h-full flex-col gap-1.5 rounded-[14px] p-4 text-foreground transition-colors duration-fast hover:border-primary/40',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <span className="text-[15px] font-bold">{col.name}</span>
                  <span className="text-[13px] text-muted-foreground">
                    {col.itemCount ?? col.items?.length ?? 0} itens · {col.visibility === 'public' ? 'Pública' : 'Privada'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </HubFrame>
  );
}
