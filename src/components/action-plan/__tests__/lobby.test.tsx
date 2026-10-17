import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionPlanBoard, ActionPlanTask } from '../../../lib/types';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  api: { listBoardsBySquad: vi.fn(), listTasks: vi.fn(), createBoard: vi.fn() },
  user: { userProfile: { id: 'me', name: 'Ana Souza' } as { id: string; name: string } | null, requestIdentity: vi.fn() },
  squad: { squadId: 'PHOENIX', squadName: 'Phoenix' },
  memberships: { memberships: null as unknown },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => h.user }));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => h.squad }));
vi.mock('../../../hooks/useMyMemberships', () => ({ useMyMemberships: () => ({ memberships: h.memberships.memberships, settled: true, stale: null, refresh: vi.fn() }) }));
vi.mock('../../../app/action-plan/api', () => ({ actionPlanApi: h.api }));
vi.mock('../../page', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../page')>();
  return { ...real, PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});
// O Select do Radix não abre no jsdom: um <select> nativo exercita a mesma lógica de opções.
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; 'aria-label'?: string }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import ActionPlanHubPage from '../../../app/action-plan/page';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/action-plan');
  h.push.mockClear();
  h.user.requestIdentity.mockClear();
  Object.values(h.api).forEach((f) => f.mockReset());
  h.user.userProfile = { id: 'me', name: 'Ana Souza' };
  h.squad = { squadId: 'PHOENIX', squadName: 'Phoenix' };
  h.memberships.memberships = null;
  h.api.listTasks.mockResolvedValue([]);
});
afterEach(cleanup);

const plan = (over: Partial<ActionPlanBoard> = {}): ActionPlanBoard => ({
  id: '9b2e41d8-6c37-4f5a-8d10-2a7c5e93b0f4', creatorId: 'u1', title: 'Redesenho do onboarding', team: 'PHOENIX', squadId: 'PHOENIX', createdAt: '2026-10-16T10:00:00Z', isPublic: true, ...over,
});
const act = (id: string, status: ActionPlanTask['status']): ActionPlanTask => ({
  id, boardId: 'b', what: id, why: '', where: '', when: '', who: '', how: '', howMuch: '', status, createdAt: '', updatedAt: '', authorId: 'u', order: 0,
});

describe('hub do Plano de ação', () => {
  it('mostra as sete perguntas do 5W2H, inclusive Who, How e How Much', async () => {
    h.api.listBoardsBySquad.mockResolvedValue([]);
    render(<ActionPlanHubPage />);
    const section = screen.getByRole('region', { name: 'Como funciona' });
    for (const name of ['O quê (What)', 'Por quê (Why)', 'Onde (Where)', 'Quando (When)', 'Quem (Who)', 'Como (How)', 'Quanto (How Much)']) {
      expect(within(section).getByText(name)).toBeTruthy();
    }
    expect(within(section).getAllByRole('listitem')).toHaveLength(7);
    await waitFor(() => expect(h.api.listBoardsBySquad).toHaveBeenCalledWith('PHOENIX'));
  });

  it('lista os planos da squad, o último com a contagem de ações, e abre pelo botão', async () => {
    h.api.listBoardsBySquad.mockResolvedValue([
      plan({ id: 'old', title: 'Preparar a migração', createdAt: '2026-09-02T10:00:00Z', isPublic: false }),
      plan({ id: 'new', title: 'Redesenho do onboarding' }),
    ]);
    h.api.listTasks.mockResolvedValue([act('1', 'done'), act('2', 'todo'), act('3', 'blocked')]);
    render(<ActionPlanHubPage />);

    const table = await screen.findByRole('table', { name: 'Planos da squad' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    // o mais novo vem primeiro, mesmo que o servidor devolva em outra ordem
    expect(within(rows[0]).getByText('Redesenho do onboarding')).toBeTruthy();
    expect(within(rows[1]).getByText('Só convidados')).toBeTruthy();

    const latest = screen.getByRole('region', { name: 'Último plano' });
    await within(latest).findByText('1 de 3');
    expect(within(latest).getByRole('progressbar', { name: 'Ações concluídas' }).getAttribute('aria-valuenow')).toBe('33');
    expect(h.api.listTasks).toHaveBeenCalledWith('new');

    fireEvent.click(within(rows[1]).getByRole('button', { name: /Abrir Preparar a migração/ }));
    expect(h.push).toHaveBeenCalledWith('/action-plan/old');
  });

  it('busca por nome na lista', async () => {
    h.api.listBoardsBySquad.mockResolvedValue([plan({ id: 'a', title: 'Alpha' }), plan({ id: 'b', title: 'Beta migração', createdAt: '2026-09-02T10:00:00Z' })]);
    render(<ActionPlanHubPage />);
    await screen.findByRole('table', { name: 'Planos da squad' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nome' }), { target: { value: 'MIGRACAO' } });
    const table = screen.getByRole('table', { name: 'Planos da squad' });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Beta migração')).toBeTruthy();
  });

  it('entrar por link extrai o ID e avisa que reconheceu', async () => {
    h.api.listBoardsBySquad.mockResolvedValue([]);
    render(<ActionPlanHubPage />);
    const input = screen.getByRole('textbox', { name: 'Entrar com o ID ou link do plano' });
    expect((screen.getByRole('button', { name: 'Entrar no plano' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'https://portal.espacoagil.com.br/action-plan/9B2E41D8-6C37-4F5A-8D10-2A7C5E93B0F4' } });
    expect(screen.getByText(/ID reconhecido no link/).textContent).toContain('9b2e41d8-6c37-4f5a-8d10-2a7c5e93b0f4');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no plano' }));
    expect(h.push).toHaveBeenCalledWith('/action-plan/9b2e41d8-6c37-4f5a-8d10-2a7c5e93b0f4');
  });

  it('erro da lista mostra "Tentar de novo" e o início continua disponível', async () => {
    h.api.listBoardsBySquad.mockRejectedValueOnce(new Error('queda'));
    render(<ActionPlanHubPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Não foi possível carregar os planos');
    expect(screen.getByRole('button', { name: /Novo plano/ })).toBeTruthy();

    h.api.listBoardsBySquad.mockResolvedValueOnce([plan()]);
    fireEvent.click(within(alert).getByRole('button', { name: /Tentar de novo/ }));
    await screen.findByRole('table', { name: 'Planos da squad' });
    expect(h.api.listBoardsBySquad).toHaveBeenCalledTimes(2);
  });

  it('o histórico deste navegador continua como atalho quando o servidor falha', async () => {
    window.localStorage.setItem('agileSpace_rooms_meta', JSON.stringify([{ roomId: 'local-1', type: 'action_plan', title: 'Plano aberto aqui', team: 'X', createdAt: '2026-10-01T10:00:00Z' }]));
    h.api.listBoardsBySquad.mockRejectedValue(new Error('queda'));
    render(<ActionPlanHubPage />);
    const table = await screen.findByRole('table', { name: 'Planos da squad' });
    expect(within(table).getByText('Plano aberto aqui')).toBeTruthy();
    expect(within(table).getByText('Neste navegador')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('abertos neste navegador');
  });

  it('sem squad ativa não há lista, mas criar e entrar por ID seguem', async () => {
    h.squad = { squadId: '', squadName: '' };
    render(<ActionPlanHubPage />);
    expect(await screen.findByText('Escolha uma squad para ver os planos')).toBeTruthy();
    expect(h.api.listBoardsBySquad).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Novo plano/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver minhas squads' }));
    expect(h.push).toHaveBeenCalledWith('/workspace');
  });

  it('plano vazio explica o que vai aparecer', async () => {
    h.api.listBoardsBySquad.mockResolvedValue([]);
    render(<ActionPlanHubPage />);
    expect(await screen.findByText('Sem registros ainda. Use o botão de criar para começar; os planos da squad aparecem aqui.')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Último plano' })).getByText('Nenhum plano ainda')).toBeTruthy();
  });
});

describe('criar plano', () => {
  const open = async () => {
    h.api.listBoardsBySquad.mockResolvedValue([]);
    render(<ActionPlanHubPage />);
    await waitFor(() => expect(h.api.listBoardsBySquad).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('button', { name: /Novo plano/ })[0]);
    return screen.findByRole('dialog');
  };

  it('sem perfil pede a identidade antes de abrir a janela', () => {
    h.user.userProfile = null;
    h.api.listBoardsBySquad.mockResolvedValue([]);
    render(<ActionPlanHubPage />);
    fireEvent.click(screen.getAllByRole('button', { name: /Novo plano/ })[0]);
    expect(h.user.requestIdentity).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('título vazio é erro no campo, não toast', async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));
    expect(within(dialog).getByText('Dê um título para o plano.')).toBeTruthy();
    expect(h.api.createBoard).not.toHaveBeenCalled();
  });

  it('cria ligado à squad pelo ID, público por padrão, e vai para o plano', async () => {
    h.api.createBoard.mockResolvedValue({ id: 'novo-id' });
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText('Título do plano'), { target: { value: '  Execução do novo checkout ' } });
    expect((within(dialog).getByLabelText('Squad') as HTMLInputElement).value).toBe('Phoenix');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));

    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/action-plan/novo-id'));
    expect(h.api.createBoard).toHaveBeenCalledWith({
      title: 'Execução do novo checkout',
      team: 'PHOENIX',
      squadId: 'PHOENIX',
      sprintId: undefined,
      isPublic: true,
      participantIds: ['me'],
    });
    // continua como atalho neste navegador
    const meta = JSON.parse(window.localStorage.getItem('agileSpace_rooms_meta') ?? '[]');
    expect(meta[0]).toMatchObject({ roomId: 'novo-id', type: 'action_plan', title: 'Execução do novo checkout', team: 'Phoenix' });
  });

  it('"Só quem eu convidar" cria um plano privado', async () => {
    h.api.createBoard.mockResolvedValue({ id: 'priv' });
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText('Título do plano'), { target: { value: 'Privado' } });
    fireEvent.click(within(dialog).getByRole('switch'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));
    await waitFor(() => expect(h.api.createBoard).toHaveBeenCalled());
    expect(h.api.createBoard.mock.calls[0][0]).toMatchObject({ isPublic: false });
  });

  it('vindo do ciclo da sprint: avisa, liga a sprint e a squad da URL', async () => {
    window.history.replaceState({}, '', '/action-plan?sprintId=S42&squad=PHOENIX');
    h.api.createBoard.mockResolvedValue({ id: 'ciclo' });
    const dialog = await open();
    expect(within(dialog).getByText('Vindo do ciclo da sprint.')).toBeTruthy();
    expect((within(dialog).getByLabelText('Sprint') as HTMLInputElement).value).toBe('S42');
    fireEvent.change(within(dialog).getByLabelText('Título do plano'), { target: { value: 'Ações da Sprint 42' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));
    await waitFor(() => expect(h.api.createBoard).toHaveBeenCalled());
    expect(h.api.createBoard.mock.calls[0][0]).toMatchObject({ sprintId: 'S42', squadId: 'PHOENIX', team: 'PHOENIX' });
  });

  it('falha do servidor fica na própria janela, com o título mantido', async () => {
    h.api.createBoard.mockRejectedValue(new Error('queda'));
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText('Título do plano'), { target: { value: 'Meu plano' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Não foi possível criar o plano agora.');
    expect((within(dialog).getByLabelText('Título do plano') as HTMLInputElement).value).toBe('Meu plano');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('perfil sem ID não cria', async () => {
    h.user.userProfile = { id: '', name: 'Sem ID' };
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText('Título do plano'), { target: { value: 'Plano' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('Não foi possível identificar seu perfil.');
    expect(h.api.createBoard).not.toHaveBeenCalled();
  });

  it('com mais de uma squad no vínculo, a pessoa escolhe a squad', async () => {
    h.memberships.memberships = {
      memberships: [
        { projectId: 'PHOENIX', projectName: 'Phoenix' },
        { projectId: 'ATLAS', projectName: 'Atlas' },
      ],
    };
    h.api.createBoard.mockResolvedValue({ id: 'x' });
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText('Squad'), { target: { value: 'ATLAS' } });
    fireEvent.change(within(dialog).getByLabelText('Título do plano'), { target: { value: 'Plano da Atlas' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar plano' }));
    await waitFor(() => expect(h.api.createBoard).toHaveBeenCalled());
    expect(h.api.createBoard.mock.calls[0][0]).toMatchObject({ squadId: 'ATLAS', team: 'ATLAS' });
  });
});
