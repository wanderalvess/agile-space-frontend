import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  search: new URLSearchParams(),
  session: { id: 'me', name: 'Ana Souza', accessibleProjects: [] } as null | { id: string; name: string; accessibleProjects: never[] },
  mustOnboard: false,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/prompt-hub',
  useRouter: () => ({ push: h.push, replace: vi.fn() }),
  useSearchParams: () => h.search,
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ session: h.session, isAuthenticated: !!h.session, isLoading: false, switchProject: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../../context/UserContext', () => ({
  useUserContext: () => ({
    userProfile: { id: 'me', role: 'user', name: 'Ana Souza', squadId: 'sq' },
    isInitializing: false,
    requestIdentity: vi.fn(),
    mustOnboard: h.mustOnboard,
    setIsEditProfileOpen: vi.fn(),
    setIsPublicExploration: vi.fn(),
  }),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'system', resolvedMode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../home/NotificationCenter', () => ({ NotificationCenter: () => <button aria-label="Notificações" /> }));
vi.mock('../../home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../feedback-widget', () => ({ FeedbackWidget: () => null }));
vi.mock('../../../lib/auth-client', () => ({
  authFetch: async () => ({ ok: false, status: 404, clone() { return this; }, json: async () => ({}) }),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), loading: vi.fn(() => 'id') }),
}));

const catalog = vi.hoisted(() => ({ fetchCatalog: vi.fn() }));
vi.mock('../../../app/prompt-hub/catalog-query', async importOriginal => {
  const original = await importOriginal<typeof import('../../../app/prompt-hub/catalog-query')>();
  return { ...original, fetchCatalog: catalog.fetchCatalog };
});

import { ApiError, promptApi } from '../../../app/prompt-hub/api';
import type { PromptItem } from '../../../app/prompt-hub/types';
import { Catalog } from '../Catalog';
import { ItemCard, type ItemCardHandlers } from '../ItemCard';
import { ItemDetail } from '../ItemDetail';
import { MyPrompts } from '../../workspace/MyPrompts';
import { PromptGuide } from '../PromptGuide';

const makeItem = (over: Partial<PromptItem> = {}): PromptItem => ({
  id: 'i1',
  title: 'Resumir issue para refinamento',
  description: 'Transforma uma issue em resumo curto.',
  content: 'Resuma {{issue}} para {{público}}.',
  type: 'prompt',
  visibility: 'public',
  authorId: 'outra',
  authorName: 'Carla Mendes',
  authorRole: 'Analista de produto',
  authorSquad: 'Phoenix',
  useCount: 12,
  forkCount: 3,
  tags: ['jira', 'refinamento', 'scrum', 'extra'],
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
});

const facets = { total: 3, typeCounts: { prompt: 2, skill: 1 }, topTags: [{ tag: 'jira', count: 2 }], totals: { items: 3, copies: 40, collections: 2 } };
const ready = (items: PromptItem[], extra: Record<string, unknown> = {}) => ({ items, total: items.length, totalPages: 1, mode: 'server', facets, ...extra });

// O jsdom não tem captura de ponteiro; o Radix precisa dela para abrir menus.
Object.assign(Element.prototype, { hasPointerCapture: () => false, setPointerCapture: () => undefined, releasePointerCapture: () => undefined, scrollIntoView: () => undefined });
const pickTab = (el: HTMLElement) => fireEvent.mouseDown(el, { button: 0 });

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  h.push.mockReset();
  h.search = new URLSearchParams();
  h.session = { id: 'me', name: 'Ana Souza', accessibleProjects: [] };
  h.mustOnboard = false;
  catalog.fetchCatalog.mockReset();
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => vi.restoreAllMocks());

function handlers(over: Partial<ItemCardHandlers> = {}): ItemCardHandlers {
  return {
    onOpen: vi.fn(),
    onCopy: vi.fn().mockResolvedValue(true),
    onOpenTool: vi.fn(),
    onToggleFavorite: vi.fn(),
    onCopyLink: vi.fn(),
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onSelectTag: vi.fn(),
    onSelectAuthor: vi.fn(),
    ...over,
  };
}

describe('ItemCard', () => {
  it('mostra tipo, campos, visibilidade, autor, cópias e duplicações, e destaca o termo buscado', () => {
    render(<ItemCard item={makeItem()} query="issue" sessionId="me" handlers={handlers()} />);
    expect(screen.getByText('Prompt')).toBeTruthy();
    expect(screen.getByText('2 campos')).toBeTruthy();
    expect(screen.getByText('Público')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Carla Mendes' })).toBeTruthy();
    expect(screen.getByLabelText('12 cópias')).toBeTruthy();
    expect(screen.getByLabelText('3 duplicações')).toBeTruthy();
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(0);
    // 3 etiquetas e "+1"
    expect(screen.getByText('+1')).toBeTruthy();
    // sem squad no cartão
    expect(screen.queryByText(/Phoenix/)).toBeNull();
  });

  it('item com campos pede "Preencher"; sem campos copia direto e mostra "Copiado"', async () => {
    const open = vi.fn();
    const { unmount } = render(<ItemCard item={makeItem()} sessionId="me" handlers={handlers({ onOpen: open })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Preencher' }));
    expect(open).toHaveBeenCalled();
    unmount();

    const onCopy = vi.fn().mockResolvedValue(true);
    render(<ItemCard item={makeItem({ content: 'Texto simples' })} sessionId="me" handlers={handlers({ onCopy })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(onCopy).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeTruthy();
  });

  it('Gem sem texto abre a ferramenta; link sem http não oferece "Abrir"', () => {
    const onOpenTool = vi.fn();
    const gem = makeItem({ type: 'gem', content: '', gemLink: 'https://gemini.google.com/gem/x' });
    const { unmount } = render(<ItemCard item={gem} sessionId="me" handlers={handlers({ onOpenTool })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(onOpenTool).toHaveBeenCalledWith(gem, 'https://gemini.google.com/gem/x');
    unmount();
    render(<ItemCard item={{ ...gem, gemLink: 'gemini.google.com/gem/x' }} sessionId="me" handlers={handlers()} />);
    expect(screen.queryByRole('button', { name: 'Abrir' })).toBeNull();
  });

  it('estrela marca o favorito e avisa a tela', () => {
    const onToggleFavorite = vi.fn();
    render(<ItemCard item={makeItem({ favorite: true })} sessionId="me" handlers={handlers({ onToggleFavorite })} />);
    const star = screen.getByRole('button', { name: 'Remover dos favoritos' });
    expect(star.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(star);
    expect(onToggleFavorite).toHaveBeenCalled();
  });

  it('administradora vê o selo "Admin" no item de outra pessoa; quem não pode editar não vê o selo', () => {
    const { unmount } = render(<ItemCard item={makeItem({ canEdit: true })} sessionId="me" handlers={handlers()} />);
    expect(screen.getByText('Admin')).toBeTruthy();
    unmount();

    render(<ItemCard item={makeItem({ canEdit: false })} sessionId="me" handlers={handlers()} />);
    expect(screen.queryByText('Admin')).toBeNull();
    expect(screen.getByRole('button', { name: /Mais ações/ })).toBeTruthy();
  });

  it('visitante não tem menu de ações', () => {
    render(<ItemCard item={makeItem()} sessionId={undefined} handlers={handlers()} />);
    expect(screen.queryByRole('button', { name: /Mais ações/ })).toBeNull();
  });
});

describe('ItemDetail', () => {
  const noVersions = () => {
    vi.spyOn(promptApi, 'getComments').mockResolvedValue([]);
    vi.spyOn(promptApi, 'listVersions').mockRejectedValue(new ApiError('x', 404));
    vi.spyOn(promptApi, 'usage').mockRejectedValue(new ApiError('x', 404));
  };

  function renderDetail(item: PromptItem, extra: Partial<React.ComponentProps<typeof ItemDetail>> = {}) {
    return render(<ItemDetail item={item} mode="page" onPatch={vi.fn()} onDeleted={vi.fn()} {...extra} />);
  }

  it('preenche os campos, copia o texto final numa passada e conta o uso', async () => {
    noVersions();
    const used = vi.spyOn(promptApi, 'usePrompt').mockResolvedValue(makeItem());
    const onPatch = vi.fn();
    renderDetail(makeItem(), { onPatch });

    expect(screen.getByText('0 de 2 preenchidos')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Valor para issue'), { target: { value: 'custo $& total' } });
    fireEvent.change(screen.getByPlaceholderText('Valor para público'), { target: { value: '{{issue}}' } });
    expect(screen.getByText('2 de 2 preenchidos')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Copiar com os campos/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Resuma custo $& total para {{issue}}.'));
    await waitFor(() => expect(used).toHaveBeenCalledWith('i1'));
    await waitFor(() => expect(onPatch).toHaveBeenCalledWith({ useCount: 13 }));
  });

  it('mostra a ficha só com o cargo da autora e leva à página dela', () => {
    noVersions();
    renderDetail(makeItem({ targetAudience: 'Times de produto', businessGoal: 'Chegar ao refinamento com a história entendida', architectureLink: 'https://wiki.empresa.com/doc' }));
    expect(screen.getByText('Analista de produto')).toBeTruthy();
    expect(screen.queryByText(/Phoenix/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Carla Mendes' }).getAttribute('href')).toBe('/prompt-hub/autor/outra');
    expect(screen.getByText('Times de produto')).toBeTruthy();
    expect(screen.getByRole('link', { name: /wiki\.empresa\.com/ }).getAttribute('target')).toBe('_blank');
    // um único h1
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('link da ferramenta sem http/https fica desligado e explica', () => {
    noVersions();
    renderDetail(makeItem({ type: 'gem', content: '', gemLink: 'gemini.google.com/gem/x' }));
    expect(screen.getByRole('alert').textContent).toMatch(/não começa com http/);
    expect((screen.getByRole('button', { name: /Abrir ferramenta/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Gem com link válido abre a ferramenta e conta o uso', async () => {
    noVersions();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const used = vi.spyOn(promptApi, 'usePrompt').mockResolvedValue(makeItem());
    renderDetail(makeItem({ type: 'gem', content: '', gemLink: 'https://gemini.google.com/gem/x' }));
    expect(screen.getByText('Este item não tem texto para copiar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Abrir ferramenta/ }));
    expect(open).toHaveBeenCalledWith('https://gemini.google.com/gem/x', '_blank', 'noopener,noreferrer');
    await waitFor(() => expect(used).toHaveBeenCalled());
  });

  it('só quem pode editar vê Editar e Excluir; excluir pede confirmação no diálogo (sem window.confirm)', async () => {
    noVersions();
    const confirmSpy = vi.spyOn(window, 'confirm');
    const del = vi.spyOn(promptApi, 'deletePrompt').mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const { unmount } = renderDetail(makeItem({ canEdit: false, canModerate: false }));
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
    unmount();

    renderDetail(makeItem({ canEdit: true, canModerate: true }), { onDeleted });
    expect(screen.getByText('Admin: você pode editar, excluir e moderar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(h.push).toHaveBeenCalledWith('/prompt-hub/i1/editar');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/como administrador/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir item' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('i1'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('visitante vê o convite para entrar e não consegue comentar', () => {
    noVersions();
    h.session = null;
    renderDetail(makeItem());
    expect(screen.getByText('Entre para duplicar, favoritar e comentar.')).toBeTruthy();
    expect(screen.getByText(/para participar da conversa/)).toBeTruthy();
    expect(screen.queryByLabelText('Escreva um comentário')).toBeNull();
  });

  it('discussão: limite de 4000 caracteres, publicar e remover com confirmação', async () => {
    vi.spyOn(promptApi, 'listVersions').mockRejectedValue(new ApiError('x', 404));
    vi.spyOn(promptApi, 'usage').mockRejectedValue(new ApiError('x', 404));
    const comments = [
      { id: 'c1', content: 'Funcionou bem.', authorId: 'outra', authorName: 'Carla Mendes', createdAt: '2026-10-18T10:00:00Z' },
      { id: 'c2', content: 'Obrigada pelo retorno', authorId: 'me', authorName: 'Ana Souza', createdAt: '2026-10-19T10:00:00Z' },
    ];
    const get = vi.spyOn(promptApi, 'getComments').mockResolvedValue(comments);
    const add = vi.spyOn(promptApi, 'addComment').mockResolvedValue(comments[1]);
    const del = vi.spyOn(promptApi, 'deleteComment').mockResolvedValue(undefined);

    renderDetail(makeItem({ canModerate: false }));
    expect(await screen.findByText('Funcionou bem.')).toBeTruthy();
    // comum: só pode remover o próprio
    expect(screen.queryByRole('button', { name: 'Remover comentário de Carla Mendes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remover comentário de Ana Souza' })).toBeTruthy();

    const box = screen.getByLabelText('Escreva um comentário') as HTMLTextAreaElement;
    expect((screen.getByRole('button', { name: 'Comentar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'x'.repeat(4001) } });
    expect(screen.getByText('4.001 de 4.000 caracteres')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Comentar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'Ótimo!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    await waitFor(() => expect(add).toHaveBeenCalledWith('i1', expect.objectContaining({ content: 'Ótimo!', authorId: 'me' })));
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1));

    fireEvent.click(screen.getByRole('button', { name: 'Remover comentário de Ana Souza' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover comentário' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('i1', 'c2'));
  });

  it('dona do item ou administradora removem o comentário de outra pessoa e o diálogo avisa', async () => {
    vi.spyOn(promptApi, 'listVersions').mockRejectedValue(new ApiError('x', 404));
    vi.spyOn(promptApi, 'usage').mockRejectedValue(new ApiError('x', 404));
    vi.spyOn(promptApi, 'getComments').mockResolvedValue([{ id: 'c1', content: 'Oi', authorId: 'outra', authorName: 'Carla Mendes', createdAt: '' }]);
    renderDetail(makeItem({ canModerate: true, canEdit: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remover comentário de Carla Mendes' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/comentário de outra pessoa/)).toBeTruthy();
  });

  it('erro ao carregar a discussão mostra "Tentar de novo"', async () => {
    vi.spyOn(promptApi, 'listVersions').mockRejectedValue(new ApiError('x', 404));
    vi.spyOn(promptApi, 'usage').mockRejectedValue(new ApiError('x', 404));
    const get = vi.spyOn(promptApi, 'getComments').mockRejectedValueOnce(new Error('queda')).mockResolvedValue([]);
    renderDetail(makeItem());
    expect(await screen.findByText('Não foi possível carregar os comentários.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Ninguém comentou ainda/)).toBeTruthy();
  });

  it('versões e uso aparecem quando o servidor tem as rotas; restaurar pede confirmação e só vale para quem edita', async () => {
    vi.spyOn(promptApi, 'getComments').mockResolvedValue([]);
    vi.spyOn(promptApi, 'usage').mockResolvedValue([
      { weekStart: '2026-09-14', uses: 2, clones: 0 },
      { weekStart: '2026-09-21', uses: 5, clones: 1 },
    ]);
    vi.spyOn(promptApi, 'listVersions').mockResolvedValue([
      { versionNumber: 2, title: 'Atual', changedByName: 'Carla', changedAt: '2026-10-12T14:20:00Z', current: true },
      { versionNumber: 1, title: 'Primeira', changedByName: 'Carla', changedAt: '2026-09-14T10:00:00Z', current: false },
    ]);
    const restore = vi.spyOn(promptApi, 'restoreVersion').mockResolvedValue(makeItem({ title: 'Primeira' }));
    const onPatch = vi.fn();

    renderDetail(makeItem({ canEdit: true }), { onPatch });
    expect(await screen.findByText('Uso nas últimas 8 semanas')).toBeTruthy();
    expect(screen.getByText('7 cópias e 1 duplicação no período.')).toBeTruthy();
    expect(await screen.findByText('Versão 2 · atual')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restaurar a versão 2' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar a versão 1' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith('i1', 1));
    await waitFor(() => expect(onPatch).toHaveBeenCalled());
  });

  it('sem permissão para editar, não há botão de restaurar', async () => {
    vi.spyOn(promptApi, 'getComments').mockResolvedValue([]);
    vi.spyOn(promptApi, 'usage').mockRejectedValue(new ApiError('x', 404));
    vi.spyOn(promptApi, 'listVersions').mockResolvedValue([{ versionNumber: 1, title: 'Primeira', changedAt: '', current: false }]);
    renderDetail(makeItem({ canEdit: false }));
    expect(await screen.findByText('Versão 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Restaurar/ })).toBeNull();
  });

  it('servidor antigo (rotas 404): os cartões de versões e uso somem sem quebrar', async () => {
    noVersions();
    renderDetail(makeItem());
    await waitFor(() => expect(promptApi.listVersions).toHaveBeenCalled());
    expect(screen.queryByText('Versões')).toBeNull();
    expect(screen.queryByText('Uso nas últimas 8 semanas')).toBeNull();
    expect(screen.getByText('Ficha técnica')).toBeTruthy();
  });

  it('skill: alterna entre formatado e cru', () => {
    noVersions();
    const skill = makeItem({
      type: 'skill',
      content: '---\nname: revisar-contrato\ndescription: Revisa contratos\n---\n\n# Passos\n\n- Compare as versões.',
    });
    renderDetail(skill);
    expect(screen.getByText('revisar-contrato')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cru' }));
    expect(screen.getByText(/name: revisar-contrato/)).toBeTruthy();
  });
});

describe('Catálogo', () => {
  const items = [makeItem({ id: 'a', title: 'Resumir issue' }), makeItem({ id: 'b', title: 'Gerar critérios', content: 'Texto simples', useCount: 30 })];

  it('um único h1, números honestos e abas do módulo para quem entrou', async () => {
    catalog.fetchCatalog.mockResolvedValue(ready(items));
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    expect((await screen.findAllByText('Resumir issue'))[0]).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca de IA' })).toBeTruthy();
    expect(screen.getByText('Cópias')).toBeTruthy();
    expect(screen.queryByText(/Execuções/)).toBeNull();
    expect(screen.queryByText(/Ateliê/)).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Seções do Prompt Hub' });
    expect(within(nav).getAllByRole('link').map(l => l.textContent)).toEqual(['Catálogo', 'Coleções', 'Favoritos', 'Meus itens']);
    expect(screen.getByText('Mostrando 2 de 2 itens')).toBeTruthy();
  });

  it('visitante vê só Catálogo e Coleções, o banner "Entrar" e nenhum botão de criar', async () => {
    h.session = null;
    catalog.fetchCatalog.mockResolvedValue(ready(items));
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    (await screen.findAllByText('Resumir issue'))[0];
    const nav = screen.getByRole('navigation', { name: 'Seções do Prompt Hub' });
    expect(within(nav).getAllByRole('link').map(l => l.textContent)).toEqual(['Catálogo', 'Coleções']);
    expect(screen.getByText(/Você está vendo só os modelos públicos/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Novo item/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Importar pasta/ })).toBeNull();
    expect(catalog.fetchCatalog.mock.calls[0][0]).toMatchObject({ anonymous: true });
  });

  it('a busca espera 300 ms e vai para o servidor', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      catalog.fetchCatalog.mockResolvedValue(ready(items));
      render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
      (await screen.findAllByText('Resumir issue'))[0];
      catalog.fetchCatalog.mockClear();
      fireEvent.change(screen.getByLabelText('Buscar na biblioteca'), { target: { value: 'contra' } });
      fireEvent.change(screen.getByLabelText('Buscar na biblioteca'), { target: { value: 'contrato' } });
      expect(catalog.fetchCatalog).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });
      await waitFor(() => expect(catalog.fetchCatalog.mock.calls.some(c => c[0].filters.search === 'contrato')).toBe(true));
    } finally {
      vi.useRealTimers();
    }
  });

  it('"Carregar mais" traz a próxima página e mostra "Mostrando N de M"', async () => {
    const page1 = Array.from({ length: 24 }, (_, i) => makeItem({ id: `p${i}`, title: `Item ${i}` }));
    catalog.fetchCatalog
      .mockResolvedValueOnce({ ...ready(page1), total: 30, totalPages: 2 })
      .mockResolvedValueOnce({ ...ready([makeItem({ id: 'p24', title: 'Item 24' })]), total: 30, totalPages: 2 })
      .mockResolvedValue({ ...ready(page1), total: 30, totalPages: 2 });
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    await screen.findByText('Item 0');
    expect(screen.getByText('Mostrando 24 de 30')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    await screen.findByText('Item 24');
    expect(catalog.fetchCatalog.mock.calls.some(c => c[0].page === 1)).toBe(true);
  });

  it('erro mostra "Tentar de novo" e recupera', async () => {
    catalog.fetchCatalog.mockRejectedValueOnce(new Error('queda')).mockResolvedValue(ready(items));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    expect(await screen.findByText('Não foi possível carregar a biblioteca')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect((await screen.findAllByText('Resumir issue'))[0]).toBeTruthy();
  });

  it('estados vazios: biblioteca vazia e nenhum resultado', async () => {
    catalog.fetchCatalog.mockResolvedValue(ready([], { facets: { ...facets, total: 0 } }));
    const { unmount } = render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    expect(await screen.findByText('A biblioteca ainda está vazia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar o primeiro item' })).toBeTruthy();
    unmount();

    catalog.fetchCatalog.mockResolvedValue(ready([]));
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    await screen.findByText('A biblioteca ainda está vazia');
    fireEvent.change(screen.getByLabelText('Buscar na biblioteca'), { target: { value: 'zzz' } });
    expect(await screen.findByText('Nada encontrado para "zzz"', undefined, { timeout: 2000 })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Limpar filtros' }).length).toBeGreaterThan(0);
  });

  it('logada sem cargo e squad: pede o perfil, com "Completar perfil" e "Apenas ver modelos públicos"', () => {
    const skip = vi.fn();
    render(<Catalog needsProfile publicOnly={false} onSkipProfile={skip} />);
    expect(screen.getByText('Complete seu perfil para usar a biblioteca')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apenas ver modelos públicos' }));
    expect(skip).toHaveBeenCalled();
    expect(catalog.fetchCatalog).not.toHaveBeenCalled();
  });

  it('o botão Filtros abre o painel único com visibilidade, situação, impacto, favoritos e etiquetas', async () => {
    catalog.fetchCatalog.mockResolvedValue(ready(items));
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    (await screen.findAllByText('Resumir issue'))[0];
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    const panel = document.getElementById('ph-filtros')!;
    expect(within(panel).getByText('VISIBILIDADE')).toBeTruthy();
    expect(within(panel).getByText('SITUAÇÃO')).toBeTruthy();
    expect(within(panel).getByText('IMPACTO')).toBeTruthy();
    expect(within(panel).getByRole('switch', { name: /Apenas favoritos/ })).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Públicos' }));
    await waitFor(() => expect(catalog.fetchCatalog.mock.calls.some(c => c[0].filters.visibility === 'public')).toBe(true));
  });

  it('a aba "Meus itens" consulta só os itens da pessoa', async () => {
    h.search = new URLSearchParams('aba=meus');
    catalog.fetchCatalog.mockResolvedValue(ready(items));
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    (await screen.findAllByText('Resumir issue'))[0];
    expect(catalog.fetchCatalog.mock.calls[0][0]).toMatchObject({ mineOnly: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Meus itens' })).toBeTruthy();
  });

  it('clicar no título abre o painel lateral com o mesmo conteúdo da página e o atalho "Abrir como página"', async () => {
    vi.spyOn(promptApi, 'getComments').mockResolvedValue([]);
    vi.spyOn(promptApi, 'listVersions').mockRejectedValue(new ApiError('x', 404));
    vi.spyOn(promptApi, 'usage').mockRejectedValue(new ApiError('x', 404));
    catalog.fetchCatalog.mockResolvedValue(ready(items));
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Resumir issue' }))[0]);
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByRole('link', { name: 'Abrir como página' }).getAttribute('href')).toBe('/prompt-hub/a');
    expect(within(panel).getByText('Ficha técnica')).toBeTruthy();
    expect(within(panel).getByText('Preencha os campos')).toBeTruthy();
    // a página atrás do painel continua com um único h1
    expect(screen.getAllByRole('heading', { level: 1, hidden: true })).toHaveLength(1);
  });

  it('o Guia abre a folha lateral do kit', async () => {
    catalog.fetchCatalog.mockResolvedValue(ready(items));
    render(<Catalog needsProfile={false} publicOnly={false} onSkipProfile={vi.fn()} />);
    (await screen.findAllByText('Resumir issue'))[0];
    fireEvent.click(screen.getByRole('button', { name: /Guia/ }));
    expect(await screen.findByText('Guia da biblioteca')).toBeTruthy();
    expect(screen.getAllByText('Fluxo de trabalho').length).toBeGreaterThan(0);
  });
});

describe('PromptGuide', () => {
  it('lista os 8 tipos e só as duas visibilidades', async () => {
    render(<PromptGuide open onOpenChange={vi.fn()} />);
    for (const label of ['Prompt', 'Skill', 'Agente', 'Gem', 'Instrução', 'Fluxo de trabalho', 'MCP', 'Recurso']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    pickTab(screen.getByRole('tab', { name: 'Quem vê o quê' }));
    expect(screen.getByText('Privado')).toBeTruthy();
    expect(screen.getByText('Público')).toBeTruthy();
    expect(screen.queryByText(/squad/i)).toBeNull();
  });
});

describe('Meu espaço: aba Prompts', () => {
  it('lista os meus itens com os mesmos cartões', async () => {
    catalog.fetchCatalog.mockResolvedValue(ready([makeItem({ id: 'm1', title: 'Meu prompt', authorId: 'me', canEdit: true })]));
    const del = vi.spyOn(promptApi, 'deletePrompt').mockResolvedValue(undefined);
    render(<MyPrompts userProfile={{ id: 'me', name: 'Ana Souza' }} />);
    expect(await screen.findByText('Meu prompt')).toBeTruthy();
    expect(catalog.fetchCatalog.mock.calls[0][0]).toMatchObject({ mineOnly: true, sessionId: 'me', filters: { status: 'all' } });

    expect(screen.getByRole('button', { name: /Mais ações/ })).toBeTruthy();
    expect(del).not.toHaveBeenCalled();
  });

  it('sem itens: estado vazio com "Criar primeiro item"', async () => {
    catalog.fetchCatalog.mockResolvedValue(ready([]));
    render(<MyPrompts userProfile={{ id: 'me' }} />);
    expect(await screen.findByText('Nenhum item encontrado')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Criar primeiro item/ }));
    expect(h.push).toHaveBeenCalledWith('/prompt-hub/novo');
  });

  it('erro ao carregar mostra "Tentar de novo"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    catalog.fetchCatalog.mockRejectedValueOnce(new Error('queda')).mockResolvedValue(ready([makeItem({ title: 'Voltou' })]));
    render(<MyPrompts userProfile={{ id: 'me' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /Tentar de novo/ }));
    expect(await screen.findByText('Voltou')).toBeTruthy();
  });
});
