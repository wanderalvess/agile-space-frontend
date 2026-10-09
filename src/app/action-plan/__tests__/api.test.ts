import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { actionPlanApi } from '../api';
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

describe('actionPlanApi', () => {
  beforeEach(() => authFetch.mockReset());

  it('updateTask manda só o campo editado (edição parcial)', async () => {
    authFetch.mockResolvedValue(response(200, { id: 't1' }));

    await actionPlanApi.updateTask('t1', { who: 'Ana' });

    expect(authFetch.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ who: 'Ana' });
  });

  it('addParticipant não manda participantId: entra quem está logado', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'p1' }));

    await actionPlanApi.addParticipant('p1');

    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/action-plans\/p1\/participants$/);
  });

  it('plano inexistente e plano sem acesso são distinguíveis pelo status', async () => {
    authFetch.mockResolvedValueOnce(response(404, { message: 'Plano de ação não encontrado.' }));
    authFetch.mockResolvedValueOnce(response(403, { message: 'Acesso restrito a participantes deste board.' }));

    const notFound = await actionPlanApi.getBoardById('x').catch(e => e);
    const forbidden = await actionPlanApi.getBoardById('y').catch(e => e);

    expect(notFound).toBeInstanceOf(CeremonyApiError);
    expect(notFound.status).toBe(404);
    expect(forbidden.status).toBe(403);
    expect(forbidden.message).toBe('Acesso restrito a participantes deste board.');
  });

  it('erro de validação mostra a mensagem do servidor ao salvar tarefa', async () => {
    authFetch.mockResolvedValue(response(400, { message: 'O campo "O quê" é obrigatório.' }));

    const error = await actionPlanApi.createTask('p1', { what: '' }).catch(e => e);

    expect(error.message).toBe('O campo "O quê" é obrigatório.');
  });

  it('queda do servidor (5xx) usa o texto padrão', async () => {
    authFetch.mockResolvedValue(response(500));

    const error = await actionPlanApi.listTasks('p1').catch(e => e);

    expect(error.message).toBe('Falha ao listar tarefas do plano de ação');
  });
});
