'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  readFavorites,
  readRecents,
  toggleId,
  withRecent,
  writeFavorites,
  writeRecents,
  type RecentEntry,
} from '@/lib/devtools/preferences';

/**
 * Favoritas e recentes do usuário no navegador. Começa vazio (igual no servidor e no cliente) e lê o
 * localStorage depois de montar; qualquer falha do storage é ignorada (ver `lib/devtools/preferences`).
 */
export function useDevToolPrefs() {
  const { session } = useAuth();
  const userId = session?.id ?? '';
  const [favorites, setFavoritesState] = useState<string[]>([]);
  const [recents, setRecentsState] = useState<RecentEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  // As refs guardam o valor mais recente para as ações não dependerem de um render intermediário.
  const favRef = useRef<string[]>([]);
  const recRef = useRef<RecentEntry[]>([]);

  useEffect(() => {
    /* O storage só existe no navegador: ler depois de montar evita divergência de hidratação. */
    favRef.current = readFavorites(userId);
    recRef.current = readRecents(userId);
    setFavoritesState(favRef.current);
    setRecentsState(recRef.current);
    setLoaded(true);
  }, [userId]);

  const toggleFavorite = useCallback(
    (id: string) => {
      favRef.current = toggleId(favRef.current, id);
      writeFavorites(userId, favRef.current);
      setFavoritesState(favRef.current);
    },
    [userId],
  );

  const markOpened = useCallback(
    (id: string) => {
      recRef.current = withRecent(recRef.current, id, Date.now());
      writeRecents(userId, recRef.current);
      setRecentsState(recRef.current);
    },
    [userId],
  );

  return { favorites, recents, loaded, toggleFavorite, markOpened };
}
