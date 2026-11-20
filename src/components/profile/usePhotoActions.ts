'use client';

import * as React from 'react';
import { prepareProfilePhoto } from '@/lib/photo-resize';
import { setUploadedPhotoOverride } from '@/lib/uploaded-photo-store';
import { userPhotoApi } from '@/lib/user-photo-api';

/**
 * Ações da foto de perfil: enviar (recorte 256x256 pelo `photo-resize`, envio pelo `user-photo-api`) e remover.
 * Guarda o novo caminho no `uploaded-photo-store` para a sessão inteira trocar a imagem na hora.
 */
export function usePhotoActions(userId?: string) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<'upload' | 'remove' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const pick = React.useCallback(() => inputRef.current?.click(), []);

  const onFile = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setError(null);
      setBusy('upload');
      try {
        const blob = await prepareProfilePhoto(file);
        const photoUrl = await userPhotoApi.upload(blob);
        setUploadedPhotoOverride(userId, photoUrl);
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : 'Não foi possível enviar a foto. Tente de novo.');
      } finally {
        setBusy(null);
      }
    },
    [userId],
  );

  const remove = React.useCallback(async () => {
    setError(null);
    setBusy('remove');
    try {
      await userPhotoApi.remove();
      setUploadedPhotoOverride(userId, null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível remover a foto. Tente de novo.');
    } finally {
      setBusy(null);
    }
  }, [userId]);

  return { inputRef, busy, error, pick, onFile, remove };
}
