import { createPresenceSession, withPresenceParam, type PresenceUpdate } from './room-presence';

export interface RoomSocketOptions {
  /** Monta a URL a cada tentativa (o token é relido: numa sessão longa o antigo expira e a reconexão nunca voltaria). */
  buildUrl: () => string;
  onMessage: (data: { type?: string; payload?: unknown; [key: string]: unknown }) => void;
  /** Chamado ao reconectar depois de uma queda: eventos perdidos não voltam sozinhos, a tela precisa recarregar. */
  onReconnect: () => void;
  /**
   * Chamado em TODA conexão aberta, inclusive a primeira (antes de `onReconnect`, que só vale depois de uma queda).
   * Serve a telas cujo primeiro handshake pode ser recusado antes de a pessoa virar participante: o que
   * aconteceu até a conexão firmar precisa ser recarregado.
   */
  onOpen?: () => void;
  /**
   * Chamado quando a conexão cai (sem ser o fechamento deliberado), já com o tempo até a próxima tentativa. A tela
   * usa para mostrar "Reconectando… nova tentativa em N s" em vez de uma sala que parece viva e não recebe nada.
   */
  onClose?: (info: { attempt: number; retryInMs: number }) => void;
  /** Mensagem que não é JSON válido ou handler que lançou: a tela recarrega tudo por segurança. */
  onError?: (error: unknown) => void;
  /**
   * Pede ao servidor a presença da sala (`presence=1` na URL). O servidor passa a enviar `PRESENCE_UPDATED`
   * (snapshot logo na abertura e a cada mudança). Um backend antigo ignora o parâmetro e nunca envia o evento.
   */
  presence?: boolean;
  /**
   * Estado completo de quem está online (`online` = ids das contas). Só chega versão MAIOR que a última vista
   * nesta conexão; a versão é zerada a cada nova conexão. `PRESENCE_UPDATED` nunca chega a `onMessage`.
   */
  onPresence?: (update: PresenceUpdate) => void;
  /** Com `presence`, chamado quando a conexão abriu e nenhum snapshot veio em `presenceWaitMs` (a tela usa o REST). */
  onPresenceMissing?: () => void;
  presenceWaitMs?: number;
  /**
   * Pede o evento `PRESENTATION_STAGE` (`presentation=1` na URL): a etapa da apresentação publicada pelo
   * facilitador. Backend antigo ignora o parâmetro e nunca envia o evento.
   */
  presentation?: boolean;
  /**
   * Liga o "escrevendo…" (`typing=1` na URL): a sessão passa a poder enviar `TYPING` (via `send`) e a receber o
   * de quem digita. Backend antigo ignora o parâmetro e nunca envia o evento.
   */
  typing?: boolean;
  WebSocketImpl?: typeof WebSocket;
  /** Atraso inicial da reconexão (ms); cresce até `maxDelayMs`. */
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/** Acrescenta `nome=1` (opt-in do servidor) à URL de um WebSocket, com `?` ou `&` conforme já houver query. */
export function withFlagParam(url: string, name: string): string {
  if (new RegExp(`[?&]${name}=`).test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + name + '=1';
}

/** O que `connectRoomSocket` devolve: chamar encerra tudo (como antes); `send` manda uma mensagem se a conexão estiver aberta. */
export type RoomSocketHandle = (() => void) & {
  /** Envia JSON (ou texto) pela conexão atual. Devolve `false` se não há conexão aberta (a mensagem é descartada, sem fila). */
  send: (message: unknown) => boolean;
};

/**
 * Conexão de sala com reconexão automática (backoff) e ressincronização. Retorna a função que encerra tudo
 * (com `send` anexado, para as telas que falam com o servidor, como o "escrevendo…").
 * O fechamento deliberado (desmontar a tela) nunca agenda reconexão.
 */
export function connectRoomSocket(options: RoomSocketOptions): RoomSocketHandle {
  const {
    buildUrl, onMessage, onReconnect, onOpen, onClose, onError, presence = false, onPresence, onPresenceMissing, presenceWaitMs,
    presentation = false, typing = false,
    WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : undefined,
    baseDelayMs = 1500, maxDelayMs = 15000,
  } = options;
  if (!WebSocketImpl) return Object.assign(() => {}, { send: () => false });

  let stopped = false;
  let socket: WebSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hadConnection = false;
  let attempt = 0;
  // O evento de presença é consumido aqui, mesmo sem opt-in: as telas tratam tipo desconhecido como "recarrega tudo".
  const presenceSession = createPresenceSession({ onPresence, onMissing: onPresenceMissing, waitMs: presenceWaitMs });

  const connect = () => {
    if (stopped) return;
    presenceSession.start(false);
    try {
      let url = buildUrl();
      if (presence) url = withPresenceParam(url);
      if (presentation) url = withFlagParam(url, 'presentation');
      if (typing) url = withFlagParam(url, 'typing');
      socket = new WebSocketImpl(url);
    } catch (error) {
      onError?.(error);
      schedule();
      return;
    }
    socket.onopen = () => {
      attempt = 0;
      if (presence) presenceSession.start(true);
      onOpen?.();
      if (hadConnection) onReconnect();
      hadConnection = true;
    };
    socket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (presenceSession.handle(message)) return;
        onMessage(message);
      } catch (error) {
        onError?.(error);
      }
    };
    socket.onclose = () => {
      presenceSession.stop();
      if (!stopped) {
        const retryInMs = schedule();
        onClose?.({ attempt, retryInMs });
      }
    };
    socket.onerror = () => {
      // o close vem em seguida e agenda a reconexão
    };
  };

  const schedule = (): number => {
    if (stopped) return 0;
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    attempt += 1;
    timer = setTimeout(connect, delay);
    return delay;
  };

  connect();

  const send = (message: unknown): boolean => {
    const current = socket;
    // 1 = OPEN (o valor é o mesmo em toda implementação; a constante estática pode não existir num WebSocket de teste)
    if (stopped || !current || current.readyState !== 1) return false;
    try {
      current.send(typeof message === 'string' ? message : JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  };

  const close = () => {
    stopped = true;
    presenceSession.stop();
    clearTimeout(timer);
    try {
      socket?.close();
    } catch { /* já fechado */ }
  };

  return Object.assign(close, { send });
}
