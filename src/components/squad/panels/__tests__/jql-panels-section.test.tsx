import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = { listPanels: vi.fn(), createPanel: vi.fn(), updatePanel: vi.fn(), deletePanel: vi.fn() };
const getJiraCredentials = vi.fn();
const toast = vi.fn();
const runPanelQuery = vi.fn();

vi.mock('../../../../app/squad/api', () => {
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
vi.mock('../../../../hooks/useJiraSettings', () => ({ getJiraCredentials: (...a: unknown[]) => getJiraCredentials(...a) }));
vi.mock('../../../../hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('../../../../lib/squad-panel-engine', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/squad-panel-engine')>('../../../../lib/squad-panel-engine');
  return { ...actual, runPanelQuery: (...a: unknown[]) => runPanelQuery(...a) };
});

import { SquadApiError } from '../../../../app/squad/api';
import type { SquadIssueSnapshot } from '../../../../lib/types';
import { useSquadPanelsStore } from '../../../../store/useSquadPanelsStore';
import { JqlPanelsSection } from '../jql/JqlPanelsSection';

const snap = (key: string, over: Partial<SquadIssueSnapshot> = {}) =>
  ({ key, jiraKey: key, title: `Título ${key}`, type: 'Bug', isBug: true, status: 'Open', statusCategory: 'new', assigneeName: 'Ana', estimateSec: 0, remainingSec: 0, loggedSec: 0, parentKey: '', parentTitle: '', ...over }) as SquadIssueSnapshot;
const squadIssues = [snap('DDW-1'), snap('DDW-2', { status: 'Done', statusCategory: 'done' })];

const serverRecord = (over: Record<string, unknown> = {}) => ({
  id: 's1', squadId: 'DDWMISSI', ownerId: 'u-elisa', name: 'Fila de QA da Elisa', type: 'number', visibility: 'SQUAD',
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z',
  config: JSON.stringify({ jql: 'status = QA', groupBy: 'none', aggregateMetric: 'count', ownerName: 'Elisa Prado', resultTotal: 4, lastRunAt: '2026-10-16T17:32:00' }),
  ...over,
});

function mount(userId = 'u-ana') {
  return render(<JqlPanelsSection squadId="DDWMISSI" userId={userId} userName="Ana Ribeiro" squadIssues={squadIssues} issuesReady />);
}

const KEY = 'agileSpace_custom_panels_DDWMISSI';

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.listPanels.mockResolvedValue([]);
  getJiraCredentials.mockReset();
  getJiraCredentials.mockResolvedValue(null); // sem token do Jira: cai na aproximação
  runPanelQuery.mockReset();
  toast.mockReset();
  localStorage.clear();
  useSquadPanelsStore.getState().reset();
});
afterEach(() => cleanup());

const openNew = () => fireEvent.click(screen.getByRole('button', { name: /Criar painel JQL/ }));

describe('aba de consultas JQL', () => {
  it('sem nada salvo mostra os 4 modelos, já consultados, e diz onde estão salvos', async () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Painéis personalizados por JQL (consultas ad-hoc)' })).toBeTruthy();
    for (const t of ['Bugs bloqueantes (Highest / High)', 'Distribuição da sprint por status', 'Itens por responsável no momento', 'Fila de homologação e testes (QA)']) {
      expect(screen.getByRole('heading', { name: t })).toBeTruthy();
    }
    // o modelo não nasce com zero: roda uma vez (aqui, aproximação com as issues da squad)
    await waitFor(() => expect(screen.getAllByText(/^Atualizado às /).length).toBe(4));
    expect(screen.getAllByText(/Aproximação: o Jira não respondeu/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Neste navegador').length).toBe(4);
    expect(screen.queryByText(/Persistência/i)).toBeNull();
    // e já fica salvo
    await waitFor(() => expect(JSON.parse(localStorage.getItem(KEY) || '[]')).toHaveLength(4));
  });

  it('com o Jira respondendo, o número vem do Jira e não é aproximação', async () => {
    getJiraCredentials.mockResolvedValue({ domain: 'jira.exemplo.com', token: 't' });
    runPanelQuery.mockResolvedValue({ resultTotal: 7, resultRows: [{ label: 'Open', value: 7 }], resultIssues: [] });
    mount();
    await waitFor(() => expect(screen.getAllByText(/^Atualizado às /).length).toBe(4));
    expect(screen.queryByText(/Aproximação: o Jira não respondeu/)).toBeNull();
    expect(screen.getAllByText('7').length).toBeGreaterThan(0);
  });

  it('painéis salvos no navegador antes (formato antigo) continuam aparecendo', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', title: 'Meu painel antigo', jql: 'project = DDWMISSI', chartType: 'number', visibility: 'squad', resultTotal: 3, lastUpdated: '10:15' }]));
    mount();
    expect(await screen.findByRole('heading', { name: 'Meu painel antigo' })).toBeTruthy();
    expect(screen.getByText('Atualizado às 10:15')).toBeTruthy();
    expect(runPanelQuery).not.toHaveBeenCalled();
  });

  it('cria um painel no navegador, consulta e guarda', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', title: 'Existente', jql: 'x', chartType: 'number', visibility: 'squad', resultTotal: 1, lastUpdated: '10:00' }]));
    mount();
    await screen.findByRole('heading', { name: 'Existente' });
    openNew();
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Título do painel'), { target: { value: 'Bugs abertos' } });
    fireEvent.change(within(dialog).getByLabelText('Consulta JQL do Jira'), { target: { value: 'project = DDWMISSI AND type = Bug' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar painel' }));
    expect(await screen.findByRole('heading', { name: 'Bugs abertos' })).toBeTruthy();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(KEY) || '[]').map((p: { title: string }) => p.title)).toEqual(['Bugs abertos', 'Existente']));
    expect(api.createPanel).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Painel salvo' }));
  });

  it('título ou JQL vazios: avisa e não fecha', async () => {
    mount();
    openNew();
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar painel' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Campos obrigatórios', variant: 'destructive' })));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('exclui com confirmação', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', title: 'Para excluir', jql: 'x', chartType: 'number', visibility: 'squad', resultTotal: 1, lastUpdated: '10:00' }]));
    mount();
    await screen.findByRole('heading', { name: 'Para excluir' });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Para excluir' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm.textContent).toContain('sai deste navegador');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Excluir painel' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Para excluir' })).toBeNull());
    expect(JSON.parse(localStorage.getItem(KEY) || '[]')).toEqual([]);
  });
});

describe('painéis da squad (servidor)', () => {
  it('mostra painéis de outras pessoas sem ações, com "Criado por", e os meus com ações', async () => {
    api.listPanels.mockResolvedValue([serverRecord(), serverRecord({ id: 's2', ownerId: 'u-ana', name: 'Meu painel na squad' })]);
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', title: 'Local', jql: 'x', chartType: 'number', visibility: 'squad', resultTotal: 1, lastUpdated: '10:00' }]));
    mount('u-ana');
    expect(await screen.findByRole('heading', { name: 'Fila de QA da Elisa' })).toBeTruthy();
    expect(screen.getByText('Criado por Elisa Prado')).toBeTruthy();
    expect(screen.getByText('Criado por você')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editar Fila de QA da Elisa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir Fila de QA da Elisa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Atualizar Fila de QA da Elisa' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar Meu painel na squad' })).toBeTruthy();
    expect(screen.getAllByText('Na squad').length).toBe(2);
    expect(screen.getByText('Na squad: 2')).toBeTruthy();
    expect(screen.getByText('Neste navegador: 1')).toBeTruthy();
  });

  it('cria na squad quando a pessoa escolhe "No servidor da squad"', async () => {
    api.createPanel.mockResolvedValue(serverRecord({ id: 'novo', ownerId: 'u-ana', name: 'Bugs da squad' }));
    api.updatePanel.mockResolvedValue(serverRecord({ id: 'novo', ownerId: 'u-ana', name: 'Bugs da squad' }));
    getJiraCredentials.mockResolvedValue({ domain: 'jira.exemplo.com', token: 't' });
    runPanelQuery.mockResolvedValue({ resultTotal: 2 });
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', title: 'Local', jql: 'x', chartType: 'number', visibility: 'squad', resultTotal: 1, lastUpdated: '10:00' }]));
    mount('u-ana');
    await screen.findByRole('heading', { name: 'Local' });
    openNew();
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Título do painel'), { target: { value: 'Bugs da squad' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: /No servidor da squad/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar painel' }));
    await waitFor(() => expect(api.createPanel).toHaveBeenCalled());
    const payload = api.createPanel.mock.calls[0][1];
    expect(payload).toMatchObject({ name: 'Bugs da squad', visibility: 'SQUAD' });
    expect(JSON.parse(payload.config)).toMatchObject({ ownerName: 'Ana Ribeiro' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Painel compartilhado com a squad' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it.each([
    [404, /ainda não guarda painéis da squad/],
    [403, /não liberou painéis da squad para você/],
  ])('servidor responde %i: a opção da squad fica desligada e o painel vai para o navegador', async (status, text) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api.listPanels.mockRejectedValue(new SquadApiError(status as number, 'x'));
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', title: 'Local', jql: 'x', chartType: 'number', visibility: 'squad', resultTotal: 1, lastUpdated: '10:00' }]));
    mount();
    await screen.findByRole('heading', { name: 'Local' });
    await waitFor(() => expect(useSquadPanelsStore.getState().panelsUnavailable).not.toBeNull());
    openNew();
    const dialog = await screen.findByRole('dialog');
    const radio = within(dialog).getByRole('radio', { name: /No servidor da squad/ }) as HTMLButtonElement;
    expect(radio.disabled).toBe(true);
    expect(radio.textContent).toMatch(text);
    // o navegador continua funcionando
    fireEvent.change(within(dialog).getByLabelText('Título do painel'), { target: { value: 'Só aqui' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar painel' }));
    expect(await screen.findByRole('heading', { name: 'Só aqui' })).toBeTruthy();
    expect(api.createPanel).not.toHaveBeenCalled();
  });

  it('falha ao salvar na squad: avisa com a mensagem do servidor e mantém o modal aberto', async () => {
    api.createPanel.mockRejectedValue(new SquadApiError(500, 'Banco fora do ar'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', title: 'Local', jql: 'x', chartType: 'number', visibility: 'squad', resultTotal: 1, lastUpdated: '10:00' }]));
    mount();
    await screen.findByRole('heading', { name: 'Local' });
    openNew();
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Título do painel'), { target: { value: 'X' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: /No servidor da squad/ }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar painel' }));
    });
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível salvar na squad', description: 'Banco fora do ar' })));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('painel da squad cujo Jira falhou mostra o erro no cartão', async () => {
    api.listPanels.mockResolvedValue([
      serverRecord({ id: 's9', ownerId: 'u-ana', name: 'Com erro', config: JSON.stringify({ jql: 'x', groupBy: 'none', aggregateMetric: 'count', ownerName: 'Ana', lastRunError: 'Token expirado' }) }),
    ]);
    localStorage.setItem(KEY, JSON.stringify([{ id: 'p1', title: 'Local', jql: 'x', chartType: 'number', visibility: 'squad', resultTotal: 1, lastUpdated: '10:00' }]));
    mount('u-ana');
    expect(await screen.findByText(/A última atualização falhou: Token expirado/)).toBeTruthy();
  });
});
