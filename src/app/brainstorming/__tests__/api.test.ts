import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { brainstormingApi } from '../api';
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

describe('brainstormingApi', () => {
  beforeEach(() => authFetch.mockReset());

  it('toggleVote chama o endpoint atômico de voto (sem mandar a lista de votos)', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'i1', votes: ['u1'] }));

    const idea = await brainstormingApi.toggleVote('b1', 'i1');

    expect(idea.votes).toEqual(['u1']);
    const [url, init] = authFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/brainstormings\/b1\/ideas\/i1\/vote$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('mergeIdeas usa destino e origem na URL (fusão única no servidor)', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'alvo' }));

    await brainstormingApi.mergeIdeas('b1', 'alvo', 'origem');

    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/ideas\/alvo\/merge\/origem$/);
  });

  it('patchIdea e patchBoard enviam PATCH só com os campos informados', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'x' }));

    await brainstormingApi.patchIdea('b1', 'i1', { groupId: null });
    await brainstormingApi.patchBoard('b1', { settings: { isRevealed: true } });

    expect(authFetch.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ groupId: null });
    expect(authFetch.mock.calls[1][1].method).toBe('PATCH');
    expect(JSON.parse(authFetch.mock.calls[1][1].body)).toEqual({ settings: { isRevealed: true } });
  });

  it('erro do servidor vira CeremonyApiError com a mensagem em português (antes era "Falha ao ...")', async () => {
    authFetch.mockResolvedValue(response(403, { message: 'Apenas o facilitador pode alterar a sessão.' }));

    const error = await brainstormingApi.patchBoard('b1', { phase: 'grouping' }).catch(e => e);

    expect(error).toBeInstanceOf(CeremonyApiError);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Apenas o facilitador pode alterar a sessão.');
  });

  it('exclusões também lançam quando o servidor recusa (antes o grupo/ideia "sumia" só na tela)', async () => {
    authFetch.mockResolvedValue(response(403, { message: 'Só o autor da ideia ou o facilitador podem apagá-la.' }));

    await expect(brainstormingApi.deleteIdea('b1', 'i1')).rejects.toMatchObject({ status: 403 });
    await expect(brainstormingApi.deleteGroup('b1', 'g1')).rejects.toBeInstanceOf(CeremonyApiError);
  });

  it('falha 5xx usa o texto padrão da chamada', async () => {
    authFetch.mockResolvedValue(response(500, { message: 'stack' }));

    const error = await brainstormingApi.saveOrUpdateIdea('b1', { content: 'x' }).catch(e => e);

    expect(error.message).toBe('Não foi possível salvar a ideia');
  });
});
