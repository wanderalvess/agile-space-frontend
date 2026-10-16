'use client';

import { useUserContext } from '@/context/UserContext';
import { useProfilePhoto } from '@/hooks/useProfilePhoto';
import { InitialsAvatar } from '@/components/common/InitialsAvatar';

/**
 * Avatar da pessoa logada nos cabeçalhos: a foto do Jira (da importação do time ou da última sincronização
 * feita em "Minha identidade") ou, sem ela, um círculo com as iniciais do nome. As classes de tamanho/forma
 * ficam com quem chama.
 */
export function ProfileAvatar({ className }: { className?: string }) {
  const { userProfile } = useUserContext();
  const { photo, reportBroken } = useProfilePhoto();
  if (!userProfile) return null;

  return (
    <InitialsAvatar
      name={userProfile.name}
      email={userProfile.email}
      src={photo}
      onPhotoError={reportBroken}
      title={userProfile.name || userProfile.email}
      className={className}
    />
  );
}
