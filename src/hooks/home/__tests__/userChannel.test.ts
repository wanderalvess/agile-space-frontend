import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserChannelUrl, startUserChannel } from '../userChannel';

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

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const start = (onSignal = vi.fn()) => ({
  onSignal,
  stop: startUserChannel({ buildUrl: () => 'ws://x/ws/user?token=t', onSignal, WebSocketImpl: FakeSocket as unknown as typeof WebSocket, baseDelayMs: 100, maxDelayMs: 400 }),
});

describe('canal do usuário', () => {
  it('monta a URL a partir da base da API, com o token codificado', () => {
    expect(buildUserChannelUrl('a b', 'http://localhost:8002/api')).toBe('ws://localhost:8002/ws/user?token=a%20b');
    expect(buildUserChannelUrl(null, 'https://app.exemplo.com/api/')).toBe('wss://app.exemplo.com/ws/user?token=');
  });

  it('entrega o tipo do sinal e o id da conversa', () => {
    const { onSignal } = start();
    FakeSocket.instances[0].onmessage?.({ data: JSON.stringify({ type: 'MESSAGE', conversationId: 'c1' }) });
    expect(onSignal).toHaveBeenCalledWith({ type: 'MESSAGE', conversationId: 'c1' });
  });

  it('mensagem que não é JSON vira releitura geral, sem lançar', () => {
    const { onSignal } = start();
    FakeSocket.instances[0].onmessage?.({ data: 'lixo' });
    expect(onSignal).toHaveBeenCalledWith({ type: 'UNREAD' });
  });

  it('reconecta com backoff e, ao voltar, pede releitura (sinais perdidos não voltam)', () => {
    const { onSignal } = start();
    FakeSocket.instances[0].onopen?.();
    expect(onSignal).not.toHaveBeenCalled(); // primeira conexão não relê
    FakeSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].onopen?.();
    expect(onSignal).toHaveBeenCalledWith({ type: 'UNREAD' });
    // segunda queda sem conexão estabelecida: o atraso dobra
    FakeSocket.instances[1].onclose?.();
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances).toHaveLength(3);
  });

  it('encerrar fecha o socket e não reconecta', () => {
    const { stop } = start();
    stop();
    expect(FakeSocket.instances[0].closed).toBe(true);
    FakeSocket.instances[0].onclose?.();
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('sem WebSocket no ambiente não faz nada', () => {
    const stop = startUserChannel({ buildUrl: () => 'x', onSignal: vi.fn(), WebSocketImpl: undefined });
    expect(typeof stop).toBe('function');
    stop();
  });
});
