import { describe, it, expect } from 'vitest';
import { roomLobbyStatus, wantsNewSession, stripNewSessionParam } from '../poker-lobby';

describe('lobby do poker', () => {
  it('status da sala: aguardando, em andamento, encerrada', () => {
    expect(roomLobbyStatus({})).toBe('waiting');
    expect(roomLobbyStatus({ sessionStartedAt: '2026-01-01T10:00:00Z' })).toBe('live');
    expect(roomLobbyStatus({ sessionStartedAt: '2026-01-01T10:00:00Z', sessionEndedAt: '2026-01-01T11:00:00Z' })).toBe('ended');
  });

  it('?nova=1 abre o diálogo; qualquer outro valor não', () => {
    expect(wantsNewSession('?nova=1')).toBe(true);
    expect(wantsNewSession('?x=2&nova=1')).toBe(true);
    expect(wantsNewSession('?nova=0')).toBe(false);
    expect(wantsNewSession('')).toBe(false);
  });

  it('limpa só o parâmetro nova da URL', () => {
    expect(stripNewSessionParam('/room', '?nova=1')).toBe('/room');
    expect(stripNewSessionParam('/room', '?a=1&nova=1', '#x')).toBe('/room?a=1#x');
  });
});
