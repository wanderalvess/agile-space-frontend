'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, ShieldAlert } from 'lucide-react';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/page';
import { ModalButton } from '@/components/room-kit';
import { useAuth } from '@/context/AuthContext';
import { ApiError, promptApi, publicPromptApi } from '@/app/prompt-hub/api';
import type { PromptItem } from '@/app/prompt-hub/types';
import { HubFrame } from './HubFrame';
import { ItemDetail } from './ItemDetail';

const deniedMessage = (signedIn: boolean) =>
  signedIn
    ? 'Este item não é público e só a pessoa que o criou pode abri-lo.'
    : 'Este item não é público. Entre com a sua conta: se você for a autora, ele aparece.';

/** Página própria de um item: é o endereço que se compartilha. Tem todas as ações do painel lateral. */
export function ItemPage({ id }: { id: string }) {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const [item, setItem] = useState<PromptItem | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const sessionId = session?.id;

  const load = useCallback(async () => {
    setState('loading');
    try {
      // Sem login só a leitura pública existe: item privado e inexistente respondem 404 igual.
      const data = sessionId ? await promptApi.getPromptById(id) : await publicPromptApi.get(id);
      // Servidor antigo devolvia qualquer item: só abre o público, o próprio ou o que o servidor diz que se pode editar.
      if (data.visibility === 'public' || data.authorId === sessionId || data.canEdit === true) {
        setItem(data);
        setState('ready');
      } else {
        setState('denied');
      }
    } catch (err) {
      console.error(err);
      setState(err instanceof ApiError && (err.status === 404 || err.status === 401 || err.status === 403) ? 'denied' : 'error');
    }
  }, [id, sessionId]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load, reloadKey]);

  if (authLoading || state === 'loading') {
    return (
      <HubFrame documentTitle="Item" active="catalogo">
        <h1 className="sr-only">Carregando o item</h1>
        <LoadingSkeleton variant="page" rows={4} label="Carregando o item" />
      </HubFrame>
    );
  }

  if (state === 'denied' || state === 'error' || !item) {
    return (
      <HubFrame documentTitle="Item" active="catalogo" title="Item da biblioteca" breadcrumb={[{ label: 'Biblioteca de IA', href: '/prompt-hub' }, { label: 'Item' }]}>
        {state === 'error' ? (
          <ErrorState
            title="Não foi possível abrir o item"
            description="Confira a conexão e tente de novo."
            onRetry={() => setReloadKey(key => key + 1)}
          />
        ) : (
          <EmptyState
            icon={ShieldAlert}
            title="Não encontramos este item"
            description={sessionId ? `${deniedMessage(true)} Ele também pode ter sido excluído.` : deniedMessage(false)}
            actions={
              <>
                <ModalButton onClick={() => router.push('/prompt-hub')}>Voltar ao catálogo</ModalButton>
                {!sessionId && (
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

  const title = item.title?.trim() || 'Item sem título';
  return (
    <HubFrame documentTitle={title} active="catalogo">
      <ItemDetail
        item={item}
        mode="page"
        onPatch={patch => setItem(prev => (prev ? { ...prev, ...patch } : prev))}
        onDeleted={() => router.push('/prompt-hub')}
        topBar={
          <nav aria-label="Caminho" className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
            <Link href="/prompt-hub" className="rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Biblioteca de IA
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <Link href="/prompt-hub" className="rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Catálogo
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <strong aria-current="page" className="max-w-[420px] truncate font-semibold text-foreground">
              {title}
            </strong>
          </nav>
        }
      />
    </HubFrame>
  );
}
