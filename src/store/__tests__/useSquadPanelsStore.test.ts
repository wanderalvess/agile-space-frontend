import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = {
  listPanels: vi.fn(),
  createPanel: vi.fn(),
  updatePanel: vi.fn(),
  deletePanel: vi.fn(),
};
const getJiraCredentials = vi.fn();
const runPanelQuery = vi.fn();

vi.mock('../../app/squad/api', () => {
  class SquadApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    SquadApiError,
    squadApi: {
      listPanels: (...a: unknown[]) => api.listPanels(...a),
      createPanel: (...a: unknown[]) => api.createPanel(...a),
      updatePanel: (...a: unknown[]) => api.updatePanel(...a),
      deletePanel: (...a: unknown[]) => api.deletePanel(...a),
    },
  };
});
vi.mock('../../hooks/useJiraSettings', () => ({ getJiraCredentials: (...a: unknown[]) => getJiraCredentials(...a) }));
vi.mock('../../lib/squad-panel-engine', () => ({ runPanelQuery: (...a: unknown[]) => runPanelQuery(...a) }));

import { SquadApiError } from '../../app/squad/api';
import { friendlyErrorMessage, unavailableReason, useSquadPanelsStore } from '../useSquadPanelsStore';

const record = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  squadId: 'S',
  ownerId: 'u-1',
  name: 'Fila de QA',
  type: 'table',
  visibility: 'SQUAD',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  config: JSON.stringify({ jql: 'status = QA', groupBy: 'none', aggregateMetric: 'count', ownerName: 'Elisa Prado', resultTotal: 4 }),
  ...over,
});

const input = { title: '  Bugs  ', jql: ' type = Bug ', chartType: 'number' as const, groupBy: 'none' as const, aggregateMetric: 'count' as const, visibility: 'squad' as const };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  getJiraCredentials.mockReset();
  runPanelQuery.mockReset();
  useSquadPanelsStore.getState().reset();
});

describe('fetchPanels', () => {
  it('lê os painéis, abre o blob de config e põe o mais recente primeiro', async () => {
    api.listPanels.mockResolvedValue([record({ id: 'old', updatedAt: '2026-10-01T00:00:00Z' }), record({ id: 'new', visibility: 'PRIVATE' })]);
    await useSquadPanelsStore.getState().fetchPanels('S');
    const { panels, panelsUnavailable } = useSquadPanelsStore.getState();
    expect(panelsUnavailable).toBeNull();
    expect(panels.map((p) => p.id)).toEqual(['new', 'old']);
    expect(panels[0]).toMatchObject({ title: 'Fila de QA', jql: 'status = QA', ownerName: 'Elisa Prado', visibility: 'private', resultTotal: 4 });
  });

  it.each([
    [403, 'forbidden'],
    [404, 'not_found'],
    [500, 'error'],
  ])('falha %i vira indisponível (%s) e a lista fica vazia', async (status, reason) => {
    api.listPanels.mockRejectedValue(new SquadApiError(status, 'x'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await useSquadPanelsStore.getState().fetchPanels('S');
    expect(useSquadPanelsStore.getState().panelsUnavailable).toBe(reason);
    expect(useSquadPanelsStore.getState().panels).toEqual([]);
  });

  it('erro de rede (sem status) também é "error"', () => {
    expect(unavailableReason(new Error('Failed to fetch'))).toBe('error');
  });

  it('depois de uma falha, um sucesso volta a deixar o servidor disponível', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api.listPanels.mockRejectedValueOnce(new SquadApiError(404, 'x')).mockResolvedValueOnce([]);
    await useSquadPanelsStore.getState().fetchPanels('S');
    await useSquadPanelsStore.getState().fetchPanels('S');
    expect(useSquadPanelsStore.getState().panelsUnavailable).toBeNull();
  });
});

describe('createPanel / updatePanel / deletePanel', () => {
  it('cria com SQUAD/PRIVATE, título e JQL aparados e o nome de quem criou dentro do blob', async () => {
    api.createPanel.mockResolvedValue(record({ id: 'novo', name: 'Bugs', type: 'number' }));
    const id = await useSquadPanelsStore.getState().createPanel('S', 'Elisa Prado', input);
    expect(id).toBe('novo');
    const payload = api.createPanel.mock.calls[0][1];
    expect(payload).toMatchObject({ name: 'Bugs', type: 'number', visibility: 'SQUAD' });
    expect(JSON.parse(payload.config)).toMatchObject({ jql: 'type = Bug', ownerName: 'Elisa Prado', aggregateMetric: 'count' });
    expect(useSquadPanelsStore.getState().panels[0].id).toBe('novo');

    api.createPanel.mockResolvedValue(record({ id: 'priv', visibility: 'PRIVATE' }));
    await useSquadPanelsStore.getState().createPanel('S', 'Elisa', { ...input, visibility: 'private' });
    expect(api.createPanel.mock.calls[1][1].visibility).toBe('PRIVATE');
  });

  it('falha ao criar: guarda a mensagem e relança (a tela mostra "Não foi possível salvar na squad")', async () => {
    api.createPanel.mockRejectedValue(new SquadApiError(403, 'Você não tem permissão para isso nesta squad.'));
    await expect(useSquadPanelsStore.getState().createPanel('S', 'E', input)).rejects.toBeInstanceOf(SquadApiError);
    expect(useSquadPanelsStore.getState().panelsError).toBe('Você não tem permissão para criar painéis neste squad.');
  });

  it('editar reescreve o blob inteiro sem perder os resultados já guardados', async () => {
    api.listPanels.mockResolvedValue([record()]);
    await useSquadPanelsStore.getState().fetchPanels('S');
    api.updatePanel.mockResolvedValue(record({ name: 'Outro nome' }));
    await useSquadPanelsStore.getState().updatePanel('S', 'p1', { title: 'Outro nome', jql: 'status = Done' });
    const payload = api.updatePanel.mock.calls[0][2];
    expect(payload.name).toBe('Outro nome');
    expect(JSON.parse(payload.config)).toMatchObject({ jql: 'status = Done', ownerName: 'Elisa Prado', resultTotal: 4 });
  });

  it('editar painel de outra pessoa: 403 vira a frase "Apenas o dono do painel pode editá-lo."', async () => {
    api.updatePanel.mockRejectedValue(new SquadApiError(403, 'x'));
    await expect(useSquadPanelsStore.getState().updatePanel('S', 'p1', { title: 'x' })).rejects.toBeInstanceOf(SquadApiError);
    expect(useSquadPanelsStore.getState().panelsError).toBe('Apenas o dono do painel pode editá-lo.');
  });

  it('excluir tira da lista; 403 mantém o painel', async () => {
    api.listPanels.mockResolvedValue([record({ id: 'a' }), record({ id: 'b' })]);
    await useSquadPanelsStore.getState().fetchPanels('S');
    api.deletePanel.mockResolvedValueOnce(undefined);
    await useSquadPanelsStore.getState().deletePanel('S', 'a');
    expect(useSquadPanelsStore.getState().panels.map((p) => p.id)).toEqual(['b']);

    api.deletePanel.mockRejectedValueOnce(new SquadApiError(403, 'x'));
    await expect(useSquadPanelsStore.getState().deletePanel('S', 'b')).rejects.toBeInstanceOf(SquadApiError);
    expect(useSquadPanelsStore.getState().panels.map((p) => p.id)).toEqual(['b']);
    expect(useSquadPanelsStore.getState().panelsError).toBe('Apenas o dono do painel pode excluí-lo.');
  });
});

describe('runPanel', () => {
  beforeEach(async () => {
    api.listPanels.mockResolvedValue([record()]);
    await useSquadPanelsStore.getState().fetchPanels('S');
  });

  it('roda a JQL com o token da própria pessoa e grava o resultado na squad', async () => {
    getJiraCredentials.mockResolvedValue({ domain: 'jira.exemplo.com', token: 't' });
    runPanelQuery.mockResolvedValue({ resultTotal: 9 });
    api.updatePanel.mockResolvedValue(record({ config: JSON.stringify({ jql: 'status = QA', groupBy: 'none', aggregateMetric: 'count', ownerName: 'Elisa Prado', resultTotal: 9, lastRunAt: '2026-10-16T17:00:00Z' }) }));
    await useSquadPanelsStore.getState().runPanel('S', 'p1', 'u-1');
    expect(getJiraCredentials).toHaveBeenCalledWith('u-1');
    expect(runPanelQuery).toHaveBeenCalledWith({ domain: 'jira.exemplo.com', token: 't' }, { jql: 'status = QA', chartType: 'table', groupBy: 'none', aggregateMetric: 'count' });
    expect(useSquadPanelsStore.getState().panels[0].resultTotal).toBe(9);
    expect(useSquadPanelsStore.getState().runningIds.size).toBe(0);
  });

  it('sem token do Jira: grava o erro no painel, relança e libera o "atualizando"', async () => {
    getJiraCredentials.mockResolvedValue(null);
    api.updatePanel.mockResolvedValue(record());
    await expect(useSquadPanelsStore.getState().runPanel('S', 'p1', 'u-1')).rejects.toThrow(/Token de Acesso do Jira/);
    expect(runPanelQuery).not.toHaveBeenCalled();
    expect(useSquadPanelsStore.getState().panels[0].lastRunError).toMatch(/Token de Acesso do Jira/);
    expect(useSquadPanelsStore.getState().runningIds.size).toBe(0);
  });
});

describe('friendlyErrorMessage', () => {
  it('reconhece o 403 pelo status e pelo texto', () => {
    expect(friendlyErrorMessage(new SquadApiError(403, 'x'), 'sem permissão')).toBe('sem permissão');
    expect(friendlyErrorMessage(new Error('Squad API error 403: x'), 'sem permissão')).toBe('sem permissão');
    expect(friendlyErrorMessage(new Error('falhou'), 'sem permissão')).toBe('falhou');
    expect(friendlyErrorMessage({}, 'sem permissão')).toBe('Erro ao comunicar com o servidor.');
  });
});
