/** Situação de uma sala na lista do lobby, derivada do que o servidor já devolve. */
export type RoomLobbyStatus = 'ended' | 'live' | 'waiting';

export function roomLobbyStatus(room: { sessionStartedAt?: string | null; sessionEndedAt?: string | null }): RoomLobbyStatus {
  if (room.sessionEndedAt) return 'ended';
  if (room.sessionStartedAt) return 'live';
  return 'waiting';
}

export const ROOM_LOBBY_STATUS_LABEL: Record<RoomLobbyStatus, string> = {
  ended: 'Encerrada',
  live: 'Em andamento',
  waiting: 'Aguardando',
};

/** Aceita "?nova=1" (a Home linka /room?nova=1 para abrir o diálogo de nova sessão). */
export function wantsNewSession(search: string): boolean {
  return new URLSearchParams(search).get('nova') === '1';
}

/** Mesma URL sem o parâmetro "nova", preservando os demais. */
export function stripNewSessionParam(pathname: string, search: string, hash = ''): string {
  const params = new URLSearchParams(search);
  params.delete('nova');
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ''}${hash}`;
}
