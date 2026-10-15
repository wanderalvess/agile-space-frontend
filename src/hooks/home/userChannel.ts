/**
 * Canal do usuário (`/ws/user?token=`, docs/home-api.md §4): o servidor só manda sinais
 * ({ type: NOTIFICATION | MESSAGE | ANNOUNCEMENT | UNREAD, conversationId? }) e o cliente refaz o GET.
 * Reconecta com backoff; o polling das listas (a cada 60 s) continua valendo como rede de segurança.
 */

export interface UserChannelSignal {
  type: string;
  conversationId?: string;
}

export interface UserChannelOptions {
  /** Monta a URL a cada tentativa (o token é relido: numa sessão longa o antigo expira). */
  buildUrl: () => string;
  onSignal: (signal: UserChannelSignal) => void;
  WebSocketImpl?: typeof WebSocket;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export function buildUserChannelUrl(token: string | null, apiBase: string): string {
  const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '/ws/user');
  return `${wsBase}?token=${encodeURIComponent(token || '')}`;
}

/** Abre o canal e devolve a função que o encerra. Sem WebSocket no ambiente, não faz nada. */
export function startUserChannel(options: UserChannelOptions): () => void {
  const {
    buildUrl,
    onSignal,
    WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : undefined,
    baseDelayMs = 1500,
    maxDelayMs = 30_000,
  } = options;
  if (!WebSocketImpl) return () => {};

  let stopped = false;
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let hadConnection = false;

  const schedule = () => {
    if (stopped) return;
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    attempt += 1;
    timer = setTimeout(connect, delay);
  };

  function connect() {
    if (stopped) return;
    try {
      socket = new WebSocketImpl!(buildUrl());
    } catch {
      schedule();
      return;
    }
    socket.onopen = () => {
      attempt = 0;
      // Sinais perdidos durante a queda não voltam: reconectou, relê.
      if (hadConnection) onSignal({ type: 'UNREAD' });
      hadConnection = true;
    };
    socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        onSignal({
          type: typeof data?.type === 'string' ? data.type : 'UNREAD',
          conversationId: typeof data?.conversationId === 'string' ? data.conversationId : undefined,
        });
      } catch {
        onSignal({ type: 'UNREAD' });
      }
    };
    socket.onclose = () => schedule();
    socket.onerror = () => {
      /* o close vem em seguida e agenda a reconexão */
    };
  }

  connect();

  return () => {
    stopped = true;
    clearTimeout(timer);
    try {
      socket?.close();
    } catch {
      /* já fechado */
    }
  };
}
