import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRO_TEMPLATES, type RetroBoard, type RetroCard, type RetroParticipant, type RetroTemplateKey } from '../../../lib/types';

// ---- Mesmas peças de fora da sala dos outros testes da Retro (rede, contexto próprio, Radix que trava o jsdom). ----
vi.mock('next/navigation', () => ({ usePathname: () => '/retro/b1', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => ({ userProfile: { id: 'me', name: 'Ana Souza' } }) }));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'PHOENIX', squadName: 'Phoenix' }) }));
vi.mock('../../../hooks/useMyMemberships', () => ({ useMyMemberships: () => ({ memberships: null, settled: true, stale: false, refresh: () => {} }) }));
vi.mock('../../../app/retro/api', () => ({ retroApi: { saveOrUpdateBoard: vi.fn() } }));
vi.mock('../../poker/team-chat/TeamChat', () => ({ TeamChat: () => null }));
vi.mock('../ExportRetroDialog', () => ({ ExportRetroDialog: () => null }));
vi.mock('../RetroActionImportDialog', () => ({ RetroActionImportDialog: () => null }));
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; 'aria-label'?: string }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));
vi.mock('../../ui/dropdown-menu', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuSub: passthrough,
    DropdownMenuSubTrigger: () => null,
    DropdownMenuSubContent: () => null,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div data-menu>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button role="menuitem" onClick={onClick}>{children}</button>,
  };
});

import { RetroRoom, type RetroRoomProps } from '../RetroRoom';
import { RetroWelcome } from '../RetroWelcome';
import { RetroGuide } from '../RetroGuide';
import { RetroScene } from '../RetroScene';
import { CreateRetroDialog } from '../CreateRetroDialog';
import { useRetroSceneMode } from '../useRetroSceneMode';
import { RETRO_SCENE_PREF_KEY } from '../retro-scene-mode';
import { RETRO_FORMATS } from '../../../lib/retro-formats';
import { RETRO_FORMAT_THEMES } from '../../../lib/retro-format-themes';

// ---- matchMedia controlável: cada teste diz quais consultas "batem". ----
let mediaMatches: (query: string) => boolean = () => false;

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    get matches() { return mediaMatches(query); },
    media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  (Element.prototype as any).scrollIntoView = (Element.prototype as any).scrollIntoView || (() => {});
  (Element.prototype as any).hasPointerCapture = (Element.prototype as any).hasPointerCapture || (() => false);
});

beforeEach(() => {
  mediaMatches = () => false;
  window.localStorage.clear();
  window.localStorage.setItem('agile_retro_welcome_dismissed', 'true');
  document.documentElement.classList.remove('theme-leitura');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.classList.remove('theme-leitura');
});

const COLUMNS = (key: Exclude<RetroTemplateKey, 'custom'>) => RETRO_TEMPLATES[key];

const board = (templateKey: RetroTemplateKey | undefined, over: Partial<RetroBoard> = {}): RetroBoard => ({
  id: 'b1', creatorId: 'fac', isCardsRevealed: false, votingStatus: 'disabled', isAuthorsRevealed: false, createdAt: '2025-10-17T10:00:00Z',
  title: 'Retro Sprint 42', team: 'Phoenix', templateKey,
  columns: templateKey && templateKey !== 'custom' ? COLUMNS(templateKey) : [
    { id: 'custom_0_1', title: 'Pontos bons', theme: 'success', order: 0 },
    { id: 'custom_1_1', title: 'Ações', theme: 'action', order: 1 },
  ],
  maxVotesPerParticipant: 3, ...over,
});

const people: RetroParticipant[] = [
  { id: 'fac', boardId: 'b1', nickname: 'Carla Mendes', role: 'AM', isCreator: true },
  { id: 'me', boardId: 'b1', nickname: 'Ana Souza', role: 'DEV', isCreator: false },
];

function setup(opts: { board: RetroBoard; cards?: RetroCard[]; me?: 'fac' | 'me'; props?: Partial<RetroRoomProps> }) {
  const meId = opts.me ?? 'fac';
  const handlers = {
    onAddCard: vi.fn(async () => true), onDeleteCard: vi.fn(), onUpdateCard: vi.fn(), onToggleVote: vi.fn(), onToggleReaction: vi.fn(), onToggleDone: vi.fn(),
    onImportActions: vi.fn(), onToggleCardsRevealed: vi.fn(), onSetVotingStatus: vi.fn(), onSetMaxVotesPerParticipant: vi.fn(),
    onStartTimer: vi.fn(), onPauseTimer: vi.fn(), onResumeTimer: vi.fn(), onResetTimer: vi.fn(), onSetTimerDuration: vi.fn(), onTimerExpire: vi.fn(),
    onToggleShowAuthors: vi.fn(), onToggleSyncStage: vi.fn(), onToggleAutoRevealOnTimerEnd: vi.fn(), onToggleAutoSortOnVoteEnd: vi.fn(),
    onToggleHealthCheck: vi.fn(), onHealthCheckQuestionChange: vi.fn(), onToggleColumnSort: vi.fn(), onRenameColumn: vi.fn(), onSyncSummary: vi.fn(),
    onDragEnd: vi.fn(), onRemoveParticipant: vi.fn(), onClaimCreator: vi.fn(), onLeaveBoard: vi.fn(), onStageChange: vi.fn(), onStartMerge: vi.fn(),
    onExecuteMerge: vi.fn(), onOpenFeedback: vi.fn(), onOpenStats: vi.fn(), onSendChatMessage: vi.fn(), onDeleteChatMessage: vi.fn(),
  };
  const props: RetroRoomProps = {
    boardId: 'b1',
    boardData: opts.board,
    cards: opts.cards ?? [],
    participants: people,
    currentUserId: meId,
    currentParticipant: people.find((p) => p.id === meId)!,
    isCurrentUserCreator: meId === 'fac',
    timer: { status: 'stopped', initialDuration: 300, remainingOnPause: 300, endTime: null },
    activeStage: opts.board.columns?.[0]?.id ?? 'wentWell',
    mergingSourceId: null,
    chatMessagesByChannel: {},
    ...handlers,
    ...opts.props,
  };
  return { ...render(<RetroRoom {...props} />), handlers };
}

const sceneEl = () => document.querySelector<HTMLElement>('[data-retro-scene]');
const sceneLoaded = () => waitFor(() => expect(sceneEl()).not.toBeNull());

describe('preferência "Cenário da retro" (useRetroSceneMode)', () => {
  it('começa Suave, lê o valor guardado no navegador e grava a escolha', async () => {
    const { result, unmount } = renderHook(() => useRetroSceneMode(false));
    await waitFor(() => expect(result.current.mode).toBe('soft'));
    expect(result.current.preference).toBe('soft');
    act(() => result.current.setPreference('full'));
    expect(result.current.mode).toBe('full');
    expect(window.localStorage.getItem(RETRO_SCENE_PREF_KEY)).toBe('full');
    unmount();
    const again = renderHook(() => useRetroSceneMode(false));
    await waitFor(() => expect(again.result.current.preference).toBe('full'));
  });

  it('valor guardado que não serve é ignorado', async () => {
    window.localStorage.setItem(RETRO_SCENE_PREF_KEY, 'neon');
    const { result } = renderHook(() => useRetroSceneMode(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.preference).toBe('soft');
  });

  it('sem storage (modo privado) a sala segue no padrão e a escolha vale só na sessão, sem erro', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const { result } = renderHook(() => useRetroSceneMode(false));
    expect(result.current.mode).toBe('soft');
    act(() => result.current.setPreference('off'));
    expect(result.current.mode).toBe('off');
  });

  it('o tema Leitura desliga e bloqueia, e a troca de tema é acompanhada na hora', async () => {
    const { result } = renderHook(() => useRetroSceneMode(false));
    act(() => result.current.setPreference('full'));
    expect(result.current.mode).toBe('full');
    await act(async () => { document.documentElement.classList.add('theme-leitura'); await Promise.resolve(); });
    await waitFor(() => expect(result.current.mode).toBe('off'));
    expect(result.current.locked).toBe(true);
    expect(result.current.preference).toBe('full');
    await act(async () => { document.documentElement.classList.remove('theme-leitura'); await Promise.resolve(); });
    await waitFor(() => expect(result.current.mode).toBe('full'));
    expect(result.current.locked).toBe(false);
  });

  it('apresentar limita a Suave e "reduzir movimento" faz o Completo virar Suave', async () => {
    window.localStorage.setItem(RETRO_SCENE_PREF_KEY, 'full');
    const presenting = renderHook(() => useRetroSceneMode(true));
    await waitFor(() => expect(presenting.result.current.preference).toBe('full'));
    expect(presenting.result.current.mode).toBe('soft');
    presenting.unmount();

    mediaMatches = (q) => q.includes('prefers-reduced-motion');
    const reduced = renderHook(() => useRetroSceneMode(false));
    await waitFor(() => expect(reduced.result.current.preference).toBe('full'));
    await waitFor(() => expect(reduced.result.current.mode).toBe('soft'));
  });
});

describe('RetroScene', () => {
  it('Suave: o cenário do formato aparece atrás de tudo, sem clique, escondido de leitor de tela', async () => {
    render(<div><RetroScene templateKey="sailboat" mode="soft" /></div>);
    await sceneLoaded();
    const el = sceneEl()!;
    expect(el.getAttribute('data-retro-scene')).toBe('sailboat');
    expect(el.getAttribute('data-mode')).toBe('soft');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('pointer-events-none');
    expect(el.className).toContain('-z-10');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('svg')!.getAttribute('aria-hidden')).toBeNull(); // o aria-hidden está no contêiner
    expect(el.textContent).toBe('');
  });

  it('Desligado, formato personalizado, quadro antigo e chave desconhecida: nada é desenhado', async () => {
    const { rerender } = render(<div><RetroScene templateKey="sailboat" mode="off" /></div>);
    await new Promise((r) => setTimeout(r, 30));
    expect(sceneEl()).toBeNull();
    for (const key of ['custom', undefined, 'nao_existe']) {
      rerender(<div><RetroScene templateKey={key} mode="full" /></div>);
      await new Promise((r) => setTimeout(r, 30));
      expect(sceneEl(), String(key)).toBeNull();
    }
  });

  it('Completo marca o modo; só ele move as camadas com o ponteiro (ponteiro fino)', async () => {
    mediaMatches = (q) => q.includes('pointer: fine');
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 1; });
    const { container } = render(<div data-host><RetroScene templateKey="hot_air_balloon" mode="full" /></div>);
    await sceneLoaded();
    expect(sceneEl()!.getAttribute('data-mode')).toBe('full');
    const host = container.querySelector('[data-host]') as HTMLElement;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) });
    host.dispatchEvent(new MouseEvent('pointermove', { clientX: 1000, clientY: 250, bubbles: true }));
    expect(sceneEl()!.style.getPropertyValue('--mx')).toBe('1.000');
    expect(sceneEl()!.style.getPropertyValue('--my')).toBe('0.000');
    raf.mockRestore();
  });

  it('sem ponteiro fino (celular) ou em Suave, a paralaxe não liga', async () => {
    const { container, rerender } = render(<div data-host><RetroScene templateKey="sailboat" mode="full" /></div>);
    await sceneLoaded();
    const host = container.querySelector('[data-host]') as HTMLElement;
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) });
    host.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 100, bubbles: true }));
    expect(sceneEl()!.style.getPropertyValue('--mx')).toBe('');
    mediaMatches = (q) => q.includes('pointer: fine');
    rerender(<div data-host><RetroScene templateKey="sailboat" mode="soft" /></div>);
    host.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 100, bubbles: true }));
    expect(sceneEl()!.style.getPropertyValue('--mx')).toBe('');
  });
});

describe('sala da Retro com cenário', () => {
  it('Veleiro e Carro veloz: cada um com o cenário do formato atrás das colunas, ícone e pergunta-guia', async () => {
    const view = setup({ board: board('sailboat') });
    await sceneLoaded();
    expect(sceneEl()!.getAttribute('data-retro-scene')).toBe('sailboat');
    const wind = screen.getByRole('region', { name: RETRO_TEMPLATES.sailboat[0].title });
    expect(within(wind).getByText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.guia)).toBeTruthy();
    expect(wind.className).toContain('bg-card/80');
    expect(wind.className).toContain('retro-on-scene');
    expect(wind.querySelector('svg')).not.toBeNull(); // ícone da coluna no quadro
    view.unmount();

    setup({ board: board('speed_car') });
    await waitFor(() => expect(sceneEl()?.getAttribute('data-retro-scene')).toBe('speed_car'));
    expect(screen.getByText(RETRO_FORMAT_THEMES.speed_car.colunas.engine.guia)).toBeTruthy();
  });

  it('o halo de antes sai quando há cenário e volta quando não há', async () => {
    const view = setup({ board: board('sailboat') });
    await sceneLoaded();
    expect(document.querySelector('.room-halo')).toBeNull();
    view.unmount();
    setup({ board: board('custom') });
    expect(document.querySelector('.room-halo')).not.toBeNull();
    expect(sceneEl()).toBeNull();
  });

  it('formato personalizado: sem cenário, sem pergunta-guia, fundo e textos de sempre', () => {
    setup({ board: board('custom') });
    const col = screen.getByRole('region', { name: 'Pontos bons' });
    expect(col.className).toContain('bg-muted/30');
    expect(col.className).not.toContain('retro-on-scene');
    expect(within(col).getByText('Nenhum cartão ainda')).toBeTruthy();
    expect(screen.getAllByText('Adicionar cartão').length).toBeGreaterThan(0);
  });

  it('escolher Desligado tira o cenário e devolve o fundo da coluna', async () => {
    window.localStorage.setItem(RETRO_SCENE_PREF_KEY, 'off');
    setup({ board: board('sailboat') });
    await new Promise((r) => setTimeout(r, 30));
    expect(sceneEl()).toBeNull();
    expect(screen.getByRole('region', { name: RETRO_TEMPLATES.sailboat[0].title }).className).toContain('bg-muted/30');
    // a identidade da coluna (pergunta-guia) é do formato, não do cenário: continua
    expect(screen.getByText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.guia)).toBeTruthy();
  });

  it('tema Leitura: nenhum cenário e o fundo da coluna não vira translúcido', async () => {
    document.documentElement.classList.add('theme-leitura');
    window.localStorage.setItem(RETRO_SCENE_PREF_KEY, 'full');
    setup({ board: board('sailboat') });
    await new Promise((r) => setTimeout(r, 30));
    expect(sceneEl()).toBeNull();
    expect(screen.getByRole('region', { name: RETRO_TEMPLATES.sailboat[0].title }).className).toContain('bg-muted/30');
  });

  it('estado vazio e placeholder na voz do formato; coluna de ação com o texto do formato', async () => {
    setup({ board: board('sailboat') });
    const wind = screen.getByRole('region', { name: RETRO_TEMPLATES.sailboat[0].title });
    expect(within(wind).getByText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.vazio.titulo)).toBeTruthy();
    expect(within(wind).getByText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.vazio.dica)).toBeTruthy();
    fireEvent.click(within(wind).getByRole('button', { name: /Adicionar cartão/ }));
    expect(within(wind).getByPlaceholderText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.placeholder)).toBeTruthy();
  });

  it('coluna renomeada pelo facilitador: mantém o ícone e esconde pergunta-guia, vazio e placeholder do formato', () => {
    const b = board('sailboat');
    b.columns = b.columns!.map((c) => (c.id === 'wind' ? { ...c, title: 'Brisa da squad' } : c));
    setup({ board: b });
    const col = screen.getByRole('region', { name: 'Brisa da squad' });
    expect(within(col).queryByText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.guia)).toBeNull();
    expect(within(col).queryByText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.vazio.titulo)).toBeNull();
    expect(within(col).getByText('Nenhum cartão ainda')).toBeTruthy();
    expect(col.querySelector('svg')).not.toBeNull(); // o ícone fica
    fireEvent.click(within(col).getByRole('button', { name: /Adicionar cartão/ }));
    expect(within(col).queryByPlaceholderText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.placeholder)).toBeNull();
    expect(within(col).getByPlaceholderText('Escreva seu feedback aqui…')).toBeTruthy();
    // as outras colunas do formato seguem com a identidade
    expect(screen.getByText(RETRO_FORMAT_THEMES.sailboat.colunas.sun.guia)).toBeTruthy();
  });

  it('cartões e funções seguem iguais: adicionar cartão no campo temático envia o texto na coluna certa', async () => {
    const { handlers } = setup({ board: board('sailboat') });
    const wind = screen.getByRole('region', { name: RETRO_TEMPLATES.sailboat[0].title });
    fireEvent.click(within(wind).getByRole('button', { name: /Adicionar cartão/ }));
    const field = within(wind).getByPlaceholderText(RETRO_FORMAT_THEMES.sailboat.colunas.wind.placeholder);
    fireEvent.change(field, { target: { value: 'Pareamento' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(handlers.onAddCard).toHaveBeenCalledWith('Pareamento', 'wind', undefined, undefined));
  });

  it('o menu "Mais" tem "Cenário da retro: Suave"; a janela muda a preferência para Completo e a guarda', async () => {
    setup({ board: board('sailboat'), me: 'me' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cenário da retro: Suave' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cenário da retro' });
    const group = within(dialog).getByRole('radiogroup', { name: 'Cenário da retro' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent)).toEqual([
      expect.stringContaining('Completo'), expect.stringContaining('Suave'), expect.stringContaining('Desligado'),
    ]);
    expect(within(group).getByRole('radio', { name: /Suave/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(group).getByRole('radio', { name: /Completo/ }));
    expect(window.localStorage.getItem(RETRO_SCENE_PREF_KEY)).toBe('full');
    await waitFor(() => expect(sceneEl()?.getAttribute('data-mode')).toBe('full'));
    expect(screen.getByRole('menuitem', { name: 'Cenário da retro: Completo', hidden: true })).toBeTruthy();
  });

  it('quadro sem cenário (personalizado) não mostra o item de cenário no menu', () => {
    setup({ board: board('custom') });
    expect(screen.queryByRole('menuitem', { name: /Cenário da retro/ })).toBeNull();
  });

  it('no tema Leitura a janela avisa e bloqueia as três opções', async () => {
    document.documentElement.classList.add('theme-leitura');
    setup({ board: board('sailboat'), me: 'me' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Cenário da retro: Desligado' })).toBeTruthy());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cenário da retro: Desligado' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cenário da retro' });
    expect(within(dialog).getByText(/Tema Leitura confortável/)).toBeTruthy();
    for (const radio of within(dialog).getAllByRole('radio')) expect((radio as HTMLButtonElement).disabled).toBe(true);
  });

  it('a configuração da sala (facilitador) também traz a preferência de cenário', async () => {
    setup({ board: board('sailboat') });
    fireEvent.click(screen.getByRole('button', { name: 'Configurações da retro' }));
    const dialog = await screen.findByRole('dialog', { name: 'Configurações da retro' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Cenário da retro' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Desligado/ }));
    expect(window.localStorage.getItem(RETRO_SCENE_PREF_KEY)).toBe('off');
  });

  it('apresentar usa sempre o Suave, mesmo com o Completo escolhido', async () => {
    window.localStorage.setItem(RETRO_SCENE_PREF_KEY, 'full');
    setup({ board: board('sailboat') });
    await waitFor(() => expect(sceneEl()?.getAttribute('data-mode')).toBe('full'));
    fireEvent.click(screen.getByRole('button', { name: 'Apresentar' }));
    await waitFor(() => expect(sceneEl()?.getAttribute('data-mode')).toBe('soft'));
  });
});

describe('tempo sugerido por fase', () => {
  it('o facilitador vê o chip da fase atual e um clique aplica ao timer (segundos)', () => {
    const { handlers } = setup({ board: board('sailboat') });
    const minutes = RETRO_FORMAT_THEMES.sailboat.temposPorFase.write;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Aplicar ao timer: ${minutes} minutos`) }));
    expect(handlers.onSetTimerDuration).toHaveBeenCalledWith(minutes * 60);
  });

  it('acompanha a fase: revelada pede o tempo de revelar', () => {
    const { handlers } = setup({ board: board('sailboat', { isCardsRevealed: true }) });
    const minutes = RETRO_FORMAT_THEMES.sailboat.temposPorFase.reveal;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Aplicar ao timer: ${minutes} minutos, sugeridos para Revelar`) }));
    expect(handlers.onSetTimerDuration).toHaveBeenCalledWith(minutes * 60);
  });

  it('já no tempo sugerido, o chip só informa; participante e formato personalizado não veem', () => {
    const minutes = RETRO_FORMAT_THEMES.sailboat.temposPorFase.write;
    const view = setup({ board: board('sailboat'), props: { timer: { status: 'stopped', initialDuration: minutes * 60, remainingOnPause: minutes * 60, endTime: null } } });
    const chip = screen.getByRole('button', { name: /Timer no tempo sugerido/ });
    expect((chip as HTMLButtonElement).disabled).toBe(true);
    view.unmount();
    setup({ board: board('sailboat'), me: 'me' });
    expect(screen.queryByRole('button', { name: /Aplicar ao timer/ })).toBeNull();
    cleanup();
    setup({ board: board('custom') });
    expect(screen.queryByRole('button', { name: /Aplicar ao timer/ })).toBeNull();
  });

  it('com o timer rodando o chip some (nada muda no cronômetro sem ação)', () => {
    setup({ board: board('sailboat'), props: { timer: { status: 'running', initialDuration: 300, remainingOnPause: 300, endTime: Date.now() + 60000 } } });
    expect(screen.queryByRole('button', { name: /Aplicar ao timer/ })).toBeNull();
  });
});

describe('boas-vindas e guia com a dinâmica do formato', () => {
  it('as boas-vindas trazem o quebra-gelo, o tempo de abertura, o nome do formato e o tempo de cada passo', () => {
    window.localStorage.setItem('agile_retro_welcome_dismissed', 'false');
    render(<RetroWelcome title="Retro Sprint 42" isFacilitator disabled={false} templateKey="sailboat" />);
    const theme = RETRO_FORMAT_THEMES.sailboat;
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(theme.quebraGelo)).toBeTruthy();
    expect(within(dialog).getByText(`Para abrir (${theme.temposPorFase.ice} min)`)).toBeTruthy();
    expect(within(dialog).getByText(/Formato: Veleiro/)).toBeTruthy();
    expect(within(dialog).getByText(`sugerido ${theme.temposPorFase.write} min`)).toBeTruthy();
    expect(within(dialog).getByText(`sugerido ${theme.temposPorFase.act} min`)).toBeTruthy();
  });

  it('depois de "Começar" as boas-vindas não voltam ao recarregar a mesma retro, mas aparecem em outra', async () => {
    window.localStorage.clear();
    const first = render(<RetroWelcome title="Retro A" isFacilitator disabled={false} boardId="rA" />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar' }));
    first.unmount();
    render(<RetroWelcome title="Retro A" isFacilitator disabled={false} boardId="rA" />);
    await waitFor(() => expect(window.localStorage.getItem('agile_retro_welcome_seen_rA')).toBe('true'));
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    render(<RetroWelcome title="Retro B" isFacilitator disabled={false} boardId="rB" />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('sem formato conhecido, as boas-vindas ficam como eram', () => {
    window.localStorage.setItem('agile_retro_welcome_dismissed', 'false');
    render(<RetroWelcome title="Retro livre" isFacilitator={false} disabled={false} templateKey="custom" />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/Para abrir/)).toBeNull();
    expect(within(dialog).queryByText(/sugerido/)).toBeNull();
  });

  it('o guia repete o quebra-gelo e o tempo de cada fase', () => {
    render(<RetroGuide open onOpenChange={() => {}} templateKey="incident" />);
    const theme = RETRO_FORMAT_THEMES.incident;
    expect(screen.getByText(theme.quebraGelo)).toBeTruthy();
    expect(screen.getAllByText(/Tempo sugerido para este formato/)).toHaveLength(4);
  });
});

describe('seletor de formato do "Nova retro"', () => {
  it('mantém o radiogroup acessível com os grupos, os 17 formatos e o personalizado', async () => {
    render(<CreateRetroDialog open onOpenChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Formato das colunas' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(RETRO_FORMATS.length);
    expect(radios).toHaveLength(18);
    expect(within(group).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Essenciais', 'Clima e pessoas', 'Metáforas', 'Para situações específicas', 'Do seu jeito',
    ]);
    expect(within(group).getByRole('radio', { name: /Clássico/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(group).getByRole('radio', { name: /Veleiro/ }));
    expect(within(group).getByRole('radio', { name: /Veleiro/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(group).getByRole('radio', { name: /Clássico/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('cada formato pronto mostra a miniatura do próprio cenário e uma ficha com o ícone de cada coluna; o personalizado fica neutro', async () => {
    render(<CreateRetroDialog open onOpenChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Formato das colunas' });
    await waitFor(() => expect(group.querySelectorAll('[data-retro-scene]')).toHaveLength(17));
    const radios = within(group).getAllByRole('radio');
    for (const radio of radios) {
      const key = RETRO_FORMATS.find((f) => radio.textContent?.includes(f.name))?.key;
      expect(key).toBeTruthy();
      if (key === 'custom') {
        expect(radio.querySelector('[data-retro-scene]')).toBeNull();
        continue;
      }
      expect(radio.querySelector('[data-retro-scene]')?.getAttribute('data-retro-scene'), String(key)).toBe(key);
      const thumb = radio.querySelector('[data-retro-scene]')!.parentElement!;
      expect(thumb.querySelectorAll('svg').length, `${key}: cenário + ${RETRO_TEMPLATES[key as keyof typeof RETRO_TEMPLATES].length} fichas`).toBe(1 + RETRO_TEMPLATES[key as keyof typeof RETRO_TEMPLATES].length);
      expect(thumb.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
