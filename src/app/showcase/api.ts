import { ShowcaseSession, TaskFile } from '@/components/showcase/types';
import { authFetch, getAuthToken } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
// Mesmo padrão de retro/poker/health-check: deriva do API_URL em vez de uma variável própria,
// que já foi documentada sem o "/ws" final e quebrava o tempo real só do showcase.
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '/ws');

import { req as resilientReq } from '@/lib/http-client';

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = new Error(`Showcase API error ${res.status}: ${await res.text()}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  } catch {
    // corpo sem JSON: cai na mensagem padrão
  }
  if (res.status === 413) return 'O arquivo excede o limite de 10 MB.';
  return fallback;
}

export const showcaseApi = {
  async getSessions(squadId: string, limit = 50): Promise<ShowcaseSession[]> {
    return req<ShowcaseSession[]>(`/showcase-sessions?limit=${limit}&squadId=${encodeURIComponent(squadId)}`);
  },

  async getSession(id: string): Promise<ShowcaseSession | null> {
    try {
      return await req<ShowcaseSession>(`/showcase-sessions/${id}`);
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  },

  async saveSession(session: Partial<ShowcaseSession>): Promise<ShowcaseSession> {
    return req<ShowcaseSession>('/showcase-sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  },

  /** Anexa um arquivo (PNG, JPEG ou PDF) ao card. Erros chegam com a mensagem em português do servidor. */
  async uploadTaskFile(sessionId: string, taskId: string, file: File): Promise<TaskFile> {
    const body = new FormData();
    body.append('file', file);
    const res = await authFetch(
      `${API_BASE_URL}/showcase-sessions/${encodeURIComponent(sessionId)}/tasks/${encodeURIComponent(taskId)}/files`,
      { method: 'POST', body }
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Não foi possível enviar o arquivo.'));
    return res.json();
  },

  async deleteTaskFile(sessionId: string, fileId: string): Promise<void> {
    const res = await authFetch(
      `${API_BASE_URL}/showcase-sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(fileId)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Não foi possível remover o arquivo.'));
  },

  /** Baixa o conteúdo com o token da sessão (um <img>/<iframe> direto não manda o Authorization). */
  async fetchTaskFileBlob(sessionId: string, fileId: string): Promise<Blob> {
    const res = await authFetch(
      `${API_BASE_URL}/showcase-sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(fileId)}`
    );
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Não foi possível abrir o arquivo.'));
    return res.blob();
  },

  getWebSocketUrl(id: string): string {
    return `${WS_BASE_URL}/showcase/${id}?token=${encodeURIComponent(getAuthToken() || '')}`;
  }
};
