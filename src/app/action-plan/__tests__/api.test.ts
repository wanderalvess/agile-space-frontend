import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import { actionPlanApi } from '../api';
import { CeremonyApiError } from '../../../lib/ceremony-api';
import { PlanSourceConflictError } from '../../../lib/action-plan-origin';

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
  it('createBoard manda a visibilidade (isPublic) e a squad pelo ID', async () => {
    authFetch.mockResolvedValue(response(201, { id: 'p1' }));

    await actionPlanApi.createBoard({ title: 'Plano', team: 'PHOENIX', squadId: 'PHOENIX', isPublic: false, participantIds: ['u1'] });

    expect(authFetch.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ title: 'Plano', team: 'PHOENIX', squadId: 'PHOENIX', isPublic: false, participantIds: ['u1'] });
  });

  it('updateBoard manda só o que mudou, em PUT', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'p1' }));

    await actionPlanApi.updateBoard('p1', { isPublic: false });

    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/action-plans\/p1$/);
    expect(authFetch.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ isPublic: false });
  });

  it('deleteBoard apaga o plano e mostra a mensagem do servidor quando recusa', async () => {
    authFetch.mockResolvedValueOnce(response(204));
    await actionPlanApi.deleteBoard('p1');
    expect(authFetch.mock.calls[0][1].method).toBe('DELETE');

    authFetch.mockResolvedValueOnce(response(403, { message: 'Apenas o criador do plano ou um administrador pode alterá-lo.' }));
    const error = await actionPlanApi.deleteBoard('p1').catch(e => e);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Apenas o criador do plano ou um administrador pode alterá-lo.');
  });

  it('addParticipant com participantId convida outra pessoa (criador ou administrador)', async () => {
    authFetch.mockResolvedValue(response(200, { id: 'p1' }));

    await actionPlanApi.addParticipant('p1', 'u-ana');

    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/action-plans\/p1\/participants\?participantId=u-ana$/);
    expect(authFetch.mock.calls[0][1].method).toBe('POST');
  });
});

describe('actionPlanApi: origem do plano (V78)', () => {
  beforeEach(() => authFetch.mockReset());

  it('createBoard manda sourceType, sourceId e sourceTitle no corpo', async () => {
    authFetch.mockResolvedValue(response(201, { id: 'p1', sourceType: 'HEALTH_CHECK', sourceId: 'hc-1', sourceTitle: 'Sprint 42' }));

    const plan = await actionPlanApi.createBoard({ title: 'Plano', team: 'PHX', squadId: 'PHX', sourceType: 'HEALTH_CHECK', sourceId: 'hc-1', sourceTitle: 'Sprint 42' });

    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ title: 'Plano', team: 'PHX', squadId: 'PHX', sourceType: 'HEALTH_CHECK', sourceId: 'hc-1', sourceTitle: 'Sprint 42' });
    expect(plan.sourceType).toBe('HEALTH_CHECK');
  });

  it('409 na criação vira PlanSourceConflictError com existingPlanId', async () => {
    authFetch.mockResolvedValue(response(409, { error: '409 CONFLICT', message: 'Já existe um plano de ação criado a partir desta origem.', existingPlanId: 'abc-123' }));

    const error = await actionPlanApi.createBoard({ title: 'x', sourceType: 'RETRO', sourceId: 'r1' }).catch(e => e);

    expect(error).toBeInstanceOf(PlanSourceConflictError);
    expect(error).toBeInstanceOf(CeremonyApiError);
    expect(error.status).toBe(409);
    expect(error.existingPlanId).toBe('abc-123');
    expect(error.message).toBe('Já existe um plano de ação criado a partir desta origem.');
  });

  it('409 de plano privado vem sem existingPlanId (e sem corpo legível usa o texto padrão)', async () => {
    authFetch.mockResolvedValueOnce(response(409, { message: 'Já existe.' }));
    authFetch.mockResolvedValueOnce(response(409));

    const priv = await actionPlanApi.createBoard({ title: 'x' }).catch(e => e);
    const bare = await actionPlanApi.createBoard({ title: 'x' }).catch(e => e);

    expect(priv.existingPlanId).toBeUndefined();
    expect(priv.message).toBe('Já existe.');
    expect(bare).toBeInstanceOf(PlanSourceConflictError);
    expect(bare.message).toMatch(/Já existe um plano/);
  });

  it('outros erros da criação seguem como antes (403 com a mensagem do servidor)', async () => {
    authFetch.mockResolvedValue(response(403, { message: 'Sem acesso à squad.' }));

    const error = await actionPlanApi.createBoard({ title: 'x', squadId: 'OUTRA' }).catch(e => e);

    expect(error).not.toBeInstanceOf(PlanSourceConflictError);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Sem acesso à squad.');
  });

  it('listBoards com filtro monta squadId, sourceType e sourceId na consulta', async () => {
    authFetch.mockResolvedValue(response(200, []));

    await actionPlanApi.listBoards({ squadId: 'PHX', sourceType: 'HEALTH_CHECK', sourceId: 'hc-7f3a' });

    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/action-plans\?squadId=PHX&sourceType=HEALTH_CHECK&sourceId=hc-7f3a$/);
  });

  it('listBoards sem squad leva só a origem, e com texto continua sendo a lista da sprint', async () => {
    authFetch.mockResolvedValue(response(200, []));

    await actionPlanApi.listBoards({ sourceType: 'BRAINSTORMING', sourceId: 'b1' });
    await actionPlanApi.listBoards('sprint-42');
    await actionPlanApi.listBoardsBySquad('PHX');

    expect(String(authFetch.mock.calls[0][0])).toMatch(/\/action-plans\?sourceType=BRAINSTORMING&sourceId=b1$/);
    expect(String(authFetch.mock.calls[1][0])).toMatch(/\/action-plans\?sprintId=sprint-42$/);
    expect(String(authFetch.mock.calls[2][0])).toMatch(/\/action-plans\?squadId=PHX$/);
  });

  it('a lista devolve as contagens quando o servidor manda e deixa os campos ausentes quando não manda', async () => {
    authFetch.mockResolvedValueOnce(response(200, [{ id: 'a', tasksTotal: 5, tasksDone: 2, sourceType: 'RETRO' }]));
    authFetch.mockResolvedValueOnce(response(200, [{ id: 'b', title: 'Antigo' }]));

    const novo = await actionPlanApi.listBoardsBySquad('PHX');
    const antigo = await actionPlanApi.listBoardsBySquad('PHX');

    expect(novo[0]).toMatchObject({ tasksTotal: 5, tasksDone: 2, sourceType: 'RETRO' });
    expect(antigo[0].tasksTotal).toBeUndefined();
    expect(antigo[0].sourceType).toBeUndefined();
  });

  it('createTask leva sourceItemId, sourceLabel e dueDate; updateTask limpa o prazo com clearDueDate', async () => {
    authFetch.mockResolvedValue(response(200, { id: 't1' }));

    await actionPlanApi.createTask('p1', { what: 'x', sourceItemId: 'comunicacao', sourceLabel: 'Comunicação', dueDate: '2026-11-05' });
    await actionPlanApi.updateTask('t1', { clearDueDate: true });
    await actionPlanApi.updateTask('t1', { dueDate: '2026-12-01' });

    expect(JSON.parse(authFetch.mock.calls[0][1].body)).toEqual({ what: 'x', sourceItemId: 'comunicacao', sourceLabel: 'Comunicação', dueDate: '2026-11-05' });
    expect(JSON.parse(authFetch.mock.calls[1][1].body)).toEqual({ clearDueDate: true });
    expect(JSON.parse(authFetch.mock.calls[2][1].body)).toEqual({ dueDate: '2026-12-01' });
  });
});
