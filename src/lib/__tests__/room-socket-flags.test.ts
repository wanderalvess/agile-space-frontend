import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectRoomSocket, withFlagParam } from '../room-socket';

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
}
const Impl = FakeSocket as unknown as typeof WebSocket;
const base = { onMessage: vi.fn(), onReconnect: vi.fn(), WebSocketImpl: Impl };

describe('withFlagParam', () => {
  it('acrescenta com ? ou & e não duplica', () => {
    expect(withFlagParam('ws://x/r', 'typing')).toBe('ws://x/r?typing=1');
    expect(withFlagParam('ws://x/r?token=t', 'typing')).toBe('ws://x/r?token=t&typing=1');
    expect(withFlagParam('ws://x/r?token=t&typing=1', 'typing')).toBe('ws://x/r?token=t&typing=1');
  });
});

describe('connectRoomSocket: opt-ins presentation e typing', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('sem as opções a URL não muda (backend antigo e telas que não usam)', () => {
    connectRoomSocket({ ...base, buildUrl: () => 'ws://x/room?token=t' });
    expect(FakeSocket.instances[0].url).toBe('ws://x/room?token=t');
  });

  it('presentation=1 e typing=1 convivem com presence=1 e valem em cada reconexão', () => {
    connectRoomSocket({ ...base, buildUrl: () => 'ws://x/room?token=t', presence: true, presentation: true, typing: true, baseDelayMs: 100 });
    expect(FakeSocket.instances[0].url).toBe('ws://x/room?token=t&presence=1&presentation=1&typing=1');
    FakeSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances[1].url).toBe('ws://x/room?token=t&presence=1&presentation=1&typing=1');
  });

  it('só typing: só typing=1', () => {
    connectRoomSocket({ ...base, buildUrl: () => 'ws://x/room?token=t', typing: true });
    expect(FakeSocket.instances[0].url).toBe('ws://x/room?token=t&typing=1');
  });
});

describe('connectRoomSocket: send', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
  });

  it('continua sendo a função que encerra tudo', () => {
    const stop = connectRoomSocket({ ...base, buildUrl: () => 'ws://x' });
    expect(typeof stop).toBe('function');
    expect(typeof stop.send).toBe('function');
  });

  it('descarta a mensagem sem conexão aberta (sem fila, sem erro)', () => {
    const handle = connectRoomSocket({ ...base, buildUrl: () => 'ws://x' });
    expect(handle.send({ type: 'TYPING' })).toBe(false);
    expect(FakeSocket.instances[0].sent).toEqual([]);
  });

  it('com a conexão aberta envia JSON; texto vai como está', () => {
    const handle = connectRoomSocket({ ...base, buildUrl: () => 'ws://x' });
    FakeSocket.instances[0].readyState = 1;
    expect(handle.send({ type: 'TYPING', scope: 'card', columnKey: 'good' })).toBe(true);
    expect(handle.send('{"type":"TYPING"}')).toBe(true);
    expect(FakeSocket.instances[0].sent).toEqual(['{"type":"TYPING","scope":"card","columnKey":"good"}', '{"type":"TYPING"}']);
  });

  it('depois de encerrar não envia mais', () => {
    const handle = connectRoomSocket({ ...base, buildUrl: () => 'ws://x' });
    FakeSocket.instances[0].readyState = 1;
    handle();
    expect(handle.send({ type: 'TYPING' })).toBe(false);
  });
});
