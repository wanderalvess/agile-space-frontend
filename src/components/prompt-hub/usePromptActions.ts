'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useUserContext } from '@/context/UserContext';
import { openExternalUrl } from '@/lib/utils';
import { isMissingRoute, promptApi } from '@/app/prompt-hub/api';
import { invalidateCatalogCache } from '@/app/prompt-hub/catalog-query';
import { loadLocalFavorites, saveLocalFavorites } from '@/app/prompt-hub/favorites-local';
import type { PromptItem } from '@/app/prompt-hub/types';

interface Options {
  /** Depois de contar um uso: a tela soma 1 no cartão sem recarregar. */
  onUsed?: (id: string) => void;
  /** Depois de qualquer ação que muda a lista (duplicar, excluir). */
  onChanged?: () => void;
}

export const itemUrl = (id: string) => `${window.location.origin}/prompt-hub/${id}`;

/**
 * As ações que todo cartão e toda página de item têm em comum: copiar (e contar o uso), abrir a
 * ferramenta, copiar o link, duplicar e favoritar. Cada tela só decide o que fazer com o resultado.
 */
export function usePromptActions({ onUsed, onChanged }: Options = {}) {
  const router = useRouter();
  const { session } = useAuth();
  const { userProfile } = useUserContext();
  const sessionId = session?.id;
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [localFavorites, setLocalFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalFavorites(sessionId ? loadLocalFavorites(sessionId) : new Set());
  }, [sessionId]);

  const authorSnapshot = useCallback(
    () => ({
      authorName: userProfile?.name || session?.name || 'Membro',
      authorRole: userProfile?.role || 'Colaborador',
      authorSquad: userProfile?.squadId || 'Squad Geral',
      authorAvatar: userProfile?.avatarSeed || '',
    }),
    [userProfile, session]
  );

  const askLogin = useCallback(
    (message: string) => {
      toast.info(message, { action: { label: 'Entrar', onClick: () => router.push('/login') } });
    },
    [router]
  );

  /** Conta o uso quando há login. Falha de rede não desfaz a cópia, mas a pessoa fica sabendo. */
  const countUse = useCallback(
    async (item: Pick<PromptItem, 'id'>) => {
      if (!sessionId) return;
      try {
        await promptApi.usePrompt(item.id);
        invalidateCatalogCache();
        onUsed?.(item.id);
      } catch (err) {
        console.warn('[prompt-hub] uso não contado', err);
        toast.warning('O uso não foi contado', { description: 'A cópia deu certo, mas o contador não atualizou.' });
      }
    },
    [sessionId, onUsed]
  );

  const copyText = useCallback(
    async (item: PromptItem, text: string, successMessage = 'Conteúdo copiado') => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error(err);
        toast.error('Não foi possível copiar o conteúdo.', { description: 'O navegador bloqueou o acesso à área de transferência.' });
        return false;
      }
      toast.success(successMessage);
      await countUse(item);
      return true;
    },
    [countUse]
  );

  const openTool = useCallback(
    async (item: PromptItem, safeLink: string) => {
      if (!openExternalUrl(safeLink)) {
        toast.error('O link deste item não pode ser aberto.', { description: 'Ele precisa começar com http:// ou https://.' });
        return;
      }
      toast.success('Abrindo a ferramenta');
      await countUse(item);
    },
    [countUse]
  );

  const copyLink = useCallback(async (item: Pick<PromptItem, 'id'>) => {
    try {
      await navigator.clipboard.writeText(itemUrl(item.id));
      toast.success('Link copiado');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível copiar o link.');
    }
  }, []);

  /** Cria a cópia privada e abre o editor nela. Devolve a cópia, ou null se não deu. */
  const duplicate = useCallback(
    async (source: PromptItem): Promise<PromptItem | null> => {
      if (!session) {
        askLogin('Entre para duplicar este item');
        return null;
      }
      if (isDuplicating) return null;
      setIsDuplicating(true);
      const loading = toast.loading('Duplicando...');
      try {
        // Cópia e contagem da duplicação acontecem juntas no servidor: se falhar, nada fica pela metade.
        const copy = await promptApi.clonePrompt(source.id, authorSnapshot());
        invalidateCatalogCache();
        toast.success('Cópia criada em "Meus itens"', { id: loading });
        onChanged?.();
        router.push(`/prompt-hub/${copy.id}/editar`);
        return copy;
      } catch (err) {
        toast.error('Erro ao duplicar', { id: loading, description: err instanceof Error ? err.message : undefined });
        return null;
      } finally {
        setIsDuplicating(false);
      }
    },
    [session, askLogin, isDuplicating, authorSnapshot, onChanged, router]
  );

  /**
   * Favorita ou desfavorita. Com o servidor novo o favorito vai para a conta; se o servidor não
   * tem a rota, guarda no navegador como antes. Devolve o estado final, ou null se não mudou.
   */
  const toggleFavorite = useCallback(
    async (item: Pick<PromptItem, 'id' | 'favorite'>, currentlyFavorite: boolean): Promise<boolean | null> => {
      if (!sessionId) {
        askLogin('Entre para guardar favoritos');
        return null;
      }
      const next = !currentlyFavorite;
      const keepLocal = () => {
        const ids = new Set(localFavorites);
        if (next) ids.add(item.id);
        else ids.delete(item.id);
        if (!saveLocalFavorites(sessionId, ids)) {
          toast.error('Não foi possível atualizar o favorito.');
          return null;
        }
        setLocalFavorites(ids);
        toast.success(next ? 'Salvo nos favoritos' : 'Removido dos favoritos');
        return next;
      };

      // Lista do servidor antigo não traz `favorite`: o favorito é só do navegador.
      if (typeof item.favorite !== 'boolean') return keepLocal();
      try {
        const saved = await promptApi.setFavorite(item.id, next);
        toast.success(saved ? 'Salvo nos favoritos' : 'Removido dos favoritos');
        return saved;
      } catch (err) {
        if (isMissingRoute(err)) return keepLocal();
        toast.error('Não foi possível atualizar o favorito.', { description: err instanceof Error ? err.message : undefined });
        return null;
      }
    },
    [sessionId, askLogin, localFavorites]
  );

  return {
    session,
    sessionId,
    userProfile,
    authorSnapshot,
    askLogin,
    copyText,
    openTool,
    copyLink,
    duplicate,
    isDuplicating,
    toggleFavorite,
    localFavorites,
  };
}
