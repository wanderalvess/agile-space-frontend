import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BrainstormLobbyRow } from '../../../lib/brainstorming-lobby';

vi.mock('next/navigation', () => ({ usePathname: () => '/brainstorming', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
// A casca do portal (cabeçalho, busca, conta) tem contexto próprio: aqui vale o miolo do hub.
vi.mock('../../page/PageShell', () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import { BrainstormLobbyView, type BrainstormLobbyViewProps } from '../BrainstormLobbyView';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

const ID = '3f9a2c71-5d0e-4b86-a1c4-7e2d8b90f315';

const rows: BrainstormLobbyRow[] = [
  { id: 'a', title: 'Redesenho do onboarding', team: 'PHOENIX', createdAt: '2026-10-15T10:00:00Z', phase: 'prioritization', creatorId: 'me', ideas: 23, people: 9, status: 'LIVE' },
  { id: 'b', title: 'Ideias para o Dia do Cliente', team: 'PHOENIX', createdAt: '2026-09-30T10:00:00Z', phase: 'actions', creatorId: 'outra', ideas: 41, people: 11, status: 'FINISHED' },
];

function setup(props: Partial<BrainstormLobbyViewProps> = {}) {
  const handlers = { onRetry: vi.fn(), onNew: vi.fn(), onJoin: vi.fn(), onOpen: vi.fn(), onDelete: vi.fn(async () => {}) };
  const view = render(<BrainstormLobbyView state="ready" rows={rows} currentUserId="me" isCreating={false} now={Date.parse('2026-10-17T12:00:00Z')} {...handlers} {...props} />);
  return { ...view, handlers };
}

describe('hub do Brainstorming', () => {
  it('lista as cinco etapas reais e o jeito de votar, todas (nada de cortar a lista)', () => {
    setup();
    const how = screen.getByRole('region', { name: 'Como funciona' });
    for (const title of ['1. Mural', '2. Teia', '3. Grupos', '4. Matriz', '5. Plano', 'Votos o tempo todo']) {
      expect(within(how).getByText(title)).toBeTruthy();
    }
    expect(within(how).queryByText(/Votação/)).toBeNull();
  });

  it('última sessão com etapa, contagens e Retomar', () => {
    const { handlers } = setup({ lastDetail: { ideas: 23, people: 9, groups: 5 } });
    const last = screen.getByRole('region', { name: 'Última sessão' });
    expect(within(last).getByText('Redesenho do onboarding')).toBeTruthy();
    expect(within(last).getByText('Em andamento')).toBeTruthy();
    expect(within(last).getByText('Matriz').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(within(last).getByText('5')).toBeTruthy();
    fireEvent.click(within(last).getByRole('button', { name: /Retomar/ }));
    expect(handlers.onOpen).toHaveBeenCalledWith('a');
  });

  it('entrar por link colado extrai o ID em minúsculas', () => {
    const { handlers } = setup();
    const input = screen.getByLabelText('Entrar com o ID ou link do brainstorming');
    fireEvent.change(input, { target: { value: `https://portal.espacoagil.com.br/brainstorming/${ID.toUpperCase()}?x=1` } });
    expect(screen.getByText(new RegExp(`ID reconhecido no link: ${ID}`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(handlers.onJoin).toHaveBeenCalledWith(ID);
  });

  it('texto que não é ID nem link não abre sala e avisa', () => {
    const { handlers } = setup();
    fireEvent.change(screen.getByLabelText('Entrar com o ID ou link do brainstorming'), { target: { value: 'duas palavras' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(handlers.onJoin).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/não parece um ID/);
  });

  it('o botão de entrar fica desabilitado com o campo vazio', () => {
    setup();
    expect((screen.getByRole('button', { name: 'Entrar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('tabela da squad: filtro, busca e contador', () => {
    setup();
    const table = screen.getByRole('table', { name: 'Brainstormings da squad' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'No plano' }));
    expect(within(screen.getByRole('table', { name: 'Brainstormings da squad' })).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('1 de 2 registros')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    fireEvent.change(screen.getByLabelText('Buscar brainstorming por nome'), { target: { value: 'onboarding' } });
    expect(screen.getByText('1 de 2 registros')).toBeTruthy();
  });

  it('só o facilitador vê "Apagar", e a exclusão pede confirmação', async () => {
    const { handlers } = setup();
    expect(screen.queryByRole('button', { name: 'Apagar Ideias para o Dia do Cliente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar Redesenho do onboarding' }));
    expect(handlers.onDelete).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Apagar brainstorming' })); });
    expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('Novo brainstorming chama a criação e fica desabilitado enquanto cria', () => {
    const { handlers, unmount } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Novo brainstorming/ }));
    expect(handlers.onNew).toHaveBeenCalled();
    unmount();
    setup({ isCreating: true });
    expect((screen.getByRole('button', { name: /Novo brainstorming/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('primeira sessão: diz o que vai aparecer', () => {
    setup({ rows: [] });
    expect(screen.getByText('Nenhum brainstorming ainda')).toBeTruthy();
    expect(screen.getByText('Sem registros ainda')).toBeTruthy();
  });

  it('erro: só a lista mostra o erro, com tentar de novo; criar e entrar seguem', () => {
    const { handlers } = setup({ state: 'error', rows: [] });
    expect(screen.getByText('Não foi possível carregar os brainstormings')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(handlers.onRetry).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Novo brainstorming/ })).toBeTruthy();
  });

  it('sem squad ativa: aviso com atalho para as squads', () => {
    setup({ state: 'no-squad', rows: [] });
    expect(screen.getByText('Escolha uma squad para ver os brainstormings')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver minhas squads' }).getAttribute('href')).toBe('/squad');
  });

  it('salas abertas só neste navegador continuam acessíveis quando o servidor falha', () => {
    setup({ state: 'error', rows: [{ id: 'z', title: 'Só aqui', team: '', createdAt: '2026-10-16T10:00:00Z', localOnly: true }] });
    expect(screen.getByText('Abertos neste navegador')).toBeTruthy();
    expect(screen.getByText('aberta neste navegador')).toBeTruthy();
  });
});
