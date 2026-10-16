'use client';

import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { PREDEFINED_AVATARS } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Avatar redondo do modal de identidade: a foto do Jira quando há, senão o avatar ilustrado da semente.
 * O tamanho vem em px para a foto e o desenho ficarem idênticos.
 */
export function IdentityAvatar({
  photo,
  seed,
  name,
  size = 96,
  onPhotoError,
  className,
}: {
  photo?: string;
  seed: string;
  name: string;
  size?: number;
  onPhotoError?: (url: string) => void;
  className?: string;
}) {
  return (
    <span
      className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full border border-border bg-muted ring-2 ring-primary/25', className)}
      style={{ width: size, height: size }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={name ? `Foto de ${name}` : 'Foto do Jira'}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => onPhotoError?.(photo)}
        />
      ) : (
        <NiceAvatar
          aria-hidden="true"
          style={{ width: size, height: size }}
          {...(PREDEFINED_AVATARS[seed] || genConfig(seed))}
        />
      )}
    </span>
  );
}
