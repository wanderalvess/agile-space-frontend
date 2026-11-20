import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoomPresence } from '../useRoomPresence';

vi.mock('../../lib/auth-client', () => ({ getAuthToken: () => 'tok' }));

const snap = (version: number, online: string[]) => ({ online, total: online.length, version });
const res = (ok: boolean, status: number, body: unknown = {}) => ({ ok, status, json: async () => body }) as unknown as Response;

describe('useRoomPresence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('começa desconhecido (null) e mostra o snapshot na hora', () => {
    const { result } = renderHook(() => useRoomPresence({ module: 'retro', roomId: 'r1' }));
    expect(result.current.online).toBeNull();
    act(() => result.current.bindings.onPresence(snap(1, ['a', 'b'])));
    expect([...result.current.online!]).toEqual(['a', 'b']);
  });

  it('entrada é imediata; saída só some depois de 5 s', () => {
    const { result } = renderHook(() => useRoomPresence({ module: 'retro', roomId: 'r1' }));
    act(() => result.current.bindings.onPresence(snap(1, ['a', 'b'])));
    act(() => result.current.bindings.onPresence(snap(2, ['a', 'b', 'c'])));
    expect(result.current.online!.has('c')).toBe(true);

    act(() => result.current.bindings.onPresence(snap(3, ['a', 'c'])));
    expect(result.current.online!.has('b')).toBe(true);
    act(() => { vi.advanceTimersByTime(4999); });
    expect(result.current.online!.has('b')).toBe(true);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.online!.has('b')).toBe(false);
    expect(result.current.online!.has('c')).toBe(true);
  });

  it('queda curta: voltar dentro de 5 s mantém a pessoa online', () => {
    const { result } = renderHook(() => useRoomPresence({ module: 'poker', roomId: 'p1' }));
    act(() => result.current.bindings.onPresence(snap(1, ['a', 'b'])));
    act(() => result.current.bindings.onPresence(snap(2, ['a'])));
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => result.current.bindings.onPresence(snap(3, ['a', 'b'])));
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(result.current.online!.has('b')).toBe(true);
  });

  it('bindings são estáveis entre renders (não reabrem o socket)', () => {
    const { result, rerender } = renderHook(() => useRoomPresence({ module: 'retro', roomId: 'r1' }));
    const first = result.current.bindings;
    act(() => first.onPresence(snap(1, ['a'])));
    rerender();
    expect(result.current.bindings).toBe(first);
    expect(first.presence).toBe(true);
  });

  it('trocar de sala volta a desconhecido', () => {
    const { result, rerender } = renderHook(({ id }) => useRoomPresence({ module: 'retro', roomId: id }), { initialProps: { id: 'r1' } });
    act(() => result.current.bindings.onPresence(snap(1, ['a'])));
    rerender({ id: 'r2' });
    expect(result.current.online).toBeNull();
  });

  it('fallback REST: aplica a lista quando o socket não entregou snapshot', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(true, 200, { online: ['x', 'y'], total: 2 }));
    const { result } = renderHook(() => useRoomPresence({ module: 'brainstorming', roomId: 'b1', fetchImpl: fetchImpl as unknown as typeof fetch }));
    await act(async () => { result.current.bindings.onPresenceMissing(); });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/presence/brainstorming/b1');
    expect([...result.current.online!]).toEqual(['x', 'y']);
  });

  it('backend antigo (404): presença segue desconhecida, sem erro e sem repetir a chamada', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(false, 404));
    const { result } = renderHook(() => useRoomPresence({ module: 'retro', roomId: 'r1', fetchImpl: fetchImpl as unknown as typeof fetch }));
    await act(async () => { result.current.bindings.onPresenceMissing(); });
    await act(async () => { result.current.bindings.onPresenceMissing(); });
    await act(async () => { result.current.bindings.onPresenceMissing(); });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.current.online).toBeNull();
  });

  it('snapshot do socket vence a resposta atrasada do REST e dispensa a consulta', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const fetchImpl = vi.fn().mockReturnValue(new Promise<Response>((r) => { resolveFetch = r; }));
    const { result } = renderHook(() => useRoomPresence({ module: 'retro', roomId: 'r1', fetchImpl: fetchImpl as unknown as typeof fetch }));
    await act(async () => { result.current.bindings.onPresenceMissing(); });
    act(() => result.current.bindings.onPresence(snap(1, ['socket'])));
    await act(async () => { resolveFetch(res(true, 200, { online: ['rest'], total: 1 })); });
    expect([...result.current.online!]).toEqual(['socket']);

    const fetch2 = vi.fn();
    const { result: r2 } = renderHook(() => useRoomPresence({ module: 'retro', roomId: 'r2', fetchImpl: fetch2 as unknown as typeof fetch }));
    act(() => r2.current.bindings.onPresence(snap(1, ['a'])));
    await act(async () => { r2.current.bindings.onPresenceMissing(); });
    expect(fetch2).not.toHaveBeenCalled();
  });
});
