'use client';

import { useEffect, useState } from 'react';
import { avatarToneIndex, initialsOf } from '@/lib/initials';
import { cn } from '@/lib/utils';

export interface InitialsAvatarProps {
  name?: string | null;
  /** Só entra quando não há nome (iniciais e cor saem do e-mail). */
  email?: string | null;
  /** Foto (Jira etc.). Se faltar ou falhar ao carregar, aparecem as iniciais. */
  src?: string | null;
  /** Tamanho, forma e texto ficam com quem chama (ex.: "h-9 w-9 text-xs"). */
  className?: string;
  /** Com título o avatar é lido como imagem; sem título é decorativo (o nome já está ao lado). */
  title?: string;
  /** Avisa qual foto não carregou, para quem guarda a lista de fotos quebradas. */
  onPhotoError?: (url: string) => void;
}

/**
 * Avatar único do app: foto quando existe; senão um círculo com as iniciais do nome, em um tom suave
 * estável por pessoa (mesma pessoa, mesma cor em toda tela). Cores vêm das variáveis `--avatar-N-*`.
 */
export function InitialsAvatar({ name, email, src, className, title, onPhotoError }: InitialsAvatarProps) {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => setFailed(null), [src]);

  const photo = src && failed !== src ? src : null;
  const label = (name ?? '').trim() || (email ?? '').trim();

  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn(
        'relative inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold leading-none',
        !photo && `avatar-tone-${avatarToneIndex(name, email)}`,
        className
      )}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={label ? `Foto de ${label}` : ''}
          className="h-full w-full object-cover"
          onError={() => {
            setFailed(photo);
            onPhotoError?.(photo);
          }}
        />
      ) : (
        initialsOf(name, email)
      )}
    </span>
  );
}
