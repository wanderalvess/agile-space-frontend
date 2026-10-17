import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectRoomSocket } from '../room-socket';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  close() {}
}

const Impl = FakeSocket as unknown as typeof WebSocket;
const open = (i = 0) => FakeSocket.instances[i].onopen?.();
const send = (i: number, msg: unknown) => FakeSocket.instances[i].onmessage?.({ data: JSON.stringify(msg) });
const presenceMsg = (version: number, online: string[]) => ({ type: 'PRESENCE_UPDATED', boardId: 'b', payload: { online, total: online.length, version } });

describe('connectRoomSocket: presença', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('sem a opção a URL não muda (backend antigo e telas sem presença)', () => {
    connectRoomSocket({ buildUrl: () => 'ws://x/room?token=t', onMessage: vi.fn(), onReconnect: vi.fn(), WebSocketImpl: Impl });
    expect(FakeSocket.instances[0].url).toBe('ws://x/room?token=t');
  });

  it('com presence acrescenta presence=1 a cada tentativa', () => {
    connectRoomSocket({ buildUrl: () => 'ws://x/room?token=t', presence: true, onMessage: vi.fn(), onReconnect: vi.fn(), WebSocketImpl: Impl, baseDelayMs: 100 });
    expect(FakeSocket.instances[0].url).toBe('ws://x/room?token=t&presence=1');
    FakeSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances[1].url).toBe('ws://x/room?token=t&presence=1');
  });

  it('entrega o estado a onPresence e NUNCA ao onMessage (que recarregaria a sala)', () => {
    const onMessage = vi.fn();
    const onPresence = vi.fn();
    connectRoomSocket({ buildUrl: () => 'ws://x/r', presence: true, onPresence, onMessage, onReconnect: vi.fn(), WebSocketImpl: Impl });
    open();
    send(0, presenceMsg(1, ['a', 'b']));
    send(0, { type: 'CARD_SAVED', payload: { id: 'c' } });
    expect(onPresence).toHaveBeenCalledWith({ online: ['a', 'b'], total: 2, version: 1 });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0].type).toBe('CARD_SAVED');
  });

  it('mesmo sem opt-in o evento não chega ao onMessage', () => {
    const onMessage = vi.fn();
    connectRoomSocket({ buildUrl: () => 'ws://x/r', onMessage, onReconnect: vi.fn(), WebSocketImpl: Impl });
    open();
    send(0, presenceMsg(1, ['a']));
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('descarta versão menor ou igual e zera a versão ao reconectar', () => {
    const onPresence = vi.fn();
    connectRoomSocket({ buildUrl: () => 'ws://x/r', presence: true, onPresence, onMessage: vi.fn(), onReconnect: vi.fn(), WebSocketImpl: Impl, baseDelayMs: 100 });
    open();
    send(0, presenceMsg(10, ['a']));
    send(0, presenceMsg(9, ['a', 'b']));
    send(0, presenceMsg(10, ['a', 'c']));
    send(0, presenceMsg(11, ['a', 'd']));
    expect(onPresence.mock.calls.map((c) => c[0].version)).toEqual([10, 11]);

    FakeSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(100);
    open(1);
    send(1, presenceMsg(1, ['a']));
    expect(onPresence.mock.calls.map((c) => c[0].version)).toEqual([10, 11, 1]);
  });

  it('sem snapshot em 3 s da abertura chama onPresenceMissing', () => {
    const onPresenceMissing = vi.fn();
    connectRoomSocket({ buildUrl: () => 'ws://x/r', presence: true, onPresenceMissing, onMessage: vi.fn(), onReconnect: vi.fn(), WebSocketImpl: Impl });
    vi.advanceTimersByTime(10_000);
    expect(onPresenceMissing).not.toHaveBeenCalled(); // a conexão ainda nem abriu
    open();
    vi.advanceTimersByTime(2999);
    expect(onPresenceMissing).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onPresenceMissing).toHaveBeenCalledTimes(1);
  });

  it('snapshot dentro do prazo cancela o fallback; encerrar a conexão também', () => {
    const onPresenceMissing = vi.fn();
    const stop = connectRoomSocket({ buildUrl: () => 'ws://x/r', presence: true, onPresenceMissing, onMessage: vi.fn(), onReconnect: vi.fn(), WebSocketImpl: Impl });
    open();
    send(0, presenceMsg(1, ['a']));
    vi.advanceTimersByTime(5000);
    expect(onPresenceMissing).not.toHaveBeenCalled();
    open();
    stop();
    vi.advanceTimersByTime(5000);
    expect(onPresenceMissing).not.toHaveBeenCalled();
  });
});
