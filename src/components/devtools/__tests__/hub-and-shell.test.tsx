import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/devtools',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session: { id: 'u1', name: 'Ana' } }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../layout/AppHeader', () => ({ AppHeader: () => <header>cabeçalho</header> }));
vi.mock('../../layout/AppFooter', () => ({ AppFooter: () => <footer>rodapé</footer> }));

import { DevToolsHub } from '../DevToolsHub';
import { DevToolPage } from '../DevToolPage';
import { DevToolsHubPage } from '../DevToolsHubPage';
import { favoritesKey, readFavorites, readRecents, recentsKey } from '../../../lib/devtools/preferences';

beforeEach(() => {
  search = '';
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe('hub do DevTools', () => {
  it('mostra os 25 cartões em 5 seções, cada um com o selo do que roda onde', () => {
    render(<DevToolsHub />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(25);
    for (const name of ['Dados e formatos', 'Codificação e segurança', 'Texto e tempo', 'API e rede', 'Qualidade e testes']) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    expect(screen.getAllByText('Roda no navegador').length).toBe(20 + 0);
    expect(screen.getAllByText('Usa serviço externo').length).toBe(4);
    expect(screen.getAllByText('Serviço externo opcional')).toHaveLength(1);
    expect(screen.getByText('20 rodam no navegador')).toBeTruthy();
    expect(screen.getByText('5 usam serviço externo')).toBeTruthy();
  });

  it('as pílulas trazem a contagem e o filtro Qualidade lista 12', () => {
    render(<DevToolsHub />);
    const tabs = screen.getByRole('tablist', { name: 'Grupos de ferramentas' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(9);
    fireEvent.click(within(tabs).getByRole('tab', { name: /Qualidade 12/ }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
    expect(screen.getByRole('region', { name: 'Qualidade' })).toBeTruthy();
  });

  it('?grupo=qualidade (destino da antiga /qa) abre direto no filtro', () => {
    search = 'grupo=qualidade';
    render(<DevToolsHub />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(12);
    expect(within(screen.getByRole('tablist')).getByRole('tab', { name: /Qualidade/, selected: true })).toBeTruthy();
  });

  it('a busca filtra, vence a pílula e mostra o estado vazio com a saída', () => {
    render(<DevToolsHub />);
    const box = screen.getByRole('textbox', { name: 'Buscar ferramenta' });
    fireEvent.change(box, { target: { value: 'cep' } });
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Abrir Consulta de CEP' }).getAttribute('href')).toBe('/devtools/cep');
    fireEvent.change(box, { target: { value: 'planilha 3d' } });
    expect(screen.getByText('Nada encontrado para "planilha 3d"')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar a busca' })[0]);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(25);
  });

  it('a tecla / leva o foco para a busca', () => {
    render(<DevToolsHub />);
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Buscar ferramenta' }));
  });

  it('favoritar guarda por usuário, sobe a seção Favoritas e some a dica', () => {
    render(<DevToolsHub />);
    expect(screen.getByText(/Marque a estrela de uma ferramenta/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Favoritar: Consulta de CEP' }));
    expect(screen.getByRole('region', { name: 'Favoritas' })).toBeTruthy();
    expect(screen.queryByText(/Marque a estrela de uma ferramenta/)).toBeNull();
    expect(readFavorites('u1')).toEqual(['cep']);
    expect(window.localStorage.getItem(favoritesKey('u1'))).toBe('["cep"]');
    // a estrela do cartão (na seção Favoritas e na do grupo) agora desfavorita
    fireEvent.click(screen.getAllByRole('button', { name: 'Tirar das favoritas: Consulta de CEP' })[0]);
    expect(readFavorites('u1')).toEqual([]);
  });

  it('com o localStorage falhando a estrela ainda funciona nesta visita', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cheio'); });
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    render(<DevToolsHub />);
    fireEvent.click(screen.getByRole('button', { name: 'Favoritar: Diff' }));
    expect(screen.getByRole('region', { name: 'Favoritas' })).toBeTruthy();
    spy.mockRestore();
    get.mockRestore();
  });

  it('recentes guardados aparecem na aba Todas (no máximo 4) e na pílula Recentes', () => {
    const now = Date.now();
    window.localStorage.setItem(
      recentsKey('u1'),
      JSON.stringify(['cep', 'diff', 'jwt-inspector', 'regex-lab', 'uuid-generator'].map((id, i) => ({ id, at: now - i * 1000 }))),
    );
    render(<DevToolsHub />);
    const section = screen.getByRole('region', { name: 'Recentes' });
    expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(4);
    fireEvent.click(screen.getByRole('tab', { name: /Recentes 5/ }));
    expect(within(screen.getByRole('region', { name: 'Recentes' })).getAllByRole('heading', { level: 3 })).toHaveLength(5);
  });

  it('Favoritas e Recentes vazias explicam como preencher', () => {
    render(<DevToolsHub />);
    fireEvent.click(screen.getByRole('tab', { name: /Favoritas/ }));
    expect(screen.getByText('Você ainda não tem favoritas')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Recentes/ }));
    expect(screen.getByText('Nenhuma ferramenta aberta ainda')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as ferramentas' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(25);
  });

  it('o Guia lista só quem usa a rede e avisa o que fica no navegador', () => {
    render(<DevToolsHubPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'DevTools' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o guia do DevTools' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Ferramentas que usam a rede (5)')).toBeTruthy();
    expect(within(dialog).getByText('viacep.com.br')).toBeTruthy();
    expect(within(dialog).getByText('ipapi.co')).toBeTruthy();
    expect(within(dialog).queryByText('JWT Inspector')).toBeNull();
    expect(document.body.textContent).not.toContain('O conteúdo não sai da sua máquina');
  });
});

describe('casca da ferramenta', () => {
  it('cabeçalho com migalha do grupo, selo, estrela e "Como usar"; grava nos recentes', () => {
    render(<DevToolPage toolId="jwt-inspector"><div>corpo</div></DevToolPage>);
    const crumbs = screen.getByRole('navigation', { name: 'Caminho' });
    expect(within(crumbs).getByText('Codificação e segurança')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'JWT Inspector' })).toBeTruthy();
    expect(screen.getByText('Roda no navegador')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(readRecents('u1').map((r) => r.id)).toEqual(['jwt-inspector']);
    fireEvent.click(screen.getByRole('button', { name: 'Favoritar: JWT Inspector' }));
    expect(readFavorites('u1')).toEqual(['jwt-inspector']);
    expect(screen.getByRole('button', { name: 'Tirar das favoritas: JWT Inspector' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Como usar/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Tudo roda no navegador/)).toBeTruthy();
  });

  it('ferramenta com rede mostra o aviso com o nome do serviço', () => {
    render(<DevToolPage toolId="cep"><div>corpo</div></DevToolPage>);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('Usa serviço externo');
    expect(note.textContent).toContain('viacep.com.br');
  });

  it('o JUnit mostra o selo de serviço opcional', () => {
    render(<DevToolPage toolId="junit-generator"><div>corpo</div></DevToolPage>);
    expect(screen.getAllByText('Serviço externo opcional').length).toBeGreaterThan(0);
    expect(screen.getByRole('note').textContent).toContain('Gemini');
  });
});
