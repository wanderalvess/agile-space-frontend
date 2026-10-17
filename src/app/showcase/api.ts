import type { ShowcaseJqlQuery, ShowcasePresenter, ShowcaseSession, ShowcaseTask, TaskFile } from '@/components/showcase/types';
import { authFetch, getAuthToken } from '@/lib/auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
// Mesmo padrão de retro/poker/health-check: deriva do API_URL em vez de uma variável própria,
// que já foi documentada sem o "/ws" final e quebrava o tempo real só do showcase.
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '/ws');

import { req as resilientReq } from '@/lib/http-client';

/** Erro de uma chamada: o status, o `code` do servidor (ex.: CARD_VERSION_CONFLICT) e o corpo já lido. */
export interface ShowcaseApiError extends Error {
  status?: number;
  code?: string;
  /** Corpo JSON da resposta de erro (`{ error, message, code, cardIds?, card? }`), quando houver. */
  body?: Record<string, unknown> | null;
}

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`Showcase API error ${res.status}: ${text}`) as ShowcaseApiError;
    error.status = res.status;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        error.body = parsed as Record<string, unknown>;
        if (typeof parsed.code === 'string') error.code = parsed.code;
      }
    } catch {
      // corpo sem JSON: fica só o status
    }
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Rota que o backend não conhece (backend antigo): 404, 405 ou 501. A tela trata como "indisponível", sem erro. */
export function isUnavailableError(e: unknown): boolean {
  const status = (e as ShowcaseApiError | undefined)?.status;
  return status === 404 || status === 405 || status === 501;
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

  /**
   * Grava só os campos mudados de UM card (backend com a V81). `version` é a que o cliente leu: se o card mudou
   * desde então, o servidor responde 409 `CARD_VERSION_CONFLICT` com o card atual (em `error.body.card`).
   * Devolve o card inteiro, já com a versão nova.
   */
  async patchCard(sessionId: string, cardId: string, body: Record<string, unknown>): Promise<ShowcaseTask> {
    return req<ShowcaseTask>(`/showcase-sessions/${encodeURIComponent(sessionId)}/cards/${encodeURIComponent(cardId)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  /** Quem apresenta agora. `null` = ninguém (204). Backend sem a rota: lança com status 404/405 (ver `isUnavailableError`). */
  async getPresenter(sessionId: string): Promise<ShowcasePresenter | null> {
    const data = await req<ShowcasePresenter | undefined>(`/showcase-sessions/${encodeURIComponent(sessionId)}/presenter`);
    return data ?? null;
  },

  /** Publica o card que o apresentador está mostrando. 403 = a pessoa não conduz esta Review. */
  async setPresenter(sessionId: string, body: { cardId: string | null; step: string | null }): Promise<ShowcasePresenter> {
    return req<ShowcasePresenter>(`/showcase-sessions/${encodeURIComponent(sessionId)}/presenter`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async clearPresenter(sessionId: string): Promise<void> {
    await req<void>(`/showcase-sessions/${encodeURIComponent(sessionId)}/presenter`, { method: 'DELETE' });
  },

  /** Consultas JQL da squad (da squad + as privadas da própria pessoa). Backend sem a rota: lança com 404/405. */
  async listSquadJql(squadId: string): Promise<ShowcaseJqlQuery[]> {
    return req<ShowcaseJqlQuery[]>(`/showcase-sessions/jql?squadId=${encodeURIComponent(squadId)}`);
  },

  async saveSquadJql(body: { squadId: string; name: string; jql: string; visibility: 'SQUAD' | 'PRIVATE' }): Promise<ShowcaseJqlQuery> {
    return req<ShowcaseJqlQuery>('/showcase-sessions/jql', { method: 'POST', body: JSON.stringify(body) });
  },

  async deleteSquadJql(id: string): Promise<void> {
    await req<void>(`/showcase-sessions/jql/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
