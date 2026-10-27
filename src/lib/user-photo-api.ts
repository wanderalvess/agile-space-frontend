import { authFetch } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';

/** Erro do envio/remoção da foto, com a mensagem pronta (a do servidor, quando ele manda uma). */
export class PhotoApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PhotoApiError';
    this.status = status;
  }
}

/** Origem da API (`http://host:porta`); vazia quando a base é relativa (mesma origem do site). */
function apiOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return '';
  }
}

/**
 * `photoUrl` do backend vem como caminho que já começa em `/api/...`. A base da API termina em `/api`:
 * por isso se junta só a ORIGEM, para o prefixo não duplicar (`/api/api/...`).
 */
export function resolvePhotoUrl(photoUrl: string): string {
  if (/^https?:\/\//i.test(photoUrl)) return photoUrl;
  const path = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
  return `${apiOrigin()}${path}`;
}

async function serverMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
  } catch {
    /* corpo vazio ou não JSON */
  }
  return fallback;
}

export const userPhotoApi = {
  /** Envia a foto já recortada. Devolve o `photoUrl` novo (com `?v=` para furar o cache). */
  async upload(blob: Blob): Promise<string> {
    const form = new FormData();
    form.append('file', blob, 'foto.jpg');
    const res = await authFetch(`${API_BASE_URL}/users/me/photo`, { method: 'POST', body: form });
    if (!res.ok) {
      throw new PhotoApiError(await serverMessage(res, 'O servidor não aceitou a foto. Tente de novo.'), res.status);
    }
    const data = await res.json();
    if (!data || typeof data.photoUrl !== 'string') throw new PhotoApiError('Resposta inesperada do servidor.', res.status);
    return data.photoUrl;
  },

  async remove(): Promise<void> {
    const res = await authFetch(`${API_BASE_URL}/users/me/photo`, { method: 'DELETE' });
    if (!res.ok) throw new PhotoApiError(await serverMessage(res, 'Não foi possível remover a foto. Tente de novo.'), res.status);
  },

  /** Bytes da foto (a leitura exige Bearer: `<img src>` direto não serve). `null` quando não há foto (404). */
  async fetchBlob(photoUrl: string): Promise<Blob | null> {
    const res = await authFetch(resolvePhotoUrl(photoUrl));
    if (res.status === 404) return null;
    if (!res.ok) throw new PhotoApiError('Não foi possível carregar a foto.', res.status);
    return res.blob();
  },
};
