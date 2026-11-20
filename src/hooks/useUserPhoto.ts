'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useUploadedPhoto } from '@/hooks/useUploadedPhoto';
import { PROFILE_PHOTO_EVENT } from '@/lib/profile-photo';
import { getUploadedPhotoOverride } from '@/lib/uploaded-photo-store';
import { peekUserPhoto, subscribeUserPhoto } from '@/lib/user-photo-cache';

function subscribeOverrides(onChange: () => void) {
  window.addEventListener(PROFILE_PHOTO_EVENT, onChange);
  return () => window.removeEventListener(PROFILE_PHOTO_EVENT, onChange);
}

/**
 * Foto ENVIADA por uma pessoa (a própria ou a de um colega) como `blob:`, ou `undefined` quando não há foto,
 * a busca falhou, ainda carrega ou não veio id. O endpoint exige Bearer, então `<img src>` direto não serve.
 *
 * - Colegas: busca via `user-photo-cache` (dedupe, no máximo 4 buscas juntas, 404 e falha em cache curto).
 *   A busca só acontece com o avatar montado.
 * - A própria pessoa: se ela enviou/removeu a foto nesta aba (`uploaded-photo-store`), vale essa decisão na hora,
 *   pelo mesmo caminho do `useProfilePhoto`; senão, é uma pessoa qualquer.
 */
export function useUserPhoto(userId?: string | null): string | undefined {
  const id = userId?.trim() || undefined;
  const override = useSyncExternalStore(
    subscribeOverrides,
    () => getUploadedPhotoOverride(id),
    () => undefined,
  );
  const own = useUploadedPhoto(typeof override === 'string' ? override : null);
  const [state, setState] = useState<{ id?: string; url?: string }>({});

  useEffect(() => {
    if (!id || override !== undefined) return;
    return subscribeUserPhoto(id, (url) => setState({ id, url }));
  }, [id, override]);

  if (!id || override === null) return undefined;
  if (typeof override === 'string') return own.url;
  // Cache quente: já devolve no primeiro render, sem piscar as iniciais.
  return state.id === id ? state.url : peekUserPhoto(id);
}
