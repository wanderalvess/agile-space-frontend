/**
 * Quais salas entram no "Histórico do time" do relatório do Poker: a sala atual primeiro, seguida das últimas sessões
 * da squad que o servidor devolve (mais recentes antes). A lista vem do servidor, não do navegador: antes ela era o
 * `localStorage` de quem abriu o relatório, então cada pessoa via um histórico diferente (só as salas criadas ali).
 */
export const VELOCITY_MAX_SESSIONS = 8;

export function pickVelocityRoomIds(
  currentRoomId: string,
  history: ReadonlyArray<{ id?: string | null }> | null | undefined,
  max: number = VELOCITY_MAX_SESSIONS,
): string[] {
  const ids: string[] = [currentRoomId];
  for (const item of history ?? []) {
    const id = item?.id;
    if (!id || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}
