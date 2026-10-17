import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { retroApi, RetroApiError } from '../api';

function response(status: number, body?: unknown, asText = false) {
  const text = body === undefined ? '' : asText ? String(body) : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => (text ? JSON.parse(text) : undefined),
  } as Response;
}

describe('retroApi', () => {
  beforeEach(() => authFetch.mockReset());

  it('deleteCard falha quando o servidor recusa (antes resolvia em silêncio)', async () => {
    authFetch.mockResolvedValue(response(403, { message: 'Acesso restrito a participantes deste board.' }));
    await expect(retroApi.deleteCard('b1', 'c1')).rejects.toMatchObject({
      name: 'RetroApiError',
      status: 403,
      message: 'Acesso restrito a participantes deste board.',
    });
  });

  it('removeParticipant e importActions também lançam em erro', async () => {
    authFetch.mockResolvedValue(response(500));
    await expect(retroApi.removeParticipant('b1', 'u1')).rejects.toBeInstanceOf(RetroApiError);
    await expect(retroApi.importActions('b1', [])).rejects.toBeInstanceOf(RetroApiError);
  });

  it('toggleVote devolve a mensagem de limite do servidor (409)', async () => {
    authFetch.mockResolvedValue(response(409, { message: 'Você já usou seus 3 votos neste painel.' }));
    const error = await retroApi.toggleVote('b1', 'c1').catch(e => e);
    expect(error).toBeInstanceOf(RetroApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('Você já usou seus 3 votos neste painel.');
  });

  it('erro 5xx não vaza o corpo cru: usa o texto padrão da chamada', async () => {
    authFetch.mockResolvedValue(response(500, { message: 'org.hibernate.exception.ConstraintViolationException ...' }));
    await expect(retroApi.patchBoard('b1', { title: 'x' })).rejects.toMatchObject({
      status: 500,
      message: 'Falha ao atualizar o quadro',
    });
  });

  it('corpo HTML de erro não vira mensagem', async () => {
    authFetch.mockResolvedValue(response(404, '<html>Not Found</html>', true));
    await expect(retroApi.getBoard('nope')).rejects.toMatchObject({
      status: 404,
      message: 'Falha ao carregar o quadro de retrospectiva',
    });
  });

  it('sucesso devolve o JSON; vote e patch usam os caminhos novos', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'c1', votes: ['u1'] }));
    const card = await retroApi.toggleVote('b1', 'c1');
    expect(card.votes).toEqual(['u1']);
    expect(authFetch).toHaveBeenCalledWith(expect.stringMatching(/\/retros\/b1\/cards\/c1\/vote$/), { method: 'POST' });

    authFetch.mockResolvedValue(response(200, { id: 'b1' }));
    await retroApi.patchBoard('b1', { title: 'Novo' });
    expect(authFetch).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/retros\/b1$/),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: 'Novo' }) })
    );
  });
});

describe('retroApi: encerrar e reabrir (backend novo)', () => {
  beforeEach(() => authFetch.mockReset());

  it('finishBoard faz POST em /finish e devolve o quadro', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'b1', lifecycleStatus: 'FINISHED', finishedAt: '2026-10-17T15:00:00' }));
    const board = await retroApi.finishBoard('b1');
    expect(board.lifecycleStatus).toBe('FINISHED');
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/retros\/b1\/finish$/);
    expect(authFetch.mock.calls[0][1].method).toBe('POST');
  });

  it('reopenBoard faz POST em /reopen', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'b1', lifecycleStatus: 'OPEN', finishedAt: null }));
    await retroApi.reopenBoard('b1');
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/retros\/b1\/reopen$/);
  });

  it('deleteBoard faz DELETE no quadro e lança com a mensagem do servidor quando não pode', async () => {
    authFetch.mockResolvedValueOnce(response(204, null));
    await retroApi.deleteBoard('b1');
    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/retros\/b1$/);
    expect(authFetch.mock.calls[0][1].method).toBe('DELETE');
    authFetch.mockResolvedValueOnce(response(403, { message: 'Só o criador apaga a retro.' }));
    const error = await retroApi.deleteBoard('b1').catch((e) => e);
    expect(error.message).toBe('Só o criador apaga a retro.');
  });

  it('403 (não é facilitador) lança com a mensagem do servidor', async () => {
    authFetch.mockResolvedValue(response(403, { message: 'Só o facilitador pode encerrar a retro.' }));
    const error = await retroApi.finishBoard('b1').catch((e) => e);
    expect(error).toBeInstanceOf(RetroApiError);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Só o facilitador pode encerrar a retro.');
  });

  it('404/405 (backend antigo) lançam com o texto padrão, sem vazar corpo cru', async () => {
    authFetch.mockResolvedValue(response(405, '<html>nope</html>', true));
    const error = await retroApi.reopenBoard('b1').catch((e) => e);
    expect(error).toBeInstanceOf(RetroApiError);
    expect(error.status).toBe(405);
    expect(error.message).toBe('Não foi possível reabrir a retro');
  });

  it('escrever em retro encerrada (409) devolve a mensagem do servidor em cartão, voto, fusão e importação', async () => {
    const message = 'Esta retrospectiva foi encerrada. Só o facilitador pode alterá-la.';
    authFetch.mockResolvedValue(response(409, { message }));
    await expect(retroApi.saveOrUpdateCard('b1', { id: 'c1' })).rejects.toMatchObject({ status: 409, message });
    await expect(retroApi.toggleVote('b1', 'c1')).rejects.toMatchObject({ status: 409, message });
    await expect(retroApi.mergeCards('b1', 'c1', 'c2')).rejects.toMatchObject({ status: 409, message });
    await expect(retroApi.importActions('b1', [])).rejects.toMatchObject({ status: 409, message });
    await expect(retroApi.deleteCard('b1', 'c1')).rejects.toMatchObject({ status: 409, message });
  });

  it('o check-in leva a nota só quando existe (campo ausente não apaga no servidor)', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'u1' }));
    await retroApi.addOrUpdateParticipant('b1', { id: 'u1', checkinNote: 'Dia puxado' });
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toMatchObject({ checkinNote: 'Dia puxado' });
  });
});
