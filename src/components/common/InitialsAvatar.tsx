'use client';

import { useEffect, useRef, useState } from 'react';
import { useUserPhoto } from '@/hooks/useUserPhoto';
import { avatarToneIndex, initialsOf } from '@/lib/initials';
import { isJiraSystemAvatar } from '@/lib/profile-photo';
import { cn } from '@/lib/utils';

// Nomes por extenso: o Tailwind só gera as classes que encontra escritas por inteiro no código.
const TONE_CLASSES = [
  'avatar-tone-0',
  'avatar-tone-1',
  'avatar-tone-2',
  'avatar-tone-3',
  'avatar-tone-4',
  'avatar-tone-5',
  'avatar-tone-6',
  'avatar-tone-7',
] as const;

export interface InitialsAvatarProps {
  name?: string | null;
  /** Só entra quando não há nome (iniciais e cor saem do e-mail). */
  email?: string | null;
  /** Foto (Jira etc.). Se faltar ou falhar ao carregar, aparecem as iniciais. */
  src?: string | null;
  /**
   * Id da CONTA da pessoa. Com ele, a foto que a pessoa enviou (`useUserPhoto`) vale mais que `src`; sem foto enviada
   * (ou se falhar), segue `src` e, depois, as iniciais. Sem `userId` nada é buscado.
   */
  userId?: string | null;
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
export function InitialsAvatar({ name, email, src, userId, className, title, onPhotoError }: InitialsAvatarProps) {
  // Guarda as URLs que falharam (não um booleano): se a foto mudar, a nova é tentada sem precisar limpar nada.
  const [failed, setFailed] = useState<string[]>([]);
  const uploaded = useUserPhoto(userId);
  const imgRef = useRef<HTMLImageElement>(null);

  // Ícone genérico do Jira (quem não subiu foto) não é foto: aparecem as iniciais.
  const external = src && !failed.includes(src) && !isJiraSystemAvatar(src) ? src : null;
  // A enviada pela pessoa vem primeiro; se a imagem quebrar, cai para a do Jira e depois para as iniciais.
  const photo = uploaded && !failed.includes(uploaded) ? uploaded : external;
  const markFailed = (url: string) => {
    setFailed((list) => (list.includes(url) ? list : [...list, url]));
    onPhotoError?.(url);
  };
  // A imagem pode falhar antes da hidratação (HTML do servidor): nesse caso o onError já passou.
  useEffect(() => {
    const img = imgRef.current;
    if (img && photo && img.complete && img.naturalWidth === 0) {
      markFailed(photo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo]);
  const label = (name ?? '').trim() || (email ?? '').trim();

  return (
    <span
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn(
        'relative inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-xs font-semibold leading-none',
        !photo && TONE_CLASSES[avatarToneIndex(name, email)],
        className
      )}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={photo}
          alt={label ? `Foto de ${label}` : ''}
          className="h-full w-full object-cover"
          onError={() => markFailed(photo)}
        />
      ) : (
        initialsOf(name, email)
      )}
    </span>
  );
}
