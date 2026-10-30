/**
 * Favoritos guardados no navegador. Só servem de reserva com o servidor antigo, que não
 * tem favoritos na conta; com o servidor novo o favorito vive na conta da pessoa.
 */
const keyFor = (userId?: string | null) => `favorites_${userId || 'anonymous'}`;

export function loadLocalFavorites(userId?: string | null): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveLocalFavorites(userId: string | null | undefined, ids: Set<string>): boolean {
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(Array.from(ids)));
    return true;
  } catch {
    return false;
  }
}
