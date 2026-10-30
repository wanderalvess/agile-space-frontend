'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUserContext } from '@/context/UserContext';
import { useTeamAvatars } from '@/hooks/useTeamAvatars';
import { useUploadedPhoto } from '@/hooks/useUploadedPhoto';
import { getUploadedPhotoOverride } from '@/lib/uploaded-photo-store';
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
 * A foto ENVIADA pela pessoa (`userProfile.photoUrl`, servida com Bearer e lida como `blob:`) vale mais que a do Jira
 * e não passa por `isUsablePhotoUrl`: é um ramo próprio, as fontes externas continuam validadas.
 * Com a preferência "Usar minhas iniciais" ligada, `photo` é sempre `undefined`; `available` diz se há foto para voltar a usar.
 */
export function useProfilePhoto(opts?: { jiraAvatarUrls?: JiraAvatarUrls | null; jiraAccountId?: string }) {
  const { userProfile } = useUserContext();
  const { avatarFor } = useTeamAvatars(userProfile?.squadId);
  const userId = userProfile?.id || userProfile?.email;

  const [storedPhoto, setStoredPhoto] = useState<string | undefined>(undefined);
  const [photoOff, setPhotoOffState] = useState(false);
  const [broken, setBroken] = useState<string[]>([]);
  const [, bump] = useState(0);

  useEffect(() => {
    const read = () => {
      setStoredPhoto(readStoredProfilePhoto(userId));
      setPhotoOffState(readProfilePhotoOff(userId));
      bump((n) => n + 1);
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

  // Decisão local (enviou/removeu nesta aba) vale mais que a sessão, que só é relida no login/recarga.
  const override = getUploadedPhotoOverride(userId);
  const uploadedPath = override !== undefined ? override : userProfile?.photoUrl ?? null;
  const uploaded = useUploadedPhoto(uploadedPath);

  const sources = { teamPhoto, jiraAvatarUrls: opts?.jiraAvatarUrls, storedPhoto };
  const resolved = resolveProfilePhoto({ ...sources, photoOff });
  const jiraPhoto = resolved && !broken.includes(resolved) ? resolved : undefined;
  const uploadedUrl = uploaded.url && !broken.includes(uploaded.url) ? uploaded.url : undefined;
  // Enquanto a enviada carrega, não mostra a do Jira por um instante (evita piscar a foto errada).
  const photo = uploadedUrl ?? (uploadedPath && uploaded.loading ? undefined : jiraPhoto);
  const hasUploaded = !!uploadedPath && !uploaded.failed;
  // Há foto do Jira que a pessoa poderia usar (mesmo com as iniciais ligadas)?
  const available = photoOff ? !!resolveProfilePhoto(sources) : !!jiraPhoto;
  const setPhotoOff = useCallback((off: boolean) => writeProfilePhotoOff(userId, off), [userId]);

  const reportBroken = useCallback((url: string) => setBroken((list) => (list.includes(url) ? list : [...list, url])), []);

  return { photo, reportBroken, available, photoOff, setPhotoOff, hasUploaded, uploadedUrl, jiraPhoto };
}
