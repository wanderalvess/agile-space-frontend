'use client';

import { useEffect, useState } from 'react';
import { showcaseApi } from '@/app/showcase/api';
import { TaskFile } from './types';

export type TaskFileBlobState = { status: 'loading' | 'ready' | 'error'; url: string | null };

/**
 * Baixa o arquivo anexado com o token da sessão e entrega uma URL local (blob:) para <img>/<iframe>.
 * Um <img src> direto para a API não funcionaria: o navegador não manda o Authorization nessas tags.
 */
export function useTaskFileBlob(sessionId: string, file: Pick<TaskFile, 'id'> | null): TaskFileBlobState {
  const [state, setState] = useState<TaskFileBlobState>({ status: 'loading', url: null });

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: 'loading', url: null });
    showcaseApi.fetchTaskFileBlob(sessionId, file.id)
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ status: 'ready', url: objectUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', url: null });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sessionId, file?.id]);

  return state;
}
