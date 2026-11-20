'use client';

import { useEffect, useState } from 'react';
import { userPhotoApi } from '@/lib/user-photo-api';

/** Cache de bytes por caminho (`?v=` muda a cada envio, então não há foto velha presa). Compartilhado entre os avatares. */
const cache = new Map<string, { url: string; refs: number }>();
const pending = new Map<string, Promise<string | null>>();

function acquire(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit) {
    hit.refs += 1;
    return Promise.resolve(hit.url);
  }
  let p = pending.get(path);
  if (!p) {
    p = userPhotoApi
      .fetchBlob(path)
      .then((blob) => {
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        cache.set(path, { url, refs: 0 });
        return url;
      })
      .finally(() => pending.delete(path));
    pending.set(path, p);
  }
  return p.then((url) => {
    if (url) {
      const entry = cache.get(path);
      if (entry) entry.refs += 1;
    }
    return url;
  });
}

function release(path: string) {
  const entry = cache.get(path);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    URL.revokeObjectURL(entry.url);
    cache.delete(path);
  }
}

/**
 * Foto enviada pela pessoa como `blob:` (o endpoint exige Bearer; `<img src>` direto não funciona).
 * Busca com `authFetch`, guarda em cache e revoga o object URL quando o último avatar sai de cena.
 */
export function useUploadedPhoto(photoPath?: string | null): { url?: string; loading: boolean; failed: boolean } {
  const [state, setState] = useState<{ path?: string; url?: string; failed: boolean }>({ failed: false });

  useEffect(() => {
    if (!photoPath) return;
    let cancelled = false;
    let held = false;
    acquire(photoPath)
      .then((url) => {
        if (cancelled) {
          if (url) release(photoPath);
          return;
        }
        held = !!url;
        setState({ path: photoPath, url: url ?? undefined, failed: !url });
      })
      .catch(() => {
        if (!cancelled) setState({ path: photoPath, failed: true });
      });
    return () => {
      cancelled = true;
      if (held) release(photoPath);
    };
  }, [photoPath]);

  if (!photoPath) return { loading: false, failed: false };
  const current = state.path === photoPath;
  return { url: current ? state.url : undefined, loading: !current, failed: current && state.failed };
}

/** Só para testes: zera o cache. */
export function __resetUploadedPhotoCache() {
  cache.forEach((e) => URL.revokeObjectURL(e.url));
  cache.clear();
  pending.clear();
}
