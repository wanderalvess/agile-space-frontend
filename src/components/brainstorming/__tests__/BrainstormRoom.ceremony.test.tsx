import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrainstormingBoard, BrainstormingGroup, BrainstormingIdea, Participant } from '../../../lib/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/brainstorming/b1', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', resolvedMode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session: { token: 't' }, isAuthenticated: true }) }));
vi.mock('../../layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock('../../../app/action-plan/api', () => ({ actionPlanApi: { createBoard: vi.fn(), createTask: vi.fn() } }));
vi.mock('../DiagramPhase', () => ({ DiagramPhase: () => <div data-testid="teia" /> }));
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; 'aria-label'?: string; disabled?: boolean }) => (
    <select aria-label={rest['aria-label']} value={value} disabled={rest.disabled} onChange={(e) => onChange(e.target.value)}>
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
    DropdownMenuLabel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div data-menu>{children}</div>,
    DropdownMenuItem: ({ children, onClick, onSelect, disabled }: { children?: React.ReactNode; onClick?: () => void; onSelect?: () => void; disabled?: boolean }) => (
      <button role="menuitem" disabled={disabled} onClick={() => { onClick?.(); onSelect?.(); }}>{children}</button>
    ),
  };
});

const toastMock = vi.fn();

import { BrainstormRoom, type BrainstormRoomProps } from '../BrainstormRoom';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  (Element.prototype as any).scrollIntoView = (Element.prototype as any).scrollIntoView || (() => {});
  (Element.prototype as any).hasPointerCapture = (Element.prototype as any).hasPointerCapture || (() => false);
});

beforeEach(() => {
  window.localStorage.clear();
  toastMock.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Mural do backend novo (V80): `status` e `facilitatorId` sempre presentes. Criador = `fac`. */
const board = (over: Partial<BrainstormingBoard> = {}): BrainstormingBoard => ({
  id: 'b1', creatorId: 'fac', title: 'Redesenho do onboarding', team: 'PHOENIX', createdAt: '2026-10-14T10:00:00Z', phase: 'ideation',
  settings: { isAnonymous: false }, timer: { status: 'stopped', endTime: null, initialDuration: 600, remainingOnPause: 600 },
  status: 'OPEN', finishedAt: null, facilitatorId: 'fac', facilitatorName: 'Wanderson Silva', votesPerParticipant: null, ...over,
});

const people: Participant[] = [
  { id: 'fac', roomId: 'b1', nickname: 'Wanderson Silva', displayName: 'Wanderson Silva', isFacilitator: true, role: 'organizador' } as Participant,
  { id: 'me', roomId: 'b1', nickname: 'Ana Ribeiro', displayName: 'Ana Ribeiro', isFacilitator: false, role: 'dev' } as Participant,
  { id: 'u3', roomId: 'b1', nickname: 'Diego Alves', displayName: 'Diego Alves', isFacilitator: false, role: 'dev' } as Participant,
];

const idea = (over: Partial<BrainstormingIdea> & { id: string }): BrainstormingIdea => ({
  boardId: 'b1', content: `texto ${over.id}`, authorId: 'u3', votes: [], position: { x: 0, y: 0 }, parentId: null, groupId: null, createdAt: '2026-10-17T10:00:00Z', ...over,
});

const groups: BrainstormingGroup[] = [{ id: 'g1', boardId: 'b1', title: 'Primeiros passos', order: 0, color: '#2563eb' }];

type Who = 'fac' | 'me' | 'u3' | 'adm';

function setup(opts: { board?: Partial<BrainstormingBoard>; legacy?: boolean; ideas?: BrainstormingIdea[]; me?: Who; props?: Partial<BrainstormRoomProps> } = {}) {
  const meId = opts.me ?? 'fac';
  const base = board(opts.board);
  const boardData: BrainstormingBoard = opts.legacy
    ? (({ status: _s, finishedAt: _f, facilitatorId: _i, facilitatorName: _n, votesPerParticipant: _v, ...old }) => old as BrainstormingBoard)(base)
    : base;
  const handlers = {
    onAddIdea: vi.fn(async () => true), onDeleteIdea: vi.fn(), onUpdateIdea: vi.fn(async () => true), onVoteIdea: vi.fn(), onStartMerge: vi.fn(),
    onExecuteMerge: vi.fn(), onUpdateIdeaPosition: vi.fn(), onConnectIdeas: vi.fn(), onDisconnectIdea: vi.fn(), onMoveIdeaToGroup: vi.fn(),
    onUpdateIdeaQualifiers: vi.fn(), onAddGroup: vi.fn(async () => true), onDeleteGroup: vi.fn(), onPhaseChange: vi.fn(), onRename: vi.fn(),
    onToggleAnonymous: vi.fn(), onToggleReveal: vi.fn(), onTogglePresentation: vi.fn(), onStartTimer: vi.fn(), onPauseTimer: vi.fn(),
    onResumeTimer: vi.fn(), onResetTimer: vi.fn(), onSetTimerDuration: vi.fn(), onRemoveParticipant: vi.fn(), onDeleteBoard: vi.fn(), onOpenFeedback: vi.fn(),
    onFinish: vi.fn(), onReopen: vi.fn(), onClaimFacilitation: vi.fn(), onTransferFacilitation: vi.fn(), onVoteLimitChange: vi.fn(), onRestrictEditsChange: vi.fn(),
  };
  const facilitator = (boardData.facilitatorId ?? boardData.creatorId) === meId;
  const props: BrainstormRoomProps = {
    boardId: 'b1',
    boardData,
    ideas: opts.ideas ?? [],
    groups,
    participants: people,
    currentUserId: meId,
    isFacilitator: facilitator,
    isAdmin: meId === 'adm',
    mergingSourceId: null,
    connection: 'live',
    squadLabel: 'Phoenix',
    ...handlers,
    ...opts.props,
  };
  const view = render(<BrainstormRoom {...props} />);
  return { ...view, handlers, props };
}

const openParticipants = () => fireEvent.click(screen.getByRole('button', { name: /^Participantes/ }));

describe('backend antigo: nada novo aparece', () => {
  it('sem status nem facilitatorId a sala é a de sempre (sem encerrar, assumir, passar, cota nem selo)', () => {
    setup({ legacy: true, ideas: [idea({ id: 'a', authorId: 'me' })] });
    expect(screen.queryByRole('menuitem', { name: /Encerrar brainstorming/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Passar a facilitação/ })).toBeNull();
    expect(screen.queryByText(/Você usou/)).toBeNull();
    expect(screen.queryByText(/editada/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar a ideia' })).toBeTruthy();
    openParticipants();
    expect(screen.queryByRole('button', { name: /Assumir a facilitação/ })).toBeNull();
  });

  it('a função some também se a rota responder 404 (ceremonyUnavailable)', () => {
    setup({ props: { ceremonyUnavailable: true } });
    expect(screen.queryByRole('menuitem', { name: /Encerrar brainstorming/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Passar a facilitação/ })).toBeNull();
  });
});

describe('facilitador pelo facilitatorId', () => {
  it('a lista mostra "Facilitação: nome" com quem facilita agora, não com o criador', () => {
    setup({ me: 'me', board: { facilitatorId: 'u3', facilitatorName: 'Diego Alves' } });
    openParticipants();
    const heading = screen.getByRole('heading', { name: /Facilitação/ });
    expect(heading.textContent).toBe('Facilitação: Diego Alves');
    const section = screen.getByLabelText('Facilitação');
    expect(within(section).getByText('Diego Alves')).toBeTruthy();
    expect(within(section).queryByText('Wanderson Silva')).toBeNull();
  });

  it('quem recebeu a facilitação (e não é o criador) tem os poderes: apagar ideia alheia e ocultar', () => {
    setup({ me: 'me', board: { facilitatorId: 'me' }, ideas: [idea({ id: 'a', authorId: 'u3' })] });
    expect(screen.getByRole('button', { name: 'Excluir a ideia' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Ocultar ideias/ }).length).toBeGreaterThan(0);
  });

  it('o criador que passou a facilitação perde os controles de facilitador, mas ainda encerra', () => {
    setup({ me: 'fac', board: { facilitatorId: 'u3', facilitatorName: 'Diego Alves' }, ideas: [idea({ id: 'a', authorId: 'u3' })] });
    expect(screen.queryByRole('button', { name: 'Excluir a ideia' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ocultar ideias/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Encerrar brainstorming/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Passar a facilitação/ })).toBeNull();
  });
});

describe('encerrar e reabrir', () => {
  it('o facilitador encerra pelo menu, com confirmação', () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /Encerrar brainstorming/ }));
    expect(handlers.onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar brainstorming' }));
    expect(handlers.onFinish).toHaveBeenCalledTimes(1);
  });

  it('quem só participa não vê "Encerrar"; ADMIN vê', () => {
    const part = setup({ me: 'me' });
    expect(screen.queryByRole('menuitem', { name: /Encerrar brainstorming/ })).toBeNull();
    part.unmount();
    setup({ me: 'adm' });
    expect(screen.getByRole('menuitem', { name: /Encerrar brainstorming/ })).toBeTruthy();
  });

  it('encerrado: chip, aviso e tudo somente leitura, para o facilitador também', () => {
    const { handlers } = setup({
      board: { status: 'FINISHED', finishedAt: '2026-10-17T14:00:00Z' },
      ideas: [idea({ id: 'a', authorId: 'fac', votes: ['fac'] }), idea({ id: 'b', authorId: 'u3' })],
    });
    expect(screen.getAllByText('Encerrado').length).toBeGreaterThan(0);
    expect(screen.getByText('Brainstorming encerrado.')).toBeTruthy();
    expect((screen.getByLabelText('Escreva uma ideia') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /Lançar ideia/ }).hasAttribute('disabled')).toBe(true);
    for (const vote of screen.getAllByRole('button', { name: /voto/i })) expect(vote.hasAttribute('disabled')).toBe(true);
    for (const name of ['Editar a ideia', 'Juntar com outra ideia', 'Excluir a ideia']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ocultar ideias/ })).toBeNull();
    // a navegação de etapas fica travada
    fireEvent.click(within(screen.getByLabelText('Etapas do brainstorming')).getByRole('button', { name: 'Grupos' }));
    expect(handlers.onPhaseChange).not.toHaveBeenCalled();
  });

  it('quem pode reabre pelo aviso; quem só participa não vê o botão', () => {
    const fac = setup({ board: { status: 'FINISHED' } });
    fireEvent.click(screen.getByRole('button', { name: /Reabrir/ }));
    expect(fac.handlers.onReopen).toHaveBeenCalledTimes(1);
    fac.unmount();
    setup({ me: 'me', board: { status: 'FINISHED' } });
    expect(screen.queryByRole('button', { name: /Reabrir/ })).toBeNull();
    expect(screen.getByText(/quem facilita pode reabrir/)).toBeTruthy();
  });

  it('encerrado, as etapas seguintes também são só leitura (grupos sem criar nem arrastar)', () => {
    setup({ board: { status: 'FINISHED', phase: 'grouping' }, ideas: [idea({ id: 'a' })] });
    expect((screen.getByLabelText('Nome do novo grupo') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /Arrastar a ideia/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Apagar o grupo/ })).toBeNull();
  });

  it('encerrado, a Matriz não oferece mover', () => {
    setup({ board: { status: 'FINISHED', phase: 'prioritization' }, ideas: [idea({ id: 'a' })] });
    expect(screen.queryByRole('button', { name: /Mover para/ })).toBeNull();
    expect(screen.getByText('Brainstorming encerrado: só leitura.')).toBeTruthy();
  });
});

describe('assumir e passar a facilitação', () => {
  const online = (...ids: string[]) => new Set(ids);

  it('participante vê "Assumir" com o facilitador offline e só habilita passado o tempo', () => {
    vi.useFakeTimers();
    const { handlers } = setup({ me: 'me', props: { onlineIds: online('me', 'u3') } });
    const notice = screen.getByText('Wanderson Silva saiu da sala.').closest('[role="status"]') as HTMLElement;
    const button = within(notice).getByRole('button', { name: /Assumir a facilitação/ });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.textContent).toMatch(/em 60 s/);
    act(() => { vi.advanceTimersByTime(61_000); });
    expect(within(notice).getByRole('button', { name: /Assumir a facilitação/ }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(within(notice).getByRole('button', { name: /Assumir a facilitação/ }));
    expect(handlers.onClaimFacilitation).toHaveBeenCalledTimes(1);
  });

  it('com o facilitador online (ou presença desconhecida) o participante não vê o botão', () => {
    const online1 = setup({ me: 'me', props: { onlineIds: online('me', 'fac') } });
    openParticipants();
    expect(screen.queryByRole('button', { name: /Assumir a facilitação/ })).toBeNull();
    online1.unmount();
    setup({ me: 'me', props: { onlineIds: null } });
    openParticipants();
    expect(screen.queryByRole('button', { name: /Assumir a facilitação/ })).toBeNull();
  });

  it('criador (que já passou) e ADMIN assumem na hora, mesmo com o facilitador online', () => {
    const creator = setup({ me: 'fac', board: { facilitatorId: 'u3', facilitatorName: 'Diego Alves' }, props: { onlineIds: online('fac', 'u3') } });
    openParticipants();
    const claim = screen.getByRole('button', { name: /Assumir a facilitação/ });
    expect(claim.hasAttribute('disabled')).toBe(false);
    fireEvent.click(claim);
    expect(creator.handlers.onClaimFacilitation).toHaveBeenCalledTimes(1);
    creator.unmount();
    setup({ me: 'adm', props: { onlineIds: online('fac') } });
    openParticipants();
    expect(screen.getByRole('button', { name: /Assumir a facilitação/ }).hasAttribute('disabled')).toBe(false);
  });

  it('o facilitador passa a facilitação escolhendo uma pessoa da sala', () => {
    const { handlers } = setup({ props: { onlineIds: online('fac', 'me') } });
    fireEvent.click(screen.getByRole('menuitem', { name: /Passar a facilitação/ }));
    const dialog = screen.getByRole('dialog', { name: /Passar a facilitação/ });
    const confirm = within(dialog).getByRole('button', { name: 'Passar a facilitação' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    expect(within(dialog).queryByText('Wanderson Silva')).toBeNull();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Ana Ribeiro/ }));
    fireEvent.click(confirm);
    expect(handlers.onTransferFacilitation).toHaveBeenCalledWith('me');
  });

  it('quem só participa não vê "Passar a facilitação"', () => {
    setup({ me: 'me', props: { onlineIds: online('fac', 'me') } });
    openParticipants();
    expect(screen.queryByRole('menuitem', { name: /Passar a facilitação/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Passar a facilitação/ })).toBeNull();
  });
});

describe('limite de votos', () => {
  const voted = (id: string, by: string[]) => idea({ id, votes: by });

  it('mostra a cota restante e desabilita votar em outra ideia ao atingir o limite', () => {
    setup({ me: 'me', board: { votesPerParticipant: 2 }, ideas: [voted('a', ['me']), voted('b', ['me']), voted('c', [])] });
    expect(screen.getByText('Você usou 2 de 2 votos')).toBeTruthy();
    const cards = screen.getAllByRole('article');
    const voteButtons = cards.map((c) => within(c).getByRole('button', { name: /voto|Votar/ }));
    const states = voteButtons.map((b) => b.hasAttribute('disabled'));
    // as duas votadas continuam habilitadas (tirar o voto devolve a cota); a terceira trava
    expect(states.filter(Boolean)).toHaveLength(1);
    expect(screen.getByTitle('Você usou todos os seus votos')).toBeTruthy();
  });

  it('abaixo do limite tudo segue habilitado e o texto acompanha', () => {
    const { handlers } = setup({ me: 'me', board: { votesPerParticipant: 3 }, ideas: [voted('a', ['me']), voted('c', [])] });
    expect(screen.getByText('Você usou 1 de 3 votos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Votar nesta ideia' }));
    expect(handlers.onVoteIdea).toHaveBeenCalledWith('c');
  });

  it('sem limite não há contador', () => {
    setup({ me: 'me', board: { votesPerParticipant: null }, ideas: [voted('a', ['me'])] });
    expect(screen.queryByText(/Você usou/)).toBeNull();
  });
});

describe('autor, "editada" e edição restrita', () => {
  it('mostra o nome do autor que o servidor mandou e o selo "editada por"', () => {
    setup({
      me: 'me',
      ideas: [idea({ id: 'a', authorId: 'zed', authorName: 'Zélia Prado', editedAt: '2026-10-17T13:20:00.000Z', editedBy: 'u3', editedByName: 'Diego Alves' })],
    });
    expect(screen.getByText('Zélia')).toBeTruthy();
    expect(screen.getByText('editada por Diego')).toBeTruthy();
  });

  it('só "editada" quando o nome do editor não vem (mural anônimo)', () => {
    setup({ me: 'me', board: { settings: { isAnonymous: true } }, ideas: [idea({ id: 'a', authorId: null, editedAt: '2026-10-17T13:20:00.000Z' })] });
    expect(screen.getByText('Anônimo')).toBeTruthy();
    expect(screen.getByText('editada')).toBeTruthy();
  });

  it('com a edição restrita o lápis some para quem não é autor, facilitador nem ADMIN', () => {
    const restricted = { settings: { isAnonymous: false, restrictEdits: true } };
    const ideas = [idea({ id: 'a', authorId: 'u3' })];
    const stranger = setup({ me: 'me', board: restricted, ideas });
    expect(screen.queryByRole('button', { name: 'Editar a ideia' })).toBeNull();
    // fundir, votar e mover seguem livres
    expect(screen.getByRole('button', { name: 'Juntar com outra ideia' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Votar nesta ideia' }).hasAttribute('disabled')).toBe(false);
    stranger.unmount();

    const author = setup({ me: 'u3', board: restricted, ideas });
    expect(screen.getByRole('button', { name: 'Editar a ideia' })).toBeTruthy();
    author.unmount();
    const facilitator = setup({ me: 'fac', board: restricted, ideas });
    expect(screen.getByRole('button', { name: 'Editar a ideia' })).toBeTruthy();
    facilitator.unmount();
    setup({ me: 'adm', board: restricted, ideas });
    expect(screen.getByRole('button', { name: 'Editar a ideia' })).toBeTruthy();
  });

  it('sem a restrição todo mundo edita, como sempre', () => {
    setup({ me: 'me', ideas: [idea({ id: 'a', authorId: 'u3' })] });
    expect(screen.getByRole('button', { name: 'Editar a ideia' })).toBeTruthy();
  });
});

describe('configurações da cerimônia', () => {
  const openSettings = () => fireEvent.click(screen.getByRole('button', { name: 'Configurações da sessão' }));

  it('o facilitador liga e muda os votos por pessoa e a edição restrita', () => {
    const { handlers } = setup({ board: { votesPerParticipant: 3, settings: { isAnonymous: false } } });
    openSettings();
    const dialog = screen.getByRole('dialog', { name: 'Configurações da sessão' });
    const count = within(dialog).getByLabelText('Votos por pessoa') as HTMLInputElement;
    expect(count.value).toBe('3');
    fireEvent.change(count, { target: { value: '5' } });
    fireEvent.blur(count);
    expect(handlers.onVoteLimitChange).toHaveBeenCalledWith(5);
    fireEvent.click(within(dialog).getByRole('switch', { name: /Limitar os votos por pessoa/ }));
    expect(handlers.onVoteLimitChange).toHaveBeenLastCalledWith(null);
    fireEvent.click(within(dialog).getByRole('switch', { name: /Só o autor e a facilitação editam/ }));
    expect(handlers.onRestrictEditsChange).toHaveBeenCalledWith(true);
  });

  it('número fora de 1 a 100 não é enviado e avisa', () => {
    const { handlers } = setup({ board: { votesPerParticipant: 3 } });
    openSettings();
    const count = within(screen.getByRole('dialog')).getByLabelText('Votos por pessoa') as HTMLInputElement;
    fireEvent.change(count, { target: { value: '0' } });
    fireEvent.blur(count);
    expect(handlers.onVoteLimitChange).not.toHaveBeenCalled();
    expect(screen.getByText('Use um número de 1 a 100.')).toBeTruthy();
    expect(count.value).toBe('3');
  });

  it('backend antigo: sem os ajustes novos; quem não facilita só vê a parte pessoal', () => {
    const legacy = setup({ legacy: true });
    openSettings();
    expect(screen.queryByText('Limitar os votos por pessoa')).toBeNull();
    expect(screen.queryByText(/Só o autor e a facilitação editam/)).toBeNull();
    legacy.unmount();
    setup({ me: 'me' });
    openSettings();
    expect(screen.queryByText('Limitar os votos por pessoa')).toBeNull();
  });

  it('encerrado: os ajustes ficam desabilitados e há "Reabrir" no lugar de "Encerrar"', () => {
    const { handlers } = setup({ board: { status: 'FINISHED', votesPerParticipant: 3 } });
    openSettings();
    const dialog = screen.getByRole('dialog', { name: 'Configurações da sessão' });
    expect(within(dialog).getByRole('switch', { name: /Autores anônimos/ }).hasAttribute('disabled')).toBe(true);
    expect(within(dialog).getByRole('switch', { name: /Limitar os votos/ }).hasAttribute('disabled')).toBe(true);
    expect(within(dialog).queryByRole('button', { name: 'Encerrar brainstorming' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reabrir brainstorming' }));
    expect(handlers.onReopen).toHaveBeenCalled();
  });
});
