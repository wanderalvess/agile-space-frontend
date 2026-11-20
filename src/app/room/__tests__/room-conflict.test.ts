import { afterEach, describe, expect, it, vi } from 'vitest';
import * as authClient from '../../../lib/auth-client';
import { pokerApi, RoomConflictError, ROOM_CONFLICT_EVENT } from '../api';

const response = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

describe('pokerApi.saveOrUpdateRoom — conflito de versão (409)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('devolve a sala salva quando o backend aceita', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(201, { id: 'r1', version: 3 }));
    await expect(pokerApi.saveOrUpdateRoom({ id: 'r1', version: 2 })).resolves.toMatchObject({ version: 3 });
  });

  it('lança RoomConflictError e avisa a página com o id da sala quando recebe 409', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(409, { error: 'CONFLICT' }));
    const listener = vi.fn();
    window.addEventListener(ROOM_CONFLICT_EVENT, listener);

    await expect(pokerApi.saveOrUpdateRoom({ id: 'r1', version: 1 })).rejects.toBeInstanceOf(RoomConflictError);

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ roomId: 'r1' });
    window.removeEventListener(ROOM_CONFLICT_EVENT, listener);
  });

  it('outros erros continuam sendo erros comuns, sem disparar o aviso de conflito', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(500));
    const listener = vi.fn();
    window.addEventListener(ROOM_CONFLICT_EVENT, listener);

    const error = await pokerApi.saveOrUpdateRoom({ id: 'r1' }).catch(e => e);

    expect(error).not.toBeInstanceOf(RoomConflictError);
    expect(error).toBeInstanceOf(Error);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(ROOM_CONFLICT_EVENT, listener);
  });
});
