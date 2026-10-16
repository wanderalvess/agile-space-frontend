/**
 * Regra da foto de perfil: quem tem foto vinda do Jira mostra a foto e não escolhe avatar ilustrado;
 * quem não tem usa o avatar ilustrado e o seletor. Funções puras (sem React), para serem testadas.
 *
 * Fontes da foto, da mais fresca à mais antiga:
 *  1. `jiraAvatarUrls` do `/myself` recém-sincronizado dentro do modal (`avatarUrls`: { '48x48': url, ... });
 *  2. `teamPhoto`: foto da importação do time pelo Jira (`useTeamAvatars.avatarFor`);
 *  3. `storedPhoto`: a última foto sincronizada neste navegador (ver `readStoredProfilePhoto`).
 */

export type JiraAvatarUrls = Record<string, string | null | undefined>;

/** Tamanho (px) a partir do qual a foto aparece nítida no modal (96 px de lado). */
export const PREFERRED_PHOTO_SIZE = 96;

/** Aceita só endereços http(s) ou do próprio site — nada de `javascript:` ou `data:` vindo de fora. */
export function isUsablePhotoUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const value = url.trim();
  if (!value) return false;
  return /^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//'));
}

/** "48x48" -> 48. Chaves fora do padrão (ex.: "xlarge") contam como 0 e só entram se não houver outra. */
function sizeOfKey(key: string): number {
  const match = /^(\d+)x(\d+)$/.exec(key.trim());
  return match ? Math.max(Number(match[1]), Number(match[2])) : 0;
}

/**
 * Melhor URL do `avatarUrls` do Jira: a maior disponível, o que já prefere 96 px ou mais quando existir.
 * O Jira costuma devolver no máximo 48x48, e aí vale a maior.
 */
export function bestJiraAvatar(urls: JiraAvatarUrls | null | undefined): string | undefined {
  if (!urls || typeof urls !== 'object') return undefined;
  let best: { url: string; size: number } | undefined;
  for (const [key, raw] of Object.entries(urls)) {
    if (!isUsablePhotoUrl(raw)) continue;
    const size = sizeOfKey(key);
    if (!best || size > best.size) best = { url: raw.trim(), size };
  }
  return best?.url;
}

export interface ResolveProfilePhotoInput {
  /** Foto da importação do time (`useTeamAvatars`). */
  teamPhoto?: string | null;
  /** `avatarUrls` do `/myself` do Jira, logo depois de sincronizar no modal. */
  jiraAvatarUrls?: JiraAvatarUrls | null;
  /** Última foto sincronizada, guardada neste navegador. */
  storedPhoto?: string | null;
}

/** URL da foto do Jira da pessoa, ou `undefined` quando ela não tem. */
export function resolveProfilePhoto({ teamPhoto, jiraAvatarUrls, storedPhoto }: ResolveProfilePhotoInput): string | undefined {
  const fresh = bestJiraAvatar(jiraAvatarUrls);
  if (fresh) return fresh;
  if (isUsablePhotoUrl(teamPhoto)) return teamPhoto.trim();
  if (isUsablePhotoUrl(storedPhoto)) return storedPhoto.trim();
  return undefined;
}

// ---- Última foto sincronizada, por pessoa, neste navegador ----------------------------------------------

export const PROFILE_PHOTO_EVENT = 'profile-photo-changed';
const storageKey = (userId: string) => `agile_profile_photo_${userId}`;

export function readStoredProfilePhoto(userId?: string | null): string | undefined {
  if (!userId || typeof window === 'undefined') return undefined;
  try {
    const value = window.localStorage.getItem(storageKey(userId));
    return isUsablePhotoUrl(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Guarda a foto sincronizada (ou apaga, com `null`) e avisa quem estiver mostrando o avatar. */
export function writeStoredProfilePhoto(userId: string | null | undefined, url: string | null): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    if (url && isUsablePhotoUrl(url)) window.localStorage.setItem(storageKey(userId), url);
    else window.localStorage.removeItem(storageKey(userId));
  } catch {
    /* navegador sem armazenamento: a foto só vale nesta sessão */
  }
  window.dispatchEvent(new Event(PROFILE_PHOTO_EVENT));
}
