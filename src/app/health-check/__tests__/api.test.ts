import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { healthCheckApi } from '../api';
import { CeremonyApiError } from '../../../lib/ceremony-api';

function response(status: number, body?: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => (text ? JSON.parse(text) : undefined),
  } as Response;
}

describe('healthCheckApi', () => {
  beforeEach(() => authFetch.mockReset());

  it('saveVote envia só dimensão, valor e comentário (quem vota e a hora são do servidor)', async () => {
    authFetch.mockResolvedValue(response(201, { id: 'v1' }));

    await healthCheckApi.saveVote('hc1', { dimensionKey: 'speed', value: 'green', comment: 'ok' });

    const body = JSON.parse(authFetch.mock.calls[0][1].body);
    expect(body).toEqual({ dimensionKey: 'speed', value: 'green', comment: 'ok' });
    expect(body).not.toHaveProperty('participantId');
  });

  it('getVotes não pede votos de outra pessoa', async () => {
    authFetch.mockResolvedValue(response(200, []));

    await healthCheckApi.getVotes('hc1');

    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/health-checks\/hc1\/votes$/);
  });

  it('finishBoard usa o endpoint de encerramento do servidor', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'hc1', status: 'finished' }));

    const board = await healthCheckApi.finishBoard('hc1');

    expect(board.status).toBe('finished');
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/health-checks\/hc1\/finish$/);
    expect(authFetch.mock.calls[0][1].method).toBe('POST');
  });

  it('votar com a votação encerrada devolve a mensagem do servidor (409)', async () => {
    authFetch.mockResolvedValue(response(409, { message: 'A votação deste radar já foi encerrada.' }));

    const error = await healthCheckApi.saveVote('hc1', { dimensionKey: 'speed', value: 'red' }).catch(e => e);

    expect(error).toBeInstanceOf(CeremonyApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('A votação deste radar já foi encerrada.');
  });

  it('deleteBoard e leaveBoard agora lançam quando falham (antes ignoravam a resposta)', async () => {
    authFetch.mockResolvedValue(response(403, { message: 'Apenas o organizador pode apagar o radar.' }));

    await expect(healthCheckApi.deleteBoard('hc1')).rejects.toMatchObject({ status: 403 });
    await expect(healthCheckApi.leaveBoard('hc1', 'u1')).rejects.toBeInstanceOf(CeremonyApiError);
  });
});
