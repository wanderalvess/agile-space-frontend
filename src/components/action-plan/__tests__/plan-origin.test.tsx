import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionPlanBoard, ActionPlanTask } from '../../../lib/types';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  toast: vi.fn(),
  api: {
    getBoardById: vi.fn(),
    listTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    updateBoard: vi.fn(),
    deleteBoard: vi.fn(),
    addParticipant: vi.fn(),
  },
  getMembers: vi.fn(),
  auth: { isAuthenticated: true, isLoading: false, session: { id: 'me', role: 'user' } as { id: string; role: string } },
  user: { userProfile: { id: 'me', name: 'Ana Souza', role: 'user' } as { id: string; name: string; role: string } | null, requestIdentity: vi.fn(), isInitializing: false },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }), useParams: () => ({ id: 'plan-1' }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => h.user }));
vi.mock('../../../hooks/useMyMemberships', () => ({ useMyMemberships: () => ({ memberships: null, settled: true, stale: null, refresh: vi.fn() }) }));
vi.mock('../../../app/action-plan/api', () => ({ actionPlanApi: h.api }));
vi.mock('../../../app/squad/api', () => ({ squadApi: { getMembers: h.getMembers } }));
vi.mock('../../../lib/copy-to-clipboard', () => ({ copyToClipboard: vi.fn(async () => true) }));
vi.mock('../../room-kit/RoomQr', () => ({ RoomQr: () => <div data-testid="qr" /> }));
vi.mock('../../page', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../page')>();
  return { ...real, PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});
// O Select do Radix não abre no jsdom: um <select> nativo exercita a mesma lógica de opções.
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, placeholder, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; 'aria-label'?: string }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import ActionPlanSessionPage from '../../../app/action-plan/[id]/page';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

const board = (over: Partial<ActionPlanBoard> = {}): ActionPlanBoard => ({
  id: 'plan-1', creatorId: 'me', title: 'Plano do radar', team: 'PHOENIX', squadId: 'PHOENIX', createdAt: '2026-10-16T10:00:00Z', isPublic: true, participantIds: ['me'],
  sourceType: 'MANUAL', sourceId: null, sourceTitle: null, ...over,
});
const task = (over: Partial<ActionPlanTask> & { id: string }): ActionPlanTask => ({
  boardId: 'plan-1', what: `Ação ${over.id}`, why: '', where: '', when: '', who: 'Ana', how: '', howMuch: '', status: 'todo', createdAt: '', updatedAt: '', authorId: 'me', order: 0, ...over,
});

// Hoje é 17/10/2026: só a data é simulada, para o relógio da tela e os timers seguirem reais.
const TODAY = new Date(2026, 9, 17, 12, 0, 0);

const TASKS = [
  task({ id: 't1', what: 'Combinar o canal', dueDate: '2026-10-10', status: 'doing', sourceLabel: 'Comunicação', when: 'até as 18h', order: 0 }),
  task({ id: 't2', what: 'Mapear o fluxo', dueDate: '2026-11-20', status: 'todo', order: 1 }),
  task({ id: 't3', what: 'Sem data', dueDate: null, status: 'todo', order: 2 }),
  task({ id: 't4', what: 'Já entregue', dueDate: '2026-10-01', status: 'done', order: 3 }),
  task({ id: 't5', what: 'Prazo cedo', dueDate: '2026-10-25', status: 'blocked', order: 4 }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: TODAY });
  h.push.mockClear();
  h.toast.mockClear();
  Object.values(h.api).forEach((f) => f.mockReset());
  h.getMembers.mockReset();
  h.getMembers.mockResolvedValue([]);
  h.auth.session = { id: 'me', role: 'user' };
  h.user.userProfile = { id: 'me', name: 'Ana Souza', role: 'user' };
  h.api.getBoardById.mockResolvedValue(board({ sourceType: 'HEALTH_CHECK', sourceId: 'hc-1', sourceTitle: 'Sprint 42' }));
  h.api.listTasks.mockResolvedValue(TASKS);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function renderPage() {
  render(<ActionPlanSessionPage />);
  return screen.findByRole('table', { name: 'Ações do plano (5W2H)' });
}

const rowOf = (table: HTMLElement, text: string) => within(table).getAllByRole('row').find((r) => r.textContent?.includes(text))!;

describe('faixa de origem', () => {
  it('plano do Radar de clima: "Criado a partir de Radar de clima «Sprint 42»" com link para o radar', async () => {
    await renderPage();
    const note = screen.getByRole('note', { name: 'Origem do plano' });
    expect(note.textContent).toContain('Criado a partir de Radar de clima');
    expect(note.textContent).toContain('«Sprint 42»');
    expect(within(note).getByRole('link', { name: 'Abrir Radar de clima de origem' }).getAttribute('href')).toBe('/health-check/hc-1');
  });

  it.each([
    ['RETRO', 'Retro', '/retro/s-9'],
    ['BRAINSTORMING', 'Brainstorming', '/brainstorming/s-9'],
    ['SHOWCASE', 'Review', '/showcase/s-9'],
  ] as const)('rota certa para %s', async (type, label, href) => {
    h.api.getBoardById.mockResolvedValue(board({ sourceType: type, sourceId: 's-9', sourceTitle: 'Sessão de outubro' }));
    await renderPage();
    const note = screen.getByRole('note', { name: 'Origem do plano' });
    expect(note.textContent).toContain(`Criado a partir de ${label}`);
    expect(within(note).getByRole('link').getAttribute('href')).toBe(href);
  });

  it('sem título de origem a faixa diz só a cerimônia', async () => {
    h.api.getBoardById.mockResolvedValue(board({ sourceType: 'RETRO', sourceId: 'r1', sourceTitle: null }));
    await renderPage();
    const note = screen.getByRole('note', { name: 'Origem do plano' });
    expect(note.textContent).not.toContain('«');
  });

  it('plano manual e plano de servidor sem origem não têm faixa', async () => {
    h.api.getBoardById.mockResolvedValue(board({ sourceType: 'MANUAL' }));
    await renderPage();
    expect(screen.queryByRole('note', { name: 'Origem do plano' })).toBeNull();
    cleanup();
    h.api.getBoardById.mockResolvedValue(board({ sourceType: undefined }));
    await renderPage();
    expect(screen.queryByRole('note', { name: 'Origem do plano' })).toBeNull();
  });

  it('a ação mostra de onde veio, discretamente', async () => {
    const table = await renderPage();
    expect(within(rowOf(table, 'Combinar o canal')).getByText('de: Comunicação')).toBeTruthy();
    expect(within(rowOf(table, 'Mapear o fluxo')).queryByText(/^de:/)).toBeNull();
  });
});

describe('prazo como data (servidor com V78)', () => {
  it('"Quando" vira campo de data com o prazo, mantendo o texto livre como complemento', async () => {
    const table = await renderPage();
    const row = rowOf(table, 'Combinar o canal');
    expect((within(row).getByLabelText('Prazo da ação 1') as HTMLInputElement).value).toBe('2026-10-10');
    expect(within(row).getByRole('button', { name: /até as 18h/ })).toBeTruthy();
    expect((within(rowOf(table, 'Sem data')).getByLabelText('Prazo da ação 3') as HTMLInputElement).value).toBe('');
  });

  it('selo "Atrasada" só em ação não concluída com prazo vencido (hoje ainda está no prazo)', async () => {
    const table = await renderPage();
    expect(within(rowOf(table, 'Combinar o canal')).getByText('Atrasada')).toBeTruthy();
    expect(within(rowOf(table, 'Já entregue')).queryByText('Atrasada')).toBeNull();
    expect(within(rowOf(table, 'Mapear o fluxo')).queryByText('Atrasada')).toBeNull();
    expect(within(rowOf(table, 'Sem data')).queryByText('Atrasada')).toBeNull();
    expect(within(table).getAllByText('Atrasada')).toHaveLength(1);
  });

  it('escolher a data grava só o dueDate; limpar manda clearDueDate', async () => {
    h.api.updateTask.mockResolvedValue({});
    const table = await renderPage();
    fireEvent.change(within(rowOf(table, 'Sem data')).getByLabelText('Prazo da ação 3'), { target: { value: '2026-12-01' } });
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledWith('t3', { dueDate: '2026-12-01' }));
    fireEvent.click(within(rowOf(table, 'Mapear o fluxo')).getByRole('button', { name: 'Limpar o prazo da ação 2' }));
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledWith('t2', { clearDueDate: true }));
  });

  it('falha ao gravar o prazo avisa por toast e o campo volta ao prazo anterior', async () => {
    h.api.updateTask.mockRejectedValue(new Error('queda'));
    const table = await renderPage();
    const input = within(rowOf(table, 'Mapear o fluxo')).getByLabelText('Prazo da ação 2') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-12-31' } });
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível salvar o prazo', variant: 'destructive' })));
    await waitFor(() => expect(input.value).toBe('2026-11-20'));
  });

  it('filtro "Atrasadas" mostra só as vencidas e a contagem aparece na opção', async () => {
    const table = await renderPage();
    const select = screen.getByRole('combobox', { name: 'Filtrar por prazo' });
    expect(within(select).getByRole('option', { name: 'Atrasadas (1)' })).toBeTruthy();
    fireEvent.change(select, { target: { value: 'overdue' } });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Combinar o canal')).toBeTruthy();
    fireEvent.change(select, { target: { value: 'without' } });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Sem data')).toBeTruthy();
    fireEvent.change(select, { target: { value: 'with' } });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
  });

  it('ordenar por prazo põe o mais próximo primeiro e deixa sem prazo no fim, sem mudar a numeração', async () => {
    const table = await renderPage();
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar as ações' }), { target: { value: 'due' } });
    const order = within(table).getAllByRole('row').slice(1).map((r) => (r.textContent ?? '').match(/Já entregue|Combinar o canal|Prazo cedo|Mapear o fluxo|Sem data/)?.[0]);
    expect(order).toEqual(['Já entregue', 'Combinar o canal', 'Prazo cedo', 'Mapear o fluxo', 'Sem data']);
    // "Sem data" continua sendo a ação 3
    expect(within(table).getByLabelText('Prazo da ação 3')).toBeTruthy();
  });
});

describe('janela da ação com prazo em data', () => {
  it('editar: o prazo vem preenchido, o calendário-que-preenche-texto some e o "Quando" vira complemento', async () => {
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: 'Editar detalhes da ação 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar ação' });
    expect((within(dialog).getByLabelText('Prazo (data)') as HTMLInputElement).value).toBe('2026-10-10');
    expect(within(dialog).queryByRole('button', { name: 'Escolher a data no calendário' })).toBeNull();
    expect(within(dialog).getByLabelText(/complemento/)).toBeTruthy();
    expect(within(dialog).getByText('Esta ação veio de: Comunicação')).toBeTruthy();
  });

  it('trocar o prazo manda dueDate; apagar manda clearDueDate sem dueDate', async () => {
    h.api.updateTask.mockResolvedValue({});
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: 'Editar detalhes da ação 1' }));
    let dialog = await screen.findByRole('dialog', { name: 'Editar ação' });
    fireEvent.change(within(dialog).getByLabelText('Prazo (data)'), { target: { value: '2026-11-30' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar ação' }));
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ dueDate: '2026-11-30', when: 'até as 18h' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(within(table).getByRole('button', { name: 'Editar detalhes da ação 1' }));
    dialog = await screen.findByRole('dialog', { name: 'Editar ação' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Limpar o prazo' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar ação' }));
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledTimes(2));
    const body = h.api.updateTask.mock.calls[1][1];
    expect(body.clearDueDate).toBe(true);
    expect(body).not.toHaveProperty('dueDate');
  });

  it('nova ação com prazo envia dueDate', async () => {
    h.api.createTask.mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /Nova ação/ })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Nova ação 5W2H' });
    fireEvent.change(within(dialog).getByLabelText(/O quê/), { target: { value: 'Publicar o guia' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: /Quem/ }), { target: { value: 'Diego' } });
    fireEvent.change(within(dialog).getByLabelText('Prazo (data)'), { target: { value: '2026-12-15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar ação' }));
    await waitFor(() => expect(h.api.createTask).toHaveBeenCalledWith('plan-1', expect.objectContaining({ what: 'Publicar o guia', dueDate: '2026-12-15', authorId: 'me', order: 5 })));
  });
});

describe('servidor sem V78 (backend antigo)', () => {
  beforeEach(() => {
    h.api.getBoardById.mockResolvedValue(board({ sourceType: undefined, sourceId: undefined, sourceTitle: undefined }));
    h.api.listTasks.mockResolvedValue([task({ id: 'a1', what: 'Ação antiga', when: '25/10 até as 18h' })]);
  });

  it('o "Quando" continua texto livre: sem campo de data, sem filtro de prazo nem ordenação, sem faixa', async () => {
    const table = await renderPage();
    expect(within(table).getByRole('button', { name: /^Quando\? 25\/10 até as 18h/ })).toBeTruthy();
    expect(within(table).queryByLabelText(/Prazo da ação/)).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Filtrar por prazo' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Ordenar as ações' })).toBeNull();
    expect(screen.queryByRole('note', { name: 'Origem do plano' })).toBeNull();
  });

  it('a janela mantém o calendário que preenche o texto e não manda dueDate', async () => {
    h.api.updateTask.mockResolvedValue({});
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: 'Editar detalhes da ação 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar ação' });
    expect(within(dialog).getByRole('button', { name: 'Escolher a data no calendário' })).toBeTruthy();
    expect(within(dialog).queryByLabelText('Prazo (data)')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar ação' }));
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledTimes(1));
    const body = h.api.updateTask.mock.calls[0][1];
    expect(body).not.toHaveProperty('dueDate');
    expect(body).not.toHaveProperty('clearDueDate');
    expect(body.when).toBe('25/10 até as 18h');
  });
});
