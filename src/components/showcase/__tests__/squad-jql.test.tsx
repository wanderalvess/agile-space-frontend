import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ShowcaseJqlQuery } from '../types';

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  api: { listSquadJql: vi.fn(), saveSquadJql: vi.fn(), deleteSquadJql: vi.fn() },
  saved: [] as Array<{ id: string; label: string; jql: string; isPublic: boolean; createdBy?: string; createdAt: string }>,
  saveLocal: vi.fn(),
  deleteLocal: vi.fn(),
}));

vi.mock('../../../app/showcase/api', () => ({
  showcaseApi: h.api,
  isUnavailableError: (e: unknown) => [404, 405, 501].includes((e as { status?: number })?.status ?? 0),
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../hooks/useJiraSettings', () => ({ useJiraSettings: () => ({ settings: { domain: 'jira.exemplo.com', token: 'tok' }, saveSettings: vi.fn() }) }));
vi.mock('../../../hooks/useSavedJqls', () => ({ useSavedJqls: () => ({ savedJqls: h.saved, saveJql: h.saveLocal, deleteJql: h.deleteLocal }) }));
vi.mock('../../../services/jiraService', () => ({
  parseJiraXml: vi.fn(), fetchJiraIssues: vi.fn(), enrichWithCodificacaoChildren: vi.fn(), enrichWithParentContext: vi.fn(),
}));

import { orderSquadJqls, squadJqlErrorMessage, squadJqlTitle, validateSquadJql } from '../squad-jql';
import { useSquadJqls } from '../useSquadJqls';
import { JiraImportDialog } from '../../shared/JiraImportDialog';

const q = (id: string, over: Partial<ShowcaseJqlQuery> = {}): ShowcaseJqlQuery => ({
  id, squadId: 'DDW', name: `Consulta ${id}`, jql: `project = ${id}`, visibility: 'SQUAD', createdBy: 'u1', createdByName: 'Ana Souza',
  createdAt: '2026-10-17T14:00:00', mine: true, canDelete: true, ...over,
});
const httpError = (status: number, body: Record<string, unknown> | null = null) => Object.assign(new Error(`erro ${status}`), { status, body });

afterEach(() => {
  cleanup();
  Object.values(h.api).forEach((fn) => fn.mockReset());
  h.toast.mockReset();
  h.saveLocal.mockReset();
  h.deleteLocal.mockReset();
  h.saved.length = 0;
});

describe('regras da consulta da squad', () => {
  it('ordena do mais recente para o mais antigo e ignora linha sem nome ou texto', () => {
    const list = orderSquadJqls([q('a', { createdAt: '2026-10-01T10:00:00' }), q('b', { createdAt: '2026-10-03T10:00:00' }), q('c', { name: ' ' }), q('d', { jql: '' })]);
    expect(list.map((x) => x.id)).toEqual(['b', 'a']);
    expect(orderSquadJqls(null)).toEqual([]);
  });

  it('dica do chip: visibilidade, quem criou e o texto', () => {
    expect(squadJqlTitle(q('a'))).toBe('Da squad · criada por você\nproject = a');
    expect(squadJqlTitle(q('a', { mine: false, visibility: 'PRIVATE' }))).toBe('Só minha · criada por Ana Souza\nproject = a');
    expect(squadJqlTitle(q('a', { mine: false, createdByName: null }))).toContain('criada por outra pessoa');
  });

  it('valida nome e texto com os limites do servidor', () => {
    expect(validateSquadJql('Sprint', 'project = X')).toBeNull();
    expect(validateSquadJql(' ', 'project = X')).toBe('Dê um nome à consulta.');
    expect(validateSquadJql('x'.repeat(121), 'project = X')).toContain('120');
    expect(validateSquadJql('Sprint', ' ')).toBe('Preencha a consulta JQL.');
    expect(validateSquadJql('Sprint', 'x'.repeat(4001))).toContain('4000');
  });

  it('mensagem de erro: usa a do servidor e cai numa padrão', () => {
    expect(squadJqlErrorMessage(httpError(409, { message: 'Você já tem uma consulta com esse nome.' }), 'x')).toBe('Você já tem uma consulta com esse nome.');
    expect(squadJqlErrorMessage(httpError(409), 'x')).toContain('Já existe');
    expect(squadJqlErrorMessage(httpError(403), 'x')).toContain('permissão');
    expect(squadJqlErrorMessage(httpError(500), 'padrão')).toBe('padrão');
  });
});

describe('consultas da squad (hook)', () => {
  it('lista as da squad quando o backend responde', async () => {
    h.api.listSquadJql.mockResolvedValue([q('a'), q('b')]);
    const { result } = renderHook(() => useSquadJqls('DDW', true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(h.api.listSquadJql).toHaveBeenCalledWith('DDW');
    expect(result.current.items).toHaveLength(2);
  });

  it('404 e 405 (backend antigo) ficam indisponíveis, sem erro', async () => {
    h.api.listSquadJql.mockRejectedValue(httpError(404));
    const { result, unmount } = renderHook(() => useSquadJqls('DDW', true));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    unmount();
    h.api.listSquadJql.mockRejectedValue(httpError(405));
    const again = renderHook(() => useSquadJqls('DDW', true));
    await waitFor(() => expect(again.result.current.status).toBe('unavailable'));
  });

  it('403 (não lê esta squad) também esconde; falha de rede mostra "tentar de novo"', async () => {
    h.api.listSquadJql.mockRejectedValue(httpError(403));
    const a = renderHook(() => useSquadJqls('DDW', true));
    await waitFor(() => expect(a.result.current.status).toBe('unavailable'));
    h.api.listSquadJql.mockRejectedValue(httpError(500));
    const b = renderHook(() => useSquadJqls('DDW', true));
    await waitFor(() => expect(b.result.current.status).toBe('error'));
  });

  it('não consulta o servidor com o diálogo fechado nem sem squad', async () => {
    renderHook(() => useSquadJqls('DDW', false));
    const { result } = renderHook(() => useSquadJqls(undefined, true));
    expect(h.api.listSquadJql).not.toHaveBeenCalled();
    expect(result.current.status).toBe('unavailable');
  });

  it('salvar acrescenta no topo; erro do servidor volta como mensagem', async () => {
    h.api.listSquadJql.mockResolvedValue([q('a')]);
    const { result } = renderHook(() => useSquadJqls('DDW', true));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    h.api.saveSquadJql.mockResolvedValueOnce(q('novo', { createdAt: '2026-10-18T10:00:00' }));
    let res: { ok: boolean } = { ok: false };
    await act(async () => { res = await result.current.save(' Nova ', ' project = N ', 'SQUAD'); });
    expect(res.ok).toBe(true);
    expect(h.api.saveSquadJql).toHaveBeenCalledWith({ squadId: 'DDW', name: 'Nova', jql: 'project = N', visibility: 'SQUAD' });
    expect(result.current.items.map((x) => x.id)).toEqual(['novo', 'a']);

    h.api.saveSquadJql.mockRejectedValueOnce(httpError(409, { message: 'Você já tem uma consulta com esse nome.' }));
    await act(async () => { res = await result.current.save('Nova', 'x', 'PRIVATE'); });
    expect(res).toEqual({ ok: false, message: 'Você já tem uma consulta com esse nome.' });
  });

  it('apagar remove da lista; se já não existe (404) some do mesmo jeito', async () => {
    h.api.listSquadJql.mockResolvedValue([q('a'), q('b')]);
    const { result } = renderHook(() => useSquadJqls('DDW', true));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    h.api.deleteSquadJql.mockResolvedValueOnce(undefined);
    await act(async () => { await result.current.remove('a'); });
    expect(result.current.items.map((x) => x.id)).toEqual(['b']);
    h.api.deleteSquadJql.mockRejectedValueOnce(httpError(404));
    await act(async () => { await result.current.remove('b'); });
    expect(result.current.items).toEqual([]);
    h.api.deleteSquadJql.mockRejectedValueOnce(httpError(403));
    let res: { ok: boolean } = { ok: true };
    await act(async () => { res = await result.current.remove('x'); });
    expect(res.ok).toBe(false);
  });
});

describe('Importar do Jira com JQL da squad', () => {
  beforeAll(() => {
    class RO { observe() {} unobserve() {} disconnect() {} }
    (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
    window.matchMedia = window.matchMedia || ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null }) as MediaQueryList);
  });

  const open = () => render(<JiraImportDialog open onClose={() => {}} onImport={() => {}} squadJql={{ squadId: 'DDW', label: 'Missões' }} />);
  const local = { id: 'l1', label: 'Meus bugs', jql: 'assignee = currentUser()', isPublic: false, createdBy: 'Ana', createdAt: '2026-10-01T10:00:00' };

  it('mostra "Da squad" ao lado das consultas deste navegador e o texto honesto', async () => {
    h.saved.push(local);
    h.api.listSquadJql.mockResolvedValue([q('a', { name: 'Review da sprint' }), q('b', { name: 'Minha', visibility: 'PRIVATE' })]);
    open();
    expect(await screen.findByText('Review da sprint')).toBeTruthy();
    expect(screen.getByText('Da squad')).toBeTruthy();
    expect(screen.getByText('Neste navegador')).toBeTruthy();
    expect(screen.getByText('Meus bugs')).toBeTruthy();
    expect(screen.getByText(/só o texto da consulta é compartilhado/i)).toBeTruthy();
  });

  it('clicar numa consulta da squad preenche a JQL', async () => {
    h.api.listSquadJql.mockResolvedValue([q('a', { name: 'Review da sprint', jql: 'sprint in openSprints()' })]);
    open();
    fireEvent.click(await screen.findByText('Review da sprint'));
    expect((screen.getByLabelText('Consulta JQL') as HTMLTextAreaElement).value).toBe('sprint in openSprints()');
  });

  it('backend antigo (404): só as consultas deste navegador, sem rótulos nem erro', async () => {
    h.saved.push(local);
    h.api.listSquadJql.mockRejectedValue(httpError(404));
    open();
    expect(await screen.findByText('Meus bugs')).toBeTruthy();
    await waitFor(() => expect(h.api.listSquadJql).toHaveBeenCalled());
    expect(screen.queryByText('Da squad')).toBeNull();
    expect(screen.queryByText('Neste navegador')).toBeNull();
    expect(screen.queryByText(/Não foi possível carregar as consultas da squad/)).toBeNull();
  });

  it('só mostra apagar nas consultas que a pessoa pode apagar', async () => {
    h.api.listSquadJql.mockResolvedValue([q('a', { name: 'Minha', canDelete: true }), q('b', { name: 'Do colega', mine: false, canDelete: false })]);
    open();
    await screen.findByText('Minha');
    expect(screen.getByLabelText('Excluir a consulta da squad Minha')).toBeTruthy();
    expect(screen.queryByLabelText('Excluir a consulta da squad Do colega')).toBeNull();
    h.api.deleteSquadJql.mockResolvedValue(undefined);
    fireEvent.click(screen.getByLabelText('Excluir a consulta da squad Minha'));
    await waitFor(() => expect(h.api.deleteSquadJql).toHaveBeenCalledWith('a'));
    await waitFor(() => expect(screen.queryByText('Minha')).toBeNull());
  });

  it('salvar na squad com visibilidade Squad ou Privada; as locais continuam funcionando', async () => {
    h.api.listSquadJql.mockResolvedValue([]);
    open();
    await screen.findByText('Nenhuma consulta salva para a squad.');
    fireEvent.change(screen.getByLabelText('Consulta JQL'), { target: { value: 'project = DDW' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar JQL/ }));
    const dialog = await screen.findByRole('dialog', { name: /Salvar consulta JQL/ });
    fireEvent.change(within(dialog).getByLabelText('Nome do filtro'), { target: { value: 'Sprint DDW' } });
    expect(within(dialog).getByText('Na squad Missões')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /Só minha/ }));
    h.api.saveSquadJql.mockResolvedValue(q('novo', { name: 'Sprint DDW', visibility: 'PRIVATE' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar filtro' }));
    await waitFor(() => expect(h.api.saveSquadJql).toHaveBeenCalledWith({ squadId: 'DDW', name: 'Sprint DDW', jql: 'project = DDW', visibility: 'PRIVATE' }));
    expect(h.saveLocal).not.toHaveBeenCalled();
    expect(await screen.findByText('Sprint DDW')).toBeTruthy();
  });

  it('salvar neste navegador segue igual (privada), sem tocar no servidor', async () => {
    h.api.listSquadJql.mockResolvedValue([]);
    open();
    await screen.findByText('Nenhuma consulta salva para a squad.');
    fireEvent.change(screen.getByLabelText('Consulta JQL'), { target: { value: 'project = DDW' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar JQL/ }));
    const dialog = await screen.findByRole('dialog', { name: /Salvar consulta JQL/ });
    fireEvent.change(within(dialog).getByLabelText('Nome do filtro'), { target: { value: 'Local' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar filtro' }));
    await waitFor(() => expect(h.saveLocal).toHaveBeenCalledWith({ label: 'Local', jql: 'project = DDW', isPublic: false }));
    expect(h.api.saveSquadJql).not.toHaveBeenCalled();
  });

  it('erro do servidor ao salvar na squad fica no formulário e não fecha', async () => {
    h.api.listSquadJql.mockResolvedValue([]);
    open();
    await screen.findByText('Nenhuma consulta salva para a squad.');
    fireEvent.change(screen.getByLabelText('Consulta JQL'), { target: { value: 'project = DDW' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar JQL/ }));
    const dialog = await screen.findByRole('dialog', { name: /Salvar consulta JQL/ });
    fireEvent.change(within(dialog).getByLabelText('Nome do filtro'), { target: { value: 'Repetida' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Da squad/ }));
    h.api.saveSquadJql.mockRejectedValue(httpError(409, { message: 'Você já tem uma consulta com esse nome.' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar filtro' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(within(dialog).getByRole('alert').textContent).toContain('Você já tem uma consulta com esse nome.');
  });
});
