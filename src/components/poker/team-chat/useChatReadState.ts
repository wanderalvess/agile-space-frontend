'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from './chatChannels';

type ReadMap = Record<string, string>;

const SINCE_KEY = '__since';

function storageKey(roomId: string, uid: string) {
  return `poker-chat-read:${roomId}:${uid}`;
}

function persist(key: string, map: ReadMap) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Sem storage (aba anônima/bloqueio): o estado segue só em memória.
  }
}

// Última mensagem lida por canal, por pessoa e por sala. Canal sem registro
// usa como corte a PRIMEIRA entrada nesta sala (guardada em __since) — senão
// todo o histórico anterior viraria "não lido", e um reload zeraria o que
// chegou e ainda não foi aberto.
function loadReadMap(key: string): ReadMap {
  let map: ReadMap = {};
  try {
    const raw = localStorage.getItem(key);
    if (raw) map = JSON.parse(raw);
  } catch {
    map = {};
  }
  if (!map[SINCE_KEY]) {
    map = { ...map, [SINCE_KEY]: new Date().toISOString() };
    persist(key, map);
  }
  return map;
}

export function useChatReadState(roomId: string, uid: string) {
  const key = storageKey(roomId, uid);
  const [baseline] = useState(() => new Date().toISOString());
  const [readMap, setReadMap] = useState<ReadMap>({});

  useEffect(() => {
    setReadMap(loadReadMap(key));
  }, [key]);

  const markRead = useCallback((channelId: string, ts: string) => {
    setReadMap(prev => {
      if (prev[channelId] && prev[channelId] >= ts) return prev;
      const next = { ...prev, [channelId]: ts };
      persist(key, next);
      return next;
    });
  }, [key]);

  const unreadCount = useCallback((channelId: string, messages: ChatMessage[] | undefined) => {
    if (!messages) return 0;
    const cutoff = readMap[channelId] ?? readMap[SINCE_KEY] ?? baseline;
    return messages.filter(m => m.senderId !== uid && m.ts > cutoff).length;
  }, [readMap, baseline, uid]);

  return { markRead, unreadCount };
}
