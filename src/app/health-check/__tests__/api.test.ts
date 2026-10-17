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

describe('healthCheckApi: rotas do backend novo', () => {
  beforeEach(() => authFetch.mockReset());

  it('getProgress devolve os dados; a lista de pendentes só existe para o facilitador', async () => {
    authFetch.mockResolvedValue(response(200, { boardId: 'hc1', participantsCount: 3, respondedCount: 1, completedCount: 0, pendingParticipantIds: ['u2'] }));
    const result = await healthCheckApi.getProgress('hc1');
    expect(result).toEqual({ status: 'ok', data: expect.objectContaining({ respondedCount: 1, pendingParticipantIds: ['u2'] }) });
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/health-checks\/hc1\/progress$/);
  });

  it('getProgress em backend antigo (404/405) é "indisponível", sem lançar', async () => {
    authFetch.mockResolvedValueOnce(response(404, { message: 'Not Found' }));
    expect(await healthCheckApi.getProgress('hc1')).toEqual({ status: 'unavailable' });
    authFetch.mockResolvedValueOnce(response(405));
    expect(await healthCheckApi.getProgress('hc1')).toEqual({ status: 'unavailable' });
  });

  it('getProgress com erro de servidor lança (a tela só registra e tenta na próxima mudança)', async () => {
    authFetch.mockResolvedValue(response(500, { message: 'x' }));
    await expect(healthCheckApi.getProgress('hc1')).rejects.toBeInstanceOf(CeremonyApiError);
  });

  it('setPresentationStage faz PUT com a etapa', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'hc1', presentationStage: 'radar' }));
    const result = await healthCheckApi.setPresentationStage('hc1', 'radar');
    expect(result.status).toBe('ok');
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/health-checks\/hc1\/presentation$/);
    expect(authFetch.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ stage: 'radar' });
  });

  it('clearPresentationStage faz DELETE', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'hc1', presentationStage: null }));
    expect((await healthCheckApi.clearPresentationStage('hc1')).status).toBe('ok');
    expect(authFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('apresentação: 404/405 = indisponível; 403 = sem permissão; 409 (radar ainda aberto) lança com a mensagem do servidor', async () => {
    authFetch.mockResolvedValueOnce(response(404));
    expect(await healthCheckApi.setPresentationStage('hc1', 'radar')).toEqual({ status: 'unavailable' });
    authFetch.mockResolvedValueOnce(response(405));
    expect(await healthCheckApi.clearPresentationStage('hc1')).toEqual({ status: 'unavailable' });
    authFetch.mockResolvedValueOnce(response(403, { message: 'Só o facilitador.' }));
    expect(await healthCheckApi.setPresentationStage('hc1', 'radar')).toEqual({ status: 'forbidden' });
    authFetch.mockResolvedValueOnce(response(409, { message: 'O radar ainda não foi encerrado.' }));
    const error = await healthCheckApi.setPresentationStage('hc1', 'radar').catch((e) => e);
    expect(error).toBeInstanceOf(CeremonyApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('O radar ainda não foi encerrado.');
  });

  it('resposta 200 sem corpo na apresentação não quebra', async () => {
    authFetch.mockResolvedValue(response(200));
    expect(await healthCheckApi.clearPresentationStage('hc1')).toEqual({ status: 'ok', data: null });
  });
});
