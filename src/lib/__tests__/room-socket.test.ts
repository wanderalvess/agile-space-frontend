import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectRoomSocket } from '../room-socket';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

const Impl = FakeSocket as unknown as typeof WebSocket;

describe('connectRoomSocket', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('relê a URL (token novo) a cada tentativa e reconecta com atraso crescente', () => {
    let token = 1;
    const onReconnect = vi.fn();
    connectRoomSocket({
      buildUrl: () => `ws://x/room?token=${token++}`,
      onMessage: vi.fn(),
      onReconnect,
      WebSocketImpl: Impl,
      baseDelayMs: 1000,
      maxDelayMs: 4000,
    });
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0].url).toContain('token=1');

    // 1ª queda: reconecta em 1 s
    FakeSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[1].url).toContain('token=2');

    // não abriu e caiu de novo: espera 2 s
    FakeSocket.instances[1].onclose?.();
    vi.advanceTimersByTime(1999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);
    expect(onReconnect).not.toHaveBeenCalled();
  });

  it('só ressincroniza quando reabre depois de uma queda (não na primeira abertura)', () => {
    const onReconnect = vi.fn();
    connectRoomSocket({ buildUrl: () => 'ws://x', onMessage: vi.fn(), onReconnect, WebSocketImpl: Impl, baseDelayMs: 10 });

    FakeSocket.instances[0].onopen?.();
    expect(onReconnect).not.toHaveBeenCalled();

    FakeSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(10);
    FakeSocket.instances[1].onopen?.();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('entrega mensagens JSON e avisa mensagem inválida sem derrubar a conexão', () => {
    const onMessage = vi.fn();
    const onError = vi.fn();
    connectRoomSocket({ buildUrl: () => 'ws://x', onMessage, onReconnect: vi.fn(), onError, WebSocketImpl: Impl });

    FakeSocket.instances[0].onmessage?.({ data: JSON.stringify({ type: 'IDEA_SAVED', payload: { id: 'i1' } }) });
    expect(onMessage).toHaveBeenCalledWith({ type: 'IDEA_SAVED', payload: { id: 'i1' } });

    FakeSocket.instances[0].onmessage?.({ data: 'não é json' });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('fechar de propósito não agenda reconexão', () => {
    const stop = connectRoomSocket({ buildUrl: () => 'ws://x', onMessage: vi.fn(), onReconnect: vi.fn(), WebSocketImpl: Impl, baseDelayMs: 10 });
    stop();
    expect(FakeSocket.instances[0].closed).toBe(true);

    FakeSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
