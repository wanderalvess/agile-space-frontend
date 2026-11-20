/**
 * Foto enviada pela pessoa, no estado desta aba. Depois de enviar/remover, a sessão ainda traz o `photoUrl`
 * antigo (ela só é relida no login/recarga): este estado manda até lá, sem exigir novo login.
 * `undefined` = sem decisão local (vale a sessão); `null` = a pessoa removeu; string = caminho novo.
 */
import { PROFILE_PHOTO_EVENT } from '@/lib/profile-photo';

const overrides = new Map<string, string | null>();

export function getUploadedPhotoOverride(userId?: string | null): string | null | undefined {
  return userId ? overrides.get(userId) : undefined;
}

export function setUploadedPhotoOverride(userId: string | null | undefined, photoUrl: string | null): void {
  if (!userId) return;
  overrides.set(userId, photoUrl);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROFILE_PHOTO_EVENT));
}

export function resetUploadedPhotoOverrides(): void {
  overrides.clear();
}
