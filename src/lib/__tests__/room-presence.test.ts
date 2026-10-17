import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRESENCE_GRACE_MS,
  createPresenceSession,
  createPresenceTracker,
  fetchRoomPresence,
  parsePresenceUpdate,
  presenceOnlineOf,
  withPresenceParam,
} from '../room-presence';

const evt = (version: number, online: string[]) => ({ type: 'PRESENCE_UPDATED', boardId: 'b1', payload: { online, total: online.length, version } });

describe('withPresenceParam', () => {
  it('acrescenta presence=1 com & quando já há query e com ? quando não há', () => {
    expect(withPresenceParam('ws://x/ws/retro/b1?token=abc')).toBe('ws://x/ws/retro/b1?token=abc&presence=1');
    expect(withPresenceParam('ws://x/ws/retro/b1')).toBe('ws://x/ws/retro/b1?presence=1');
  });
  it('não duplica', () => {
    expect(withPresenceParam('ws://x/a?presence=1&token=t')).toBe('ws://x/a?presence=1&token=t');
  });
});

describe('parsePresenceUpdate', () => {
  it('lê o payload e descarta o que não é id', () => {
    expect(parsePresenceUpdate(evt(3, ['a', 'b']))).toEqual({ online: ['a', 'b'], total: 2, version: 3 });
    expect(parsePresenceUpdate({ payload: { online: ['a', 7, null], version: 1 } })).toEqual({ online: ['a'], total: 1, version: 1 });
  });
  it('payload malformado vira null', () => {
    expect(parsePresenceUpdate({})).toBeNull();
    expect(parsePresenceUpdate({ payload: { online: 'a', version: 1 } })).toBeNull();
    expect(parsePresenceUpdate({ payload: { online: [], version: 'x' } })).toBeNull();
  });
});

describe('createPresenceSession', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('consome o evento (devolve true) e ignora os outros tipos', () => {
    const onPresence = vi.fn();
    const s = createPresenceSession({ onPresence });
    expect(s.handle({ type: 'BOARD_UPDATED', payload: {} })).toBe(false);
    expect(s.handle(evt(1, ['a']))).toBe(true);
    expect(onPresence).toHaveBeenCalledWith({ online: ['a'], total: 1, version: 1 });
  });

  it('descarta versão menor ou igual à última vista', () => {
    const onPresence = vi.fn();
    const s = createPresenceSession({ onPresence });
    s.handle(evt(5, ['a']));
    s.handle(evt(4, ['a', 'b']));
    s.handle(evt(5, ['a', 'c']));
    s.handle(evt(6, ['a', 'd']));
    expect(onPresence.mock.calls.map((c) => c[0].version)).toEqual([5, 6]);
  });

  it('nova conexão zera a versão (o servidor reiniciou e o contador recomeçou)', () => {
    const onPresence = vi.fn();
    const s = createPresenceSession({ onPresence });
    s.handle(evt(900, ['a']));
    s.start(true);
    s.handle(evt(1, ['a', 'b']));
    expect(onPresence).toHaveBeenCalledTimes(2);
    expect(onPresence).toHaveBeenLastCalledWith({ online: ['a', 'b'], total: 2, version: 1 });
  });

  it('evento malformado é consumido mas não aplicado', () => {
    const onPresence = vi.fn();
    const s = createPresenceSession({ onPresence });
    expect(s.handle({ type: 'PRESENCE_UPDATED', payload: null })).toBe(true);
    expect(onPresence).not.toHaveBeenCalled();
  });

  it('sem snapshot em 3 s chama onMissing; com snapshot não chama', () => {
    const onMissing = vi.fn();
    const s = createPresenceSession({ onMissing });
    s.start(true);
    vi.advanceTimersByTime(2999);
    expect(onMissing).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onMissing).toHaveBeenCalledTimes(1);

    s.start(true);
    vi.advanceTimersByTime(1000);
    s.handle(evt(1, ['a']));
    vi.advanceTimersByTime(5000);
    expect(onMissing).toHaveBeenCalledTimes(1);
  });

  it('stop e start(false) desarmam a espera', () => {
    const onMissing = vi.fn();
    const s = createPresenceSession({ onMissing });
    s.start(true);
    s.stop();
    s.start(true);
    s.start(false);
    vi.advanceTimersByTime(10_000);
    expect(onMissing).not.toHaveBeenCalled();
  });
});

describe('createPresenceTracker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('começa desconhecido e o primeiro estado vale direto', () => {
    const onChange = vi.fn();
    const t = createPresenceTracker(onChange);
    expect(t.current()).toBeNull();
    t.apply(['a', 'b']);
    expect(onChange).toHaveBeenLastCalledWith(new Set(['a', 'b']));
  });

  it('entrar é imediato; sair só aparece depois de 5 s', () => {
    const onChange = vi.fn();
    const t = createPresenceTracker(onChange);
    t.apply(['a', 'b']);
    t.apply(['a', 'b', 'c']);
    expect(onChange).toHaveBeenLastCalledWith(new Set(['a', 'b', 'c']));

    t.apply(['a', 'c']);
    expect(t.current()?.has('b')).toBe(true);
    vi.advanceTimersByTime(PRESENCE_GRACE_MS - 1);
    expect(t.current()?.has('b')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(t.current()?.has('b')).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(new Set(['a', 'c']));
  });

  it('queda curta (saiu e voltou dentro de 5 s) nunca pisca para offline', () => {
    const onChange = vi.fn();
    const t = createPresenceTracker(onChange);
    t.apply(['a', 'b']);
    onChange.mockClear();
    t.apply(['a']);
    vi.advanceTimersByTime(2000);
    t.apply(['a', 'b']);
    vi.advanceTimersByTime(10_000);
    expect(t.current()?.has('b')).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('o prazo de cada pessoa conta da primeira ausência, não de cada snapshot', () => {
    const t = createPresenceTracker(vi.fn(), 5000);
    t.apply(['a', 'b']);
    t.apply(['a']);
    vi.advanceTimersByTime(3000);
    t.apply(['a']);
    vi.advanceTimersByTime(2000);
    expect(t.current()?.has('b')).toBe(false);
  });

  it('dispose cancela os prazos e volta a desconhecido', () => {
    const onChange = vi.fn();
    const t = createPresenceTracker(onChange);
    t.apply(['a', 'b']);
    t.apply(['a']);
    onChange.mockClear();
    t.dispose();
    vi.advanceTimersByTime(10_000);
    expect(onChange).not.toHaveBeenCalled();
    expect(t.current()).toBeNull();
  });
});

describe('presenceOnlineOf', () => {
  it('undefined quando a sala não sabe; booleano quando sabe', () => {
    expect(presenceOnlineOf(null, 'a')).toBeUndefined();
    expect(presenceOnlineOf(undefined, 'a')).toBeUndefined();
    expect(presenceOnlineOf(new Set(['a']), 'a')).toBe(true);
    expect(presenceOnlineOf(new Set(['a']), 'b')).toBe(false);
    expect(presenceOnlineOf(new Set(['a']), undefined)).toBe(false);
  });
});

describe('fetchRoomPresence', () => {
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
  const fail = (code: number) => ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response;

  it('200 devolve os ids e manda o Bearer na URL do módulo', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ module: 'retro', roomId: 'r 1', online: ['a', 'b'], total: 2 }));
    const r = await fetchRoomPresence('retro', 'r 1', { fetchImpl, apiBase: 'http://api/api', token: 'T' });
    expect(r).toEqual({ status: 'ok', online: ['a', 'b'] });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://api/api/presence/retro/r%201');
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer T' });
  });

  it.each([404, 403, 401, 500])('status %i vira indisponível, sem lançar', async (code) => {
    const r = await fetchRoomPresence('poker', 'p1', { fetchImpl: vi.fn().mockResolvedValue(fail(code)), apiBase: 'http://x', token: 't' });
    expect(r).toEqual({ status: 'unavailable' });
  });

  it('falha de rede e corpo inválido viram indisponível', async () => {
    expect(await fetchRoomPresence('poker', 'p1', { fetchImpl: vi.fn().mockRejectedValue(new Error('rede')), apiBase: 'http://x', token: 't' })).toEqual({ status: 'unavailable' });
    expect(await fetchRoomPresence('poker', 'p1', { fetchImpl: vi.fn().mockResolvedValue(ok({ nope: 1 })), apiBase: 'http://x', token: 't' })).toEqual({ status: 'unavailable' });
  });
});
