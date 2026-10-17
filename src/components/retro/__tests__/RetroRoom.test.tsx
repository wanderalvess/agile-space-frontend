import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetroBoard, RetroCard, RetroParticipant } from '../../../lib/types';

// ---- Peças com rede, contexto próprio ou peso (PDF) ficam de fora: aqui vale a estrutura da sala. ----
vi.mock('next/navigation', () => ({ usePathname: () => '/retro/b1', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock('../../poker/team-chat/TeamChat', () => ({ TeamChat: () => null }));
vi.mock('../ExportRetroDialog', () => ({ ExportRetroDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div role="dialog" aria-label="Exportar" /> : null) }));
vi.mock('../RetroActionImportDialog', () => ({ RetroActionImportDialog: () => null }));
// O Select do Radix não abre no jsdom: um <select> nativo exercita a mesma lógica de opções.
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; 'aria-label'?: string }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

// O DropdownMenu do Radix trava o jsdom ao abrir (mesmo isolado): o menu vira uma lista simples sempre visível,
// o que basta para exercitar o que cada item faz.
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

const toastMock = vi.fn();

import { RetroRoom, type RetroRoomProps } from '../RetroRoom';

beforeAll(() => {
  // jsdom não traz matchMedia nem ResizeObserver, que o kit e o Radix usam.
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  (Element.prototype as any).scrollIntoView = (Element.prototype as any).scrollIntoView || (() => {});
  (Element.prototype as any).hasPointerCapture = (Element.prototype as any).hasPointerCapture || (() => false);
});

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('agile_retro_welcome_dismissed', 'true');
  toastMock.mockClear();
});
afterEach(cleanup);

const COLUMNS = [
  { id: 'wentWell', title: 'O que funcionou?', theme: 'success' as const, order: 0 },
  { id: 'toImprove', title: 'O que melhorar?', theme: 'warning' as const, order: 1 },
  { id: 'actionItems', title: 'Plano de Ação', theme: 'action' as const, order: 2 },
];

const board = (over: Partial<RetroBoard> = {}): RetroBoard => ({
  id: 'b1', creatorId: 'fac', isCardsRevealed: false, votingStatus: 'disabled', isAuthorsRevealed: false, createdAt: '2025-10-17T10:00:00Z',
  title: 'Retro Sprint 42', team: 'Phoenix', templateKey: 'classic', columns: COLUMNS, maxVotesPerParticipant: 3, ...over,
});

const people: RetroParticipant[] = [
  { id: 'fac', boardId: 'b1', nickname: 'Carla Mendes', role: 'AM', isCreator: true },
  { id: 'me', boardId: 'b1', nickname: 'Ana Souza', role: 'DEV', isCreator: false },
  { id: 'u3', boardId: 'b1', nickname: 'Bruno Lima', role: 'QA', isCreator: false },
];

const card = (over: Partial<RetroCard> & { id: string }): RetroCard => ({
  boardId: 'b1', columnKey: 'wentWell', content: `texto ${over.id}`, authorId: 'u3', votes: [], order: 1000, ...over,
});

function setup(opts: { board?: Partial<RetroBoard>; cards?: RetroCard[]; me?: 'fac' | 'me'; props?: Partial<RetroRoomProps> } = {}) {
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
    boardData: board(opts.board),
    cards: opts.cards ?? [],
    participants: people,
    currentUserId: meId,
    currentParticipant: people.find((p) => p.id === meId)!,
    isCurrentUserCreator: meId === 'fac',
    timer: { status: 'stopped', initialDuration: 300, remainingOnPause: 300, endTime: null },
    activeStage: 'wentWell',
    mergingSourceId: null,
    chatMessagesByChannel: {},
    ...handlers,
    ...opts.props,
  };
  const view = render(<RetroRoom {...props} />);
  return { ...view, handlers, props };
}

describe('sala da Retro: cabeçalho e fases', () => {
  it('mostra o nome, a squad, o formato e as quatro fases com a atual marcada', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Retro Sprint 42' })).toBeTruthy();
    expect(screen.getByText('Phoenix')).toBeTruthy();
    expect(screen.getByText('Clássico')).toBeTruthy();
    const phases = screen.getByLabelText('Fases da retro');
    expect(within(phases).getAllByRole('listitem').map((li) => li.textContent?.replace(/\d/g, '').trim())).toEqual(['Escrever', 'Revelar', 'Votar', 'Agir']);
    expect(within(phases).getByText('Escrever').closest('li')?.getAttribute('aria-current')).toBe('step');
  });

  it('a fase acompanha o quadro: revelada, votando e encerrada', () => {
    const { rerender, props } = setup({ board: { isCardsRevealed: true } });
    const current = () => screen.getByLabelText('Fases da retro').querySelector('[aria-current=step]')?.textContent;
    expect(current()).toContain('Revelar');
    rerender(<RetroRoom {...props} boardData={board({ isCardsRevealed: true, votingStatus: 'active' })} />);
    expect(current()).toContain('Votar');
    rerender(<RetroRoom {...props} boardData={board({ isCardsRevealed: true, votingStatus: 'finished' })} />);
    expect(current()).toContain('Agir');
  });

  it('as três colunas do formato aparecem na ordem', () => {
    setup();
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter((l) => COLUMNS.some((c) => c.title === l))).toEqual(['O que funcionou?', 'O que melhorar?', 'Plano de Ação']);
  });
});

describe('sala da Retro: permissões de facilitador e participante', () => {
  it('facilitador revela os cartões; participante só vê o estado', () => {
    const fac = setup();
    fireEvent.click(screen.getByRole('button', { name: /Revelar cartões/ }));
    expect(fac.handlers.onToggleCardsRevealed).toHaveBeenCalledTimes(1);
    cleanup();

    setup({ me: 'me' });
    expect(screen.queryByRole('button', { name: /Revelar cartões/ })).toBeNull();
    expect(screen.getByText('Escrevendo · cartões ocultos')).toBeTruthy();
    expect(screen.queryByLabelText('Votos por painel')).toBeNull();
  });

  it('revelada: o facilitador inicia a votação ou volta a ocultar', () => {
    const { handlers } = setup({ board: { isCardsRevealed: true } });
    fireEvent.click(screen.getByRole('button', { name: /Iniciar votação/ }));
    expect(handlers.onSetVotingStatus).toHaveBeenCalledWith('active');
    fireEvent.click(screen.getByRole('button', { name: /Ocultar cartões/ }));
    expect(handlers.onToggleCardsRevealed).toHaveBeenCalledTimes(1);
  });

  it('votando: encerra a votação; zerar pede confirmação e só então zera', async () => {
    const { handlers } = setup({ board: { isCardsRevealed: true, votingStatus: 'active' } });
    fireEvent.click(screen.getByRole('button', { name: /Encerrar votação/ }));
    expect(handlers.onSetVotingStatus).toHaveBeenCalledWith('finished');

    fireEvent.click(screen.getByRole('button', { name: /Zerar votos/ }));
    expect(handlers.onSetVotingStatus).not.toHaveBeenCalledWith('disabled');
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zerar votos' }));
    expect(handlers.onSetVotingStatus).toHaveBeenCalledWith('disabled');
  });

  it('o limite de votos por painel é do facilitador e inclui o valor atual', () => {
    const { handlers } = setup({ board: { isCardsRevealed: true, maxVotesPerParticipant: 5 } });
    const select = screen.getByLabelText('Votos por painel') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['3', '5', '10', 'Sem limite']);
    expect(select.value).toBe('5');
    fireEvent.change(select, { target: { value: '10' } });
    expect(handlers.onSetMaxVotesPerParticipant).toHaveBeenCalledWith(10);
  });

  it('participante vê o limite sem poder mudar', () => {
    setup({ me: 'me', board: { isCardsRevealed: true, votingStatus: 'active', maxVotesPerParticipant: 3 } });
    expect(screen.getByText('Votação aberta')).toBeTruthy();
    expect(screen.getByText(/Votos por painel:/).textContent).toContain('3');
    expect(screen.queryByLabelText('Votos por painel')).toBeNull();
  });
});

describe('sala da Retro: cartões, anonimato e votos', () => {
  it('na fase anônima os cartões dos outros ficam ocultos', () => {
    setup({ me: 'me', cards: [card({ id: 'x', hidden: true, content: '', authorId: '' }), card({ id: 'mine', authorId: 'me', content: 'meu cartão' })] });
    expect(screen.getByText(/oculto até a revelação/)).toBeTruthy();
    expect(screen.getByText('meu cartão')).toBeTruthy();
    expect(screen.getByText('só você vê')).toBeTruthy();
  });

  it('revelados: autor anônimo até o facilitador abrir os autores', () => {
    const cards = [card({ id: 'a', authorId: 'u3', content: 'ideia' })];
    const closed = setup({ me: 'me', board: { isCardsRevealed: true }, cards });
    const article = closed.container.querySelector('article')!;
    expect(within(article).getByText('Anônimo')).toBeTruthy();
    cleanup();
    const open = setup({ me: 'me', board: { isCardsRevealed: true, isAuthorsRevealed: true }, cards });
    expect(within(open.container.querySelector('article')!).getByText('Bruno Lima')).toBeTruthy();
  });

  it('votar chama o handler só com a votação aberta; com ela fechada o botão nem aparece', () => {
    const cards = [card({ id: 'a' })];
    const aberta = setup({ me: 'me', board: { isCardsRevealed: true, votingStatus: 'active' }, cards });
    fireEvent.click(screen.getByRole('button', { name: /Votar neste cartão/ }));
    expect(aberta.handlers.onToggleVote).toHaveBeenCalledWith('a', []);
    cleanup();

    setup({ me: 'me', board: { isCardsRevealed: true, votingStatus: 'disabled' }, cards });
    expect(screen.queryByRole('button', { name: /Votar neste cartão/ })).toBeNull();
  });

  it('encerrada a votação o voto fica só para leitura', () => {
    setup({ me: 'me', board: { isCardsRevealed: true, votingStatus: 'finished' }, cards: [card({ id: 'a', votes: ['u3'] })] });
    const chip = screen.getByRole('button', { name: /Votar neste cartão \(1 voto\)/ }) as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
  });

  it('mostra quantos votos sobram no painel e destaca o mais votado', () => {
    setup({ me: 'me', board: { isCardsRevealed: true, votingStatus: 'active', maxVotesPerParticipant: 3 }, cards: [card({ id: 'a', votes: ['me'] }), card({ id: 'b', votes: [] })] });
    expect(screen.getByLabelText('Você usou 1 de 3 votos neste painel')).toBeTruthy();
  });

  it('adicionar cartão: Enter envia o texto na coluna certa', async () => {
    const { handlers } = setup();
    const colunas = screen.getAllByRole('region').filter((r) => r.getAttribute('aria-label') === 'O que melhorar?');
    fireEvent.click(within(colunas[0]).getByRole('button', { name: /Adicionar cartão/ }));
    const campo = within(colunas[0]).getByLabelText('Escreva seu feedback');
    fireEvent.change(campo, { target: { value: '  Deploys às sextas  ' } });
    await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });
    expect(handlers.onAddCard).toHaveBeenCalledWith('Deploys às sextas', 'toImprove', undefined, undefined);
  });

  it('cartão vazio não envia e avisa', async () => {
    const { handlers } = setup();
    const coluna = screen.getAllByRole('region').find((r) => r.getAttribute('aria-label') === 'O que funcionou?')!;
    fireEvent.click(within(coluna).getByRole('button', { name: /Adicionar cartão/ }));
    const campo = within(coluna).getByLabelText('Escreva seu feedback');
    await act(async () => { fireEvent.keyDown(campo, { key: 'Enter' }); });
    expect(handlers.onAddCard).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Campo obrigatório' }));
  });

  it('coluna de ação: concluir só para autor ou facilitador', () => {
    const acao = card({ id: 'act', columnKey: 'actionItems', authorId: 'u3', content: 'Congelar deploy', assignee: 'Carla', dueDate: '2099-12-31' });
    const fac = setup({ board: { isCardsRevealed: true }, cards: [acao] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Marcar como concluída' }));
    expect(fac.handlers.onToggleDone).toHaveBeenCalledWith('act', true);
    cleanup();

    setup({ me: 'me', board: { isCardsRevealed: true }, cards: [acao] });
    expect((screen.getByRole('checkbox', { name: 'Marcar como concluída' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ação vinda de outra retro mostra a origem e a recorrência', () => {
    setup({ board: { isCardsRevealed: true }, cards: [card({ id: 'act', columnKey: 'actionItems', carriedFromBoardId: 'old', carriedFromBoardTitle: 'Sprint 41', carryCount: 2 })] });
    expect(screen.getByText('Veio de Sprint 41')).toBeTruthy();
    expect(screen.getByText('Recorrente (2x)')).toBeTruthy();
  });

  it('menu do cartão: editar salva com Enter; juntar inicia a fusão; excluir pede confirmação', async () => {
    const cards = [card({ id: 'a', authorId: 'fac', content: 'cartão do facilitador' })];
    const { handlers } = setup({ board: { isCardsRevealed: true }, cards });

    fireEvent.click(screen.getByRole('menuitem', { name: /Juntar com outro cartão/ }));
    expect(handlers.onStartMerge).toHaveBeenCalledWith('a');

    fireEvent.click(screen.getByRole('menuitem', { name: /Editar cartão/ }));
    const campo = screen.getByLabelText('Editar o texto do cartão');
    fireEvent.change(campo, { target: { value: 'texto editado' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(handlers.onUpdateCard).toHaveBeenCalledWith('a', 'texto editado', undefined, undefined);

    fireEvent.click(screen.getByRole('menuitem', { name: /Excluir cartão/ }));
    expect(handlers.onDeleteCard).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover cartão' }));
    expect(handlers.onDeleteCard).toHaveBeenCalledWith('a');
  });

  it('edição vazia não salva e Esc cancela', () => {
    const { handlers } = setup({ board: { isCardsRevealed: true }, cards: [card({ id: 'a', authorId: 'fac', content: 'original' })] });
    fireEvent.click(screen.getByRole('menuitem', { name: /Editar cartão/ }));
    const campo = screen.getByLabelText('Editar o texto do cartão');
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(handlers.onUpdateCard).not.toHaveBeenCalled();
    fireEvent.keyDown(campo, { key: 'Escape' });
    expect(screen.queryByLabelText('Editar o texto do cartão')).toBeNull();
    expect(screen.getByText('original')).toBeTruthy();
  });

  it('participante só edita e exclui o que escreveu; juntar vale para qualquer cartão revelado', () => {
    setup({ me: 'me', board: { isCardsRevealed: true }, cards: [card({ id: 'a', authorId: 'u3' }), card({ id: 'b', authorId: 'me' })] });
    expect(screen.getAllByRole('menuitem', { name: /Juntar com outro cartão/ })).toHaveLength(2);
    expect(screen.getAllByRole('menuitem', { name: /Editar cartão/ })).toHaveLength(1);
    expect(screen.getAllByRole('menuitem', { name: /Excluir cartão/ })).toHaveLength(1);
  });

  it('com a fusão em andamento, clicar em outro cartão executa e no mesmo cancela', () => {
    const cards = [card({ id: 'a', content: 'origem' }), card({ id: 'b', content: 'destino' })];
    const { handlers } = setup({ board: { isCardsRevealed: true }, cards, props: { mergingSourceId: 'a' } });
    expect(screen.getByText('Origem')).toBeTruthy();
    fireEvent.click(screen.getByText('destino').closest('article')!);
    expect(handlers.onExecuteMerge).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByText('origem').closest('article')!);
    expect(handlers.onStartMerge).toHaveBeenCalledWith(null);
  });

  it('reação chama o handler com o tipo e quem já reagiu', () => {
    const { handlers } = setup({ me: 'me', board: { isCardsRevealed: true }, cards: [card({ id: 'a', reactions: { up: ['u3'] } })] });
    fireEvent.click(screen.getByRole('button', { name: 'Concordo (1)' }));
    expect(handlers.onToggleReaction).toHaveBeenCalledWith('a', 'up', ['u3']);
  });
});

describe('sala da Retro: visões e navegação', () => {
  it('foco mostra uma coluna e a navegação troca a etapa', () => {
    window.localStorage.setItem('agile_retro_layout_mode', 'focus');
    const { handlers } = setup();
    return screen.findByRole('navigation', { name: 'Colunas da retro' }).then((nav) => {
      expect(screen.getAllByRole('region').filter((r) => COLUMNS.some((c) => c.title === r.getAttribute('aria-label')))).toHaveLength(1);
      fireEvent.click(within(nav).getByRole('button', { name: /O que melhorar\?/ }));
      expect(handlers.onStageChange).toHaveBeenCalledWith('toImprove');
    });
  });

  it('com a sincronização ligada, quem não é facilitador não troca de coluna', () => {
    window.localStorage.setItem('agile_retro_layout_mode', 'focus');
    setup({ me: 'me', board: { syncStageEnabled: true } });
    return screen.findByRole('navigation', { name: 'Colunas da retro' }).then((nav) => {
      const outra = within(nav).getByRole('button', { name: /O que melhorar\?/ }) as HTMLButtonElement;
      expect(outra.disabled).toBe(true);
    });
  });

  it('apresentar troca o cabeçalho pela barra de apresentação; Esc e o botão saem', () => {
    setup({ board: { isCardsRevealed: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Apresentar' }));
    expect(screen.getByText('Apresentando')).toBeTruthy();
    expect(screen.queryByLabelText('Fases da retro')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Apresentando')).toBeNull();
    expect(screen.getByLabelText('Fases da retro')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Apresentar' }));
    fireEvent.click(screen.getByRole('button', { name: /Sair da apresentação/ }));
    expect(screen.queryByText('Apresentando')).toBeNull();
  });

  it('na apresentação as setas trocam de coluna, menos com a navegação travada', () => {
    const livre = setup({ board: { isCardsRevealed: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Apresentar' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(livre.handlers.onStageChange).toHaveBeenCalledWith('toImprove');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(livre.handlers.onStageChange).toHaveBeenLastCalledWith('actionItems');
    cleanup();

    const travada = setup({ me: 'me', board: { isCardsRevealed: true, syncStageEnabled: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Apresentar' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(travada.handlers.onStageChange).not.toHaveBeenCalled();
  });

  it('a apresentação abre com uma coluna em destaque, com a navegação das colunas, e "Todas" mostra o quadro inteiro', () => {
    setup({ board: { isCardsRevealed: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Apresentar' }));
    expect((screen.getByRole('button', { name: 'Em destaque' })).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(1);
    expect(screen.getByRole('navigation', { name: 'Colunas da retro' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect((screen.getByRole('button', { name: 'Todas' })).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(1);
    expect(screen.queryByRole('navigation', { name: 'Colunas da retro' })).toBeNull();
    expect(window.localStorage.getItem('agile_retro_present_layout')).toBe('all');
  });

  it('"Anterior" e "Próxima coluna" trocam a coluna em destaque', () => {
    const { handlers } = setup({ board: { isCardsRevealed: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Apresentar' }));
    fireEvent.click(screen.getByRole('button', { name: /Próxima coluna/ }));
    expect(handlers.onStageChange).toHaveBeenCalledWith('toImprove');
    fireEvent.click(screen.getByRole('button', { name: /Anterior/ }));
    expect(handlers.onStageChange).toHaveBeenLastCalledWith('actionItems');
  });

  it('na apresentação o facilitador continua conduzindo as fases', () => {
    const { handlers } = setup({ board: { isCardsRevealed: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Apresentar' }));
    fireEvent.click(screen.getByRole('button', { name: /Iniciar votação/ }));
    expect(handlers.onSetVotingStatus).toHaveBeenCalledWith('active');
  });

  it('a visão em foco fica guardada no navegador', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Foco' }));
    expect(window.localStorage.getItem('agile_retro_layout_mode')).toBe('focus');
    expect(screen.getByRole('navigation', { name: 'Colunas da retro' })).toBeTruthy();
  });
});

describe('sala da Retro: menu, painéis e janelas', () => {
  it('sair da retro pede confirmação antes de chamar o handler', async () => {
    const { handlers } = setup({ me: 'me' });
    fireEvent.click(screen.getByRole('menuitem', { name: /Sair da retro/ }));
    expect(handlers.onLeaveBoard).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sair da retro' }));
    expect(handlers.onLeaveBoard).toHaveBeenCalledTimes(1);
  });

  it('exportar: facilitador abre; participante só depois da revelação', () => {
    const fac = setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Exportar retrospectiva' })[0]);
    expect(screen.getByRole('dialog', { name: 'Exportar' })).toBeTruthy();
    expect(fac.handlers.onOpenStats).not.toHaveBeenCalled();
    cleanup();

    setup({ me: 'me' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Exportar retrospectiva' })[0]);
    expect(screen.queryByRole('dialog', { name: 'Exportar' })).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Exportar depois da revelação' }));
  });

  it('configurações só existem para o facilitador e mudam o quadro na hora', async () => {
    const fac = setup();
    fireEvent.click(screen.getAllByRole('button', { name: 'Configurações da retro' })[0]);
    const dialog = await screen.findByRole('dialog', { name: /Configurações da retro/ });
    fireEvent.click(within(dialog).getByRole('switch', { name: /Autores abertos/ }));
    expect(fac.handlers.onToggleShowAuthors).toHaveBeenCalledWith(true);
    fireEvent.click(within(dialog).getByRole('switch', { name: /Sincronizar coluna ativa/ }));
    expect(fac.handlers.onToggleSyncStage).toHaveBeenCalledWith(true);
    cleanup();

    setup({ me: 'me' });
    expect(screen.queryAllByRole('button', { name: 'Configurações da retro' })).toHaveLength(0);
  });

  it('participantes: abre o painel, facilitador remove com confirmação', async () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Participantes/ }));
    const painel = await screen.findByRole('region', { name: 'Participantes' });
    expect(within(painel).getByText('Bruno Lima')).toBeTruthy();
    fireEvent.click(within(painel).getByRole('button', { name: 'Remover Bruno Lima da retro' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover' }));
    expect(handlers.onRemoveParticipant).toHaveBeenCalledWith('u3');
  });

  it('participante pode assumir o controle (com confirmação), o facilitador não', async () => {
    const part = setup({ me: 'me' });
    fireEvent.click(screen.getByRole('button', { name: /^Participantes/ }));
    const painel = await screen.findByRole('region', { name: 'Participantes' });
    expect(within(painel).queryByRole('button', { name: /Remover/ })).toBeNull();
    fireEvent.click(within(painel).getByRole('button', { name: 'Assumir o controle da retro' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Assumir controle' }));
    expect(part.handlers.onClaimCreator).toHaveBeenCalledTimes(1);
    cleanup();

    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Participantes/ }));
    expect(within(await screen.findByRole('region', { name: 'Participantes' })).queryByRole('button', { name: 'Assumir o controle da retro' })).toBeNull();
  });

  it('copiar o link avisa quem copiou', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    setup();
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Copiar link da retro' })[0]); });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Link copiado' }));
  });
});

describe('sala da Retro: boas-vindas e faixa ao vivo', () => {
  it('quadro vazio abre as boas-vindas uma vez; "Não mostrar de novo" guarda a escolha', async () => {
    window.localStorage.removeItem('agile_retro_welcome_dismissed');
    setup();
    const dialog = await screen.findByRole('dialog', { name: 'Retro Sprint 42' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(4);
    fireEvent.click(within(dialog).getByLabelText('Não mostrar de novo'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Começar' }));
    expect(window.localStorage.getItem('agile_retro_welcome_dismissed')).toBe('true');
  });

  it('com cartões, ou já dispensadas, não abrem', () => {
    window.localStorage.removeItem('agile_retro_welcome_dismissed');
    setup({ cards: [card({ id: 'a' })] });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a faixa conta os cartões, os seus e os sem autoria', () => {
    setup({ me: 'me', cards: [card({ id: 'a', authorId: 'me' }), card({ id: 'b', authorId: '', hidden: true, content: '' }), card({ id: 'c', authorId: '', hidden: true, content: '' })] });
    const faixa = screen.getByRole('status', { name: 'Contribuições ao vivo' });
    expect(faixa.textContent).toContain('3 cartões');
    expect(faixa.textContent).toContain('Você1');
    expect(faixa.textContent).toContain('Sem autoria 2');
  });
});

describe('sala da Retro: presença em tempo real', () => {
  it('com a presença do servidor: conta online, ponto verde e "ausente" para quem fechou a sala', async () => {
    setup({ props: { onlineIds: new Set(['fac', 'me']) } });
    const botao = screen.getByRole('button', { name: /^Participantes/ });
    expect(botao.getAttribute('aria-label')).toBe('Participantes (2 online de 3)');
    fireEvent.click(botao);
    const painel = await screen.findByRole('region', { name: 'Participantes' });
    const bruno = within(painel).getByText('Bruno Lima').closest('li')!;
    expect(bruno.textContent).toContain('ausente');
    expect(bruno.querySelector('.bg-emerald-500')).toBeNull();
    const ana = within(painel).getByText('Ana Souza').closest('li')!;
    expect(ana.textContent).not.toContain('ausente');
    expect(ana.querySelector('.bg-emerald-500')).not.toBeNull();
  });

  it('sem presença (backend antigo): só o total, sem ponto e sem "ausente"', async () => {
    setup();
    const botao = screen.getByRole('button', { name: /^Participantes/ });
    expect(botao.getAttribute('aria-label')).toBe('Participantes (3)');
    fireEvent.click(botao);
    const painel = await screen.findByRole('region', { name: 'Participantes' });
    expect(painel.textContent).not.toContain('ausente');
    expect(painel.querySelector('.bg-emerald-500')).toBeNull();
  });
});

describe('sala da Retro: encerrar, somente leitura, escrevendo… e notas do check-in (backend novo)', () => {
  const closed = { lifecycleStatus: 'FINISHED' as const, finishedAt: '2026-10-17T15:00:00', isCardsRevealed: true, votingStatus: 'active' as const };
  const feedback = [card({ id: 'k1', columnKey: 'wentWell', authorId: 'u3' })];

  it('participante numa retro encerrada só lê: aviso, selo "Encerrada", sem campo de novo cartão, sem votar nem reagir', () => {
    setup({ me: 'me', board: closed, cards: feedback, props: { isFinished: true, readOnly: true } });
    expect(screen.getByText(/O facilitador encerrou esta retro/)).toBeTruthy();
    expect(screen.getAllByText('Encerrada').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Adicionar cartão' })).toBeNull();
    expect((screen.getByRole('button', { name: /Votar neste cartão/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Concordo' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Mais ações do cartão' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Arrastar cartão' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Encerrar retro|Reabrir/ })).toBeNull();
  });

  it('facilitador numa retro encerrada continua podendo tudo e vê "Reabrir"', () => {
    const onReopenRetro = vi.fn();
    setup({ me: 'fac', board: closed, cards: feedback, props: { isFinished: true, readOnly: false, onFinishRetro: vi.fn(), onReopenRetro } });
    expect(screen.queryByText(/O facilitador encerrou esta retro/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Adicionar cartão' }).length).toBeGreaterThan(0);
    expect((screen.getByRole('button', { name: 'Concordo' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Reabrir' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reabrir retro' }));
    expect(onReopenRetro).toHaveBeenCalledTimes(1);
  });

  it('"Encerrar retro" pede confirmação e só então chama o servidor', () => {
    const onFinishRetro = vi.fn();
    setup({ me: 'fac', props: { onFinishRetro, onReopenRetro: vi.fn() } });
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar retro' }));
    expect(onFinishRetro).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('não escrevem, votam nem movem cartões');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Encerrar retro' }));
    expect(onFinishRetro).toHaveBeenCalledTimes(1);
  });

  it('participante comum nunca vê "Encerrar retro"; backend antigo (sem os callbacks) também não', () => {
    setup({ me: 'me', props: { onFinishRetro: undefined, onReopenRetro: undefined } });
    expect(screen.queryByRole('button', { name: 'Encerrar retro' })).toBeNull();
    cleanup();
    setup({ me: 'fac' });
    expect(screen.queryByRole('button', { name: 'Encerrar retro' })).toBeNull();
    expect(screen.queryByText('Encerrada')).toBeNull();
  });

  it('"Fulana está escrevendo…" aparece só na coluna certa; com autoria oculta vem sem nome', () => {
    const labelFor = (key: string) => (key === 'wentWell' ? 'Bruno Lima está escrevendo…' : key === 'toImprove' ? 'Alguém está escrevendo…' : null);
    setup({ me: 'me', props: { typingLabelForColumn: labelFor } });
    const well = screen.getByRole('region', { name: 'O que funcionou?' });
    const improve = screen.getByRole('region', { name: 'O que melhorar?' });
    const action = screen.getByRole('region', { name: 'Plano de Ação' });
    expect(within(well).getByRole('status').textContent).toBe('Bruno Lima está escrevendo…');
    expect(within(improve).getByRole('status').textContent).toBe('Alguém está escrevendo…');
    expect(within(action).queryByRole('status')).toBeNull();
  });

  it('sem backend novo nada de "escrevendo…" aparece', () => {
    const { container } = setup({ me: 'me' });
    expect(container.textContent).not.toContain('escrevendo…');
  });

  it('digitar num novo cartão avisa a coluna (o limite de 2 s é de quem chama)', () => {
    const onTypingCard = vi.fn();
    setup({ me: 'me', props: { onTypingCard } });
    const well = screen.getByRole('region', { name: 'O que funcionou?' });
    fireEvent.click(within(well).getByRole('button', { name: 'Adicionar cartão' }));
    fireEvent.change(within(well).getByLabelText('Escreva seu feedback'), { target: { value: 'O deploy' } });
    expect(onTypingCard).toHaveBeenCalledWith('wentWell');
    fireEvent.change(within(well).getByLabelText('Escreva seu feedback'), { target: { value: '   ' } });
    expect(onTypingCard).toHaveBeenCalledTimes(1);
  });

  it('notas do check-in: o facilitador vê nome, humor e texto; participante não', async () => {
    const withNotes: RetroParticipant[] = [
      { ...people[0] },
      { ...people[1], healthCheckAnswer: 'tired', checkinNote: 'Semana puxada, mas animada.' },
      { ...people[2], healthCheckAnswer: 'great' },
    ];
    setup({ me: 'fac', props: { participants: withNotes } });
    fireEvent.click(screen.getByRole('button', { name: /^Participantes/ }));
    const notes = await screen.findByRole('region', { name: 'Notas do check-in' });
    expect(notes.textContent).toContain('Ana Souza');
    expect(notes.textContent).toContain('Cansado');
    expect(notes.textContent).toContain('Semana puxada, mas animada.');
    expect(notes.textContent).not.toContain('Bruno Lima');
    cleanup();
    setup({ me: 'me', props: { participants: withNotes } });
    fireEvent.click(screen.getByRole('button', { name: /^Participantes/ }));
    await screen.findByRole('region', { name: 'Participantes' });
    expect(screen.queryByRole('region', { name: 'Notas do check-in' })).toBeNull();
  });
});
