/**
 * Presença em tempo real nas salas (Poker, Retro, Brainstorming, Radar de clima, Review).
 *
 * Contrato do backend: `docs/presence-api.md` (repositório do backend). Resumo:
 * - abrir o WebSocket com `?presence=1` faz a sessão receber `PRESENCE_UPDATED` com o estado COMPLETO
 *   (`{ online: userId[], total, version }`), um snapshot logo na conexão e depois a cada mudança;
 * - `version` só cresce dentro de um processo do servidor: o cliente descarta versão menor ou igual à
 *   última aplicada naquela conexão e zera a versão ao reconectar;
 * - `GET /api/presence/{module}/{roomId}` devolve a mesma lista (carga inicial/fallback);
 * - um backend antigo ignora `presence=1`, não envia o evento e responde 404 no REST: aí a presença fica
 *   DESCONHECIDA (`null`) e a tela se comporta como antes, sem nenhum indicador inventado.
 *
 * Este arquivo só tem regra pura (sem React): a URL, o filtro do evento, a ordem de versões, a tolerância
 * de queda curta e o fallback REST. O hook está em `src/hooks/useRoomPresence.ts`.
 */
import { getAuthToken } from '@/lib/auth-client';

export const PRESENCE_EVENT = 'PRESENCE_UPDATED';
/** Espera antes de mostrar alguém como offline: uma queda curta de rede é saída seguida de entrada. */
export const PRESENCE_GRACE_MS = 5000;
/** Sem snapshot do WebSocket depois deste tempo, a sala consulta o REST uma vez. */
export const PRESENCE_SNAPSHOT_WAIT_MS = 3000;

/** Segmento do módulo, o mesmo que vem depois de `/ws/` e de `/api/presence/`. */
export type PresenceModule = 'poker' | 'retro' | 'brainstorming' | 'health-check' | 'showcase';

export interface PresenceUpdate {
  online: string[];
  total: number;
  version: number;
}

/** Acrescenta `presence=1` (opt-in do servidor) a uma URL de WebSocket, com `?` ou `&` conforme já houver query. */
export function withPresenceParam(url: string): string {
  if (/[?&]presence=/.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'presence=1';
}

/** Lê o payload de um `PRESENCE_UPDATED`; `null` se vier malformado (o evento é ignorado, nunca recarrega a sala). */
export function parsePresenceUpdate(message: { payload?: unknown }): PresenceUpdate | null {
  const p = message.payload as Partial<PresenceUpdate> | null | undefined;
  if (!p || !Array.isArray(p.online) || typeof p.version !== 'number' || !Number.isFinite(p.version)) return null;
  const online = p.online.filter((id): id is string => typeof id === 'string');
  return { online, total: typeof p.total === 'number' ? p.total : online.length, version: p.version };
}

export interface PresenceSessionOptions {
  onPresence?: (update: PresenceUpdate) => void;
  /** Chamado quando a conexão abriu e nenhum snapshot chegou em `waitMs` (backend antigo ou evento perdido). */
  onMissing?: () => void;
  waitMs?: number;
}

export interface PresenceSession {
  /** Nova conexão: zera a última versão vista e rearma a espera pelo snapshot (só vale quando `expectSnapshot`). */
  start(expectSnapshot?: boolean): void;
  /** Conexão encerrada: desarma a espera pelo snapshot. */
  stop(): void;
  /**
   * Filtra uma mensagem do socket. Devolve `true` quando era `PRESENCE_UPDATED` (consumida): a tela NÃO deve tratá-la,
   * senão cairia no "tipo desconhecido, recarrega tudo".
   */
  handle(message: { type?: string; payload?: unknown }): boolean;
}

/** Estado de presença de UMA conexão de WebSocket: ordem de versões e espera pelo snapshot. */
export function createPresenceSession({ onPresence, onMissing, waitMs = PRESENCE_SNAPSHOT_WAIT_MS }: PresenceSessionOptions): PresenceSession {
  let lastVersion = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    start(expectSnapshot = false) {
      lastVersion = -1;
      clear();
      if (expectSnapshot && onMissing) timer = setTimeout(() => { timer = undefined; onMissing(); }, waitMs);
    },
    stop: clear,
    handle(message) {
      if (message.type !== PRESENCE_EVENT) return false;
      const update = parsePresenceUpdate(message);
      if (!update) return true;
      clear();
      if (update.version <= lastVersion) return true;
      lastVersion = update.version;
      onPresence?.(update);
      return true;
    },
  };
}

export interface PresenceTracker {
  /** Aplica um estado completo (snapshot do socket ou resposta do REST). */
  apply(ids: readonly string[]): void;
  /** Quem está online agora; `null` enquanto o servidor não informou nada. */
  current(): ReadonlySet<string> | null;
  dispose(): void;
}

/**
 * Mantém o conjunto mostrado na tela. Entrar é imediato; sair só aparece depois de `graceMs` sem a pessoa voltar
 * (uma queda curta de rede vira "saiu + entrou" no servidor e não deve piscar na tela). O primeiro estado é aplicado
 * direto: ninguém "estava" online antes.
 */
export function createPresenceTracker(
  onChange: (online: ReadonlySet<string> | null) => void,
  graceMs: number = PRESENCE_GRACE_MS,
): PresenceTracker {
  let shown: Set<string> | null = null;
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const emit = () => onChange(shown ? new Set(shown) : null);

  return {
    apply(ids) {
      const incoming = new Set(ids);
      if (shown === null) {
        shown = incoming;
        emit();
        return;
      }
      let changed = false;
      for (const id of incoming) {
        const t = pending.get(id);
        if (t !== undefined) {
          clearTimeout(t);
          pending.delete(id);
        }
        if (!shown.has(id)) {
          shown.add(id);
          changed = true;
        }
      }
      for (const id of shown) {
        if (incoming.has(id) || pending.has(id)) continue;
        pending.set(id, setTimeout(() => {
          pending.delete(id);
          if (shown?.delete(id)) emit();
        }, graceMs));
      }
      if (changed) emit();
    },
    current: () => shown,
    dispose() {
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
      shown = null;
    },
  };
}

/** `undefined` quando a sala não sabe (sem ponto e sem "ausente" no kit); senão se a conta está online. */
export function presenceOnlineOf(online: ReadonlySet<string> | null | undefined, userId: string | undefined | null): boolean | undefined {
  if (!online) return undefined;
  return !!userId && online.has(userId);
}

export type PresenceFetchResult =
  | { status: 'ok'; online: string[] }
  /** 404 (backend antigo ou sala desconhecida), 403, 401, rede ou corpo inválido: presença continua desconhecida. */
  | { status: 'unavailable' };

/**
 * Consulta única `GET /api/presence/{module}/{roomId}`. Nunca lança e nunca dispara o "sessão expirada" global
 * (usa `fetch` com o Bearer, não `authFetch`): presença é complemento, não deve derrubar quem está na sala.
 */
export async function fetchRoomPresence(
  module: PresenceModule,
  roomId: string,
  options: { fetchImpl?: typeof fetch; apiBase?: string; token?: string | null } = {},
): Promise<PresenceFetchResult> {
  const {
    fetchImpl = typeof fetch !== 'undefined' ? fetch : undefined,
    apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api',
    token = getAuthToken(),
  } = options;
  if (!fetchImpl) return { status: 'unavailable' };
  try {
    const res = await fetchImpl(`${apiBase}/presence/${module}/${encodeURIComponent(roomId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    });
    if (!res.ok) return { status: 'unavailable' };
    const body = (await res.json()) as { online?: unknown };
    if (!body || !Array.isArray(body.online)) return { status: 'unavailable' };
    return { status: 'ok', online: body.online.filter((id): id is string => typeof id === 'string') };
  } catch {
    return { status: 'unavailable' };
  }
}
