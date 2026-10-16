'use client';

import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { useUserContext } from '@/context/UserContext';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { PREDEFINED_AVATARS } from '@/lib/types';

/**
 * Avatar da pessoa logada nos cabeçalhos: a foto do Jira (da importação do time ou da última sincronização
 * feita em "Minha identidade") ou, sem ela, o avatar ilustrado de sempre. As classes de tamanho/forma ficam
 * com quem chama.
 */
export function ProfileAvatar({ className }: { className?: string }) {
  const { userProfile } = useUserContext();
  const { photo, reportBroken } = useProfilePhoto();
  if (!userProfile) return null;

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={`Foto de ${userProfile.name}`}
        className={`${className ?? ''} object-cover`}
        onError={() => reportBroken(photo)}
      />
    );
  }
  return (
    <NiceAvatar
      className={className}
      {...(PREDEFINED_AVATARS[userProfile.avatarSeed || ''] || genConfig(userProfile.avatarSeed || userProfile.email || userProfile.name))}
    />
  );
}
