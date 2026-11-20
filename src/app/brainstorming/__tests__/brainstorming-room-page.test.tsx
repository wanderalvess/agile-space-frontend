import React, { Suspense } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrainstormingBoard, BrainstormingGroup, BrainstormingIdea, Participant } from '../../../lib/types';

// Página da sala com a BrainstormRoom trocada por um espião: o que vale aqui é a orquestração (dados, tempo real,
// permissões, chamadas ao servidor), não o desenho.
const h = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  state: { roomProps: null as any, socket: null as any, profile: { id: 'me', name: 'Ana Souza', role: 'DEV', cargo: 'Developer' } as any },
  toast: vi.fn(),
  stopSocket: vi.fn(),
  api: {
    getBoard: vi.fn(), getIdeas: vi.fn(), getGroups: vi.fn(), getParticipants: vi.fn(), patchBoard: vi.fn(), deleteBoard: vi.fn(),
    joinBoard: vi.fn(), leaveBoard: vi.fn(), saveOrUpdateIdea: vi.fn(), patchIdea: vi.fn(), toggleVote: vi.fn(), mergeIdeas: vi.fn(),
    deleteIdea: vi.fn(), saveOrUpdateGroup: vi.fn(), deleteGroup: vi.fn(),
    finishBoard: vi.fn(), reopenBoard: vi.fn(), claimFacilitation: vi.fn(), transferFacilitation: vi.fn(),
  },
}));
const { router, state, toast, api } = h;

vi.mock('next/navigation', () => ({ useRouter: () => h.router }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false }) }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => ({ userProfile: h.state.profile, isInitializing: false }) }));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'PHOENIX', squadName: 'Phoenix' }) }));
vi.mock('../../../hooks/useMyMemberships', () => ({ useMyMemberships: () => ({ memberships: null }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../components/layout/LoadingScreen', () => ({ LoadingScreen: ({ message }: { message: string }) => <div data-testid="loading">{message}</div> }));
vi.mock('../../../components/feedback-widget', () => ({ FeedbackWidget: () => null }));
vi.mock('../../../lib/auth-client', () => ({ getAuthToken: () => 'tok' }));
vi.mock('../../../components/brainstorming/BrainstormRoom', () => ({
  BrainstormRoom: (p: any) => {
    h.state.roomProps = p;
    return <div data-testid="room" data-ideas={p.ideas.length} data-connection={p.connection} />;
  },
}));
vi.mock('../../../lib/room-socket', () => ({
  connectRoomSocket: (opts: any) => {
    h.state.socket = opts;
    return h.stopSocket;
  },
}));
vi.mock('../api', () => ({ brainstormingApi: h.api }));

import BrainstormingRoomPage from '../[id]/page';
import { CeremonyApiError } from '../../../lib/ceremony-api';

let board: BrainstormingBoard;
let ideas: BrainstormingIdea[];
let groups: BrainstormingGroup[];
let participants: Participant[];

beforeEach(() => {
  vi.useRealTimers();
  state.roomProps = null;
  state.socket = null;
  state.profile = { id: 'me', name: 'Ana Souza', role: 'DEV', cargo: 'Developer' };
  board = {
    id: 'b1', creatorId: 'me', title: 'Redesenho', team: 'PHOENIX', createdAt: '2026-10-14T10:00:00Z', phase: 'ideation',
    settings: { isAnonymous: false }, timer: { status: 'stopped', endTime: null, initialDuration: 600, remainingOnPause: 600 },
  };
  ideas = [{ id: 'i1', boardId: 'b1', content: 'a', authorId: 'u3', votes: [], position: { x: 0, y: 0 }, parentId: null, groupId: null, createdAt: '2026-10-17T10:00:00Z' }];
  groups = [{ id: 'g1', boardId: 'b1', title: 'A', order: 0, color: '#2563eb' }];
  participants = [{ id: 'me', roomId: 'b1', nickname: 'Ana Souza', isFacilitator: true, role: 'dev' } as Participant];
  Object.values(api).forEach((f) => f.mockReset());
  toast.mockClear();
  router.push.mockClear();
  h.stopSocket.mockClear();
  api.getBoard.mockImplementation(async () => board);
  api.getIdeas.mockImplementation(async () => ideas);
  api.getGroups.mockImplementation(async () => groups);
  api.getParticipants.mockImplementation(async () => participants);
  api.patchBoard.mockImplementation(async (_id: string, patch: any) => { board = { ...board, ...patch, settings: { ...board.settings, ...(patch.settings ?? {}) } }; return board; });
  api.joinBoard.mockImplementation(async (_id: string, p: any) => ({ id: 'me', ...p }));
  api.saveOrUpdateGroup.mockImplementation(async (_id: string, g: any) => ({ id: 'g2', boardId: 'b1', order: 1, ...g }));
  api.deleteBoard.mockResolvedValue(undefined);
});
afterEach(cleanup);

async function mount() {
  await act(async () => {
    render(<Suspense fallback={<div data-testid="susp" />}><BrainstormingRoomPage params={Promise.resolve({ id: 'b1' })} /></Suspense>);
  });
  await waitFor(() => expect(screen.getByTestId('room')).toBeTruthy());
  await act(async () => {});
}
const emit = async (type: string, payload?: unknown) => { await act(async () => { state.socket.onMessage({ type, payload }); }); };
const latest = () => state.roomProps;
const call = async (fn: () => unknown) => { await act(async () => { await fn(); }); };

describe('carga e entrada na sala', () => {
  it('carrega mural, ideias, grupos e participantes e é facilitador quem criou', async () => {
    await mount();
    expect(api.getBoard).toHaveBeenCalledWith('b1');
    expect(latest().ideas).toHaveLength(1);
    expect(latest().isFacilitator).toBe(true);
    expect(latest().squadLabel).toBe('Phoenix');
  });

  it('quem não criou o mural não é facilitador', async () => {
    board.creatorId = 'outra';
    await mount();
    expect(latest().isFacilitator).toBe(false);
  });

  it('entra na lista de participantes uma só vez, com o apelido do perfil', async () => {
    participants = [];
    await mount();
    expect(api.joinBoard).toHaveBeenCalledTimes(1);
    expect(api.joinBoard).toHaveBeenCalledWith('b1', expect.objectContaining({ nickname: 'Ana Souza', role: 'Developer' }));
  });

  it('mural que não existe (404) mostra "não encontrado"', async () => {
    api.getBoard.mockRejectedValue(new CeremonyApiError('Mural não encontrado.', 404));
    await act(async () => { render(<Suspense fallback={null}><BrainstormingRoomPage params={Promise.resolve({ id: 'b1' })} /></Suspense>); });
    await waitFor(() => expect(screen.getByText('Brainstorming não encontrado')).toBeTruthy());
  });

  it('falha de rede NÃO vira "não encontrado": mostra o erro com "Tentar de novo"', async () => {
    api.getBoard.mockRejectedValueOnce(new Error('rede'));
    await act(async () => { render(<Suspense fallback={null}><BrainstormingRoomPage params={Promise.resolve({ id: 'b1' })} /></Suspense>); });
    await waitFor(() => expect(screen.getByText('Não foi possível carregar o brainstorming')).toBeTruthy());
    expect(screen.queryByText('Brainstorming não encontrado')).toBeNull();
    await act(async () => { screen.getByRole('button', { name: 'Tentar de novo' }).click(); });
    await waitFor(() => expect(screen.getByTestId('room')).toBeTruthy());
  });
});

describe('presença em tempo real', () => {
  it('pede a presença ao conectar; sem snapshot a sala fica sem dado (null) e com snapshot vira a lista', async () => {
    await mount();
    expect(state.socket.presence).toBe(true);
    expect(state.roomProps.onlineIds).toBeNull();
    await act(async () => { state.socket.onPresence({ online: ['me'], total: 1, version: 1 }); });
    expect([...state.roomProps.onlineIds]).toEqual(['me']);
  });
});

describe('tempo real', () => {
  it('o estado da conexão acompanha abrir e cair do socket', async () => {
    await mount();
    expect(screen.getByTestId('room').getAttribute('data-connection')).toBe('connecting');
    await act(async () => { state.socket.onOpen(); });
    expect(screen.getByTestId('room').getAttribute('data-connection')).toBe('live');
    await act(async () => { state.socket.onClose(); });
    expect(screen.getByTestId('room').getAttribute('data-connection')).toBe('reconnecting');
  });

  it('eventos de ideia, grupo e participante entram no estado', async () => {
    await mount();
    await emit('IDEA_SAVED', { ...ideas[0], id: 'i2', content: 'nova' });
    expect(latest().ideas).toHaveLength(2);
    await emit('IDEA_DELETED', { ideaId: 'i1' });
    expect(latest().ideas.map((i: BrainstormingIdea) => i.id)).toEqual(['i2']);
    await emit('PARTICIPANT_JOINED', { id: 'u9', roomId: 'b1', nickname: 'Bia' });
    expect(latest().participants.some((p: Participant) => p.id === 'u9')).toBe(true);
    await emit('PARTICIPANT_LEFT', { userId: 'u9' });
    expect(latest().participants.some((p: Participant) => p.id === 'u9')).toBe(false);
    await emit('GROUP_SAVED', { id: 'g9', boardId: 'b1', title: 'Novo', order: 1 });
    expect(latest().groups).toHaveLength(2);
    await emit('GROUP_DELETED', { groupId: 'g9' });
    expect(latest().groups).toHaveLength(1);
  });

  it('o facilitador apagou o mural: a sala mostra o aviso (e volta sozinha depois)', async () => {
    board.creatorId = 'outra';
    await mount();
    await emit('BOARD_DELETED', { boardId: 'b1' });
    expect(screen.getByText('Esta sessão foi encerrada')).toBeTruthy();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Esta sessão foi encerrada' }));
  });

  it('quem apaga o próprio mural não recebe o aviso de "encerrada"', async () => {
    await mount();
    await call(() => latest().onDeleteBoard());
    expect(api.deleteBoard).toHaveBeenCalledWith('b1');
    await emit('BOARD_DELETED', { boardId: 'b1' });
    expect(screen.queryByText('Esta sessão foi encerrada')).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/brainstorming');
  });

  it('revelar muda o que o servidor manda: recarrega só as ideias', async () => {
    await mount();
    api.getIdeas.mockClear();
    await call(() => latest().onToggleReveal());
    await waitFor(() => expect(api.getIdeas).toHaveBeenCalledTimes(1));
  });
});

describe('ações da sala', () => {
  it('cada grupo novo leva uma cor da paleta (a primeira livre)', async () => {
    await mount();
    await call(() => latest().onAddGroup('Convites'));
    expect(api.saveOrUpdateGroup).toHaveBeenCalledWith('b1', expect.objectContaining({ title: 'Convites', color: '#059669' }));
  });

  it('o cronômetro grava pelo patch: duração, iniciar, pausar, retomar e reiniciar', async () => {
    await mount();
    await call(() => latest().onSetTimerDuration(900));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { timer: { status: 'stopped', endTime: null, initialDuration: 900, remainingOnPause: 900 } });
    await call(() => latest().onStartTimer(300));
    const start = api.patchBoard.mock.calls.at(-1)![1].timer;
    expect(start).toMatchObject({ status: 'running', initialDuration: 300 });
    expect(start.endTime).toBeGreaterThan(Date.now());
    await call(() => latest().onPauseTimer());
    expect(api.patchBoard.mock.calls.at(-1)![1].timer.status).toBe('paused');
    await call(() => latest().onResumeTimer());
    expect(api.patchBoard.mock.calls.at(-1)![1].timer.status).toBe('running');
    await call(() => latest().onResetTimer());
    expect(api.patchBoard.mock.calls.at(-1)![1].timer).toMatchObject({ status: 'stopped', endTime: null });
  });

  it('etapa, nome e ajustes são gravados por campo (settings mescladas no servidor)', async () => {
    await mount();
    await call(() => latest().onPhaseChange('grouping'));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { phase: 'grouping' });
    await call(() => latest().onRename('Novo nome'));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { title: 'Novo nome' });
    await call(() => latest().onToggleAnonymous());
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { settings: { isAnonymous: true } });
    await call(() => latest().onTogglePresentation());
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { settings: { isPresentationMode: true } });
    await call(() => latest().onToggleReveal());
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { settings: { isRevealed: false } });
  });

  it('lançar ideia devolve true e erro vira aviso com a mensagem do servidor', async () => {
    await mount();
    api.saveOrUpdateIdea.mockResolvedValueOnce({ ...ideas[0], id: 'i9' });
    let ok: boolean | undefined;
    await act(async () => { ok = await latest().onAddIdea('texto'); });
    expect(ok).toBe(true);
    expect(latest().ideas.some((i: BrainstormingIdea) => i.id === 'i9')).toBe(true);
    api.saveOrUpdateIdea.mockRejectedValueOnce(new CeremonyApiError('Texto muito longo.', 400));
    await act(async () => { ok = await latest().onAddIdea('texto'); });
    expect(ok).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível lançar a ideia', description: 'Texto muito longo.', variant: 'destructive' }));
  });

  it('voto, edição, ligação, grupo e priorização vão como PATCH parcial', async () => {
    await mount();
    api.patchIdea.mockImplementation(async (_b: string, id: string, patch: any) => ({ ...ideas[0], id, ...patch }));
    await call(() => latest().onUpdateIdea('i1', 'novo texto'));
    expect(api.patchIdea).toHaveBeenLastCalledWith('b1', 'i1', { content: 'novo texto' });
    await call(() => latest().onConnectIdeas('i1', 'i2'));
    expect(api.patchIdea).toHaveBeenLastCalledWith('b1', 'i2', { parentId: 'i1' });
    await call(() => latest().onDisconnectIdea('i2'));
    expect(api.patchIdea).toHaveBeenLastCalledWith('b1', 'i2', { parentId: null });
    await call(() => latest().onMoveIdeaToGroup('i1', 'g1'));
    expect(api.patchIdea).toHaveBeenLastCalledWith('b1', 'i1', { groupId: 'g1' });
    await call(() => latest().onUpdateIdeaQualifiers('i1', { roi: 80, effort: 20 }));
    expect(api.patchIdea).toHaveBeenLastCalledWith('b1', 'i1', { qualifiers: { roi: 80, effort: 20 } });
    await call(() => latest().onUpdateIdeaPosition('i1', 10, 20));
    expect(api.patchIdea).toHaveBeenLastCalledWith('b1', 'i1', { position: { x: 10, y: 20 } });
  });

  it('remover participante e apagar ideia chamam o servidor e atualizam a lista', async () => {
    participants = [participants[0], { id: 'u3', roomId: 'b1', nickname: 'Diego', isFacilitator: false, role: 'dev' } as Participant];
    await mount();
    api.leaveBoard.mockResolvedValue(undefined);
    await call(() => latest().onRemoveParticipant('u3'));
    expect(api.leaveBoard).toHaveBeenCalledWith('b1', 'u3');
    expect(latest().participants.map((p: Participant) => p.id)).toEqual(['me']);
    api.deleteIdea.mockResolvedValue(undefined);
    await call(() => latest().onDeleteIdea('i1'));
    expect(api.deleteIdea).toHaveBeenCalledWith('b1', 'i1');
    expect(latest().ideas).toHaveLength(0);
  });
});

describe('cerimônia: facilitador, encerrar e facilitação (backend novo)', () => {
  it('o facilitador é o facilitatorId; o criador que passou a facilitação deixa de ser', async () => {
    board = { ...board, creatorId: 'me', facilitatorId: 'bia', status: 'OPEN' };
    await mount();
    expect(latest().isFacilitator).toBe(false);
    await emit('BOARD_UPDATED', { ...board, facilitatorId: 'me' });
    expect(latest().isFacilitator).toBe(true);
  });

  it('mural antigo (sem facilitatorId) continua valendo o criador', async () => {
    await mount();
    expect(latest().isFacilitator).toBe(true);
    expect(latest().isAdmin).toBe(false);
  });

  it('conta admin chega à sala como isAdmin', async () => {
    state.profile = { id: 'adm', name: 'Admin', role: 'admin' };
    board = { ...board, creatorId: 'outra', status: 'OPEN', facilitatorId: 'outra' };
    await mount();
    expect(latest().isAdmin).toBe(true);
    expect(latest().isFacilitator).toBe(false);
  });

  it('trocar o facilitador recarrega as ideias (o texto das ocultas muda de mãos)', async () => {
    board = { ...board, creatorId: 'outra', facilitatorId: 'outra', status: 'OPEN' };
    await mount();
    api.getIdeas.mockClear();
    await emit('BOARD_UPDATED', { ...board, facilitatorId: 'me' });
    await waitFor(() => expect(api.getIdeas).toHaveBeenCalledTimes(1));
  });

  it('encerrar e reabrir aplicam o mural devolvido pelo servidor', async () => {
    api.finishBoard.mockImplementation(async () => ({ ...board, status: 'FINISHED', finishedAt: '2026-10-17T14:00:00Z' }));
    api.reopenBoard.mockImplementation(async () => ({ ...board, status: 'OPEN', finishedAt: null }));
    board = { ...board, status: 'OPEN', facilitatorId: 'me' };
    await mount();
    await call(() => latest().onFinish());
    expect(api.finishBoard).toHaveBeenCalledWith('b1');
    expect(latest().boardData.status).toBe('FINISHED');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Brainstorming encerrado' }));
    await call(() => latest().onReopen());
    expect(api.reopenBoard).toHaveBeenCalledWith('b1');
    expect(latest().boardData.status).toBe('OPEN');
    expect(latest().ceremonyBusy).toBe(false);
  });

  it('assumir e passar chamam as rotas de facilitação', async () => {
    api.claimFacilitation.mockImplementation(async () => ({ ...board, facilitatorId: 'me', status: 'OPEN' }));
    api.transferFacilitation.mockImplementation(async () => ({ ...board, facilitatorId: 'bia', status: 'OPEN' }));
    board = { ...board, creatorId: 'outra', facilitatorId: 'outra', status: 'OPEN' };
    await mount();
    await call(() => latest().onClaimFacilitation());
    expect(api.claimFacilitation).toHaveBeenCalledWith('b1');
    expect(latest().isFacilitator).toBe(true);
    await call(() => latest().onTransferFacilitation('bia'));
    expect(api.transferFacilitation).toHaveBeenCalledWith('b1', 'bia');
    expect(latest().isFacilitator).toBe(false);
  });

  it('409 do servidor ("O facilitador está online.") vira aviso e recarrega o mural', async () => {
    api.claimFacilitation.mockImplementation(async () => { throw new CeremonyApiError('O facilitador está online.', 409); });
    board = { ...board, creatorId: 'outra', facilitatorId: 'outra', status: 'OPEN' };
    await mount();
    api.getBoard.mockClear();
    await call(() => latest().onClaimFacilitation());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível assumir a facilitação', description: 'O facilitador está online.', variant: 'destructive' }));
    await waitFor(() => expect(api.getBoard).toHaveBeenCalledTimes(1));
    expect(latest().ceremonyUnavailable).toBe(false);
  });

  it('403 ao encerrar mostra a mensagem; 404 (backend antigo) esconde a função sem erro na tela', async () => {
    api.finishBoard.mockImplementation(async () => { throw new CeremonyApiError('Apenas o facilitador pode encerrar o brainstorming.', 403); });
    board = { ...board, status: 'OPEN', facilitatorId: 'me' };
    await mount();
    await call(() => latest().onFinish());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Apenas o facilitador pode encerrar o brainstorming.', variant: 'destructive' }));
    expect(latest().ceremonyUnavailable).toBe(false);

    toast.mockClear();
    api.finishBoard.mockImplementation(async () => { throw new CeremonyApiError('No static resource', 404); });
    await call(() => latest().onFinish());
    expect(latest().ceremonyUnavailable).toBe(true);
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('votar além do limite (409) avisa com a mensagem do servidor e ressincroniza o mural', async () => {
    api.toggleVote.mockRejectedValue(new CeremonyApiError('Você já usou seus 3 votos. Remova um voto para votar em outra ideia.', 409));
    await mount();
    api.getBoard.mockClear();
    await call(() => latest().onVoteIdea('i1'));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('3 votos'), variant: 'destructive' }));
    await waitFor(() => expect(api.getBoard).toHaveBeenCalled());
  });

  it('editar o texto sem permissão (403) mostra a mensagem do servidor', async () => {
    api.patchIdea.mockRejectedValue(new CeremonyApiError('Só o autor da ideia ou o facilitador podem editar o texto.', 403));
    await mount();
    let saved: unknown;
    await act(async () => { saved = await latest().onUpdateIdea('i1', 'novo'); });
    expect(saved).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Só o autor da ideia ou o facilitador podem editar o texto.' }));
  });

  it('limite de votos e edição restrita vão no PATCH (null tira o limite)', async () => {
    await mount();
    await call(() => latest().onVoteLimitChange(4));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { votesPerParticipant: 4 });
    await call(() => latest().onVoteLimitChange(null));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { votesPerParticipant: null });
    await call(() => latest().onRestrictEditsChange(true));
    expect(api.patchBoard).toHaveBeenLastCalledWith('b1', { settings: { restrictEdits: true } });
  });
});
