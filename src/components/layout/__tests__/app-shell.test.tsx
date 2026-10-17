import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse } from '@/lib/auth-client';

const push = vi.fn();
let pathname = '/painel';
let role = 'admin';
let session: Partial<AuthResponse> = {};
const switchProject = vi.fn(async () => {});

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session, switchProject }) }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => ({ userProfile: { role, name: 'Ana Ribeiro' } }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
// Peças com rede ou contexto próprio ficam de fora: aqui vale a estrutura do cabeçalho.
vi.mock('../../home/NotificationCenter', () => ({ NotificationCenter: () => <button aria-label="Notificações" /> }));
vi.mock('../../home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../feedback-widget', () => ({ FeedbackWidget: () => <div data-testid="feedback-widget" /> }));

import { AppHeader } from '../AppHeader';
import { AppFooter } from '../AppFooter';
import { ModuleSearch } from '../ModuleSearch';

const squad = (id: string, name: string) => ({ projectId: id, projectName: name, roleName: 'Scrum Master', directAssignment: true, leadership: false });

function setSession(count: 1 | 3) {
  const all = [squad('DDWMISSI', 'Missão Varejo'), squad('DDWPRIME', 'Prime Distribuição'), squad('DDWOMNI', 'Omnicanal Checkout')];
  session = { id: 'u1', activeProjectId: 'DDWMISSI', activeProjectName: 'Missão Varejo', accessibleProjects: all.slice(0, count) };
}

beforeEach(() => {
  pathname = '/painel';
  role = 'admin';
  push.mockClear();
  switchProject.mockClear();
  setSession(1);
});

describe('AppHeader', () => {
  it('traz a navegação curta: Home, Squad, Meu espaço, Rituais e Admin (admin)', () => {
    render(<AppHeader />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const names = within(nav).getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(['Home', 'Squad', 'Meu espaço', 'Admin']);
    expect(within(nav).getByRole('button', { name: /Rituais/ })).toBeTruthy();
  });

  it('Admin some para quem não é administrador', () => {
    role = 'Scrum Master';
    render(<AppHeader />);
    expect(within(screen.getByRole('navigation', { name: 'Principal' })).queryByText('Admin')).toBeNull();
  });

  it('marca o item ativo: /squad/roster conta como Squad', () => {
    pathname = '/squad/roster';
    render(<AppHeader />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Squad' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });

  it('um vínculo só: o nome da squad é rótulo, sem seletor', () => {
    render(<AppHeader />);
    expect(screen.queryByRole('button', { name: /Trocar de squad/ })).toBeNull();
    expect(screen.getByText('Missão Varejo')).toBeTruthy();
    expect(screen.getAllByText(/Squad atual:/).length).toBeGreaterThan(0);
  });

  it('três vínculos: seletor com a squad ativa, sem a opção "Todas as squads"', () => {
    setSession(3);
    render(<AppHeader />);
    const trigger = screen.getByRole('button', { name: /Squad atual: Missão Varejo/ });
    expect(trigger).toBeTruthy();
    expect(screen.queryByText('Todas as squads')).toBeNull();
  });

  it('sem squad (conta nova): nem rótulo nem seletor; squadControl={null} também esconde', () => {
    session = { id: 'u1', accessibleProjects: [] };
    const { unmount } = render(<AppHeader />);
    expect(screen.queryByText(/Squad atual:/)).toBeNull();
    unmount();
    setSession(3);
    render(<AppHeader squadControl={null} />);
    expect(screen.queryByRole('button', { name: /Trocar de squad/ })).toBeNull();
  });

  it('squadControl da Home mostra "Todas as squads" quando não há escopo', () => {
    setSession(3);
    const squads = (session.accessibleProjects ?? []).map((p, i) => ({ id: p.projectId, name: p.projectName, isActive: i === 0, sprintPercent: null, daysLeft: null }));
    render(<AppHeader squadControl={{ squads, scope: null, isMulti: true, switchingTo: null, onPick: vi.fn() }} />);
    expect(screen.getByRole('button', { name: /Squad atual: Todas as squads/ })).toBeTruthy();
  });

  it('marca e sino, tema e perfil estão no cabeçalho; ícones têm nome acessível', () => {
    render(<AppHeader />);
    expect(screen.getByRole('link', { name: /Portal Tech V&D, página inicial/ }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('button', { name: 'Notificações' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tema' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Menu do perfil' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeTruthy();
  });
});

describe('AppFooter', () => {
  it('mostra a versão do portal e os cinco atalhos, com as rotas de sempre', () => {
    render(<AppFooter />);
    expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Links úteis do rodapé' });
    expect(within(nav).getByRole('button', { name: 'Feedback' })).toBeTruthy();
    const links = within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      ['Versões', '/changelog'],
      ['Manual', '/manual'],
      ['Segurança e dados', '/governance'],
      ['Suporte', '/support'],
    ]);
  });

  it('cuida do feedback sozinho, ou usa o gatilho de quem já tem o próprio widget', () => {
    const { unmount } = render(<AppFooter toolName="Time da squad" />);
    expect(screen.getByTestId('feedback-widget')).toBeTruthy();
    unmount();
    const onOpen = vi.fn();
    render(<AppFooter onOpenFeedback={onOpen} />);
    expect(screen.queryByTestId('feedback-widget')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Feedback' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('ModuleSearch', () => {
  it('sem onQueryChange lista os módulos que casam e abre o escolhido com Enter', () => {
    render(<ModuleSearch id="busca" />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'retro' } });
    const options = screen.getAllByRole('option');
    expect(options[0].textContent).toContain('Retrospectiva');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/retro');
  });

  it('acha pelo apelido e esconde administração de quem não é admin', () => {
    role = 'Scrum Master';
    render(<ModuleSearch id="busca" />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'biblioteca de ia' } });
    expect(screen.getAllByRole('option')[0].textContent).toContain('Prompt Hub');
    fireEvent.change(input, { target: { value: 'administração' } });
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByText('Nenhum módulo encontrado')).toBeTruthy();
  });

  it('com onQueryChange só filtra a página (Home): sem lista e sem navegar', () => {
    const onQueryChange = vi.fn();
    render(<ModuleSearch id="busca" query="" onQueryChange={onQueryChange} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'jolt' } });
    expect(onQueryChange).toHaveBeenCalledWith('jolt');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Esc fecha a lista', () => {
    render(<ModuleSearch id="busca" />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'poker' } });
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
