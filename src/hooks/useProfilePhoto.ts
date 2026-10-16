'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUserContext } from '@/context/UserContext';
import { useTeamAvatars } from '@/hooks/useTeamAvatars';
import {
  PROFILE_PHOTO_EVENT,
  readProfilePhotoOff,
  readStoredProfilePhoto,
  resolveProfilePhoto,
  writeProfilePhotoOff,
  type JiraAvatarUrls,
} from '@/lib/profile-photo';

/**
 * Foto do Jira da pessoa logada (ou `undefined`). Junta a foto da importação do time, a última foto
 * sincronizada neste navegador e, no modal de identidade, a recém-sincronizada (`jiraAvatarUrls`).
 * Uma imagem que não carrega é descartada, e a pessoa volta às iniciais.
 * Com a preferência "Usar minhas iniciais" ligada, `photo` é sempre `undefined`; `available` diz se há foto para voltar a usar.
 */
export function useProfilePhoto(opts?: { jiraAvatarUrls?: JiraAvatarUrls | null; jiraAccountId?: string }) {
  const { userProfile } = useUserContext();
  const { avatarFor } = useTeamAvatars(userProfile?.squadId);
  const userId = userProfile?.id || userProfile?.email;

  const [storedPhoto, setStoredPhoto] = useState<string | undefined>(undefined);
  const [photoOff, setPhotoOffState] = useState(false);
  const [broken, setBroken] = useState<string[]>([]);

  useEffect(() => {
    const read = () => {
      setStoredPhoto(readStoredProfilePhoto(userId));
      setPhotoOffState(readProfilePhotoOff(userId));
    };
    read();
    window.addEventListener(PROFILE_PHOTO_EVENT, read);
    return () => window.removeEventListener(PROFILE_PHOTO_EVENT, read);
  }, [userId]);

  const teamPhoto = userProfile
    ? avatarFor({
        email: userProfile.email,
        name: userProfile.name,
        accountId: opts?.jiraAccountId || userProfile.jiraAccountId,
      })
    : undefined;

  const sources = { teamPhoto, jiraAvatarUrls: opts?.jiraAvatarUrls, storedPhoto };
  const resolved = resolveProfilePhoto({ ...sources, photoOff });
  const photo = resolved && !broken.includes(resolved) ? resolved : undefined;
  // Há foto do Jira que a pessoa poderia usar (mesmo com as iniciais ligadas)?
  const available = photoOff ? !!resolveProfilePhoto(sources) : !!photo;
  const setPhotoOff = useCallback((off: boolean) => writeProfilePhotoOff(userId, off), [userId]);

  const reportBroken = useCallback((url: string) => setBroken((list) => (list.includes(url) ? list : [...list, url])), []);

  return { photo, reportBroken, available, photoOff, setPhotoOff };
}
