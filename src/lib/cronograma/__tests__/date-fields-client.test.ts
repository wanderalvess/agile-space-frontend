import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
let networkDown = false;
vi.mock('../../auth-client', () => ({
  authFetch: (...a: unknown[]) => (networkDown ? Promise.reject(new TypeError('Failed to fetch')) : authFetch(...a)),
}));

import { JiraDateFieldsError, getJiraDateFields, saveJiraDateFields } from '../date-fields-client';

const json = (status: number, body?: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

beforeEach(() => {
  authFetch.mockReset();
  networkDown = false;
});

describe('getJiraDateFields', () => {
  it('lê o contrato do servidor e completa o que faltar', async () => {
    authFetch.mockResolvedValue(json(200, {
      startFieldId: 'customfield_1', endFieldId: null, startFieldName: 'Data e Hora de Início', endFieldName: null, autoDetected: true,
      candidates: { start: [{ id: 'customfield_1', name: 'Data e Hora de Início' }], end: [] },
      sample: { total: 17, startFilled: 0, endFilled: 0 },
    }));
    const r = await getJiraDateFields('DDW MISSI');
    expect(authFetch.mock.calls[0][0]).toMatch(/\/squads\/DDW%20MISSI\/jira-date-fields$/);
    expect(r).toMatchObject({ available: true, data: { startFieldId: 'customfield_1', endFieldId: null, autoDetected: true, warning: null } });
    if (r.available) expect(r.data.sample.total).toBe(17);
  });

  it('404 vira "recurso ainda não disponível", sem lançar erro', async () => {
    authFetch.mockResolvedValue(json(404));
    expect(await getJiraDateFields('S')).toEqual({ available: false, reason: 'not-found' });
  });

  it('falha de rede também não quebra a tela', async () => {
    networkDown = true;
    expect(await getJiraDateFields('S')).toEqual({ available: false, reason: 'network' });
  });

  it('outros erros HTTP são lançados com o status', async () => {
    authFetch.mockResolvedValue(json(500, { message: 'Falhou' }));
    await expect(getJiraDateFields('S')).rejects.toMatchObject({ status: 500, name: 'JiraDateFieldsError' });
  });
});

describe('saveJiraDateFields', () => {
  it('envia PUT com os dois ids (null limpa a escolha)', async () => {
    authFetch.mockResolvedValue(json(204));
    expect(await saveJiraDateFields('S', { startFieldId: 'customfield_1', endFieldId: null })).toBeNull();
    const [url, init] = authFetch.mock.calls[0];
    expect(url).toMatch(/\/squads\/S\/jira-date-fields$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ startFieldId: 'customfield_1', endFieldId: null });
  });

  it('devolve a configuração quando o servidor responde com corpo', async () => {
    authFetch.mockResolvedValue(json(200, { startFieldId: 'a', endFieldId: 'b', autoDetected: false }));
    const r = await saveJiraDateFields('S', { startFieldId: 'a', endFieldId: 'b' });
    expect(r).toMatchObject({ startFieldId: 'a', endFieldId: 'b', autoDetected: false });
  });

  it('403 lança erro com a mensagem de permissão', async () => {
    authFetch.mockResolvedValue({ ok: false, status: 403, json: async () => { throw new Error('vazio'); } } as unknown as Response);
    const err = await saveJiraDateFields('S', { startFieldId: null, endFieldId: null }).catch((e) => e);
    expect(err).toBeInstanceOf(JiraDateFieldsError);
    expect(err.message).toMatch(/permissão/);
  });
});
