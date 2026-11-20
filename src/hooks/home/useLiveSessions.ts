'use client';

import { fetchLiveSessions } from './sources';
import type { SquadRef, ToolSession } from './types';
import { useHomeResource } from './useHomeResource';

const NONE: ToolSession[] = [];
/** Uma sala criada agora precisa aparecer em poucos segundos; a consulta é leve (uma chamada por ritual no servidor). */
const REFRESH_MS = 15_000;

/**
 * Sessões abertas agora (ao vivo, assíncronas ou aguardando o início) nas squads informadas: `GET /api/live-sessions`,
 * com as listas de cada ritual como reserva (ver `sources.fetchLiveSessions`). Atualiza a cada 15 s e ao voltar para
 * a aba. Falha de qualquer ritual/squad apenas some da lista.
 */
export function useLiveSessions(squads: SquadRef[]) {
  const key = squads.map((s) => s.id).join(',');
  return useHomeResource(() => fetchLiveSessions(squads), `live:${key}`, NONE, {
    enabled: squads.length > 0,
    intervalMs: REFRESH_MS,
    refetchOnFocus: true,
  });
}
