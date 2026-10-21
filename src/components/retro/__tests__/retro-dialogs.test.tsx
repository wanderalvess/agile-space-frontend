import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetroBoard, RetroCard } from '../../../lib/types';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  toast: vi.fn(),
  api: { listBoards: vi.fn(), getCards: vi.fn(), saveOrUpdateBoard: vi.fn() },
  stats: vi.fn(),
  user: { userProfile: { id: 'me', name: 'Ana Souza' } as { id: string; name: string } | null },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => h.user }));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'PHOENIX', squadName: 'Phoenix' }) }));
vi.mock('../../../hooks/useMyMemberships', () => ({ useMyMemberships: () => ({ memberships: null, settled: true, stale: false, refresh: () => {} }) }));
vi.mock('../../../app/retro/api', () => ({ retroApi: h.api }));
vi.mock('../../../app/work-items-api', () => ({ workItemsApi: { getSprintStats: h.stats } }));
vi.mock('../../ui/DashboardFilters', () => ({ useProjectEstimationUnit: () => ({ unit: 'HOURS', isConfigured: true }) }));
vi.mock('../../page', () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
    <header><h1>{title}</h1><p>{subtitle}</p>{actions}</header>
  ),
}));
// O Select do Radix não abre no jsdom: um <select> nativo exercita a mesma lógica de opções.
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; 'aria-label'?: string }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import { RetroActionImportDialog } from '../RetroActionImportDialog';
import { CreateRetroDialog } from '../CreateRetroDialog';
import { RetroLobbyView } from '../RetroLobbyView';
import { RetroSettingsDialog } from '../RetroSettingsDialog';
import { RetroHealthCheckGate } from '../RetroHealthCheckGate';
import { SprintStatsDialog } from '../SprintStatsDialog';
import { RETRO_TEMPLATES } from '../../../lib/types';
import { saveTemplate, listTemplates } from '../../../lib/retro-templates';
import { DEFAULT_SETUP_SETTINGS } from '../../../lib/retro-formats';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  window.localStorage.clear();
  h.push.mockClear();
  h.toast.mockClear();
  Object.values(h.api).forEach((f) => f.mockReset());
  h.user.userProfile = { id: 'me', name: 'Ana Souza' };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const board = (over: Partial<RetroBoard> = {}): RetroBoard => ({
  id: 'b1', creatorId: 'u1', isCardsRevealed: true, votingStatus: 'finished', isAuthorsRevealed: false, createdAt: '2025-10-03T10:00:00Z',
  title: 'Retro 41', team: 'Phoenix', templateKey: 'classic', columns: RETRO_TEMPLATES.classic, ...over,
});
const card = (over: Partial<RetroCard> & { id: string }): RetroCard => ({
  boardId: 'b1', columnKey: 'actionItems', content: `ação ${over.id}`, authorId: 'u1', votes: [], order: 1, ...over,
});

describe('importar ações pendentes', () => {
  it('lista só ações abertas, com todas marcadas, e importa as marcadas agrupadas por retro', async () => {
    h.api.listBoards.mockResolvedValue([board({ id: 'b0', title: 'Atual' }), board({ id: 'b41', title: 'Retro 41' }), board({ id: 'b40', title: 'Retro 40', createdAt: '2025-09-19T10:00:00Z' })]);
    h.api.getCards.mockImplementation(async (id: string) =>
      id === 'b41'
        ? [card({ id: 'a1', boardId: 'b41', assignee: 'Carla', dueDate: '2025-10-25' }), card({ id: 'a2', boardId: 'b41', isDone: true }), card({ id: 'f1', boardId: 'b41', columnKey: 'wentWell' })]
        : [card({ id: 'a3', boardId: 'b40', carryCount: 2 })]
    );
    const onImport = vi.fn();
    render(<RetroActionImportDialog isOpen onClose={vi.fn()} team="Phoenix" squadId="PHOENIX" currentBoardId="b0" onImport={onImport} />);

    expect(await screen.findByText('ação a1')).toBeTruthy();
    expect(screen.queryByText('ação a2')).toBeNull(); // concluída
    expect(screen.queryByText('ação f1')).toBeNull(); // coluna de feedback
    expect(h.api.listBoards).toHaveBeenCalledWith({ squadId: 'PHOENIX' });
    expect(h.api.getCards).not.toHaveBeenCalledWith('b0'); // o quadro atual não entra

    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.every((b) => b.checked)).toBe(true);
    expect(screen.getByRole('button', { name: 'Importar 2 ações' })).toBeTruthy();

    fireEvent.click(boxes[1]); // desmarca a de Retro 40
    fireEvent.click(screen.getByRole('button', { name: 'Importar 1 ação' }));
    expect(onImport).toHaveBeenCalledTimes(1);
    const entries = onImport.mock.calls[0][0];
    expect(entries).toHaveLength(1);
    expect(entries[0].board.id).toBe('b41');
    expect(entries[0].cards.map((c: RetroCard) => c.id)).toEqual(['a1']);
  });

  it('nada marcado: o botão fica desligado', async () => {
    h.api.listBoards.mockResolvedValue([board({ id: 'b41' })]);
    h.api.getCards.mockResolvedValue([card({ id: 'a1' })]);
    render(<RetroActionImportDialog isOpen onClose={vi.fn()} team="Phoenix" squadId="PHOENIX" currentBoardId="b0" onImport={vi.fn()} />);
    fireEvent.click((await screen.findAllByRole('checkbox'))[0]);
    expect((screen.getByRole('button', { name: 'Importar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('falha de rede não é "nenhuma ação": avisa e deixa tentar de novo', async () => {
    h.api.listBoards.mockRejectedValueOnce(new Error('rede'));
    render(<RetroActionImportDialog isOpen onClose={vi.fn()} team="Phoenix" squadId="PHOENIX" currentBoardId="b0" onImport={vi.fn()} />);
    expect(await screen.findByText('Não foi possível buscar as retros anteriores')).toBeTruthy();
    h.api.listBoards.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Nenhuma ação pendente')).toBeTruthy();
  });

  it('uma retro ilegível não derruba as outras e a tela avisa que pode estar incompleta', async () => {
    h.api.listBoards.mockResolvedValue([board({ id: 'b41' }), board({ id: 'b40' })]);
    h.api.getCards.mockImplementation(async (id: string) => { if (id === 'b40') throw new Error('x'); return [card({ id: 'a1' })]; });
    render(<RetroActionImportDialog isOpen onClose={vi.fn()} team="Phoenix" squadId="PHOENIX" currentBoardId="b0" onImport={vi.fn()} />);
    expect(await screen.findByText('ação a1')).toBeTruthy();
    expect(screen.getByText(/a lista pode estar incompleta/)).toBeTruthy();
  });
});

describe('Nova retro', () => {
  const open = () => render(<CreateRetroDialog open onOpenChange={vi.fn()} />);

  it('sem título mostra o erro no campo e não chama o servidor', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Criar retro' }));
    expect(await screen.findByText('Dê um nome à retro.')).toBeTruthy();
    expect(h.api.saveOrUpdateBoard).not.toHaveBeenCalled();
  });

  it('cria com o formato escolhido, as opções ligadas, e leva para a sala', async () => {
    h.api.saveOrUpdateBoard.mockImplementation(async (b: RetroBoard) => b);
    open();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Retro Sprint 43' } });
    fireEvent.click(screen.getByRole('radio', { name: /Start \/ Stop \/ Continue/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Autores abertos/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Check-in inicial/ }));
    fireEvent.change(screen.getByLabelText('Pergunta do check-in'), { target: { value: 'Como você chega?' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar retro' })); });

    expect(h.api.saveOrUpdateBoard).toHaveBeenCalledTimes(1);
    const sent = h.api.saveOrUpdateBoard.mock.calls[0][0];
    expect(sent).toMatchObject({
      creatorId: 'me', title: 'Retro Sprint 43', team: 'PHOENIX', squadId: 'PHOENIX', templateKey: 'start_stop_continue',
      isCardsRevealed: false, votingStatus: 'disabled', maxVotesPerParticipant: 5, participantIds: ['me'],
      isAuthorsRevealed: true, healthCheckEnabled: true, healthCheckQuestion: 'Como você chega?', syncStageEnabled: false,
    });
    expect(sent.columns).toBe(RETRO_TEMPLATES.start_stop_continue);
    expect(h.push).toHaveBeenCalledWith(`/retro/${sent.id}`);
    // aparece em "abertas neste navegador"
    expect(JSON.parse(window.localStorage.getItem('agileSpace_rooms_meta')!)[0]).toMatchObject({ roomId: sent.id, type: 'retro', title: 'Retro Sprint 43' });
  });

  it('formato personalizado: exige 2 colunas nomeadas, sem repetição, e manda só as nomeadas', async () => {
    h.api.saveOrUpdateBoard.mockImplementation(async (b: RetroBoard) => b);
    open();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Pós-incidente' } });
    fireEvent.click(screen.getByRole('radio', { name: /Personalizado/ }));
    fireEvent.change(screen.getByLabelText('Nome da coluna 1'), { target: { value: 'Linha do tempo' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar retro' })); });
    expect(h.api.saveOrUpdateBoard).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Revise as colunas' }));

    fireEvent.change(screen.getByLabelText('Nome da coluna 2'), { target: { value: 'Causas' } });
    fireEvent.change(screen.getByLabelText('Nome da coluna 3'), { target: { value: 'Ações' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar retro' })); });
    const sent = h.api.saveOrUpdateBoard.mock.calls[0][0];
    expect(sent.templateKey).toBe('custom');
    expect(sent.columns.map((c: any) => c.title)).toEqual(['Linha do tempo', 'Causas', 'Ações']);
    expect(sent.columns.map((c: any) => c.order)).toEqual([0, 1, 2]);
    expect(sent.columns[2].theme).toBe('action'); // a 3ª coluna do editor já nasce como plano de ação
  });

  it('limites do formato personalizado: de 2 a 6 colunas', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: /Personalizado/ }));
    expect(screen.getAllByLabelText(/^Nome da coluna/)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Remover a coluna 3' }));
    expect(screen.getAllByLabelText(/^Nome da coluna/)).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Remover a coluna/ })).toBeNull();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: /Adicionar coluna/ }));
    expect(screen.getAllByLabelText(/^Nome da coluna/)).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /Adicionar coluna/ })).toBeNull();
  });

  it('"Salvar este formato" guarda no navegador, e o formato salvo volta aplicado', async () => {
    h.api.saveOrUpdateBoard.mockImplementation(async (b: RetroBoard) => b);
    open();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Retro rápida' } });
    fireEvent.click(screen.getByRole('radio', { name: /4Ls/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Sincronizar coluna ativa/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Salvar este formato/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar retro' })); });
    const saved = listTemplates();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'Retro rápida', template: 'four_ls' });
    expect(saved[0].setupSettings.syncStageEnabled).toBe(true);
    cleanup();

    render(<CreateRetroDialog open onOpenChange={vi.fn()} presetFormatId={saved[0].id} />);
    await waitFor(() => expect((screen.getByRole('radio', { name: /4Ls/ }) as HTMLElement).getAttribute('aria-checked')).toBe('true'));
    expect((screen.getByRole('switch', { name: /Sincronizar coluna ativa/ }) as HTMLElement).getAttribute('aria-checked')).toBe('true');
  });

  it('escolher um formato salvo na lista aplica formato e opções', async () => {
    saveTemplate({ name: 'Pós-incidente', template: 'speed_car', customColumns: [], setupSettings: { ...DEFAULT_SETUP_SETTINGS, autoSortOnVoteEnd: true } });
    open();
    const select = await screen.findByLabelText('Formato salvo');
    fireEvent.change(select, { target: { value: listTemplates()[0].id } });
    expect(screen.getByRole('radio', { name: /Carro veloz/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: /Ordenar por votos/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('erro do servidor avisa e não navega; sem ID também', async () => {
    h.api.saveOrUpdateBoard.mockRejectedValueOnce(new Error('sem permissão'));
    open();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'X' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar retro' })); });
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao criar', description: 'sem permissão' }));
    expect(h.push).not.toHaveBeenCalled();

    h.api.saveOrUpdateBoard.mockResolvedValueOnce({});
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar retro' })); });
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'O servidor não retornou um ID para o novo quadro.' }));
  });

  it('sem perfil identificado não cria', async () => {
    h.user.userProfile = null;
    open();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'X' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Criar retro' })); });
    expect(h.api.saveOrUpdateBoard).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Perfil não identificado' }));
  });
});

describe('lobby da Retro', () => {
  const NOW = Date.parse('2025-10-17T18:00:00Z');
  const rows = [
    { id: 'L1', title: 'Retro Sprint 42', team: 'Phoenix', createdAt: '2025-10-17T10:00:00Z', templateKey: 'classic' as const, board: board({ id: 'L1', title: 'Retro Sprint 42', createdAt: '2025-10-17T10:00:00Z', votingStatus: 'active' }) },
    { id: 'B41', title: 'Retro Sprint 41', team: 'Phoenix', createdAt: '2025-10-03T10:00:00Z', templateKey: 'classic' as const, board: board({ id: 'B41', title: 'Retro Sprint 41' }) },
    { id: 'B40', title: 'Retro Sprint 40', team: 'Phoenix', createdAt: '2025-09-19T10:00:00Z', templateKey: 'four_ls' as const, board: board({ id: 'B40', title: 'Retro Sprint 40', templateKey: 'four_ls' }) },
  ];
  const details = {
    B41: { summary: { cards: 18, actions: 4, actionsDone: 3 }, open: [card({ id: 'a1', boardId: 'B41', assignee: 'Carla', dueDate: '2025-10-25' })] },
    B40: { summary: { cards: 22, actions: 5, actionsDone: 5 }, open: [] },
  };
  const base = { squadName: 'Phoenix', rows, loading: false, failed: false, onRetry: vi.fn(), details, savedFormats: [], isCreating: false, onNew: vi.fn(), onJoin: vi.fn(), onOpenBoard: vi.fn(), now: NOW };

  it('separa o que está em andamento das retros anteriores e mostra contagens', () => {
    render(<RetroLobbyView {...base} />);
    const andamento = screen.getByRole('region', { name: 'Em andamento' });
    expect(within(andamento).getByText('Retro Sprint 42')).toBeTruthy();
    expect(within(andamento).getByText(/Fase: Votação/)).toBeTruthy();
    const anteriores = screen.getByRole('region', { name: 'Retros anteriores' });
    expect(within(anteriores).queryByText('Retro Sprint 42')).toBeNull();
    expect(within(anteriores).getByText(/18 cartões · 4 ações · 3 feitas/)).toBeTruthy();
    expect(screen.getByText('2 retros anteriores')).toBeTruthy();
  });

  it('abrir uma retro e entrar na que está em andamento', () => {
    const onOpenBoard = vi.fn();
    render(<RetroLobbyView {...base} onOpenBoard={onOpenBoard} />);
    fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }));
    expect(onOpenBoard).toHaveBeenCalledWith('L1');
    fireEvent.click(within(screen.getByRole('region', { name: 'Retros anteriores' })).getByText('Retro Sprint 41'));
    expect(onOpenBoard).toHaveBeenLastCalledWith('B41');
  });

  it('entrar por código: maiúsculas, só com texto, e Enter envia', () => {
    const onJoin = vi.fn();
    render(<RetroLobbyView {...base} onJoin={onJoin} />);
    const submit = screen.getByRole('button', { name: 'Entrar na retro' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Entrar com o código da retro'), { target: { value: ' ab12 ' } });
    fireEvent.submit(submit.closest('form')!);
    expect(onJoin).toHaveBeenCalledWith('AB12');
  });

  it('filtro "Com ações abertas" fica só com as retros que têm ação aberta', () => {
    render(<RetroLobbyView {...base} />);
    const anteriores = screen.getByRole('region', { name: 'Retros anteriores' });
    fireEvent.click(screen.getByRole('button', { name: 'Com ações abertas' }));
    expect(within(anteriores).getByText('Retro Sprint 41')).toBeTruthy();
    expect(within(anteriores).queryByText('Retro Sprint 40')).toBeNull();
  });

  it('ações em aberto de retros anteriores abrem a retro de origem', () => {
    const onOpenBoard = vi.fn();
    render(<RetroLobbyView {...base} onOpenBoard={onOpenBoard} />);
    const lateral = screen.getByRole('region', { name: 'Ações em aberto' });
    fireEvent.click(within(lateral).getByText('ação a1'));
    expect(onOpenBoard).toHaveBeenCalledWith('B41');
  });

  it('Nova retro e formatos salvos ("Usar" abre com o formato)', () => {
    const onNew = vi.fn();
    const savedFormats = [{ id: 's1', name: 'Retro rápida da Phoenix', template: 'classic' as const, customColumns: [], setupSettings: DEFAULT_SETUP_SETTINGS, createdAt: '2025-10-01T10:00:00Z' }];
    render(<RetroLobbyView {...base} onNew={onNew} savedFormats={savedFormats} />);
    fireEvent.click(screen.getByRole('button', { name: /Nova retro/ }));
    expect(onNew).toHaveBeenLastCalledWith();
    fireEvent.click(within(screen.getByRole('region', { name: 'Formatos salvos' })).getByRole('button', { name: 'Usar' }));
    expect(onNew).toHaveBeenLastCalledWith('s1');
  });

  it('estados: primeira vez, falha ao carregar com nova tentativa', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<RetroLobbyView {...base} rows={[]} details={{}} />);
    expect(screen.getByText('Nenhuma retro ainda')).toBeTruthy();
    rerender(<RetroLobbyView {...base} rows={[]} details={{}} failed onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('configurações da retro', () => {
  const props = () => ({
    isOpen: true, onClose: vi.fn(),
    isAuthorsRevealed: false, onToggleAuthorsRevealed: vi.fn(), syncStageEnabled: false, onToggleSyncStage: vi.fn(),
    autoRevealOnTimerEnd: false, onToggleAutoRevealOnTimerEnd: vi.fn(), autoSortOnVoteEnd: false, onToggleAutoSortOnVoteEnd: vi.fn(),
    healthCheckEnabled: true, onToggleHealthCheck: vi.fn(), healthCheckQuestion: 'Pergunta antiga', onHealthCheckQuestionChange: vi.fn(),
  });

  it('a pergunta do check-in só é enviada depois de 500 ms parado, e o eco do servidor não apaga o que se digita', () => {
    vi.useFakeTimers();
    const p = props();
    const { rerender } = render(<RetroSettingsDialog {...p} />);
    const campo = screen.getByLabelText('Pergunta do check-in') as HTMLTextAreaElement;
    expect(campo.value).toBe('Pergunta antiga');
    fireEvent.change(campo, { target: { value: 'Pergunta nova' } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(p.onHealthCheckQuestionChange).not.toHaveBeenCalled();
    // eco de um valor mais antigo chegando enquanto digita
    rerender(<RetroSettingsDialog {...p} healthCheckQuestion="Pergunta antiga" />);
    expect((screen.getByLabelText('Pergunta do check-in') as HTMLTextAreaElement).value).toBe('Pergunta nova');
    act(() => { vi.advanceTimersByTime(600); });
    expect(p.onHealthCheckQuestionChange).toHaveBeenCalledTimes(1);
    expect(p.onHealthCheckQuestionChange).toHaveBeenCalledWith('Pergunta nova');
  });

  it('sem check-in ligado o campo da pergunta não aparece', () => {
    render(<RetroSettingsDialog {...props()} healthCheckEnabled={false} />);
    expect(screen.queryByLabelText('Pergunta do check-in')).toBeNull();
  });
});

describe('check-in inicial', () => {
  it('um clique só: cliques repetidos enviam uma resposta', async () => {
    let release!: () => void;
    const onAnswer = vi.fn(() => new Promise<void>((r) => { release = r; }));
    render(<RetroHealthCheckGate onAnswer={onAnswer} />);
    const bem = screen.getByRole('button', { name: 'Bem' });
    fireEvent.click(bem);
    fireEvent.click(bem);
    fireEvent.click(screen.getByRole('button', { name: 'Ótimo' }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith('good');
    await act(async () => { release(); });
  });

  it('usa a pergunta do facilitador, ou a padrão quando está em branco, e não dá para fechar sem responder', () => {
    const { rerender } = render(<RetroHealthCheckGate question="  Como foi a sprint?  " onAnswer={vi.fn()} />);
    expect(screen.getByRole('dialog').textContent).toContain('Como foi a sprint?');
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    rerender(<RetroHealthCheckGate question="   " onAnswer={vi.fn()} />);
    expect(screen.getByRole('dialog').textContent).toContain('Como você está chegando nessa retro?');
  });
});

describe('números da sprint', () => {
  it('mostra entregue, previsto, o que ficou e o cumprimento, com a unidade da squad', async () => {
    h.stats.mockResolvedValue({ entregue: 20, previsto: 30, carryOvers: 4 });
    render(<SprintStatsDialog open onClose={vi.fn()} squadId="PHOENIX" sprintId="s42" />);
    expect(await screen.findByText('Entregue na sprint')).toBeTruthy();
    expect(h.stats).toHaveBeenCalledWith('PHOENIX', 's42');
    expect(screen.getByText('de 30')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getAllByText('h').length).toBeGreaterThan(0);
  });

  it('sem dados avisa como conectar o Jira; falha da API mostra o erro', async () => {
    h.stats.mockResolvedValueOnce({ entregue: 0, previsto: 0, carryOvers: 0 });
    const { unmount } = render(<SprintStatsDialog open onClose={vi.fn()} squadId="PHOENIX" />);
    expect(await screen.findByText(/Ainda não há dados desta sprint/)).toBeTruthy();
    unmount();
    h.stats.mockRejectedValueOnce(new Error('x'));
    render(<SprintStatsDialog open onClose={vi.fn()} squadId="PHOENIX" />);
    expect(await screen.findByText(/Não foi possível carregar os números desta sprint/)).toBeTruthy();
  });
});

describe('check-in com nota livre e números da sprint (backend novo)', () => {
  it('check-in: sem allowNote o campo não existe e a resposta é a de sempre', () => {
    render(<RetroHealthCheckGate onAnswer={vi.fn()} />);
    expect(screen.queryByLabelText(/Quer contar mais/)).toBeNull();
  });

  it('check-in: a nota (até 500) vai junto com a resposta, e vazia não vai', async () => {
    const onAnswer = vi.fn();
    const { unmount } = render(<RetroHealthCheckGate allowNote onAnswer={onAnswer} />);
    const field = screen.getByLabelText(/Quer contar mais/) as HTMLTextAreaElement;
    expect(field.maxLength).toBe(500);
    fireEvent.change(field, { target: { value: '  Dia puxado.  ' } });
    expect(screen.getByText('15/500')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cansado' })); });
    expect(onAnswer).toHaveBeenCalledWith('tired', 'Dia puxado.');
    unmount();
    const second = vi.fn();
    render(<RetroHealthCheckGate allowNote onAnswer={second} />);
    fireEvent.change(screen.getByLabelText(/Quer contar mais/), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bem' })); });
    expect(second).toHaveBeenCalledWith('good');
  });

  it('check-in: a nota que passa de 500 caracteres é cortada', () => {
    render(<RetroHealthCheckGate allowNote onAnswer={vi.fn()} />);
    const field = screen.getByLabelText(/Quer contar mais/) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'x'.repeat(520) } });
    expect(field.value).toHaveLength(500);
  });

  it('números da sprint: mostra os quatro campos novos quando vierem', async () => {
    h.stats.mockResolvedValue({ entregue: 20, previsto: 30, carryOvers: 4, totalItens: 42, concluidosJira: 30, bugs: 3, carryOverPontos: 12 });
    render(<SprintStatsDialog open onClose={vi.fn()} squadId="PHOENIX" sprintId="s42" />);
    const group = await screen.findByRole('group', { name: 'Itens da sprint no Jira' });
    expect(group.textContent).toContain('Itens na sprint');
    expect(group.textContent).toContain('42');
    expect(group.textContent).toContain('Concluídos no Jira');
    expect(group.textContent).toContain('Bugs na sprint');
    expect(group.textContent).toContain('Pontos que ficaram para a próxima');
    expect(screen.getByText('Entregue na sprint')).toBeTruthy();
  });

  it('números da sprint: o que não vier fica oculto (nada de zero inventado) e backend antigo mostra só os três de hoje', async () => {
    h.stats.mockResolvedValueOnce({ entregue: 20, previsto: 30, carryOvers: 4 });
    const { unmount } = render(<SprintStatsDialog open onClose={vi.fn()} squadId="PHOENIX" sprintId="s42" />);
    await screen.findByText('Entregue na sprint');
    expect(screen.queryByRole('group', { name: 'Itens da sprint no Jira' })).toBeNull();
    unmount();
    h.stats.mockResolvedValueOnce({ entregue: 0, previsto: 0, carryOvers: 0, bugs: 5 });
    render(<SprintStatsDialog open onClose={vi.fn()} squadId="PHOENIX" sprintId="s42" />);
    const group = await screen.findByRole('group', { name: 'Itens da sprint no Jira' });
    expect(group.textContent).toContain('Bugs na sprint');
    expect(group.textContent).not.toContain('Itens na sprint');
    expect(group.textContent).not.toContain('Concluídos no Jira');
    expect(screen.queryByText(/Ainda não há dados desta sprint/)).toBeNull();
  });
});

describe('lobby da Retro: status real Ao vivo / Encerrada (backend novo)', () => {
  const NOW = Date.parse('2025-10-17T18:00:00Z');
  const live = board({ id: 'L1', title: 'Retro Sprint 42', createdAt: '2025-10-17T10:00:00Z', votingStatus: 'finished', lifecycleStatus: 'OPEN' });
  const closed = board({ id: 'B41', title: 'Retro Sprint 41', createdAt: '2025-10-03T10:00:00Z', lifecycleStatus: 'FINISHED', finishedAt: '2025-10-03T16:30:00' });
  const stale = board({ id: 'B39', title: 'Retro Sprint 39', createdAt: '2025-08-03T10:00:00Z', lifecycleStatus: 'OPEN' });
  const rows = [live, closed, stale].map((b) => ({ id: b.id, title: b.title!, team: 'Phoenix', createdAt: b.createdAt, templateKey: 'classic' as const, board: b }));
  const base = { squadName: 'Phoenix', rows, loading: false, failed: false, onRetry: vi.fn(), details: {}, savedFormats: [], isCreating: false, onNew: vi.fn(), onJoin: vi.fn(), onOpenBoard: vi.fn(), now: NOW };

  it('aberta e recente: "Ao vivo", mesmo com a votação encerrada; encerrada pelo facilitador: "Encerrada" com a data', () => {
    render(<RetroLobbyView {...base} />);
    const andamento = screen.getByRole('region', { name: 'Em andamento' });
    expect(within(andamento).getByText('Ao vivo')).toBeTruthy();
    expect(within(andamento).getByText('Retro Sprint 42')).toBeTruthy();
    const anteriores = screen.getByRole('region', { name: 'Retros anteriores' });
    const row = within(anteriores).getByText('Retro Sprint 41').closest('li')!;
    expect(row.textContent).toContain('Encerrada');
    expect(row.textContent).toMatch(/encerrada em 03 de/);
  });

  it('retro antiga que ninguém encerrou não vira "Ao vivo" nem "Encerrada": segue com a fase', () => {
    render(<RetroLobbyView {...base} />);
    const row = within(screen.getByRole('region', { name: 'Retros anteriores' })).getByText('Retro Sprint 39').closest('li')!;
    expect(row.textContent).not.toContain('Encerrada');
    expect(row.textContent).toContain('Votação encerrada');
  });

  it('o filtro "Encerradas" lista só as encerradas', () => {
    render(<RetroLobbyView {...base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Encerradas' }));
    const anteriores = screen.getByRole('region', { name: 'Retros anteriores' });
    expect(within(anteriores).getByText('Retro Sprint 41')).toBeTruthy();
    expect(within(anteriores).queryByText('Retro Sprint 39')).toBeNull();
  });

  it('backend antigo: sem selo "Ao vivo" e sem o filtro "Encerradas"', () => {
    const old = [board({ id: 'L1', title: 'Retro Sprint 42', createdAt: '2025-10-17T10:00:00Z', votingStatus: 'active' })].map((b) => ({ id: b.id, title: b.title!, team: 'Phoenix', createdAt: b.createdAt, board: b }));
    render(<RetroLobbyView {...base} rows={old} />);
    expect(screen.queryByText('Ao vivo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Encerradas' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Em andamento' })).getByText('Retro Sprint 42')).toBeTruthy();
  });
});
