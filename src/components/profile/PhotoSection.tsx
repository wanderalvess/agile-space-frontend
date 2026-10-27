'use client';

import * as React from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { FOCUS_RING, ModalButton } from '@/components/room-kit';
import { ACCEPTED_PHOTO_TYPES, prepareProfilePhoto } from '@/lib/photo-resize';
import { setUploadedPhotoOverride } from '@/lib/uploaded-photo-store';
import { userPhotoApi } from '@/lib/user-photo-api';
import { cn } from '@/lib/utils';
import { SectionCard, TEXT_ACTION } from './ui';

export interface PhotoSectionProps {
  userId?: string;
  name: string;
  email: string;
  /** Foto em uso (enviada ou do Jira). */
  photo?: string;
  onPhotoError: (url: string) => void;
  /** A pessoa tem foto enviada. */
  hasUploaded: boolean;
  /** Há foto do Jira que ela pode usar (mesmo com as iniciais ligadas). */
  photoAvailable: boolean;
  photoOff: boolean;
  onPhotoOff: (off: boolean) => void;
  onGoJira: () => void;
}

/** Cartão "Foto": trocar (envio com recorte 256x256), remover e escolher entre foto enviada, do Jira ou iniciais. */
export function PhotoSection(p: PhotoSectionProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<'upload' | 'remove' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const photoState = p.hasUploaded ? 'Foto enviada por você' : p.photo ? 'Foto do Jira' : p.photoAvailable ? 'Iniciais do seu nome' : 'Sem foto';

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy('upload');
    try {
      const blob = await prepareProfilePhoto(file);
      const photoUrl = await userPhotoApi.upload(blob);
      setUploadedPhotoOverride(p.userId, photoUrl);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível enviar a foto. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setError(null);
    setBusy('remove');
    try {
      await userPhotoApi.remove();
      setUploadedPhotoOverride(p.userId, null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Não foi possível remover a foto. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <SectionCard icon={Camera} title="Foto" titleId="identity-foto">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={pick}
          disabled={disabled}
          aria-label="Trocar foto"
          className={cn('shrink-0 rounded-full max-sm:min-h-14 max-sm:min-w-14', FOCUS_RING)}
        >
          <InitialsAvatar name={p.name.trim()} email={p.email} src={p.photo} onPhotoError={p.onPhotoError} className="h-14 w-14 border border-border text-lg" />
        </button>
        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{photoState}</span>
          <span className="text-xs text-muted-foreground">JPG, PNG ou WebP. Recortamos no centro, em quadrado.</span>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPTED_PHOTO_TYPES.join(',')} onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" data-testid="photo-input" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ModalButton onClick={pick} disabled={disabled} className="gap-2 max-sm:h-11">
          {busy === 'upload' && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />}
          {busy === 'upload' ? 'Enviando...' : 'Trocar foto'}
        </ModalButton>
        {p.hasUploaded && (
          <ModalButton onClick={remove} disabled={disabled} className="gap-2 max-sm:h-11">
            {busy === 'remove' && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />}
            Remover foto
          </ModalButton>
        )}
        {!p.hasUploaded && (p.photo || p.photoAvailable) && (
          <ModalButton onClick={() => p.onPhotoOff(!p.photoOff)} disabled={disabled} className="max-sm:h-11">
            {p.photoOff ? 'Usar foto do Jira' : 'Usar minhas iniciais'}
          </ModalButton>
        )}
        {!p.hasUploaded && !p.photo && !p.photoAvailable && (
          <button type="button" onClick={p.onGoJira} className={TEXT_ACTION}>
            Ou conectar o Jira
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </SectionCard>
  );
}
