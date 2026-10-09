import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workItemsApi } from '../../app/work-items-api';
import * as authClient from '../../lib/auth-client';

describe('workItemsApi - Cliente HTTP de Integração com Backend de Work Items', () => {

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve buscar work items da squad com a URL correta', async () => {
    const mockData = [{ id: 'SQ1_CARD-1', jiraKey: 'CARD-1', status: 'To Do' }];
    vi.spyOn(authClient, 'authFetch').mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as any);

    const result = await workItemsApi.getWorkItems('SQ1');

    expect(authClient.authFetch).toHaveBeenCalledWith(expect.stringContaining('/work-items/SQ1'));
    expect(result).toEqual(mockData);
  });

  it('deve lançar erro quando getWorkItems falhar', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    await expect(workItemsApi.getWorkItems('SQ1')).rejects.toThrow('Falha ao carregar work items da squad');
  });

  it('deve enviar requisição de estimativa com pontos serializados em JSON', async () => {
    const fetchSpy = vi.spyOn(authClient, 'authFetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);

    await workItemsApi.estimateWorkItem('SQ1', 'DDW-100', 5.0);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/work-items/SQ1/DDW-100/estimate'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ points_estimated: 5.0 }),
      })
    );
  });

  it('deve enviar requisição de commit com sprint_id serializado em JSON', async () => {
    const fetchSpy = vi.spyOn(authClient, 'authFetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);

    await workItemsApi.commitWorkItem('SQ1', 'DDW-100', 'SPRINT-45');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/work-items/SQ1/DDW-100/commit'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ sprint_id: 'SPRINT-45' }),
      })
    );
  });

  it('deve enviar decisão de showcase com status e feedback serializados', async () => {
    const fetchSpy = vi.spyOn(authClient, 'authFetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);

    await workItemsApi.showcaseDecision('SQ1', 'DDW-100', 'delivered', 'Aprovado pelo PO sem ressalvas');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/work-items/SQ1/DDW-100/showcase-decision'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ status: 'delivered', feedback: 'Aprovado pelo PO sem ressalvas' }),
      })
    );
  });

  it('deve recuperar estatísticas de velocidade da sprint', async () => {
    const mockStats = { velocityReal: 8.0, previsto: 13.0, entregue: 8.0, carryOvers: 1 };
    vi.spyOn(authClient, 'authFetch').mockResolvedValue({
      ok: true,
      json: async () => mockStats,
    } as any);

    const result = await workItemsApi.getSprintStats('SQ1', 'SPRINT-45');

    expect(authClient.authFetch).toHaveBeenCalledWith(
      expect.stringContaining('/work-items/SQ1/sprint/SPRINT-45/stats')
    );
    expect(result).toEqual(mockStats);
  });
});

describe('workItemsApi - mensagem de erro do servidor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('mostra a frase do servidor quando ele recusa (ex.: estimativa inválida)', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Estimativa inválida: use um número entre 0 e 1000.' }),
    } as any);

    await expect(workItemsApi.estimateWorkItem('SQ1', 'DDW-1', -3)).rejects.toThrow('Estimativa inválida: use um número entre 0 e 1000.');
  });

  it('codifica squad e chave na URL', async () => {
    const spy = vi.spyOn(authClient, 'authFetch').mockResolvedValue({ ok: true, json: async () => ({}) } as any);

    await workItemsApi.estimateWorkItem('Squad Geral', 'DDW-1', 3);

    expect(spy.mock.calls[0][0]).toContain('/work-items/Squad%20Geral/DDW-1/estimate');
  });
});
