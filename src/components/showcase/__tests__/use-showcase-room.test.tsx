import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcaseSession, ShowcaseTask } from '../types';

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  api: {
    getSession: vi.fn(),
    saveSession: vi.fn(),
    patchCard: vi.fn(),
    uploadTaskFile: vi.fn(),
    deleteTaskFile: vi.fn(),
    getWebSocketUrl: vi.fn(() => 'ws://test/ws/showcase/s1?token=t'),
  },
  presence: { online: null, bindings: { presence: true as const, onPresence: () => {}, onPresenceMissing: () => {} } },
}));

vi.mock('../../../app/showcase/api', () => ({ showcaseApi: h.api }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ session: { id: 'u1', name: 'Ana' } }) }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => ({ userProfile: { name: 'Ana' } }) }));
vi.mock('../../../hooks/useActiveSquad', () => ({ useActiveSquad: () => ({ squadId: 'DDW' }) }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../hooks/useRoomPresence', () => ({ useRoomPresence: () => h.presence }));

import { useShowcaseRoom } from '../useShowcaseRoom';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  url: string;
  constructor(url: string) { this.url = url; FakeSocket.instances.push(this); }
  close() {}
  emit(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

function apiError(status: number, code: string, body: Record<string, unknown> = {}) {
  return Object.assign(new Error(`Showcase API error ${status}`), { status, code, body: { code, ...body } });
}

function card(id: string, over: Partial<ShowcaseTask> = {}): ShowcaseTask {
  return {
    id, key: id.toUpperCase(), title: `Título ${id}`, description: '', acceptanceCriteria: '', type: 'História', status: 'Done', priority: 'Medium', points: 0,
    assignee: '', url: '',
    evidence: { problem: 'p', solution: 's', dev: 'Ana', qa: 'Bruno', screenshot: '', video: '', timeSpent: 0, timeEstimate: 0, planned: null },
    decision: 'open', preparationStatus: 'doing', feedback: '', version: 1, ...over,
  } as ShowcaseTask;
}
const room = (tasks: ShowcaseTask[], over: Partial<ShowcaseSession> = {}): ShowcaseSession => ({
  id: 's1', name: 'Review', sprintName: 'S1', tasks, createdAt: '2026-10-01T10:00:00', updatedAt: '2026-10-17T10:00:00', status: 'planning', squadName: 'DDW', ...over,
});

async function openRoom(session: ShowcaseSession) {
  h.api.getSession.mockResolvedValue(structuredClone(session));
  const hook = renderHook(() => useShowcaseRoom('s1'));
  await waitFor(() => expect(hook.result.current.session).not.toBeNull());
  return hook;
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.values(h.api).forEach((fn) => fn.mockReset());
  h.api.getWebSocketUrl.mockImplementation(() => 'ws://test/ws/showcase/s1?token=t');
  h.toast.mockReset();
});

describe('edição por card (PATCH com versão)', () => {
  it('card com version grava só os campos mudados por PATCH, sem POST da sessão', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3 }), card('c2')]));
    h.api.patchCard.mockResolvedValue(card('c1', { version: 4, title: 'Novo título' }));

    let ok = false;
    await act(async () => { ok = await result.current.updateTask('c1', { title: 'Novo título' }); });

    expect(ok).toBe(true);
    expect(h.api.patchCard).toHaveBeenCalledTimes(1);
    expect(h.api.patchCard).toHaveBeenCalledWith('s1', 'c1', { version: 3, title: 'Novo título' });
    expect(h.api.saveSession).not.toHaveBeenCalled();
    expect(result.current.session?.tasks[0]).toMatchObject({ title: 'Novo título', version: 4 });
    expect(result.current.session?.tasks[1].title).toBe('Título c2');
  });

  it('evidência vai por subcampo (não apaga o resto)', async () => {
    const { result } = await openRoom(room([card('c1', { version: 2 })]));
    h.api.patchCard.mockResolvedValue(card('c1', { version: 3 }));
    await act(async () => {
      await result.current.updateTask('c1', (prev) => ({ ...prev, evidence: { ...prev.evidence, solution: 'nova solução' } }));
    });
    expect(h.api.patchCard).toHaveBeenCalledWith('s1', 'c1', { version: 2, evidence: { solution: 'nova solução' } });
  });

  it('backend antigo (card sem version): continua gravando a Review inteira', async () => {
    const { result } = await openRoom(room([card('c1', { version: undefined })]));
    h.api.saveSession.mockImplementation(async (s: ShowcaseSession) => s);

    let ok = false;
    await act(async () => { ok = await result.current.updateTask('c1', { title: 'Novo' }); });

    expect(ok).toBe(true);
    expect(h.api.patchCard).not.toHaveBeenCalled();
    expect(h.api.saveSession).toHaveBeenCalledTimes(1);
    expect(h.api.saveSession.mock.calls[0][0].tasks[0].title).toBe('Novo');
  });

  it('alteração que não muda nada não vai ao servidor', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3 })]));
    let ok = false;
    await act(async () => { ok = await result.current.updateTask('c1', { title: 'Título c1' }); });
    expect(ok).toBe(true);
    expect(h.api.patchCard).not.toHaveBeenCalled();
  });

  it('409 em campos diferentes: reaplica sobre o card atual e repete com a versão nova, sem perguntar nada', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3 })]));
    const serverNow = card('c1', { version: 5, evidence: { ...card('c1').evidence, qa: 'Outro QA' } });
    h.api.patchCard
      .mockRejectedValueOnce(apiError(409, 'CARD_VERSION_CONFLICT', { card: serverNow }))
      .mockResolvedValueOnce({ ...serverNow, version: 6, title: 'Meu título' });

    let ok = false;
    await act(async () => { ok = await result.current.updateTask('c1', { title: 'Meu título' }); });

    expect(ok).toBe(true);
    expect(h.api.patchCard).toHaveBeenCalledTimes(2);
    expect(h.api.patchCard.mock.calls[1][2]).toEqual({ version: 5, title: 'Meu título' });
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.session?.tasks[0]).toMatchObject({ title: 'Meu título', version: 6 });
    expect(result.current.session?.tasks[0].evidence.qa).toBe('Outro QA');
  });

  it('409 no mesmo campo: mostra o do servidor, guarda o que a pessoa digitou e deixa reaplicar', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3 })]));
    const serverNow = card('c1', { version: 4, title: 'Título do colega' });
    h.api.patchCard.mockRejectedValueOnce(apiError(409, 'CARD_VERSION_CONFLICT', { card: serverNow }));

    let ok = true;
    await act(async () => { ok = await result.current.updateTask('c1', { title: 'Meu título' }); });

    expect(ok).toBe(false);
    expect(result.current.lastFailure()).toBe('conflict');
    expect(result.current.session?.tasks[0].title).toBe('Título do colega');
    expect(result.current.conflicts).toHaveLength(1);
    expect(result.current.conflicts[0]).toMatchObject({ taskId: 'c1', taskKey: 'C1' });
    expect(result.current.conflicts[0].changes[0]).toMatchObject({ path: 'title', value: 'Meu título' });

    h.api.patchCard.mockResolvedValueOnce({ ...serverNow, version: 5, title: 'Meu título' });
    await act(async () => { await result.current.resolveConflict(result.current.conflicts[0].id, 'reapply'); });

    expect(h.api.patchCard).toHaveBeenLastCalledWith('s1', 'c1', { version: 4, title: 'Meu título' });
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.session?.tasks[0]).toMatchObject({ title: 'Meu título', version: 5 });
  });

  it('descartar o conflito fica com o que está gravado e não grava nada', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3 })]));
    h.api.patchCard.mockRejectedValueOnce(apiError(409, 'CARD_VERSION_CONFLICT', { card: card('c1', { version: 4, title: 'Do colega' }) }));
    await act(async () => { await result.current.updateTask('c1', { title: 'Meu' }); });
    await act(async () => { await result.current.resolveConflict(result.current.conflicts[0].id, 'discard'); });
    expect(result.current.conflicts).toEqual([]);
    expect(h.api.patchCard).toHaveBeenCalledTimes(1);
    expect(result.current.session?.tasks[0].title).toBe('Do colega');
  });

  it('conflito parcial: grava o que não colidiu e avisa só do que colidiu', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3 })]));
    const serverNow = card('c1', { version: 4, title: 'Do colega' });
    h.api.patchCard
      .mockRejectedValueOnce(apiError(409, 'CARD_VERSION_CONFLICT', { card: serverNow }))
      .mockResolvedValueOnce({ ...serverNow, version: 5, description: 'minha descrição' });
    await act(async () => { await result.current.updateTask('c1', { title: 'Meu', description: 'minha descrição' }); });
    expect(h.api.patchCard.mock.calls[1][2]).toEqual({ version: 4, description: 'minha descrição' });
    expect(result.current.conflicts[0].changes.map((c) => c.path)).toEqual(['title']);
    expect(result.current.session?.tasks[0]).toMatchObject({ title: 'Do colega', description: 'minha descrição' });
  });

  it('403 DECISION_RESTRICTED: avisa com clareza, grava o resto, recarrega o card e nada some', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3 })]));
    h.api.patchCard
      .mockRejectedValueOnce(apiError(403, 'DECISION_RESTRICTED', { cardIds: ['c1'] }))
      .mockResolvedValueOnce(card('c1', { version: 4, title: 'Outro título' }));

    let ok = true;
    await act(async () => { ok = await result.current.updateTask('c1', { title: 'Outro título', decision: 'approved', feedback: 'ok' }); });

    expect(ok).toBe(false);
    expect(result.current.lastFailure()).toBe('restricted');
    expect(h.api.patchCard.mock.calls[1][2]).toEqual({ version: 3, title: 'Outro título' });
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Você não pode registrar a decisão desta Review', variant: 'destructive' }));
    expect(result.current.session?.tasks[0]).toMatchObject({ title: 'Outro título', decision: 'open', feedback: '' });
    expect(result.current.session?.tasks).toHaveLength(1);
  });

  it('403 só com decisão: a tela volta ao veredito gravado (nada foi salvo)', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3, decision: 'needs_adjustment', feedback: 'ajuste' })]));
    h.api.patchCard.mockRejectedValueOnce(apiError(403, 'DECISION_RESTRICTED', { cardIds: ['c1'] }));
    let ok = true;
    await act(async () => { ok = await result.current.updateTask('c1', { decision: 'approved', feedback: '' }); });
    expect(ok).toBe(false);
    expect(h.api.patchCard).toHaveBeenCalledTimes(1);
    expect(result.current.session?.tasks[0]).toMatchObject({ decision: 'needs_adjustment', feedback: 'ajuste', version: 3 });
  });

  it('falha de rede: avisa, volta ao que está gravado e resolve false', async () => {
    const { result } = await openRoom(room([card('c1', { version: 3 })]));
    h.api.patchCard.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
    let ok = true;
    await act(async () => { ok = await result.current.updateTask('c1', { title: 'Perdido' }); });
    expect(ok).toBe(false);
    expect(result.current.lastFailure()).toBe('error');
    expect(result.current.saveState).toBe('error');
    expect(result.current.session?.tasks[0].title).toBe('Título c1');
  });

  it('edições seguidas do mesmo card viram um PATCH só', async () => {
    const { result } = await openRoom(room([card('c1', { version: 1 })]));
    let release: (c: ShowcaseTask) => void = () => {};
    h.api.patchCard.mockImplementationOnce(() => new Promise<ShowcaseTask>((resolve) => { release = resolve; }));
    h.api.patchCard.mockResolvedValue(card('c1', { version: 3 }));
    let p1: Promise<boolean>, p2: Promise<boolean>, p3: Promise<boolean>;
    await act(async () => {
      p1 = result.current.updateTask('c1', { title: 'A' });
      await Promise.resolve();
      p2 = result.current.updateTask('c1', { description: 'B' });
      p3 = result.current.updateTask('c1', { points: 5 });
      await Promise.resolve();
      release(card('c1', { version: 2, title: 'A' }));
      await Promise.all([p1, p2, p3]);
    });
    expect(h.api.patchCard).toHaveBeenCalledTimes(2);
    expect(h.api.patchCard.mock.calls[1][2]).toEqual({ version: 2, description: 'B', points: 5 });
  });
});

describe('POST da sessão inteira', () => {
  it('staleCardIds: avisa quantos cards foram mantidos no servidor e recarrega', async () => {
    const { result } = await openRoom(room([card('c1', { version: 2 })]));
    h.api.saveSession.mockImplementation(async (s: ShowcaseSession) => ({ ...s, staleCardIds: ['c1', 'c9'] }));
    await act(async () => { await result.current.persist({ name: 'Renomeada' }); });
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '2 cards foram mantidos como estavam no servidor' }));
    expect(result.current.session).not.toHaveProperty('staleCardIds');
    expect(h.api.getSession.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('um card mantido usa o singular', async () => {
    const { result } = await openRoom(room([card('c1', { version: 2 })]));
    h.api.saveSession.mockImplementation(async (s: ShowcaseSession) => ({ ...s, staleCardIds: ['c1'] }));
    await act(async () => { await result.current.persist({ name: 'x' }); });
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '1 card foi mantido como estava no servidor' }));
  });

  it('403 DECISION_RESTRICTED no POST: regrava sem a decisão recusada e avisa', async () => {
    const { result } = await openRoom(room([card('c1', { version: undefined, decision: 'needs_adjustment', feedback: 'ajuste' })]));
    h.api.saveSession
      .mockRejectedValueOnce(apiError(403, 'DECISION_RESTRICTED', { cardIds: ['c1'] }))
      .mockImplementation(async (s: ShowcaseSession) => s);
    let ok = true;
    await act(async () => { ok = await result.current.updateTask('c1', { decision: 'approved', title: 'Editado' }); });
    expect(ok).toBe(false);
    expect(h.api.saveSession).toHaveBeenCalledTimes(2);
    expect(h.api.saveSession.mock.calls[1][0].tasks[0]).toMatchObject({ decision: 'needs_adjustment', feedback: 'ajuste', title: 'Editado' });
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Você não pode registrar a decisão desta Review' }));
    expect(result.current.lastFailure()).toBe('restricted');
  });

  it('o POST não leva o apresentador nem o aviso de cards mantidos', async () => {
    const { result } = await openRoom(room([card('c1')], { presenter: { userId: 'u2', displayName: 'Caio', cardId: 'c1', step: 'card', presentingAt: 'x' } }));
    h.api.saveSession.mockImplementation(async (s: ShowcaseSession) => s);
    await act(async () => { await result.current.persist({ name: 'Y' }); });
    expect(h.api.saveSession.mock.calls[0][0]).not.toHaveProperty('presenter');
  });
});

describe('tempo real', () => {
  it('CARD_UPDATED troca só aquele card, sem recarregar a sessão', async () => {
    const { result } = await openRoom(room([card('c1', { version: 1 }), card('c2', { version: 1 })]));
    const socket = FakeSocket.instances[0];
    const loads = h.api.getSession.mock.calls.length;
    act(() => socket.emit({
      type: 'CARD_UPDATED', sessionId: 's1',
      payload: { cardId: 'c2', version: 2, card: card('c2', { version: 2, title: 'Mudou lá' }), sessionUpdatedAt: '2026-10-17T11:00:00' },
    }));
    expect(result.current.session?.tasks[1]).toMatchObject({ title: 'Mudou lá', version: 2 });
    expect(result.current.session?.tasks[0].title).toBe('Título c1');
    expect(result.current.session?.updatedAt).toBe('2026-10-17T11:00:00');
    expect(h.api.getSession.mock.calls.length).toBe(loads);
  });

  it('CARD_UPDATED com versão igual ou menor é eco e não faz nada', async () => {
    const { result } = await openRoom(room([card('c1', { version: 4 })]));
    const socket = FakeSocket.instances[0];
    act(() => socket.emit({ type: 'CARD_UPDATED', payload: { cardId: 'c1', version: 4, card: card('c1', { version: 4, title: 'Eco' }) } }));
    act(() => socket.emit({ type: 'CARD_UPDATED', payload: { cardId: 'c1', version: 3, card: card('c1', { version: 3, title: 'Velho' }) } }));
    expect(result.current.session?.tasks[0].title).toBe('Título c1');
  });

  it('CARD_UPDATED de um card que a tela não conhece recarrega a sessão', async () => {
    await openRoom(room([card('c1')]));
    const socket = FakeSocket.instances[0];
    const loads = h.api.getSession.mock.calls.length;
    act(() => socket.emit({ type: 'CARD_UPDATED', payload: { cardId: 'novo', version: 1, card: card('novo') } }));
    await waitFor(() => expect(h.api.getSession.mock.calls.length).toBe(loads + 1));
  });

  it('CARD_UPDATED não apaga o que a pessoa está digitando no mesmo card', async () => {
    const { result } = await openRoom(room([card('c1', { version: 1 })]));
    const socket = FakeSocket.instances[0];
    h.api.patchCard.mockImplementation(() => new Promise(() => {}));
    act(() => { void result.current.updateTask('c1', { title: 'Digitando' }); });
    act(() => socket.emit({ type: 'CARD_UPDATED', payload: { cardId: 'c1', version: 2, card: card('c1', { version: 2, description: 'do colega' }) } }));
    expect(result.current.session?.tasks[0]).toMatchObject({ title: 'Digitando', description: 'do colega', version: 2 });
  });

  it('edição do mesmo campo na fila + CARD_UPDATED de outra pessoa: não sobrescreve em silêncio, vira aviso de conflito', async () => {
    const { result } = await openRoom(room([card('c1', { version: 1, acceptanceCriteria: 'base' })]));
    const socket = FakeSocket.instances[0];
    // 1ª digitação fica em voo; a 2ª espera na fila (é a que usaria a versão nova do evento).
    h.api.patchCard.mockImplementation(() => new Promise(() => {}));
    act(() => { void result.current.updateTask('c1', { acceptanceCriteria: 'base minha' }); });
    let queued: Promise<boolean> = Promise.resolve(true);
    act(() => { queued = result.current.updateTask('c1', { acceptanceCriteria: 'base minha 2' }); });
    act(() => socket.emit({
      type: 'CARD_UPDATED',
      payload: { cardId: 'c1', version: 2, card: card('c1', { version: 2, acceptanceCriteria: 'texto do colega' }) },
    }));
    await expect(queued).resolves.toBe(false);
    expect(result.current.conflicts).toHaveLength(1);
    expect(result.current.conflicts[0].changes[0]).toMatchObject({ path: 'acceptanceCriteria', value: 'base minha 2' });
    expect(result.current.lastFailure()).toBe('conflict');
  });

  it('CARD_UPDATED de OUTRO campo com edição na fila não gera conflito', async () => {
    const { result } = await openRoom(room([card('c1', { version: 1 })]));
    const socket = FakeSocket.instances[0];
    h.api.patchCard.mockImplementation(() => new Promise(() => {}));
    act(() => { void result.current.updateTask('c1', { acceptanceCriteria: 'a' }); });
    act(() => { void result.current.updateTask('c1', { acceptanceCriteria: 'ab' }); });
    // O servidor ainda tem o critério original (vazio): não foi outra pessoa que mexeu nele.
    act(() => socket.emit({ type: 'CARD_UPDATED', payload: { cardId: 'c1', version: 2, card: card('c1', { version: 2, description: 'do colega' }) } }));
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.session?.tasks[0]).toMatchObject({ acceptanceCriteria: 'ab', description: 'do colega' });
  });

  it('SESSION_UPDATED continua funcionando como antes', async () => {
    const { result } = await openRoom(room([card('c1')]));
    const socket = FakeSocket.instances[0];
    act(() => socket.emit({ type: 'SESSION_UPDATED', payload: { ...room([card('c1', { title: 'Via POST', version: 2 })]), updatedAt: '2026-10-17T12:00:00' } }));
    expect(result.current.session?.tasks[0].title).toBe('Via POST');
  });

  it('PRESENTER_UPDATED guarda o apresentador e null limpa', async () => {
    const { result } = await openRoom(room([card('c1')]));
    const socket = FakeSocket.instances[0];
    const presenter = { userId: 'u2', displayName: 'Caio', cardId: 'c1', step: 'card', presentingAt: '2026-10-17T14:30:12' };
    act(() => socket.emit({ type: 'PRESENTER_UPDATED', payload: { presenter } }));
    expect(result.current.presenter).toEqual(presenter);
    act(() => socket.emit({ type: 'PRESENTER_UPDATED', payload: { presenter: null } }));
    expect(result.current.presenter).toBeNull();
  });

  it('o apresentador também vem do GET da sessão', async () => {
    const presenter = { userId: 'u2', displayName: 'Caio', cardId: null, step: 'cover', presentingAt: 'x' };
    const { result } = await openRoom(room([card('c1')], { presenter }));
    expect(result.current.presenter).toEqual(presenter);
  });

  it('evento de tipo desconhecido recarrega a sala (como o cliente antigo)', async () => {
    await openRoom(room([card('c1')]));
    const socket = FakeSocket.instances[0];
    const loads = h.api.getSession.mock.calls.length;
    act(() => socket.emit({ type: 'REFRESH_SESSION' }));
    await waitFor(() => expect(h.api.getSession.mock.calls.length).toBe(loads + 1));
  });
});
