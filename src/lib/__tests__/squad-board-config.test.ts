import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyBoardConfig,
  boardConfigApi,
  clearLegacyBoardConfig,
  effectiveBoardConfig,
  normalizeBoardConfig,
  readLegacyBoardConfig,
  saveLegacyBoardConfig,
} from '../squad-board-config';
import type { GreenhopperWorkData } from '@/services/greenhopperService';

const authFetch = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

const board = (): GreenhopperWorkData =>
  ({
    rapidViewId: 1,
    columnsData: { columns: [{ id: 10, name: 'A Fazer', min: null, max: null }, { id: 11, name: 'Fazendo', min: null, max: null }] },
    swimlanesData: { swimlanes: [{ id: 104, name: 'Todo o Resto', isDefault: true }] },
    issuesData: { issues: [] },
    quickFiltersData: { quickFilters: [{ id: 1, name: 'Do Jira' }] },
  }) as unknown as GreenhopperWorkData;

const response = (status: number, body?: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as Response;

beforeEach(() => {
  authFetch.mockReset();
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('normalizeBoardConfig', () => {
  it('linha nova (tudo nulo) vira sem personalização', () => {
    expect(normalizeBoardConfig({ squadId: 'DDW', quickFilters: null, swimlanes: null, swimlaneStrategy: null, columns: null })).toEqual({
      quickFilters: null, swimlanes: null, swimlaneStrategy: null, columns: null,
    });
  });
  it('lista vazia e estratégia desconhecida não contam', () => {
    const n = normalizeBoardConfig({ quickFilters: [], swimlaneStrategy: 'zzz', columns: [{ id: 1, min: 0, max: 3 }] });
    expect(n.quickFilters).toBeNull();
    expect(n.swimlaneStrategy).toBeNull();
    expect(n.columns).toHaveLength(1);
  });
});

describe('applyBoardConfig', () => {
  it('sem personalização devolve o quadro do Jira como veio', () => {
    const data = board();
    expect(applyBoardConfig(data, {})).toBe(data);
  });
  it('troca filtros e raias e aplica o limite só nas colunas citadas', () => {
    const out = applyBoardConfig(board(), {
      quickFilters: [{ id: 9, name: 'Meus' }] as never,
      swimlanes: [{ id: 'x', name: 'Raia' }] as never,
      columns: [{ id: 11, min: 1, max: 4 }],
    });
    expect(out.quickFiltersData.quickFilters[0].name).toBe('Meus');
    expect(out.swimlanesData.swimlanes[0].name).toBe('Raia');
    expect(out.columnsData.columns[0]).toMatchObject({ id: 10, min: null, max: null });
    expect(out.columnsData.columns[1]).toMatchObject({ id: 11, min: 1, max: 4 });
  });
});

describe('chaves antigas do navegador', () => {
  it('lê o que o navegador guardou antes', () => {
    localStorage.setItem('agile_swimlane_strategy_DDW', 'epics');
    localStorage.setItem('agile_columns_DDW', JSON.stringify([{ id: 10, min: 0, max: 2 }]));
    const legacy = readLegacyBoardConfig('DDW');
    expect(legacy.swimlaneStrategy).toBe('epics');
    expect(legacy.columns).toHaveLength(1);
    expect(legacy.quickFilters).toBeNull();
  });
  it('o servidor vence; o que ele não tem cai no navegador', () => {
    localStorage.setItem('agile_swimlane_strategy_DDW', 'epics');
    localStorage.setItem('agile_columns_DDW', JSON.stringify([{ id: 10, min: 0, max: 2 }]));
    const eff = effectiveBoardConfig({ swimlaneStrategy: 'assignees', columns: null }, 'DDW');
    expect(eff.swimlaneStrategy).toBe('assignees');
    expect(eff.columns).toHaveLength(1);
  });
  it('clearLegacyBoardConfig apaga só as partes pedidas', () => {
    localStorage.setItem('agile_swimlane_strategy_DDW', 'epics');
    localStorage.setItem('agile_columns_DDW', JSON.stringify([{ id: 10, min: 0, max: 2 }]));
    clearLegacyBoardConfig('DDW', ['columns']);
    expect(localStorage.getItem('agile_columns_DDW')).toBeNull();
    expect(localStorage.getItem('agile_swimlane_strategy_DDW')).toBe('epics');
  });
});

describe('saveLegacyBoardConfig (servidor sem o recurso)', () => {
  it('guarda cada parte nas chaves antigas e apaga a que veio nula', () => {
    saveLegacyBoardConfig('DDW', { swimlaneStrategy: 'parents', columns: [{ id: 1, min: 0, max: 3 }], quickFilters: [] });
    expect(localStorage.getItem('agile_swimlane_strategy_DDW')).toBe('parents');
    expect(JSON.parse(localStorage.getItem('agile_columns_DDW') ?? '[]')).toHaveLength(1);
    saveLegacyBoardConfig('DDW', { swimlaneStrategy: null });
    expect(localStorage.getItem('agile_swimlane_strategy_DDW')).toBeNull();
  });
});

describe('boardConfigApi', () => {
  it('get: 404 (servidor antigo) e falha de rede viram null', async () => {
    authFetch.mockResolvedValueOnce(response(404));
    expect(await boardConfigApi.get('DDW')).toBeNull();
    authFetch.mockRejectedValueOnce(new Error('rede'));
    expect(await boardConfigApi.get('DDW')).toBeNull();
  });
  it('get: devolve a configuração normalizada', async () => {
    authFetch.mockResolvedValueOnce(response(200, { squadId: 'DDW', swimlaneStrategy: 'none', columns: null }));
    expect((await boardConfigApi.get('DDW'))?.swimlaneStrategy).toBe('none');
  });
  it('save: PATCH só com as partes enviadas', async () => {
    authFetch.mockResolvedValueOnce(response(200, { squadId: 'DDW', columns: [{ id: 1, min: 0, max: 3 }] }));
    const out = await boardConfigApi.save('DDW', { columns: [{ id: 1, min: 0, max: 3 }] });
    const [calledUrl, init] = authFetch.mock.calls[0];
    expect(calledUrl).toContain('/squads/DDW/board-config');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ columns: [{ id: 1, min: 0, max: 3 }] });
    expect(out.columns).toHaveLength(1);
  });
  it('save: 403 mostra o motivo que o servidor mandou', async () => {
    authFetch.mockResolvedValueOnce(response(403, { error: '403', message: 'Só a liderança da squad altera o quadro para todos.' }));
    await expect(boardConfigApi.save('DDW', { swimlaneStrategy: 'epics' })).rejects.toMatchObject({
      status: 403,
      message: 'Só a liderança da squad altera o quadro para todos.',
    });
  });
});
