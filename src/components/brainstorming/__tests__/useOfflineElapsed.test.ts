import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineElapsed } from '../useOfflineElapsed';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useOfflineElapsed', () => {
  it('só conta enquanto está fora e zera ao voltar', () => {
    const { result, rerender } = renderHook(({ offline }) => useOfflineElapsed(offline, 'fac', 60_000), { initialProps: { offline: false } });
    expect(result.current).toBe(0);
    rerender({ offline: true });
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(result.current).toBe(5_000);
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current).toBe(15_000);
    rerender({ offline: false });
    expect(result.current).toBe(0);
  });

  it('para de atualizar ao chegar no limite (a tela não re-renderiza à toa)', () => {
    const { result } = renderHook(() => useOfflineElapsed(true, 'fac', 3_000));
    act(() => { vi.advanceTimersByTime(3_000); });
    expect(result.current).toBe(3_000);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(result.current).toBe(3_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('trocar o facilitador recomeça a contagem', () => {
    const { result, rerender } = renderHook(({ key }) => useOfflineElapsed(true, key, 60_000), { initialProps: { key: 'a' } });
    act(() => { vi.advanceTimersByTime(20_000); });
    expect(result.current).toBe(20_000);
    rerender({ key: 'b' });
    expect(result.current).toBe(0);
  });
});
