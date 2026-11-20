import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/manual',
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ session: { id: 'u1', name: 'Ana', accessibleProjects: [] }, isAuthenticated: true, isLoading: false, switchProject: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../../context/UserContext', () => ({
  useUserContext: () => ({ userProfile: { role: 'user', name: 'Ana' }, isInitializing: false, requestIdentity: vi.fn() }),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'system', resolvedMode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../components/home/NotificationCenter', () => ({ NotificationCenter: () => <button aria-label="Notificações" /> }));
vi.mock('../../../components/home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../../components/layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../../components/feedback-widget', () => ({ FeedbackWidget: () => null }));

import ManualLayout from '../layout';
import ManualOverviewPage from '../page';
import ManualLoading from '../loading';
import ManualTopicPage, { generateMetadata, generateStaticParams } from '../[topic]/page';
import { TopicPage } from '../components/TopicPage';
import { TOPIC_CONTENT } from '../content';
import { MANUAL_CATEGORIES, MANUAL_TOPICS } from '../data/topics';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});
beforeEach(() => replace.mockClear());

function index() {
  return render(
    <ManualLayout>
      <ManualOverviewPage />
    </ManualLayout>,
  );
}

describe('índice do Manual', () => {
  it('usa a casca do portal, um único h1 e as cinco categorias', () => {
    index();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Manual' })).toBeTruthy();
    for (const c of MANUAL_CATEGORIES) expect(screen.getByRole('heading', { level: 2, name: c.label })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Atualizado em v/ }).length).toBe(MANUAL_TOPICS.length);
  });

  it('mostra um cartão por tópico, com a frase e "Novo" onde cabe', () => {
    index();
    const poker = screen.getByRole('link', { name: /Scrum Poker/ });
    expect(poker.getAttribute('href')).toBe('/manual/poker');
    expect(within(poker).getByText(/Estime issues em horas por papel/)).toBeTruthy();
    const suporte = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/manual/suporte')!;
    expect(within(suporte).getByText('Novo')).toBeTruthy();
  });

  it('os atalhos do cabeçalho levam ao Suporte e às Versões', () => {
    index();
    expect(screen.getByRole('link', { name: 'Falar com o suporte' }).getAttribute('href')).toBe('/support');
    expect(screen.getByRole('link', { name: /O que mudou na v\d/ }).getAttribute('href')).toBe('/changelog');
  });

  it('busca no corpo: mostra o trecho "No texto" e as contagens das categorias acompanham', () => {
    index();
    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar no manual/ }), { target: { value: 'assinatura' } });
    expect(screen.getByText(/No texto:/)).toBeTruthy();
    expect(screen.getAllByText(/tópico(s)? encontrado/).length).toBeGreaterThan(0);
    // Sem busca, os títulos de categoria somem: a lista vira "Resultados".
    expect(screen.queryByRole('heading', { level: 2, name: 'Cerimônias' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Resultados' })).toBeTruthy();
  });

  it('busca sem resultado mostra "Nada encontrado" e o botão limpa a busca', () => {
    index();
    const box = screen.getByRole('searchbox', { name: /Buscar no manual/ }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'reembolso' } });
    expect(screen.getByRole('heading', { level: 2, name: /Nada encontrado para “reembolso”/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar busca' })[0]);
    expect(box.value).toBe('');
    expect(screen.getByRole('heading', { level: 2, name: 'Cerimônias' })).toBeTruthy();
  });

  it('categoria filtra a lista e "Todas" volta', () => {
    index();
    const nav = screen.getByRole('navigation', { name: 'Categorias do manual' });
    fireEvent.click(within(nav).getByRole('button', { name: /Conta e ajuda/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Conta e ajuda' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Cerimônias' })).toBeNull();
    fireEvent.click(within(nav).getByRole('button', { name: /Todas/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Cerimônias' })).toBeTruthy();
  });

  it('a tecla "/" leva o foco à busca, mas não rouba a tecla de quem já está digitando', () => {
    index();
    const box = screen.getByRole('searchbox', { name: /Buscar no manual/ });
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(box);
    (box as HTMLInputElement).blur();
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    fireEvent.keyDown(other, { key: '/' });
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  it('/manual#poker continua levando para /manual/poker, e apelidos antigos também', () => {
    window.location.hash = '#poker';
    index();
    expect(replace).toHaveBeenCalledWith('/manual/poker');
    cleanup();
    replace.mockClear();
    window.location.hash = '#seguranca';
    index();
    expect(replace).toHaveBeenCalledWith('/manual/governance');
    cleanup();
    replace.mockClear();
    window.location.hash = '#nao-existe';
    index();
    expect(replace).not.toHaveBeenCalled();
  });

  it('o estado de carregamento é a grade em esqueleto, marcada como ocupada', () => {
    render(<ManualLoading />);
    expect(screen.getByRole('status', { name: 'Carregando o manual' }).getAttribute('aria-busy')).toBe('true');
  });
});

describe('página de um tópico', () => {
  it('todos os tópicos renderizam sem erro, com um h1, sumário, "Neste tópico", Suporte e o ícone do tópico', { timeout: 90_000 }, () => {
    for (const topic of MANUAL_TOPICS) {
      const { container, unmount } = render(
        <ManualLayout>
          <TopicPage topic={topic} blocks={TOPIC_CONTENT[topic.id]} />
        </ManualLayout>,
      );
      expect(screen.getAllByRole('heading', { level: 1 }), topic.id).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(topic.title);
      expect(screen.getAllByRole('navigation', { name: 'Tópicos do manual' }).length, topic.id).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: 'Falar com o suporte' }).some((a) => a.getAttribute('href') === '/support'), topic.id).toBe(true);
      expect(screen.getByText('Ideia central'), topic.id).toBeTruthy();
      expect(container.querySelector('article svg'), topic.id).toBeTruthy();
      expect(screen.getByText(`Atualizado em ${topic.updatedIn}`)).toBeTruthy();
      unmount();
    }
  });

  it('o sumário marca o tópico aberto e os "Veja também" levam a outros tópicos', () => {
    const topic = MANUAL_TOPICS.find((t) => t.id === 'poker')!;
    render(<TopicPage topic={topic} blocks={TOPIC_CONTENT.poker} />);
    const nav = screen.getAllByRole('navigation', { name: 'Tópicos do manual' })[0];
    expect(within(nav).getByRole('link', { name: /Scrum Poker/ }).getAttribute('aria-current')).toBe('page');
    const see = screen.getByRole('region', { name: 'Veja também' });
    expect(within(see).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/manual/retro', '/manual/planner', '/manual/action-plan']);
  });

  it('filtra o sumário por título e mostra "Nenhum tópico com esse nome"', () => {
    const topic = MANUAL_TOPICS[0];
    render(<TopicPage topic={topic} blocks={TOPIC_CONTENT[topic.id]} />);
    const filter = screen.getAllByPlaceholderText('Filtrar tópicos')[0];
    fireEvent.change(filter, { target: { value: 'zephyr' } });
    const nav = screen.getAllByRole('navigation', { name: 'Tópicos do manual' })[0];
    expect(within(nav).getByRole('link', { name: /Central de qualidade/ })).toBeTruthy();
    expect(within(nav).queryByRole('link', { name: /Scrum Poker/ })).toBeNull();
    fireEvent.change(filter, { target: { value: 'xyzxyz' } });
    expect(screen.getByText('Nenhum tópico com esse nome.')).toBeTruthy();
  });

  it('o bloco de API mostra código com botão de copiar e copia o texto', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const topic = MANUAL_TOPICS.find((t) => t.id === 'integracoes')!;
    render(<TopicPage topic={topic} blocks={TOPIC_CONTENT.integracoes} />);
    const copy = screen.getAllByRole('button', { name: 'Copiar o código' })[0];
    fireEvent.click(copy);
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain('X-Api-Key');
    expect(await screen.findByRole('button', { name: 'Código copiado' })).toBeTruthy();
  });

  it('"Este tópico ajudou?" é só visual: o "Não" leva ao Suporte e nada é enviado', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const topic = MANUAL_TOPICS.find((t) => t.id === 'retro')!;
    render(<TopicPage topic={topic} blocks={TOPIC_CONTENT.retro} />);
    fireEvent.click(screen.getByRole('button', { name: 'Não' }));
    expect(screen.getByRole('link', { name: /abra um chamado no Suporte/ }).getAttribute('href')).toBe('/support');
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }));
    expect(screen.getByText('Que bom que ajudou.')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('anterior e próximo seguem a ordem do Manual', () => {
    const topic = MANUAL_TOPICS[1];
    render(<TopicPage topic={topic} blocks={TOPIC_CONTENT[topic.id]} />);
    const pager = screen.getByRole('navigation', { name: 'Anterior e próximo' });
    expect(within(pager).getByRole('link', { name: /Anterior/ }).getAttribute('href')).toBe(`/manual/${MANUAL_TOPICS[0].id}`);
    expect(within(pager).getByRole('link', { name: /Próximo/ }).getAttribute('href')).toBe(`/manual/${MANUAL_TOPICS[2].id}`);
  });

  it('título da aba por tópico e páginas geradas para todos os ids', async () => {
    expect(generateStaticParams().map((p) => p.topic)).toEqual(MANUAL_TOPICS.map((t) => t.id));
    const meta = await generateMetadata({ params: Promise.resolve({ topic: 'poker' }) });
    expect(meta.title).toBe('Scrum Poker - Manual | Portal Tech V&D');
    const missing = await generateMetadata({ params: Promise.resolve({ topic: 'nada' }) });
    expect(String(missing.title)).toMatch(/não encontrado/);
  });

  it('um id que não existe cai em "não encontrado"', async () => {
    await expect(ManualTopicPage({ params: Promise.resolve({ topic: 'nada' }) })).rejects.toThrow();
  });
});
