/**
 * Tempo real do plano (E4): WebSocket com o evento `REFRESH_PLAN`. É o único lugar que conhece o caminho e o nome do
 * evento; se o backend mudar um dos dois, ajuste só as constantes abaixo.
 */
import { getAuthToken } from '@/lib/auth-client';
import { connectRoomSocket, type RoomSocketHandle } from '@/lib/room-socket';

/** Caminho do WebSocket do plano (assumido; o backend define o definitivo). */
export const PLAN_WS_PATH = '/ws/sprint-plan/';
export const REFRESH_PLAN_EVENT = 'REFRESH_PLAN';

export function planSocketUrl(planId: string, apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_SPRING_API_URL || 'http://localhost:8002/api'): string {
  return apiBase.replace(/^http/, 'ws').replace(/\/api$/, PLAN_WS_PATH) + encodeURIComponent(planId);
}

export interface PlanSocketHandlers {
  /** Alguém mexeu no plano (ou a conexão voltou depois de uma queda): recarregar. */
  onRefresh: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

/** Abre a conexão; devolve a função que encerra. Sem WebSocket no ambiente, não faz nada (a tela usa "Atualizar"). */
export function connectPlanSocket(planId: string, h: PlanSocketHandlers): RoomSocketHandle {
  return connectRoomSocket({
    buildUrl: () => planSocketUrl(planId) + '?token=' + encodeURIComponent(getAuthToken() || ''),
    onOpen: () => h.onConnectionChange?.(true),
    onClose: () => h.onConnectionChange?.(false),
    onReconnect: h.onRefresh,
    onError: () => h.onRefresh(),
    onMessage: (m) => {
      if (m.type === REFRESH_PLAN_EVENT) h.onRefresh();
    },
  });
}
