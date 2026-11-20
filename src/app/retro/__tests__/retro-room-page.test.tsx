import React, { Suspense } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetroBoard, RetroCard, RetroParticipant } from '../../../lib/types';

// Página da sala com a RetroRoom trocada por um espião: o que vale aqui é a orquestração (dados, tempo real,
// votos, permissões), não o desenho.
const h = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  state: {
    auth: { isAuthenticated: true, isLoading: false },
    profile: { id: 'me', name: 'Ana Souza', role: 'Developer', cargo: 'Developer' } as { id: string; name: string; role: string; cargo?: string } | null,
    roomProps: null as any,
    socket: null as any,
  },
  requestIdentity: vi.fn(),
  toast: vi.fn(),
  stopSocket: vi.fn(),
  api: {
    getBoard: vi.fn(),
    getCards: vi.fn(),
    getParticipants: vi.fn(),
    patchBoard: vi.fn(),
    resetVotes: vi.fn(),
    toggleVote: vi.fn(),
    mergeCards: vi.fn(),
    transferControl: vi.fn(),
    addOrUpdateParticipant: vi.fn(),
    removeParticipant: vi.fn(),
    saveOrUpdateCard: vi.fn(),
    deleteCard: vi.fn(),
    importActions: vi.fn(),
    getChatMessages: vi.fn(),
    sendChatMessage: vi.fn(),
    deleteChatMessage: vi.fn(),
    finishBoard: vi.fn(),
    reopenBoard: vi.fn(),
  },
}));
const { router, state, requestIdentity, toast, stopSocket, api } = h;

vi.mock('next/navigation', () => ({ useRouter: () => h.router }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => h.state.auth }));
vi.mock('../../../context/UserContext', () => ({
  useUserContext: () => ({ userProfile: h.state.profile, requestIdentity: h.requestIdentity, isInitializing: false }),
}));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'PHOENIX', squadName: 'Phoenix' }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../components/layout/LoadingScreen', () => ({ LoadingScreen: ({ message }: { message: string }) => <div data-testid="loading">{message}</div> }));
vi.mock('../../../components/NotFound', () => ({ NotFound: () => <div data-testid="notfound" /> }));
vi.mock('../../../components/feedback-widget', () => ({ FeedbackWidget: () => null }));
vi.mock('../../../components/retro/SprintStatsDialog', () => ({ SprintStatsDialog: () => null }));
vi.mock('../../../components/retro/RetroHealthCheckGate', () => ({
  RetroHealthCheckGate: ({ onAnswer, allowNote }: { onAnswer: (a: string, note?: string) => void; allowNote?: boolean }) => (
    <>
      <button onClick={() => onAnswer('good')}>responder check-in</button>
      <button onClick={() => onAnswer('tired', '  Dia puxado.  ')}>responder com nota</button>
      <span data-testid="allow-note">{String(!!allowNote)}</span>
    </>
  ),
}));
vi.mock('../../../lib/auth-client', () => ({ getAuthToken: () => 'tok' }));
vi.mock('../../../components/retro/RetroRoom', () => ({
  RetroRoom: (p: any) => {
    h.state.roomProps = p;
    return <div data-testid="room" data-cards={p.cards.length} data-stage={p.activeStage} />;
  },
}));
vi.mock('../../../lib/room-socket', () => ({
  connectRoomSocket: (opts: any) => {
    h.state.socket = opts;
    return h.stopSocket;
  },
}));
Object.assign(h.stopSocket, { send: vi.fn(() => true) });
vi.mock('../api', () => ({
  retroApi: h.api,
  RetroApiError: class RetroApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
}));

let serverBoard: RetroBoard;
let serverCards: RetroCard[];
let serverParticipants: RetroParticipant[];

import RetroRoomPage from '../[id]/page';
import { RetroApiError } from '../api';

const COLUMNS = [
  { id: 'wentWell', title: 'O que funcionou?', theme: 'success' as const, order: 0 },
  { id: 'toImprove', title: 'O que melhorar?', theme: 'warning' as const, order: 1 },
  { id: 'actionItems', title: 'Plano de Ação', theme: 'action' as const, order: 2 },
];

const card = (over: Partial<RetroCard> & { id: string }): RetroCard => ({
  boardId: 'b1', columnKey: 'wentWell', content: `texto ${over.id}`, authorId: 'u3', votes: [], order: 1000, ...over,
});

beforeEach(() => {
  vi.useRealTimers();
  state.roomProps = null;
  state.socket = null;
  state.auth = { isAuthenticated: true, isLoading: false };
  state.profile = { id: 'me', name: 'Ana Souza', role: 'Developer', cargo: 'Developer' };
  serverBoard = {
    id: 'b1', creatorId: 'me', isCardsRevealed: true, votingStatus: 'active', isAuthorsRevealed: false, createdAt: '2025-10-17T10:00:00Z',
    title: 'Retro 42', team: 'Phoenix', columns: COLUMNS, maxVotesPerParticipant: 2, participantIds: ['me'], timer: { status: 'stopped', endTime: null, initialDuration: 300, remainingOnPause: 300 },
  };
  serverCards = [card({ id: 'c1' }), card({ id: 'c2' }), card({ id: 'c3', columnKey: 'toImprove' })];
  serverParticipants = [{ id: 'me', boardId: 'b1', nickname: 'Ana Souza', role: 'DEV', isCreator: true }, { id: 'u3', boardId: 'b1', nickname: 'Bruno', role: 'QA', isCreator: false }];
  Object.values(api).forEach((f) => f.mockReset());
  toast.mockClear();
  router.push.mockClear();
  stopSocket.mockClear();
  api.getBoard.mockImplementation(async () => serverBoard);
  api.getCards.mockImplementation(async () => serverCards);
  api.getParticipants.mockImplementation(async () => serverParticipants);
  api.patchBoard.mockImplementation(async (_id: string, patch: Partial<RetroBoard>) => { serverBoard = { ...serverBoard, ...patch }; return serverBoard; });
  api.getChatMessages.mockResolvedValue([]);
  api.addOrUpdateParticipant.mockImplementation(async (_id: string, p: RetroParticipant) => p);
  api.saveOrUpdateCard.mockImplementation(async (_id: string, c: RetroCard) => c);
  api.toggleVote.mockImplementation(async (_id: string, cardId: string) => ({ ...serverCards.find((c) => c.id === cardId)!, votes: ['me'] }));
  api.resetVotes.mockImplementation(async () => { serverBoard = { ...serverBoard, votingStatus: 'disabled' }; return serverBoard; });
  api.removeParticipant.mockResolvedValue(undefined);
  api.deleteCard.mockResolvedValue(undefined);
  api.importActions.mockResolvedValue(undefined);
});
afterEach(cleanup);

async function mount() {
  await act(async () => {
    render(<Suspense fallback={<div data-testid="susp" />}><RetroRoomPage params={Promise.resolve({ id: 'b1' })} /></Suspense>);
  });
  await waitFor(() => expect(screen.getByTestId('room')).toBeTruthy());
  await act(async () => {});
}

const emit = async (type: string, payload?: unknown) => { await act(async () => { state.socket.onMessage({ type, payload }); }); };
const latest = () => state.roomProps;
const call = async (fn: () => unknown) => { await act(async () => { await fn(); }); };

describe('carga e entrada na sala', () => {
  it('carrega quadro, cartões e participantes e entrega à sala, com a primeira coluna ativa', async () => {
    await mount();
    expect(api.getBoard).toHaveBeenCalledWith('b1');
    expect(latest().boardData.title).toBe('Retro 42');
    expect(latest().cards).toHaveLength(3);
    expect(latest().participants).toHaveLength(2);
    expect(latest().isCurrentUserCreator).toBe(true);
    expect(latest().activeStage).toBe('wentWell');
  });

  it('quem ainda não é participante entra sozinho, com o papel do cargo, e entra em participantIds', async () => {
    serverParticipants = [{ id: 'u3', boardId: 'b1', nickname: 'Bruno', role: 'QA', isCreator: false }];
    serverBoard = { ...serverBoard, creatorId: 'u3', participantIds: ['u3'] };
    await mount();
    await waitFor(() => expect(api.addOrUpdateParticipant).toHaveBeenCalled());
    const entry = api.addOrUpdateParticipant.mock.calls[0][1];
    expect(entry).toMatchObject({ id: 'me', nickname: 'Ana Souza', role: 'DEV', isCreator: false });
    expect(api.patchBoard).toHaveBeenCalledWith('b1', { participantIds: ['u3', 'me'] });
    // Só participantIds: gravar o quadro inteiro desfazia fase, timer e votação do facilitador.
    expect(Object.keys(api.patchBoard.mock.calls[0][1])).toEqual(['participantIds']);
  });

  it('não repete a entrada nem em render duplo', async () => {
    serverParticipants = [];
    await mount();
    await waitFor(() => expect(api.addOrUpdateParticipant).toHaveBeenCalledTimes(1));
  });

  it('sem sessão mostra o convite ao login; com falha de carga oferece tentar de novo; quadro inexistente = não encontrado', async () => {
    state.auth = { isAuthenticated: false, isLoading: false };
    await act(async () => { render(<Suspense fallback={null}><RetroRoomPage params={Promise.resolve({ id: 'b1' })} /></Suspense>); });
    expect(await screen.findByText('Entre para abrir este quadro')).toBeTruthy();
    cleanup();

    state.auth = { isAuthenticated: true, isLoading: false };
    api.getBoard.mockRejectedValueOnce(new Error('rede'));
    await act(async () => { render(<Suspense fallback={null}><RetroRoomPage params={Promise.resolve({ id: 'b1' })} /></Suspense>); });
    expect(await screen.findByText('Não foi possível carregar o quadro')).toBeTruthy();
    cleanup();

    api.getBoard.mockRejectedValueOnce(new RetroApiError('nada', 404));
    await act(async () => { render(<Suspense fallback={null}><RetroRoomPage params={Promise.resolve({ id: 'b1' })} /></Suspense>); });
    expect(await screen.findByTestId('notfound')).toBeTruthy();
  });
});

describe('presença em tempo real', () => {
  it('pede a presença ao conectar; sem snapshot a sala fica sem dado (null) e com snapshot vira a lista', async () => {
    await mount();
    expect(state.socket.presence).toBe(true);
    expect(latest().onlineIds).toBeNull();
    await call(() => state.socket.onPresence({ online: ['me'], total: 1, version: 1 }));
    expect([...latest().onlineIds]).toEqual(['me']);
  });
});

describe('tempo real (WebSocket)', () => {
  it('a primeira abertura já recarrega, e uma queda e volta recarrega de novo', async () => {
    await mount();
    const before = api.getBoard.mock.calls.length;
    await call(() => state.socket.onOpen());
    expect(api.getBoard.mock.calls.length).toBe(before + 1);
    await call(() => state.socket.onOpen());
    expect(api.getBoard.mock.calls.length).toBe(before + 2);
  });

  it('erro ao processar uma mensagem recarrega tudo por segurança', async () => {
    await mount();
    const before = api.getBoard.mock.calls.length;
    await call(() => state.socket.onError(new Error('json ruim')));
    expect(api.getBoard.mock.calls.length).toBe(before + 1);
  });

  it('desmontar encerra a conexão', async () => {
    await mount();
    cleanup();
    expect(stopSocket).toHaveBeenCalled();
  });

  it('BOARD_UPDATED troca o quadro sem recarregar', async () => {
    await mount();
    const before = api.getBoard.mock.calls.length;
    await emit('BOARD_UPDATED', { ...serverBoard, isCardsRevealed: false, title: 'Novo nome' });
    expect(latest().boardData.title).toBe('Novo nome');
    expect(api.getBoard.mock.calls.length).toBe(before);
  });

  it('CARD_SAVED acrescenta ou troca; CARD_DELETED remove; CARDS_IMPORTED soma', async () => {
    await mount();
    await emit('CARD_SAVED', card({ id: 'c9', content: 'novo' }));
    expect(latest().cards.map((c: RetroCard) => c.id)).toEqual(['c1', 'c2', 'c3', 'c9']);
    await emit('CARD_SAVED', card({ id: 'c1', content: 'editado' }));
    expect(latest().cards.find((c: RetroCard) => c.id === 'c1').content).toBe('editado');
    await emit('CARD_DELETED', { cardId: 'c2' });
    expect(latest().cards.map((c: RetroCard) => c.id)).toEqual(['c1', 'c3', 'c9']);
    await emit('CARDS_IMPORTED', [card({ id: 'c3', content: 'reimportado' }), card({ id: 'c10', columnKey: 'actionItems' })]);
    expect(latest().cards.map((c: RetroCard) => c.id)).toEqual(['c1', 'c9', 'c3', 'c10']);
  });

  it('PARTICIPANT_JOINED e PARTICIPANT_LEFT mantêm a lista', async () => {
    await mount();
    await emit('PARTICIPANT_JOINED', { id: 'u4', boardId: 'b1', nickname: 'Diego', isCreator: false });
    expect(latest().participants.map((p: RetroParticipant) => p.id)).toEqual(['me', 'u3', 'u4']);
    await emit('PARTICIPANT_LEFT', { userId: 'u3' });
    expect(latest().participants.map((p: RetroParticipant) => p.id)).toEqual(['me', 'u4']);
  });

  it('BOARD_DELETED de outra pessoa troca a sala pelo aviso "foi apagada"; um 404 em quadro aberto também', async () => {
    await mount();
    await emit('BOARD_DELETED', { boardId: 'b1' });
    expect(screen.getByText('Esta retro foi apagada')).toBeTruthy();
    expect(screen.queryByTestId('room')).toBeNull();
    cleanup();
    await mount();
    api.getBoard.mockRejectedValue(new RetroApiError('Board não encontrado', 404));
    await emit('REFRESH_BOARD');
    await waitFor(() => expect(screen.getByText('Esta retro foi apagada')).toBeTruthy());
  });

  it('REFRESH_BOARD e evento desconhecido recarregam', async () => {
    await mount();
    const before = api.getBoard.mock.calls.length;
    await emit('REFRESH_BOARD');
    await emit('ALGO_NOVO');
    expect(api.getBoard.mock.calls.length).toBe(before + 2);
  });

  it('só uma resposta de carga mais nova vale: a lenta que chega depois não desfaz o estado', async () => {
    await mount();
    let release!: (b: RetroBoard) => void;
    api.getBoard.mockImplementationOnce(() => new Promise<RetroBoard>((r) => { release = r; }));
    await call(() => state.socket.onOpen()); // carga lenta em voo
    serverBoard = { ...serverBoard, title: 'Mais novo' };
    await call(() => state.socket.onOpen()); // carga rápida e mais nova
    await waitFor(() => expect(latest().boardData.title).toBe('Mais novo'));
    await call(() => release({ ...serverBoard, title: 'VELHO' }));
    expect(latest().boardData.title).toBe('Mais novo');
  });

  it('chat: só entram mensagens de canais que a pessoa enxerga', async () => {
    await mount();
    await emit('CHAT_MESSAGE_SAVED', { id: 'm1', channelId: 'geral', senderId: 'u3', senderName: 'Bruno', senderCategory: null, text: 'oi', kind: 'text', ts: '2025-10-17T10:00:00Z' });
    await emit('CHAT_MESSAGE_SAVED', { id: 'm2', channelId: 'dm_u8_u9', senderId: 'u8', senderName: 'X', senderCategory: null, text: 'segredo', kind: 'text', ts: '2025-10-17T10:00:01Z' });
    expect(Object.keys(latest().chatMessagesByChannel)).toContain('geral');
    expect(latest().chatMessagesByChannel.dm_u8_u9).toBeUndefined();
    await emit('CHAT_MESSAGE_DELETED', { messageId: 'm1', channelId: 'geral' });
    expect(latest().chatMessagesByChannel.geral).toEqual([]);
  });
});

describe('votos e limite', () => {
  it('votar aplica na hora e grava só o voto da pessoa (o servidor alterna e aplica o limite)', async () => {
    await mount();
    await call(() => latest().onToggleVote('c1'));
    expect(api.toggleVote).toHaveBeenCalledWith('b1', 'c1');
    expect(latest().cards.find((c: RetroCard) => c.id === 'c1').votes).toEqual(['me']);
  });

  it('retirar o voto passa mesmo no limite', async () => {
    serverCards = [card({ id: 'c1', votes: ['me'] }), card({ id: 'c2', votes: ['me'] })];
    await mount();
    await call(() => latest().onToggleVote('c1'));
    expect(api.toggleVote).toHaveBeenCalledWith('b1', 'c1');
  });

  it('no limite do painel o voto novo é barrado sem chamar o servidor', async () => {
    serverCards = [card({ id: 'c1', votes: ['me'] }), card({ id: 'c2', votes: ['me'] }), card({ id: 'c4' })];
    await mount();
    await call(() => latest().onToggleVote('c4'));
    expect(api.toggleVote).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Limite de votos atingido' }));
  });

  it('votação fechada: avisa e não chama o servidor', async () => {
    serverBoard = { ...serverBoard, votingStatus: 'finished' };
    await mount();
    await call(() => latest().onToggleVote('c1'));
    expect(api.toggleVote).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'A votação não está aberta' }));
  });

  it('falha ao votar desfaz só aquele voto e avisa', async () => {
    api.toggleVote.mockRejectedValueOnce(new Error('409'));
    await mount();
    await call(() => latest().onToggleVote('c1'));
    expect(latest().cards.find((c: RetroCard) => c.id === 'c1').votes).toEqual([]);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível registrar o voto', variant: 'destructive' }));
  });

  it('encerrar a votação com ordenação automática ordena só colunas de feedback', async () => {
    serverBoard = { ...serverBoard, autoSortOnVoteEnd: true, columnSorts: { actionItems: false } };
    await mount();
    await call(() => latest().onSetVotingStatus('finished'));
    expect(api.patchBoard).toHaveBeenCalledWith('b1', { votingStatus: 'finished', columnSorts: { actionItems: false, wentWell: true, toImprove: true } });
  });

  it('zerar chama o endpoint próprio e limpa os votos na tela', async () => {
    serverCards = [card({ id: 'c1', votes: ['me', 'u3'] })];
    await mount();
    await call(() => latest().onSetVotingStatus('disabled'));
    expect(api.resetVotes).toHaveBeenCalledWith('b1');
    expect(latest().cards[0].votes).toEqual([]);
    expect(latest().boardData.votingStatus).toBe('disabled');
  });

  it('revelar alterna a revelação do quadro; limite de votos e configurações gravam só o campo', async () => {
    serverBoard = { ...serverBoard, isCardsRevealed: false, votingStatus: 'disabled' };
    await mount();
    await call(() => latest().onToggleCardsRevealed());
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { isCardsRevealed: true });
    await call(() => latest().onSetMaxVotesPerParticipant(10));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { maxVotesPerParticipant: 10 });
    await call(() => latest().onToggleShowAuthors(true));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { isAuthorsRevealed: true });
    await call(() => latest().onToggleAutoRevealOnTimerEnd(true));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { autoRevealOnTimerEnd: true });
    await call(() => latest().onToggleHealthCheck(true));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { healthCheckEnabled: true });
  });

  it('erro ao gravar o quadro vira aviso, não silêncio', async () => {
    api.patchBoard.mockRejectedValueOnce(new Error('sem permissão'));
    await mount();
    await call(() => latest().onToggleCardsRevealed());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível salvar a alteração', description: 'sem permissão' }));
  });
});

describe('cartões', () => {
  it('adicionar: aparece na hora, grava e devolve true; com falha devolve false e avisa', async () => {
    await mount();
    let ok: boolean | undefined;
    await call(async () => { ok = await latest().onAddCard('  Deploys às sextas  ', 'toImprove'); });
    expect(ok).toBe(true);
    const sent = api.saveOrUpdateCard.mock.calls[0][1];
    expect(sent).toMatchObject({ boardId: 'b1', columnKey: 'toImprove', content: 'Deploys às sextas', authorId: 'me', votes: [] });
    expect(latest().cards.some((c: RetroCard) => c.content === 'Deploys às sextas')).toBe(true);

    api.saveOrUpdateCard.mockRejectedValueOnce(new Error('falhou'));
    await call(async () => { ok = await latest().onAddCard('outro', 'wentWell'); });
    expect(ok).toBe(false);
    expect(latest().cards.some((c: RetroCard) => c.content === 'outro')).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível adicionar o cartão' }));
  });

  it('texto vazio não vai ao servidor', async () => {
    await mount();
    let ok: boolean | undefined;
    await call(async () => { ok = await latest().onAddCard('   ', 'wentWell'); });
    expect(ok).toBe(false);
    expect(api.saveOrUpdateCard).not.toHaveBeenCalled();
  });

  it('editar só grava se mudou algo; excluir remove depois que o servidor confirma', async () => {
    await mount();
    await call(() => latest().onUpdateCard('c1', 'texto c1'));
    expect(api.saveOrUpdateCard).not.toHaveBeenCalled();
    await call(() => latest().onUpdateCard('c1', 'texto novo', 'Carla', '2025-10-30'));
    expect(api.saveOrUpdateCard.mock.calls[0][1]).toMatchObject({ id: 'c1', content: 'texto novo', assignee: 'Carla', dueDate: '2025-10-30' });
    await call(() => latest().onDeleteCard('c2'));
    expect(api.deleteCard).toHaveBeenCalledWith('b1', 'c2');
    expect(latest().cards.some((c: RetroCard) => c.id === 'c2')).toBe(false);
  });

  it('excluir com erro mantém o cartão e avisa', async () => {
    api.deleteCard.mockRejectedValueOnce(new Error('403'));
    await mount();
    await call(() => latest().onDeleteCard('c2'));
    expect(latest().cards.some((c: RetroCard) => c.id === 'c2')).toBe(true);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível apagar o cartão' }));
  });

  it('reação é exclusiva por pessoa: marcar uma tira as outras', async () => {
    serverCards = [card({ id: 'c1', reactions: { up: ['me', 'u3'], love: [] } })];
    await mount();
    await call(() => latest().onToggleReaction('c1', 'wow', []));
    const saved = api.saveOrUpdateCard.mock.calls[0][1];
    expect(saved.reactions.up).toEqual(['u3']);
    expect(saved.reactions.wow).toEqual(['me']);
  });

  it('marcar ação como concluída grava o status', async () => {
    serverCards = [card({ id: 'a1', columnKey: 'actionItems' })];
    await mount();
    await call(() => latest().onToggleDone('a1', true));
    expect(api.saveOrUpdateCard.mock.calls[0][1]).toMatchObject({ id: 'a1', isDone: true });
  });
});

describe('juntar, arrastar e importar', () => {
  it('juntar cartões do mesmo painel chama o servidor e troca o cartão fundido; fase anônima e painéis diferentes são barrados', async () => {
    api.mergeCards.mockResolvedValue(card({ id: 'c1', content: 'fundido', originalTexts: ['texto c2'] }));
    await mount();
    await call(() => latest().onStartMerge('c2'));
    expect(latest().mergingSourceId).toBe('c2');
    await call(() => latest().onExecuteMerge('c1'));
    expect(api.mergeCards).toHaveBeenCalledWith('b1', 'c1', 'c2');
    expect(latest().cards.some((c: RetroCard) => c.id === 'c2')).toBe(false);
    expect(latest().cards.find((c: RetroCard) => c.id === 'c1').content).toBe('fundido');
    expect(latest().mergingSourceId).toBeNull();

    api.mergeCards.mockClear();
    await call(() => latest().onStartMerge('c1'));
    await call(() => latest().onExecuteMerge('c3'));
    expect(api.mergeCards).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fusão não permitida' }));
  });

  it('Esc cancela a fusão em andamento', async () => {
    await mount();
    await call(() => latest().onStartMerge('c1'));
    expect(latest().mergingSourceId).toBe('c1');
    await call(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(latest().mergingSourceId).toBeNull();
  });

  it('juntar na fase anônima é barrado', async () => {
    serverBoard = { ...serverBoard, isCardsRevealed: false, votingStatus: 'disabled' };
    await mount();
    await call(() => latest().onExecuteMerge('c1'));
    await call(() => latest().onStartMerge('c2'));
    await call(() => latest().onExecuteMerge('c1'));
    expect(api.mergeCards).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ação bloqueada' }));
  });

  it('arrastar para outra coluna grava a nova posição; ignora quando não muda nada', async () => {
    await mount();
    const over = (id: string, isColumn: boolean) => ({ active: { id: 'c1' }, over: { id, data: { current: isColumn ? { type: 'column' } : {} } } });
    await call(() => latest().onDragEnd(over('wentWell', true)));
    expect(api.saveOrUpdateCard).not.toHaveBeenCalled();
    await call(() => latest().onDragEnd(over('toImprove', true)));
    expect(api.saveOrUpdateCard.mock.calls[0][1]).toMatchObject({ id: 'c1', columnKey: 'toImprove' });
  });

  it('arrastar na fase anônima: só autor ou facilitador', async () => {
    serverBoard = { ...serverBoard, isCardsRevealed: false, votingStatus: 'disabled', creatorId: 'u3' };
    serverParticipants = [{ id: 'me', boardId: 'b1', nickname: 'Ana', role: 'DEV', isCreator: false }, { id: 'u3', boardId: 'b1', nickname: 'Bruno', role: 'QA', isCreator: true }];
    await mount();
    await call(() => latest().onDragEnd({ active: { id: 'c1' }, over: { id: 'toImprove', data: { current: { type: 'column' } } } }));
    expect(api.saveOrUpdateCard).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cartão de outra pessoa' }));
  });

  it('importar ações: uma só chamada, preservando a raiz da cadeia e contando as reimportações', async () => {
    await mount();
    const origem = { id: 'old1', title: 'Sprint 40' } as RetroBoard;
    const outra = { id: 'old2', title: 'Sprint 39' } as RetroBoard;
    await call(() => latest().onImportActions([
      { board: origem, cards: [card({ id: 'x1', columnKey: 'actionItems', content: 'Documentar deploy', assignee: 'Carla', carryCount: 1, carriedFromBoardId: 'root', carriedFromBoardTitle: 'Sprint 30' })] },
      { board: outra, cards: [card({ id: 'x2', columnKey: 'actionItems', content: 'Revisar alertas' })] },
    ]));
    expect(api.importActions).toHaveBeenCalledTimes(1);
    const sent: RetroCard[] = api.importActions.mock.calls[0][1];
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ columnKey: 'actionItems', content: 'Documentar deploy', assignee: 'Carla', isDone: false, carriedFromBoardId: 'root', carriedFromBoardTitle: 'Sprint 30', carryCount: 2 });
    expect(sent[1]).toMatchObject({ content: 'Revisar alertas', carriedFromBoardId: 'old2', carriedFromBoardTitle: 'Sprint 39', carryCount: 1 });
    expect(sent[1].order).toBeGreaterThan(sent[0].order);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ações importadas' }));
  });

  it('importar sem coluna de ação avisa e não grava', async () => {
    serverBoard = { ...serverBoard, columns: COLUMNS.filter((c) => c.theme !== 'action') };
    await mount();
    await call(() => latest().onImportActions([{ board: { id: 'o' } as RetroBoard, cards: [card({ id: 'x' })] }]));
    expect(api.importActions).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sem coluna de ação' }));
  });
});

describe('timer e facilitador', () => {
  it('iniciar, pausar, retomar e zerar gravam o timer pelo relógio local', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-10-17T10:00:00Z'));
    await mount();
    const now = Date.now();
    await call(() => latest().onStartTimer(120));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { timer: { status: 'running', endTime: now + 120_000, initialDuration: 120, remainingOnPause: 120 } });
    vi.setSystemTime(now + 30_000);
    await call(() => latest().onPauseTimer());
    expect(api.patchBoard.mock.calls.at(-1)![1].timer).toMatchObject({ status: 'paused', remainingOnPause: 90 });
    vi.setSystemTime(now + 60_000);
    await call(() => latest().onResumeTimer());
    expect(api.patchBoard.mock.calls.at(-1)![1].timer).toMatchObject({ status: 'running', endTime: now + 60_000 + 90_000 });
    await call(() => latest().onResetTimer());
    expect(api.patchBoard.mock.calls.at(-1)![1].timer).toEqual({ status: 'stopped', endTime: null, initialDuration: 120, remainingOnPause: 120 });
    await call(() => latest().onSetTimerDuration(180));
    expect(api.patchBoard.mock.calls.at(-1)![1].timer).toEqual({ status: 'stopped', endTime: null, initialDuration: 180, remainingOnPause: 180 });
    vi.useRealTimers();
  });

  it('o timer da sala é estável entre renders (senão o contador reiniciaria a cada cartão)', async () => {
    serverBoard = { ...serverBoard, timer: { status: 'running', endTime: Date.now() + 60_000, initialDuration: 300, remainingOnPause: 300 } };
    await mount();
    const before = latest().timer;
    await emit('CARD_SAVED', card({ id: 'c9' }));
    expect(latest().timer).toBe(before);
  });

  it('fim do tempo: o facilitador revela (se a opção estiver ligada) e encerra o timer', async () => {
    serverBoard = { ...serverBoard, isCardsRevealed: false, votingStatus: 'disabled', autoRevealOnTimerEnd: true, timer: { status: 'running', endTime: Date.now() - 100, initialDuration: 300, remainingOnPause: 300 } };
    await mount();
    await call(() => latest().onTimerExpire({ late: false }));
    expect(api.patchBoard).toHaveBeenCalledWith('b1', { isCardsRevealed: true });
    expect(api.patchBoard.mock.calls.at(-1)![1].timer).toMatchObject({ status: 'stopped', endTime: null });
  });

  it('fim atrasado (tela aberta depois) só encerra o timer, sem revelar', async () => {
    serverBoard = { ...serverBoard, isCardsRevealed: false, votingStatus: 'disabled', autoRevealOnTimerEnd: true, timer: { status: 'running', endTime: Date.now() - 60_000, initialDuration: 300, remainingOnPause: 300 } };
    await mount();
    await call(() => latest().onTimerExpire({ late: true }));
    expect(api.patchBoard).toHaveBeenCalledTimes(1);
    expect(api.patchBoard.mock.calls[0][1].timer).toMatchObject({ status: 'stopped' });
  });

  it('quem não é facilitador não mexe no quadro quando o tempo acaba', async () => {
    serverBoard = { ...serverBoard, creatorId: 'u3', autoRevealOnTimerEnd: true, timer: { status: 'running', endTime: Date.now() - 100, initialDuration: 300, remainingOnPause: 300 } };
    await mount();
    await call(() => latest().onTimerExpire({ late: false }));
    expect(api.patchBoard).not.toHaveBeenCalled();
  });

  it('um timer já encerrado não é encerrado de novo', async () => {
    await mount();
    await call(() => latest().onTimerExpire({ late: false }));
    expect(api.patchBoard).not.toHaveBeenCalled();
  });
});

describe('etapa sincronizada, colunas e resumo', () => {
  it('facilitador com sincronização grava a coluna ativa; sem ela só muda localmente', async () => {
    await mount();
    await call(() => latest().onStageChange('toImprove'));
    expect(latest().activeStage).toBe('toImprove');
    expect(api.patchBoard).not.toHaveBeenCalled();

    await call(() => latest().onToggleSyncStage(true));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { syncStageEnabled: true, activeColumnKey: 'toImprove' });
    await call(() => latest().onStageChange('actionItems'));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { activeColumnKey: 'actionItems' });
  });

  it('participante acompanha a coluna do facilitador e nunca grava a etapa', async () => {
    serverBoard = { ...serverBoard, creatorId: 'u3', syncStageEnabled: true, activeColumnKey: 'toImprove' };
    await mount();
    expect(latest().activeStage).toBe('toImprove');
    await emit('BOARD_UPDATED', { ...serverBoard, activeColumnKey: 'actionItems' });
    expect(latest().activeStage).toBe('actionItems');
    await call(() => latest().onStageChange('wentWell'));
    expect(api.patchBoard).not.toHaveBeenCalled();
  });

  it('renomear coluna grava só a lista de colunas', async () => {
    await mount();
    await call(() => latest().onRenameColumn('wentWell', 'Vitórias'));
    const patch = api.patchBoard.mock.calls[0][1];
    expect(Object.keys(patch)).toEqual(['columns']);
    expect(patch.columns.find((c: any) => c.id === 'wentWell').title).toBe('Vitórias');
    expect(patch.columns.find((c: any) => c.id === 'toImprove').title).toBe('O que melhorar?');
  });

  it('ordenar coluna por votos grava o mapa de ordenações preservando as outras', async () => {
    serverBoard = { ...serverBoard, columnSorts: { toImprove: true } };
    await mount();
    await call(() => latest().onToggleColumnSort('wentWell', true));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { columnSorts: { toImprove: true, wentWell: true } });
  });

  it('salvar resumo: conta cartões de feedback e lista as ações; sem ações avisa', async () => {
    serverCards = [card({ id: 'c1' }), card({ id: 'c2', columnKey: 'toImprove' }), card({ id: 'a1', columnKey: 'actionItems', content: 'Congelar deploy' })];
    await mount();
    await call(() => latest().onSyncSummary());
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { summary: { feedbackCount: 2, actionItems: ['Congelar deploy'] } });
    cleanup();

    api.patchBoard.mockClear();
    serverCards = [card({ id: 'c1' })];
    await mount();
    await call(() => latest().onSyncSummary());
    expect(api.patchBoard).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Nenhuma ação para salvar' }));
  });
});

describe('pessoas e check-in', () => {
  it('remover participante: chama o servidor, tira da lista e atualiza participantIds', async () => {
    serverBoard = { ...serverBoard, participantIds: ['me', 'u3'] };
    await mount();
    let ok: boolean | undefined;
    await call(async () => { ok = await latest().onRemoveParticipant('u3'); });
    expect(ok).toBe(true);
    expect(api.removeParticipant).toHaveBeenCalledWith('b1', 'u3');
    expect(api.patchBoard).toHaveBeenCalledWith('b1', { participantIds: ['me'] });
    expect(latest().participants.map((p: RetroParticipant) => p.id)).toEqual(['me']);
  });

  it('falha ao remover mantém a pessoa e avisa', async () => {
    api.removeParticipant.mockRejectedValueOnce(new Error('403'));
    await mount();
    let ok: boolean | undefined;
    await call(async () => { ok = await latest().onRemoveParticipant('u3'); });
    expect(ok).toBe(false);
    expect(latest().participants.map((p: RetroParticipant) => p.id)).toContain('u3');
  });

  it('assumir o controle: um só facilitador na lista e o quadro novo', async () => {
    serverBoard = { ...serverBoard, creatorId: 'u3' };
    serverParticipants = [{ id: 'me', boardId: 'b1', nickname: 'Ana', role: 'DEV', isCreator: false }, { id: 'u3', boardId: 'b1', nickname: 'Bruno', role: 'QA', isCreator: true }];
    api.transferControl.mockResolvedValue({ ...serverBoard, creatorId: 'me' });
    await mount();
    expect(latest().isCurrentUserCreator).toBe(false);
    await call(() => latest().onClaimCreator());
    expect(api.transferControl).toHaveBeenCalledWith('b1');
    expect(latest().isCurrentUserCreator).toBe(true);
    expect(latest().participants.filter((p: RetroParticipant) => p.isCreator).map((p: RetroParticipant) => p.id)).toEqual(['me']);
  });

  it('sair da retro: só vai para a Home depois que o servidor confirmou', async () => {
    await mount();
    api.removeParticipant.mockRejectedValueOnce(new Error('falhou'));
    await call(() => latest().onLeaveBoard());
    expect(router.push).not.toHaveBeenCalled();
    await call(() => latest().onLeaveBoard());
    expect(api.removeParticipant).toHaveBeenLastCalledWith('b1', 'me');
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('check-in ligado e sem resposta trava a sala até responder; a resposta é gravada na hora', async () => {
    serverBoard = { ...serverBoard, healthCheckEnabled: true };
    await mount();
    expect(latest().needsHealthCheck).toBe(true);
    await act(async () => { screen.getByText('responder check-in').click(); });
    expect(api.addOrUpdateParticipant).toHaveBeenCalledWith('b1', expect.objectContaining({ id: 'me', healthCheckAnswer: 'good' }));
    expect(latest().needsHealthCheck).toBe(false);
  });

  it('o perfil global (nome e cargo) é sincronizado na lista da retro', async () => {
    serverParticipants = [{ id: 'me', boardId: 'b1', nickname: 'Nome antigo', role: 'QA', globalRole: 'QA' as any, isCreator: true }, { id: 'u3', boardId: 'b1', nickname: 'Bruno', role: 'QA', isCreator: false }];
    await mount();
    await waitFor(() => expect(api.addOrUpdateParticipant).toHaveBeenCalled());
    expect(api.addOrUpdateParticipant.mock.calls[0][1]).toMatchObject({ id: 'me', nickname: 'Ana Souza', globalRole: 'Developer', role: 'DEV' });
  });
});


describe('encerrar, reabrir e somente leitura (backend novo)', () => {
  const newBackend = (over: Partial<RetroBoard> = {}) => { serverBoard = { ...serverBoard, lifecycleStatus: 'OPEN', finishedAt: null, ...over }; };

  it('backend antigo (sem lifecycleStatus): sem botões de encerrar, sem escrevendo…, sem nota no check-in, nada somente leitura', async () => {
    await mount();
    expect(latest().onFinishRetro).toBeUndefined();
    expect(latest().onReopenRetro).toBeUndefined();
    expect(latest().onTypingCard).toBeUndefined();
    expect(latest().typingLabelForColumn).toBeUndefined();
    expect(latest().isFinished).toBe(false);
    expect(latest().readOnly).toBe(false);
  });

  it('facilitador encerra: chama POST /finish, troca o quadro e avisa; reabrir faz o inverso', async () => {
    newBackend();
    api.finishBoard.mockImplementation(async () => { serverBoard = { ...serverBoard, lifecycleStatus: 'FINISHED', finishedAt: '2026-10-17T15:00:00' }; return serverBoard; });
    api.reopenBoard.mockImplementation(async () => { serverBoard = { ...serverBoard, lifecycleStatus: 'OPEN', finishedAt: null }; return serverBoard; });
    await mount();
    expect(typeof latest().onFinishRetro).toBe('function');
    await call(() => latest().onFinishRetro());
    expect(api.finishBoard).toHaveBeenCalledWith('b1');
    expect(latest().boardData.lifecycleStatus).toBe('FINISHED');
    expect(latest().isFinished).toBe(true);
    expect(latest().readOnly).toBe(false); // facilitador continua podendo tudo
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Retro encerrada' }));
    await call(() => latest().onReopenRetro());
    expect(api.reopenBoard).toHaveBeenCalledWith('b1');
    expect(latest().isFinished).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Retro reaberta' }));
  });

  it('erro ao encerrar (403/409) mostra a mensagem do servidor e mantém a retro como estava', async () => {
    newBackend();
    api.finishBoard.mockRejectedValueOnce(new RetroApiError('Só o facilitador pode encerrar a retro.', 403));
    await mount();
    await call(() => latest().onFinishRetro());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível encerrar a retro', description: 'Só o facilitador pode encerrar a retro.', variant: 'destructive' }));
    expect(latest().isFinished).toBe(false);
  });

  it('participante não vê os callbacks de encerrar; ADMIN que não criou a retro vê', async () => {
    newBackend({ creatorId: 'u3' });
    await mount();
    expect(latest().onFinishRetro).toBeUndefined();
    cleanup();
    state.profile = { id: 'me', name: 'Ana Souza', role: 'admin' };
    await mount();
    expect(typeof latest().onFinishRetro).toBe('function');
  });

  it('o facilitador encerra e o participante recebe BOARD_UPDATED: a sala vira somente leitura e as escritas são barradas na tela', async () => {
    newBackend({ creatorId: 'u3' });
    await mount();
    expect(latest().readOnly).toBe(false);
    await emit('BOARD_UPDATED', { ...serverBoard, lifecycleStatus: 'FINISHED', finishedAt: '2026-10-17T15:00:00' });
    expect(latest().readOnly).toBe(true);
    expect(latest().isFinished).toBe(true);

    let ok: boolean | undefined;
    await call(async () => { ok = await latest().onAddCard('Texto novo', 'wentWell'); });
    expect(ok).toBe(false);
    await call(() => latest().onToggleVote('c1', []));
    await call(() => latest().onToggleReaction('c1', 'up', []));
    await call(() => latest().onDeleteCard('c1'));
    await call(() => latest().onUpdateCard('c1', 'Editado'));
    await call(() => latest().onToggleDone('c1', true));
    expect(api.saveOrUpdateCard).not.toHaveBeenCalled();
    expect(api.toggleVote).not.toHaveBeenCalled();
    expect(api.deleteCard).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Retro encerrada' }));

    // reabriu: volta a escrever
    await emit('BOARD_UPDATED', { ...serverBoard, lifecycleStatus: 'OPEN', finishedAt: null });
    expect(latest().readOnly).toBe(false);
    await call(async () => { ok = await latest().onAddCard('Texto novo', 'wentWell'); });
    expect(ok).toBe(true);
  });

  it('retro já encerrada ao entrar: participante só lê; o 409 do servidor aparece com a mensagem dele', async () => {
    newBackend({ creatorId: 'u3', lifecycleStatus: 'FINISHED', finishedAt: '2026-10-17T15:00:00' });
    await mount();
    expect(latest().readOnly).toBe(true);
    // corrida: a tela ainda achava que estava aberta e o servidor respondeu 409
    await emit('BOARD_UPDATED', { ...serverBoard, lifecycleStatus: 'OPEN', finishedAt: null });
    api.saveOrUpdateCard.mockRejectedValueOnce(new RetroApiError('Esta retrospectiva foi encerrada. Só o facilitador pode alterá-la.', 409));
    let ok: boolean | undefined;
    await call(async () => { ok = await latest().onAddCard('Texto', 'wentWell'); });
    expect(ok).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Esta retrospectiva foi encerrada. Só o facilitador pode alterá-la.', variant: 'destructive' }));
  });

  it('arrastar não faz nada numa retro encerrada para participante', async () => {
    newBackend({ creatorId: 'u3', lifecycleStatus: 'FINISHED' });
    await mount();
    await call(() => latest().onDragEnd({ active: { id: 'c1' }, over: { id: 'toImprove', data: { current: { type: 'column' } } } }));
    expect(api.saveOrUpdateCard).not.toHaveBeenCalled();
  });
});

describe('escrevendo… (backend novo)', () => {
  const newBackend = (over: Partial<RetroBoard> = {}) => { serverBoard = { ...serverBoard, lifecycleStatus: 'OPEN', finishedAt: null, ...over }; };
  const typingEvent = (over: Record<string, unknown> = {}) => ({ userId: 'u3', anonymous: false, scope: 'card', columnKey: 'wentWell', expiresInMs: 5000, expiresAt: 0, ...over });

  it('abre o socket com typing=1 e o evento TYPING nunca recarrega a sala', async () => {
    newBackend();
    await mount();
    expect(state.socket.typing).toBe(true);
    const before = api.getBoard.mock.calls.length;
    await emit('TYPING', typingEvent());
    expect(api.getBoard.mock.calls.length).toBe(before);
  });

  it('autoria oculta: "Alguém está escrevendo…"; revelada: o nome; some sozinho em 5 s', async () => {
    newBackend({ isAuthorsRevealed: false });
    await mount();
    vi.useFakeTimers();
    await emit('TYPING', typingEvent({ userId: null, anonymous: true }));
    expect(latest().typingLabelForColumn('wentWell')).toBe('Alguém está escrevendo…');
    expect(latest().typingLabelForColumn('toImprove')).toBeNull();
    await act(async () => { vi.advanceTimersByTime(5200); });
    expect(latest().typingLabelForColumn('wentWell')).toBeNull();
    await emit('BOARD_UPDATED', { ...serverBoard, isAuthorsRevealed: true });
    await emit('TYPING', typingEvent());
    expect(latest().typingLabelForColumn('wentWell')).toBe('Bruno está escrevendo…');
  });

  it('chat: mostra por canal e com o nome', async () => {
    newBackend();
    await mount();
    await emit('TYPING', { userId: 'u3', anonymous: false, scope: 'chat', channelId: 'geral', expiresInMs: 5000 });
    expect(latest().typingLabelForChannel('geral')).toBe('Bruno está escrevendo…');
    expect(latest().typingLabelForChannel('role-QA')).toBeNull();
    expect(latest().typingLabelForColumn('geral')).toBeNull();
  });

  it('digitar envia TYPING pelo socket no máximo a cada 2 s, sem userId no corpo', async () => {
    newBackend();
    await mount();
    const send = (h.stopSocket as any).send as ReturnType<typeof vi.fn>;
    send.mockClear();
    await call(() => latest().onTypingCard('wentWell'));
    await call(() => latest().onTypingCard('wentWell'));
    await call(() => latest().onTypingChat('geral'));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'TYPING', scope: 'card', columnKey: 'wentWell' });
  });

  it('o evento de si mesmo é ignorado', async () => {
    newBackend();
    await mount();
    await emit('TYPING', typingEvent({ userId: 'me' }));
    expect(latest().typingLabelForColumn('wentWell')).toBeNull();
  });
});

describe('check-in com nota (backend novo)', () => {
  it('a nota vai junto com a resposta, cortada em 500 e sem espaços nas pontas; o campo só aparece no backend novo', async () => {
    serverBoard = { ...serverBoard, healthCheckEnabled: true };
    await mount();
    expect(screen.getByTestId('allow-note').textContent).toBe('false');
    cleanup();
    serverBoard = { ...serverBoard, healthCheckEnabled: true, lifecycleStatus: 'OPEN' };
    await mount();
    expect(screen.getByTestId('allow-note').textContent).toBe('true');
    await act(async () => { screen.getByText('responder com nota').click(); });
    expect(api.addOrUpdateParticipant).toHaveBeenCalledWith('b1', expect.objectContaining({ id: 'me', healthCheckAnswer: 'tired', checkinNote: 'Dia puxado.' }));
    expect(latest().participants.find((x: RetroParticipant) => x.id === 'me').checkinNote).toBe('Dia puxado.');
  });

  it('sem nota, o corpo não leva checkinNote (campo ausente não apaga no servidor)', async () => {
    serverBoard = { ...serverBoard, healthCheckEnabled: true, lifecycleStatus: 'OPEN' };
    await mount();
    await act(async () => { screen.getByText('responder check-in').click(); });
    expect(api.addOrUpdateParticipant.mock.calls.at(-1)![1]).not.toHaveProperty('checkinNote');
  });
});
