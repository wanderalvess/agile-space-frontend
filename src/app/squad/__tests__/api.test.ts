import { describe, it, expect, vi, beforeEach } from 'vitest';
import { squadApi, SquadApiError } from '../api';
import * as authClient from '../../../lib/auth-client';

function response(status: number, body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  } as unknown as Response;
}

describe('squadApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('404 vira null pelo status, e erro 500 que menciona "404" no texto NÃO é engolido', async () => {
    const spy = vi.spyOn(authClient, 'authFetch');
    spy.mockResolvedValueOnce(response(404, { message: 'nada' }));
    await expect(squadApi.getSquad('SQ1')).resolves.toBeNull();

    spy.mockResolvedValueOnce(response(500, { message: 'falha ao buscar issue ABC-404 no Jira' }));
    await expect(squadApi.getSquad('SQ1')).rejects.toBeInstanceOf(SquadApiError);
  });

  it('403 chega com o status e uma frase em português', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(403, ''));
    const err = await squadApi.getMembers('SQ1').catch(e => e);
    expect(err).toBeInstanceOf(SquadApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe('Você não tem permissão para isso nesta squad.');
  });

  it('mensagem do servidor ({message}) é a que a pessoa lê', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(403, { message: 'Só a liderança da squad pode fazer isso.' }));
    await expect(squadApi.getMemberMetrics('SQ1')).rejects.toThrow('Só a liderança da squad pode fazer isso.');
  });

  it('getRollup pede a sprint escolhida (e codifica o id)', async () => {
    const spy = vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(200, { squadId: 'SQ1', sprintId: '42' }));
    await squadApi.getRollup('SQ1', '42');
    expect(spy.mock.calls[0][0]).toContain('/squads/SQ1/rollup?sprintId=42');

    await squadApi.getRollup('SQ1');
    expect(spy.mock.calls[1][0]).toMatch(/\/squads\/SQ1\/rollup$/);
  });

  it('saveSquad parcial não manda o nome (senão a chave do projeto trocaria o nome de exibição)', async () => {
    const spy = vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(200, { id: 'SQ1' }));
    await squadApi.saveSquad('SQ1', { rapidViewId: '12' } as never);
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ rapidViewId: '12', id: 'SQ1' });
    expect('name' in body).toBe(false);
  });

  it('saveSquad com nome informado envia o nome', async () => {
    const spy = vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(200, { id: 'SQ1' }));
    await squadApi.saveSquad('SQ1', { name: 'Squad Alfa' } as never);
    expect(JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string).name).toBe('Squad Alfa');
  });

  it('sync e force-resync mostram a frase do servidor', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(response(409, { message: 'Já existe uma sincronização em andamento para esta squad.' }));
    await expect(squadApi.sync('SQ1')).rejects.toThrow('Já existe uma sincronização em andamento');
    await expect(squadApi.forceResyncSprint('SQ1', '7')).rejects.toThrow('Já existe uma sincronização em andamento');
  });
});
