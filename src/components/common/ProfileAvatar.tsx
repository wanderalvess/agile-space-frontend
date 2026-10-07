'use client';

import NiceAvatar, { genConfig } from 'react-nice-avatar';
import { useUserContext } from '@/context/UserContext';
import { useTeamAvatars } from '@/hooks/useTeamAvatars';
import { PREDEFINED_AVATARS } from '@/lib/types';

/**
 * Avatar da pessoa logada nos cabeçalhos: a foto do Jira (quando o time foi importado com fotos) ou, sem ela,
 * o avatar ilustrado de sempre. As classes de tamanho/forma ficam com quem chama.
 */
export function ProfileAvatar({ className }: { className?: string }) {
  const { userProfile } = useUserContext();
  const { avatarFor } = useTeamAvatars(userProfile?.squadId);
  if (!userProfile) return null;

  const photo = avatarFor({ email: userProfile.email, name: userProfile.name });
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={`Foto de ${userProfile.name}`} className={`${className ?? ''} object-cover`} />;
  }
  return (
    <NiceAvatar
      className={className}
      {...(PREDEFINED_AVATARS[userProfile.avatarSeed || ''] || genConfig(userProfile.avatarSeed || userProfile.email || userProfile.name))}
    />
  );
}
