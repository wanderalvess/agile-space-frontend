import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthCheckBoard, HealthCheckDimension, HealthCheckParticipant, HealthCheckVote } from '../../../lib/types';

// ---- Peças com rede, contexto próprio ou peso ficam de fora: aqui vale a estrutura das telas. ----
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => '/health-check/b1', useRouter: () => ({ push: pushMock, replace: vi.fn() }) }));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'PHX', squadName: 'Phoenix', roleName: '' }) }));
vi.mock('../../../hooks/useMyMemberships', () => ({ useMyMemberships: () => ({ memberships: null }) }));
vi.mock('../../../app/health-check/api', () => ({ healthCheckApi: { listBoards: vi.fn(async () => []) } }));
vi.mock('../../../app/action-plan/api', () => ({ actionPlanApi: { createBoard: vi.fn(), createTask: vi.fn() } }));
vi.mock('../../../app/workspace/api', () => ({ workspaceApi: { saveKanbanCard: vi.fn() } }));
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; 'aria-label'?: string }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));
// O DropdownMenu do Radix trava o jsdom ao abrir: o menu vira uma lista simples (ver docs/redesign/room-kit.md).
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
vi.mock('../../page', async () => {
  const R = await import('react');
  return {
    PAGE_CARD: 'card',
    PageShell: ({ children }: { children: React.ReactNode }) => R.createElement('div', null, children),
    PageHeader: ({ title }: { title: string }) => R.createElement('h1', null, title),
    DataToolbar: ({ search }: { search?: { value: string; onChange: (v: string) => void; ariaLabel?: string } }) =>
      R.createElement('input', { 'aria-label': search?.ariaLabel ?? 'Buscar', value: search?.value ?? '', onChange: (e: { target: { value: string } }) => search?.onChange(e.target.value) }),
    EmptyState: ({ title }: { title: string }) => R.createElement('div', { role: 'status' }, title),
    ErrorState: ({ title, onRetry }: { title?: string; onRetry?: () => void }) =>
      R.createElement('div', { role: 'alert' }, title, onRetry ? R.createElement('button', { onClick: onRetry }, 'Tentar de novo') : null),
  };
});
vi.mock('recharts', async () => {
  const R = await import('react');
  const Box = ({ children }: { children?: React.ReactNode }) => R.createElement('div', { 'data-chart': true }, children);
  const names = ['ResponsiveContainer', 'LineChart', 'Line', 'XAxis', 'YAxis', 'CartesianGrid', 'RadarChart', 'Radar', 'PolarGrid', 'PolarAngleAxis', 'PolarRadiusAxis', 'Tooltip'];
  return Object.fromEntries(names.map((n) => [n, Box]));
});

import { HealthCheckVotingBoard } from '../HealthCheckVotingBoard';
import { HealthCheckResults } from '../HealthCheckResults';
import { HealthLobbyView } from '../HealthLobbyView';
import { HealthRoomState } from '../HealthRoomStates';
import { HealthGuide } from '../HealthGuide';
import { CreateHealthCheckDialog } from '../CreateHealthCheckDialog';
import { rowFromBoard } from '../../../lib/health-check-lobby';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  (Element.prototype as any).scrollIntoView = (Element.prototype as any).scrollIntoView || (() => {});
  (Element.prototype as any).hasPointerCapture = (Element.prototype as any).hasPointerCapture || (() => false);
});
beforeEach(() => { window.localStorage.clear(); pushMock.mockClear(); });
afterEach(cleanup);

const DIMS: HealthCheckDimension[] = [
  { key: 'a', title: 'Apoio e suporte', description: 'Recebemos ajuda de fora do time?' },
  { key: 'p', title: 'Processos', description: 'Nossos processos ajudam?' },
];
const people: HealthCheckParticipant[] = [
  { id: 'fac', boardId: 'b1', nickname: 'Carla Mendes', role: 'AM' },
  { id: 'me', boardId: 'b1', nickname: 'Ana Souza', role: 'DEV' },
];
const board = (over: Partial<HealthCheckBoard> = {}): HealthCheckBoard => ({
  id: 'b1', creatorId: 'fac', status: 'collecting', createdAt: '2026-10-14T10:00:00Z', dimensions: DIMS, scaleType: 'traffic_light', sprintName: 'Radar Sprint 42', team: 'PHX', ...over,
});
const vote = (dimensionKey: string, value: string, comment = ''): HealthCheckVote =>
  ({ id: `${dimensionKey}-${value}`, boardId: 'b1', participantId: 'me', participantRole: 'DEV', dimensionKey, value, comment, timestamp: 'x' }) as HealthCheckVote;

/** Nenhum texto de 8 a 11 px nas telas do radar (o mínimo do redesign é 12 px). */
function expectNoTinyText(container: HTMLElement) {
  // O cabeçalho da sala é do kit (RoomTopBar, 11 px nos selos): aqui vale o conteúdo da tela.
  const scope = container.querySelector('#conteudo') ?? container;
  const bad = [...scope.querySelectorAll('*')].filter((el) => /text-\[(?:[0-9]|1[01])px\]/.test(el.getAttribute('class') ?? ''));
  expect(bad.map((b) => b.getAttribute('class'))).toEqual([]);
}

describe('votação', () => {
  const baseProps = (over: Record<string, unknown> = {}) => ({
    board: board(), squadLabel: 'Phoenix', participants: people, currentUserId: 'fac', userVotes: [] as HealthCheckVote[],
    onVote: vi.fn(async () => true), isCreator: true, onFinish: vi.fn(async () => ({ ok: true })), isFinishing: false, dimensions: DIMS,
    connection: { state: 'live' } as const, onDeleteBoard: vi.fn(async () => {}), onOpenFeedback: vi.fn(), ...over,
  });

  it('mostra as dimensões com a descrição inteira, o anonimato e o progresso próprio', () => {
    const { container } = render(<HealthCheckVotingBoard {...baseProps()} />);
    expect(screen.getByText('Apoio e suporte')).toBeTruthy();
    expect(screen.getByText('Recebemos ajuda de fora do time?')).toBeTruthy();
    expect(screen.getByText('Você respondeu 0 de 2')).toBeTruthy();
    expect(container.textContent).toContain('Respostas anônimas.');
    expect(screen.getAllByText('Aguardando a sua resposta')).toHaveLength(2);
    expectNoTinyText(container);
  });

  it('só o facilitador vê "Encerrar votação"; quem participa vê que o resultado depende dele', () => {
    const { unmount } = render(<HealthCheckVotingBoard {...baseProps()} />);
    expect(screen.getByRole('button', { name: /Encerrar votação/ })).toBeTruthy();
    unmount();
    render(<HealthCheckVotingBoard {...baseProps({ isCreator: false, currentUserId: 'me' })} />);
    expect(screen.queryByRole('button', { name: /Encerrar votação/ })).toBeNull();
    expect(screen.getByText('Aguardando o facilitador')).toBeTruthy();
  });

  it('um clique grava a resposta e o comentário aparece depois dela', async () => {
    const onVote = vi.fn(async () => true);
    render(<HealthCheckVotingBoard {...baseProps({ onVote })} />);
    const card = screen.getByRole('article', { name: 'Processos' });
    expect(within(card).queryByLabelText('Comentário sobre Processos')).toBeNull();
    await act(async () => { fireEvent.click(within(card).getByRole('button', { name: /Atenção/ })); });
    expect(onVote).toHaveBeenCalledWith('p', 'yellow', undefined);
  });

  it('escala de 1 a 5 mostra as pontas e marca a nota escolhida', () => {
    render(<HealthCheckVotingBoard {...baseProps({ board: board({ scaleType: 'numbers_5' }), userVotes: [vote('a', '4')] })} />);
    expect(screen.getAllByText('1 · Crítico').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5 · Muito bom').length).toBeGreaterThan(0);
    const card = screen.getByRole('article', { name: 'Apoio e suporte' });
    expect(within(card).getByRole('button', { name: 'Nota 4 de 5' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('escala emocional usa texto e ícone, sem emoji', () => {
    const { container } = render(<HealthCheckVotingBoard {...baseProps({ board: board({ scaleType: 'emojis' }) })} />);
    expect(screen.getAllByRole('button', { name: /Bom/ }).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('encerrar sem votos mostra o erro do servidor dentro da própria janela', async () => {
    const onFinish = vi.fn(async () => ({ ok: false, message: 'É necessário pelo menos um voto para encerrar.' }));
    render(<HealthCheckVotingBoard {...baseProps({ onFinish })} />);
    fireEvent.click(screen.getByRole('button', { name: /Encerrar votação/ }));
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Encerrar e ver o resultado' })); });
    expect(onFinish).toHaveBeenCalled();
    expect((await screen.findByRole('alert')).textContent).toContain('É necessário pelo menos um voto');
    expect(screen.getByRole('button', { name: 'Continuar votando' })).toBeTruthy();
  });

  it('conexão caída vira aviso visível', () => {
    render(<HealthCheckVotingBoard {...baseProps({ connection: { state: 'reconnecting', retryInSec: 4 } })} />);
    expect(screen.getAllByText(/Reconectando… nova tentativa em 4 s/).length).toBeGreaterThan(0);
  });

  it('o cabeçalho volta para o Radar de clima, sem seletor de squad', () => {
    render(<HealthCheckVotingBoard {...baseProps()} />);
    const back = screen.getByRole('link', { name: 'Voltar para o Radar de clima' });
    expect(back.getAttribute('href')).toBe('/health-check');
    expect(screen.queryByText(/Selecionar squad/i)).toBeNull();
  });
});

describe('resultado', () => {
  const results = [
    { dimensionKey: 'a', values: { green: 6, yellow: 3, red: 1 } },
    { dimensionKey: 'p', values: { green: 2, yellow: 5, red: 3 } },
  ];
  const votes = [vote('p', 'red', 'Muita reunião'), vote('a', 'green', '')];
  const props = (over: Record<string, unknown> = {}) => ({
    boardId: 'b1', board: board({ status: 'finished', summary: { topMetrics: [], lowMetrics: [], results } }), squadLabel: 'Phoenix', creatorName: 'Carla Mendes',
    participants: people, currentUserId: 'me', isCreator: false, dimensions: DIMS, votes, results,
    connection: { state: 'live' } as const, onDeleteBoard: vi.fn(async () => {}), onOpenFeedback: vi.fn(), ...over,
  });

  it('mostra a nota de clima de 0 a 10, a frase do resultado e os fortes e em atenção pela regra única', () => {
    const { container } = render(<HealthCheckResults {...props()} />);
    expect(screen.getByRole('img', { name: /Nota de clima 6,0 de 10/ })).toBeTruthy();
    expect(screen.getByText('O clima está bom, e Processos é o ponto que mais pede atenção.')).toBeTruthy();
    const attention = screen.getByRole('region', { name: 'Em atenção' });
    expect(attention.textContent).toContain('Processos');
    expect(attention.textContent).toContain('3 de 10 votos ruins');
    const strong = screen.getByRole('region', { name: 'Pontos fortes' });
    expect(strong.textContent).toContain('Apoio e suporte');
    expectNoTinyText(container);
  });

  it('não tem os textos antigos: Health Score, Sair do Radar, versão fixa e data inicial fixa', () => {
    const { container } = render(<HealthCheckResults {...props()} />);
    expect(container.textContent).not.toMatch(/Health Score|Sair do Radar|Snapshot v2\.5|Sprint Atual|Avg:/);
    expect(container.textContent).not.toMatch(/Engajamento/);
  });

  it('detalhamento: nota em português, contagem rotulada e comentário anônimo', () => {
    render(<HealthCheckResults {...props()} />);
    const detail = screen.getByRole('article', { name: 'Detalhe de Processos' });
    expect(detail.textContent).toContain('Nota 4,5');
    expect(detail.textContent).toContain('Muita reunião');
    expect(detail.textContent).not.toMatch(/green|yellow|red/);
  });

  it('o plano de ação abre com o item em atenção marcado e o outro como opcional', async () => {
    render(<HealthCheckResults {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Criar plano de ação/ }));
    expect(await screen.findByText('Itens propostos (1 de 2)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar 1 ação' })).toBeTruthy();
  });

  it('plano já criado neste navegador: o botão vira "Plano criado" mesmo depois de recarregar', () => {
    window.localStorage.setItem('healthCheck.plans.v1', JSON.stringify({ b1: { boardId: 'b1', destination: 'kanban', items: [{ key: 'p', what: 'Melhorar: Processos' }], createdAt: 'x' } }));
    render(<HealthCheckResults {...props()} />);
    expect(screen.getAllByRole('button', { name: /Plano criado/ }).length).toBeGreaterThan(0);
  });

  it('apresentar troca o cabeçalho pela faixa "Apresentando" e Esc sai', () => {
    render(<HealthCheckResults {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Apresentar/ }));
    expect(screen.getByText('Apresentando')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Etapas da apresentação' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Radar' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Apresentando')).toBeNull();
  });

  it('exportar fica no cabeçalho e abre as três opções', () => {
    render(<HealthCheckResults {...props()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Exportar o resultado' })[0]);
    expect(screen.getByText('Markdown')).toBeTruthy();
    expect(screen.getByText('Planilha (CSV)')).toBeTruthy();
    expect(screen.getByText('PDF do resultado')).toBeTruthy();
  });

  it('só quem criou vê "Apagar este radar"', () => {
    const { unmount } = render(<HealthCheckResults {...props({ isCreator: true, currentUserId: 'fac' })} />);
    expect(screen.getByRole('menuitem', { name: /Apagar este radar/ })).toBeTruthy();
    unmount();
    render(<HealthCheckResults {...props()} />);
    expect(screen.queryByRole('menuitem', { name: /Apagar este radar/ })).toBeNull();
  });
});

describe('lobby', () => {
  const finished = board({ id: 'f1', status: 'finished', sprintName: 'Radar Sprint 38', summary: { topMetrics: [], lowMetrics: [], results: [{ dimensionKey: 'a', values: { green: 8, yellow: 2 } }, { dimensionKey: 'p', values: { green: 7, yellow: 3 } }] } });
  const open = board({ id: 'c1', sprintName: 'Radar Sprint 42' });
  const view = (over: Record<string, unknown> = {}) => (
    <HealthLobbyView rows={[rowFromBoard(open, 9), rowFromBoard(finished)]} state="ready" onRetry={() => {}} onNew={() => {}} isCreating={false} onJoin={() => {}} onOpen={() => {}} currentUserId="fac" onDelete={async () => {}} {...over} />
  );

  it('começar, última pesquisa, lista da squad e o nome "Radar de clima"', () => {
    const { container } = render(view());
    expect(screen.getByText('Radar de clima')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Nova pesquisa/ })).toBeTruthy();
    expect(container.textContent).toContain('Última pesquisa');
    expect(container.textContent).toContain('Respostas até agora');
    expect(screen.getByRole('table', { name: 'Pesquisas da squad' })).toBeTruthy();
    expect(container.textContent).not.toMatch(/Radar de Saúde|Health Check|Sessões recentes/);
    expectNoTinyText(container);
  });

  it('colar o link inteiro extrai o ID em minúsculas e entra na pesquisa', () => {
    const onJoin = vi.fn();
    render(view({ onJoin }));
    const id = '7c1e5f0a-93b4-4b52-a1d2-0f6e3a9c8d41';
    fireEvent.change(screen.getByLabelText('ID ou link da pesquisa'), { target: { value: `https://portal.x/health-check/${id.toUpperCase()}` } });
    expect(screen.getByText(id)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na pesquisa' }));
    expect(onJoin).toHaveBeenCalledWith(id);
  });

  it('texto que não é do radar não vira rota quebrada', () => {
    const onJoin = vi.fn();
    render(view({ onJoin }));
    fireEvent.change(screen.getByLabelText('ID ou link da pesquisa'), { target: { value: 'https://x/retro/abc' } });
    expect((screen.getByRole('button', { name: 'Entrar na pesquisa' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/não parece um ID nem um link/)).toBeTruthy();
  });

  it('filtra por situação', () => {
    render(view());
    fireEvent.click(screen.getByRole('button', { name: 'Encerradas' }));
    const table = screen.getByRole('table', { name: 'Pesquisas da squad' });
    expect(within(table).queryByText('Radar Sprint 42')).toBeNull();
    expect(within(table).getByText('Radar Sprint 38')).toBeTruthy();
  });

  it('só o criador vê "Apagar" e a confirmação é vermelha', async () => {
    const onDelete = vi.fn(async () => {});
    render(view({ onDelete }));
    fireEvent.click(screen.getAllByRole('button', { name: /Apagar a pesquisa/ })[0]);
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Apagar pesquisa' })); });
    expect(onDelete).toHaveBeenCalled();
  });

  it('quem não criou não vê o botão de apagar', () => {
    render(view({ currentUserId: 'outra-pessoa' }));
    expect(screen.queryByRole('button', { name: /Apagar a pesquisa/ })).toBeNull();
  });

  it('erro da lista não esconde o começo: Nova pesquisa e entrar por ID seguem', () => {
    const onRetry = vi.fn();
    render(view({ rows: [], state: 'error', onRetry }));
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar as pesquisas');
    fireEvent.click(screen.getByText('Tentar de novo'));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Nova pesquisa/ })).toBeTruthy();
  });

  it('sem squad ativa explica o que fazer; carregando é um status', () => {
    const { unmount } = render(view({ rows: [], state: 'no-squad' }));
    expect(screen.getByText('Escolha uma squad para ver as pesquisas')).toBeTruthy();
    unmount();
    render(view({ rows: [], state: 'loading' }));
    expect(screen.getByRole('status', { name: 'Carregando as pesquisas' })).toBeTruthy();
  });

  it('primeira pesquisa: textos de vazio que dizem o que vai aparecer', () => {
    render(view({ rows: [] }));
    expect(screen.getByText('Nenhuma pesquisa ainda')).toBeTruthy();
    expect(screen.getByText(/A evolução aparece depois do primeiro radar encerrado/)).toBeTruthy();
  });
});

describe('estados da sala', () => {
  it('erro de carga não parece "não encontrado" e oferece tentar de novo', () => {
    const onRetry = vi.fn();
    render(<HealthRoomState kind="error" onRetry={onRetry} />);
    expect(screen.getByText('Não foi possível carregar o radar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('não encontrado, apagado, carregando e entrando na sala', () => {
    const kinds: [Parameters<typeof HealthRoomState>[0]['kind'], string][] = [
      ['notfound', 'Radar não encontrado'], ['deleted', 'Este radar foi apagado'], ['loading', 'Carregando o radar…'], ['entering', 'Entrando na sala…'],
    ];
    for (const [kind, text] of kinds) {
      const { unmount, container } = render(<HealthRoomState kind={kind} />);
      expect(container.textContent).toContain(text);
      expect(container.textContent).not.toContain('Oops');
      unmount();
    }
  });

  it('apagado e não encontrado voltam ao Radar de clima', () => {
    render(<HealthRoomState kind="deleted" />);
    expect(screen.getByRole('link', { name: 'Voltar para o Radar de clima' }).getAttribute('href')).toBe('/health-check');
  });
});

describe('guia', () => {
  it('explica as três escalas e a privacidade verdadeira (sem "apenas a média consolidada")', () => {
    render(<HealthGuide open onOpenChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Escalas' }), { button: 0 });
    expect(screen.getByText('Numérica de 1 a 5')).toBeTruthy();
    expect(screen.getByText('Emocional')).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Privacidade' }), { button: 0 });
    expect(document.body.textContent).toContain('todos os votos e comentários, sem nome');
    expect(document.body.textContent).not.toContain('apenas a média consolidada');
  });
});

describe('nova pesquisa', () => {
  const open = (onCreateBoard = vi.fn(async () => {})) => render(<CreateHealthCheckDialog open onOpenChange={() => {}} onCreateBoard={onCreateBoard} isCreating={false} />);

  it('título obrigatório: o erro aparece no campo, sem toast', async () => {
    const onCreateBoard = vi.fn(async () => {});
    open(onCreateBoard);
    fireEvent.click(await screen.findByRole('button', { name: /Iniciar pesquisa/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Dê um título para a pesquisa.');
    expect(onCreateBoard).not.toHaveBeenCalled();
  });

  it('cria com a squad do vínculo (nunca texto livre), a escala e as 8 perguntas do modelo', async () => {
    const onCreateBoard = vi.fn(async () => {});
    open(onCreateBoard);
    fireEvent.change(await screen.findByLabelText('Título da pesquisa'), { target: { value: '  Radar Sprint 45 ' } });
    fireEvent.click(screen.getByRole('radio', { name: /Numérica de 1 a 5/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/ })); });
    expect(onCreateBoard).toHaveBeenCalledTimes(1);
    const input = (onCreateBoard.mock.calls[0] as unknown as [{ title: string; team: string; scaleType: string; dimensions: unknown[] }])[0];
    expect(input).toMatchObject({ title: 'Radar Sprint 45', team: 'PHX', scaleType: 'numbers_5' });
    expect(input.dimensions).toHaveLength(8);
  });

  it('falha do servidor aparece em faixa na própria janela e o texto digitado fica', async () => {
    const onCreateBoard = vi.fn(async () => { throw new Error('boom'); });
    open(onCreateBoard);
    const title = await screen.findByLabelText('Título da pesquisa');
    fireEvent.change(title, { target: { value: 'Radar X' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/ })); });
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível criar a pesquisa agora.');
    expect((screen.getByLabelText('Título da pesquisa') as HTMLInputElement).value).toBe('Radar X');
  });

  it('perguntas: remover tem nome acessível, importar em massa conta as linhas e limpar pede confirmação', async () => {
    open();
    fireEvent.click(await screen.findByRole('tab', { name: 'Perguntas (8)' }));
    expect(screen.getByRole('button', { name: 'Remover Apoio e Suporte' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Importar em massa/ }));
    fireEvent.change(screen.getByLabelText('Lista de dimensões'), { target: { value: 'Autonomia - Temos poder?\nCarga: Está ok?' } });
    expect(screen.getByText('2 linhas serão criadas.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar as 2 dimensões' }));
    expect(await screen.findByRole('tab', { name: 'Perguntas (10)' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Limpar tudo/ }));
    expect(await screen.findByText('Limpar todas as perguntas?')).toBeTruthy();
  });
});
