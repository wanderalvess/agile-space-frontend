export interface RoomSocketOptions {
  /** Monta a URL a cada tentativa (o token é relido: numa sessão longa o antigo expira e a reconexão nunca voltaria). */
  buildUrl: () => string;
  onMessage: (data: { type?: string; payload?: unknown; [key: string]: unknown }) => void;
  /** Chamado ao reconectar depois de uma queda: eventos perdidos não voltam sozinhos, a tela precisa recarregar. */
  onReconnect: () => void;
  /** Mensagem que não é JSON válido ou handler que lançou: a tela recarrega tudo por segurança. */
  onError?: (error: unknown) => void;
  WebSocketImpl?: typeof WebSocket;
  /** Atraso inicial da reconexão (ms); cresce até `maxDelayMs`. */
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Conexão de sala com reconexão automática (backoff) e ressincronização. Retorna a função que encerra tudo.
 * O fechamento deliberado (desmontar a tela) nunca agenda reconexão.
 */
export function connectRoomSocket(options: RoomSocketOptions): () => void {
  const {
    buildUrl, onMessage, onReconnect, onError,
    WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : undefined,
    baseDelayMs = 1500, maxDelayMs = 15000,
  } = options;
  if (!WebSocketImpl) return () => {};

  let stopped = false;
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hadConnection = false;
  let attempt = 0;

  const connect = () => {
    if (stopped) return;
    try {
      socket = new WebSocketImpl(buildUrl());
    } catch (error) {
      onError?.(error);
      schedule();
      return;
    }
    socket.onopen = () => {
      attempt = 0;
      if (hadConnection) onReconnect();
      hadConnection = true;
    };
    socket.onmessage = (event: MessageEvent) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch (error) {
        onError?.(error);
      }
    };
    socket.onclose = () => {
      if (!stopped) schedule();
    };
    socket.onerror = () => {
      // o close vem em seguida e agenda a reconexão
    };
  };

  const schedule = () => {
    if (stopped) return;
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    attempt += 1;
    timer = setTimeout(connect, delay);
  };

  connect();

  return () => {
    stopped = true;
    clearTimeout(timer);
    try {
      socket?.close();
    } catch { /* já fechado */ }
  };
}
