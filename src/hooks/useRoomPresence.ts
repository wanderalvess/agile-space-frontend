'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PRESENCE_GRACE_MS,
  createPresenceTracker,
  fetchRoomPresence,
  type PresenceModule,
  type PresenceTracker,
  type PresenceUpdate,
} from '@/lib/room-presence';

export interface UseRoomPresenceOptions {
  module: PresenceModule;
  /** Id da sala/quadro/sessão (o segmento que vem depois do módulo na URL do WebSocket). */
  roomId: string | undefined;
  /** Atraso antes de mostrar alguém como offline (queda curta de rede = saída seguida de entrada). */
  graceMs?: number;
  /** Para teste. */
  fetchImpl?: typeof fetch;
}

export interface RoomPresenceBindings {
  /** Passe como `presence` ao `connectRoomSocket` (acrescenta `presence=1` à URL). */
  presence: true;
  onPresence: (update: PresenceUpdate) => void;
  /** Sem snapshot do WebSocket em ~3 s: consulta o REST uma única vez. */
  onPresenceMissing: () => void;
}

export interface RoomPresence {
  /**
   * Contas (userId) com a sala aberta agora. `null` = o servidor não informa (backend antigo, ainda sem snapshot,
   * REST 404): a tela mostra como antes, só o total, sem ponto de online e sem "ausente".
   */
  online: ReadonlySet<string> | null;
  /** Espalhe em `connectRoomSocket({ ...presence.bindings })` ou use com `createPresenceSession` num socket próprio. Estável. */
  bindings: RoomPresenceBindings;
}

/**
 * Presença de uma sala. Guarda o último estado completo vindo do servidor e só mostra alguém como offline depois de
 * `graceMs` (5 s) sem a pessoa voltar; entrar é imediato. Trocar de sala zera tudo para `null`.
 */
export function useRoomPresence({ module, roomId, graceMs = PRESENCE_GRACE_MS, fetchImpl }: UseRoomPresenceOptions): RoomPresence {
  // O estado carrega a chave da sala: ao trocar de sala o valor antigo deixa de valer (volta a `null`) sem efeito extra.
  const roomKey = `${module}/${roomId ?? ''}`;
  const [state, setState] = useState<{ key: string; online: ReadonlySet<string> | null }>({ key: roomKey, online: null });
  const online = state.key === roomKey ? state.online : null;
  const trackerRef = useRef<PresenceTracker | null>(null);
  const gotSocketSnapshot = useRef(false);
  const restTried = useRef(false);

  useEffect(() => {
    const tracker = createPresenceTracker((next) => setState({ key: roomKey, online: next }), graceMs);
    trackerRef.current = tracker;
    gotSocketSnapshot.current = false;
    restTried.current = false;
    return () => {
      tracker.dispose();
      if (trackerRef.current === tracker) trackerRef.current = null;
    };
  }, [roomKey, graceMs]);

  const onPresence = useCallback((update: PresenceUpdate) => {
    gotSocketSnapshot.current = true;
    trackerRef.current?.apply(update.online);
  }, []);

  const onPresenceMissing = useCallback(() => {
    // Uma consulta por sala: 404 (backend antigo) ou qualquer falha deixa a presença desconhecida, sem repetir.
    if (!roomId || restTried.current || gotSocketSnapshot.current) return;
    restTried.current = true;
    const tracker = trackerRef.current;
    void fetchRoomPresence(module, roomId, { fetchImpl }).then((result) => {
      if (result.status !== 'ok') return;
      // Um snapshot do WebSocket que chegou enquanto o REST respondia é mais novo que a resposta.
      if (gotSocketSnapshot.current || trackerRef.current !== tracker) return;
      tracker?.apply(result.online);
    });
  }, [module, roomId, fetchImpl]);

  const bindings = useMemo<RoomPresenceBindings>(() => ({ presence: true, onPresence, onPresenceMissing }), [onPresence, onPresenceMissing]);

  return useMemo(() => ({ online, bindings }), [online, bindings]);
}
