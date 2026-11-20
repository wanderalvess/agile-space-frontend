'use client';

import * as React from 'react';
import { Camera, ImageUp, Loader2, Plug, Trash2, UserRound } from 'lucide-react';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FOCUS_RING } from '@/components/room-kit';
import { ACCEPTED_PHOTO_TYPES } from '@/lib/photo-resize';
import { cn } from '@/lib/utils';
import type { usePhotoActions } from './usePhotoActions';

export interface PhotoMenuProps {
  name: string;
  email: string;
  /** Foto em uso (enviada ou do Jira), ou nada. */
  photo?: string;
  onPhotoError: (url: string) => void;
  /** A pessoa tem foto enviada. */
  hasUploaded: boolean;
  /** Há foto do Jira que ela pode usar (mesmo com as iniciais ligadas). */
  photoAvailable: boolean;
  photoOff: boolean;
  onPhotoOff: (off: boolean) => void;
  actions: ReturnType<typeof usePhotoActions>;
}

const ITEM =
  'flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground focus:bg-accent focus:text-accent-foreground ' +
  'aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground aria-disabled:focus:bg-transparent aria-disabled:focus:text-muted-foreground';

/**
 * O avatar grande é o botão da foto: abre um menu (role="menu") com enviar, usar a do Jira / as iniciais e remover.
 * O Radix cuida de Esc, setas, foco preso no menu e devolução do foco ao avatar.
 */
export function PhotoMenu({ name, email, photo, onPhotoError, hasUploaded, photoAvailable, photoOff, onPhotoOff, actions }: PhotoMenuProps) {
  const busy = actions.busy !== null;
  const jiraPhotoExists = !hasUploaded && (!!photo || photoAvailable);
  const jiraItemOff = hasUploaded ? 'Remova a foto enviada para usar a do Jira.' : 'Conecte o Jira para trazer a sua.';
  const jiraActive = jiraPhotoExists && !photoOff;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Trocar foto"
            disabled={busy}
            className={cn(
              'relative flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-full sm:h-24 sm:w-24',
              'disabled:cursor-progress',
              FOCUS_RING,
            )}
          >
            <InitialsAvatar name={name.trim()} email={email} src={photo} onPhotoError={onPhotoError} className="h-full w-full border border-border text-[34px] font-semibold" />
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-card bg-primary text-primary-foreground"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
              ) : (
                <Camera className="h-4 w-4" strokeWidth={1.5} />
              )}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" aria-label="Foto de perfil" className="z-[60] w-[min(20rem,calc(100vw-2rem))] rounded-xl border-border bg-popover p-1.5">
          <DropdownMenuItem className={ITEM} onSelect={() => actions.pick()}>
            <ImageUp aria-hidden="true" className="mt-0.5 h-4 w-4" strokeWidth={1.5} />
            Enviar uma foto
          </DropdownMenuItem>

          {jiraPhotoExists ? (
            <DropdownMenuItem className={ITEM} onSelect={() => onPhotoOff(!photoOff)}>
              {jiraActive ? <UserRound aria-hidden="true" className="mt-0.5 h-4 w-4" strokeWidth={1.5} /> : <Plug aria-hidden="true" className="mt-0.5 h-4 w-4" strokeWidth={1.5} />}
              {jiraActive ? 'Usar minhas iniciais' : 'Usar a foto do Jira'}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem aria-disabled="true" className={ITEM} onSelect={(e) => e.preventDefault()}>
              <Plug aria-hidden="true" className="mt-0.5 h-4 w-4" strokeWidth={1.5} />
              <span className="flex flex-col gap-0.5">
                <span>Usar a foto do Jira</span>
                <span className="text-xs font-normal">{jiraItemOff}</span>
              </span>
            </DropdownMenuItem>
          )}

          {hasUploaded && (
            <DropdownMenuItem className={cn(ITEM, 'text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300')} onSelect={() => void actions.remove()}>
              <Trash2 aria-hidden="true" className="mt-0.5 h-4 w-4" strokeWidth={1.5} />
              Remover foto
            </DropdownMenuItem>
          )}

          <p className="border-t border-border px-3 pb-1.5 pt-2.5 text-xs text-muted-foreground">JPG, PNG ou WebP. Recortamos no centro, em quadrado.</p>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={actions.inputRef}
        type="file"
        accept={ACCEPTED_PHOTO_TYPES.join(',')}
        onChange={actions.onFile}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="photo-input"
      />
    </>
  );
}
