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
// O React Flow não mede nada no jsdom: a Teia vira um marcador (a lógica dela vive nas regras puras).
vi.mock('../DiagramPhase', () => ({ DiagramPhase: () => <div data-testid="teia" /> }));
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
afterEach(cleanup);

const board = (over: Partial<BrainstormingBoard> = {}): BrainstormingBoard => ({
  id: 'b1', creatorId: 'fac', title: 'Redesenho do onboarding', team: 'PHOENIX', createdAt: '2026-10-14T10:00:00Z', phase: 'ideation',
  settings: { isAnonymous: false }, timer: { status: 'stopped', endTime: null, initialDuration: 600, remainingOnPause: 600 }, ...over,
});

const people: Participant[] = [
  { id: 'fac', roomId: 'b1', nickname: 'Wanderson Silva', isFacilitator: true, role: 'organizador', globalRole: 'Agile Master' } as Participant,
  { id: 'me', roomId: 'b1', nickname: 'Ana Ribeiro', isFacilitator: false, role: 'dev' } as Participant,
  { id: 'u3', roomId: 'b1', nickname: 'Diego Alves', isFacilitator: false, role: 'dev' } as Participant,
];

const idea = (over: Partial<BrainstormingIdea> & { id: string }): BrainstormingIdea => ({
  boardId: 'b1', content: `texto ${over.id}`, authorId: 'u3', votes: [], position: { x: 0, y: 0 }, parentId: null, groupId: null, createdAt: '2026-10-17T10:00:00Z', ...over,
});

const groups: BrainstormingGroup[] = [
  { id: 'g1', boardId: 'b1', title: 'Primeiros passos', order: 0, color: '#2563eb' },
  { id: 'g2', boardId: 'b1', title: 'Convites', order: 1, color: '#059669' },
];

function setup(opts: { board?: Partial<BrainstormingBoard>; ideas?: BrainstormingIdea[]; me?: 'fac' | 'me'; props?: Partial<BrainstormRoomProps> } = {}) {
  const meId = opts.me ?? 'fac';
  const handlers = {
    onAddIdea: vi.fn(async () => true), onDeleteIdea: vi.fn(), onUpdateIdea: vi.fn(async () => true), onVoteIdea: vi.fn(), onStartMerge: vi.fn(),
    onExecuteMerge: vi.fn(), onUpdateIdeaPosition: vi.fn(), onConnectIdeas: vi.fn(), onDisconnectIdea: vi.fn(), onMoveIdeaToGroup: vi.fn(),
    onUpdateIdeaQualifiers: vi.fn(), onAddGroup: vi.fn(async () => true), onDeleteGroup: vi.fn(), onPhaseChange: vi.fn(), onRename: vi.fn(),
    onToggleAnonymous: vi.fn(), onToggleReveal: vi.fn(), onTogglePresentation: vi.fn(), onStartTimer: vi.fn(), onPauseTimer: vi.fn(),
    onResumeTimer: vi.fn(), onResetTimer: vi.fn(), onSetTimerDuration: vi.fn(), onRemoveParticipant: vi.fn(), onDeleteBoard: vi.fn(), onOpenFeedback: vi.fn(),
  };
  const props: BrainstormRoomProps = {
    boardId: 'b1',
    boardData: board(opts.board),
    ideas: opts.ideas ?? [],
    groups,
    participants: people,
    currentUserId: meId,
    isFacilitator: meId === 'fac',
    mergingSourceId: null,
    connection: 'live',
    squadLabel: 'Phoenix',
    ...handlers,
    ...opts.props,
  };
  const view = render(<BrainstormRoom {...props} />);
  return { ...view, handlers, props };
}

describe('sala do Brainstorming: cabeçalho e etapas', () => {
  it('mostra o nome, a squad e as cinco etapas com a atual marcada', () => {
    setup();
    expect(screen.getByRole('heading', { name: /Redesenho do onboarding/ })).toBeTruthy();
    expect(screen.getByText('Phoenix')).toBeTruthy();
    const phases = screen.getByLabelText('Fases do brainstorming');
    expect(within(phases).getAllByRole('listitem').map((li) => li.textContent?.replace(/\d/g, '').trim())).toEqual(['Mural', 'Teia', 'Grupos', 'Matriz', 'Plano']);
    expect(within(phases).getByText('Mural').closest('li')?.getAttribute('aria-current')).toBe('step');
  });

  it('o facilitador troca de etapa pela navegação do pé', () => {
    const { handlers } = setup();
    fireEvent.click(within(screen.getByLabelText('Etapas do brainstorming')).getByRole('button', { name: 'Grupos' }));
    expect(handlers.onPhaseChange).toHaveBeenCalledWith('grouping');
  });

  it('quem participa vê a navegação travada com o cadeado', () => {
    const { handlers } = setup({ me: 'me' });
    const nav = screen.getByLabelText('Etapas do brainstorming');
    expect(within(nav).getByText('Navegação controlada pelo facilitador')).toBeTruthy();
    const grupos = within(nav).getByRole('button', { name: 'Grupos' }) as HTMLButtonElement;
    expect(grupos.disabled).toBe(true);
    fireEvent.click(grupos);
    expect(handlers.onPhaseChange).not.toHaveBeenCalled();
  });

  it('a Teia, a Matriz e o Plano aparecem conforme a etapa do mural', () => {
    const { rerender, props } = setup({ ideas: [idea({ id: 'a' })] });
    rerender(<BrainstormRoom {...props} boardData={board({ phase: 'diagram' })} />);
    expect(screen.getByTestId('teia')).toBeTruthy();
    rerender(<BrainstormRoom {...props} boardData={board({ phase: 'prioritization' })} />);
    expect(screen.getByRole('heading', { name: 'Matriz de priorização' })).toBeTruthy();
    rerender(<BrainstormRoom {...props} boardData={board({ phase: 'actions' })} />);
    expect(screen.getByRole('heading', { name: 'Plano' })).toBeTruthy();
    rerender(<BrainstormRoom {...props} boardData={board({ phase: 'grouping' })} />);
    expect(screen.getByRole('heading', { name: 'Grupos' })).toBeTruthy();
  });

  it('a conexão aparece no estado da sala, sem aviso quando está ao vivo', () => {
    const { rerender, props } = setup();
    expect(screen.getByText('Ao vivo')).toBeTruthy();
    rerender(<BrainstormRoom {...props} connection="reconnecting" />);
    expect(screen.getByText('Reconectando…')).toBeTruthy();
    rerender(<BrainstormRoom {...props} connection="offline" />);
    expect(screen.getByText(/as mudanças não serão salvas/)).toBeTruthy();
  });
});

describe('sala do Brainstorming: Mural', () => {
  it('lança a ideia pelo campo e limpa só se salvou', async () => {
    const onAddIdea = vi.fn(async () => false);
    setup({ props: { onAddIdea } });
    const input = screen.getByLabelText('Escreva uma ideia') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Mascote animado' } });
    await act(async () => { fireEvent.submit(input.closest('form')!); });
    expect(onAddIdea).toHaveBeenCalledWith('Mascote animado');
    expect(input.value).toBe('Mascote animado');
  });

  it('busca por texto e ordem por mais votadas', () => {
    setup({ ideas: [
      idea({ id: 'a', content: 'Checklist', votes: ['x'], createdAt: '2026-10-17T12:00:00Z' }),
      idea({ id: 'b', content: 'Vídeo curto', votes: ['x', 'y'], createdAt: '2026-10-17T10:00:00Z' }),
    ] });
    const order = () => screen.getAllByRole('listitem').filter((li) => li.querySelector('article')).map((li) => li.textContent);
    expect(order()[0]).toContain('Checklist');
    fireEvent.click(screen.getByRole('button', { name: 'Populares' }));
    expect(order()[0]).toContain('Vídeo curto');
    fireEvent.change(screen.getByLabelText('Pesquisar ideias'), { target: { value: 'nada' } });
    expect(screen.getByText('Nenhuma ideia corresponde à busca')).toBeTruthy();
  });

  it('excluir pergunta antes e só depois chama o servidor', () => {
    const { handlers } = setup({ me: 'me', ideas: [idea({ id: 'a', authorId: 'me', content: 'Minha ideia' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir a ideia' }));
    expect(handlers.onDeleteIdea).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir ideia' }));
    expect(handlers.onDeleteIdea).toHaveBeenCalledWith('a');
  });

  it('o facilitador pode excluir a ideia de outra pessoa; quem participa não', () => {
    const ideas = [idea({ id: 'a', authorId: 'u3' })];
    const fac = setup({ ideas });
    expect(screen.getByRole('button', { name: 'Excluir a ideia' })).toBeTruthy();
    fac.unmount();
    setup({ me: 'me', ideas });
    expect(screen.queryByRole('button', { name: 'Excluir a ideia' })).toBeNull();
  });

  it('modo apresentação esconde o campo de lançar para todos e a faixa "Apresentando" é do facilitador', () => {
    const { handlers, unmount } = setup({ board: { settings: { isAnonymous: false, isPresentationMode: true } } });
    expect(screen.queryByLabelText('Escreva uma ideia')).toBeNull();
    expect(screen.getByText('Apresentando')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sair da apresentação/ }));
    expect(handlers.onTogglePresentation).toHaveBeenCalled();
    unmount();
    setup({ me: 'me', board: { settings: { isAnonymous: false, isPresentationMode: true } } });
    expect(screen.queryByText('Apresentando')).toBeNull();
    expect(screen.getByText('O facilitador está apresentando o mural.')).toBeTruthy();
  });
});

describe('sala do Brainstorming: ocultas e anônimas', () => {
  it('ocultas: o facilitador vê tudo e tem "Revelar ideias"; quem participa vê o aviso e as ideias cobertas', () => {
    const fac = setup({ board: { settings: { isAnonymous: false, isRevealed: false } }, ideas: [idea({ id: 'a', content: 'segredo' })] });
    expect(screen.getByText('segredo')).toBeTruthy();
    expect(screen.getByText(/Ideias ocultas para a sala/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Revelar ideias/ })[0]);
    expect(fac.handlers.onToggleReveal).toHaveBeenCalled();
    fac.unmount();

    setup({ me: 'me', board: { settings: { isAnonymous: false, isRevealed: false } }, ideas: [idea({ id: 'a', content: '', hidden: true, authorId: null })] });
    expect(screen.getByText(/As ideias estão ocultas/)).toBeTruthy();
    expect(screen.getByText('Ideia oculta')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Revelar ideias/ })).toBeNull();
  });

  it('exportar com as ideias ocultas só o facilitador faz', () => {
    setup({ me: 'me', board: { settings: { isAnonymous: false, isRevealed: false } } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Exportar depois da revelação' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('autores anônimos: o aviso muda para quem facilita e para quem participa', () => {
    const fac = setup({ board: { settings: { isAnonymous: true } } });
    expect(screen.getByText(/nem você/)).toBeTruthy();
    fac.unmount();
    setup({ me: 'me', board: { settings: { isAnonymous: true } } });
    expect(screen.getByText(/nem o facilitador/)).toBeTruthy();
  });
});

describe('sala do Brainstorming: exportação, participantes e apagar', () => {
  it('a imagem só aparece como formato no Mural e na Teia', () => {
    const mural = setup({ ideas: [idea({ id: 'a' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getByRole('radio', { name: /Imagem \(PNG\)/ })).toBeTruthy();
    mural.unmount();

    setup({ board: { phase: 'grouping' }, ideas: [idea({ id: 'a' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(screen.getByRole('radio', { name: /Resumo em Markdown/ })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Imagem \(PNG\)/ })).toBeNull();
  });

  it('a lista de participantes não inventa quem está online', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /^Participantes/ }));
    expect(screen.getAllByText('Facilitação').length).toBeGreaterThan(0);
    expect(screen.queryByText(/ausente/)).toBeNull();
    expect(screen.queryByLabelText(/online/)).toBeNull();
  });

  it('o facilitador remove uma pessoa com confirmação', () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Participantes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover Ana da sessão' }));
    expect(handlers.onRemoveParticipant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover pessoa' }));
    expect(handlers.onRemoveParticipant).toHaveBeenCalledWith('me');
  });

  it('apagar o brainstorming é só do facilitador e pede confirmação', () => {
    const fac = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /Apagar este brainstorming/ }));
    expect(fac.handlers.onDeleteBoard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar brainstorming' }));
    expect(fac.handlers.onDeleteBoard).toHaveBeenCalled();
    fac.unmount();
    setup({ me: 'me' });
    expect(screen.queryByRole('menuitem', { name: /Apagar este brainstorming/ })).toBeNull();
  });

  it('"Dar feedback" abre o formulário de feedback', () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /Sugerir melhoria/ }));
    expect(handlers.onOpenFeedback).toHaveBeenCalled();
  });
});

describe('sala do Brainstorming: Grupos e Matriz', () => {
  it('cria grupo e só limpa o campo se criou', async () => {
    const onAddGroup = vi.fn(async () => false);
    setup({ board: { phase: 'grouping' }, props: { onAddGroup } });
    const input = screen.getByLabelText('Nome do novo grupo') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Onboarding' } });
    await act(async () => { fireEvent.submit(input.closest('form')!); });
    expect(onAddGroup).toHaveBeenCalledWith('Onboarding');
    expect(input.value).toBe('Onboarding');
  });

  it('apagar grupo pede confirmação e diz para onde as ideias voltam', () => {
    const { handlers } = setup({ board: { phase: 'grouping' }, ideas: [idea({ id: 'a', groupId: 'g1' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Apagar o grupo Primeiros passos' }));
    expect(screen.getByText(/A ideia dele volta para "Sem grupo"/)).toBeTruthy();
    expect(handlers.onDeleteGroup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar grupo' }));
    expect(handlers.onDeleteGroup).toHaveBeenCalledWith('g1');
  });

  it('"Mover para…" move a ideia de grupo sem arrastar', () => {
    const { handlers } = setup({ board: { phase: 'grouping' }, ideas: [idea({ id: 'a', groupId: null })] });
    const item = screen.getAllByRole('menuitem', { name: 'Convites' })[0];
    fireEvent.click(item);
    expect(handlers.onMoveIdeaToGroup).toHaveBeenCalledWith('a', 'g2');
  });

  it('Matriz: os atalhos e o menu gravam retorno e esforço da coluna', () => {
    const { handlers } = setup({ board: { phase: 'prioritization' }, ideas: [idea({ id: 'a' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Mover para Quick wins' }));
    expect(handlers.onUpdateIdeaQualifiers).toHaveBeenCalledWith('a', { roi: 80, effort: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Mover para Descartar' }));
    expect(handlers.onUpdateIdeaQualifiers).toHaveBeenCalledWith('a', { roi: 20, effort: 80 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Estratégico' }));
    expect(handlers.onUpdateIdeaQualifiers).toHaveBeenCalledWith('a', { roi: 80, effort: 80 });
  });

  it('Plano: o botão abre a prévia com as ações marcadas', () => {
    const ideas = Array.from({ length: 7 }, (_, i) => idea({ id: `i${i}`, content: `Ideia ${i}`, votes: Array.from({ length: 7 - i }, (_, k) => `v${k}`), qualifiers: { roi: 80, effort: 20 } }));
    setup({ board: { phase: 'actions' }, ideas });
    fireEvent.click(screen.getByRole('button', { name: /Criar plano de ação/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('5 de 7 ideias')).toBeTruthy();
    expect(within(dialog).getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)).toHaveLength(5);
    expect(within(dialog).getByRole('button', { name: /Criar plano com 5 ações/ })).toBeTruthy();
  });
});
