import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingRoster } from '@/services/onboardingService';

const search = vi.fn();
vi.mock('../../services/onboardingService', () => ({ onboardingService: { search: (...a: unknown[]) => search(...a) } }));

import { SEARCH_DEBOUNCE_MS, useSquadSearch } from '../useSquadSearch';

const roster = (projectId: string) => ({ projectId, projectName: projectId, memberCount: 3, members: [] }) as OnboardingRoster;

async function type(result: { current: ReturnType<typeof useSquadSearch> }, text: string) {
  act(() => result.current.setQuery(text));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10);
  });
}

describe('useSquadSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    search.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('começa ocioso e pede ao menos 2 letras sem consultar o servidor', async () => {
    const { result } = renderHook(() => useSquadSearch(true));
    expect(result.current.phase).toBe('idle');
    await type(result, 'd');
    expect(result.current.phase).toBe('idle');
    expect(search).not.toHaveBeenCalled();
  });

  it('mostra "buscando" já na digitação e depois os resultados', async () => {
    search.mockResolvedValue([roster('DDWMISSI')]);
    const { result } = renderHook(() => useSquadSearch(true));
    act(() => result.current.setQuery('ddw'));
    expect(result.current.phase).toBe('loading');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10);
    });
    expect(search).toHaveBeenCalledWith('ddw');
    expect(result.current.phase).toBe('ok');
    expect(result.current.results.map((r) => r.projectId)).toEqual(['DDWMISSI']);
    expect(result.current.searchedText).toBe('ddw');
  });

  it('sem resultado é "empty"', async () => {
    search.mockResolvedValue([]);
    const { result } = renderHook(() => useSquadSearch(true));
    await type(result, 'xyzw');
    expect(result.current.phase).toBe('empty');
    expect(result.current.searchedText).toBe('xyzw');
  });

  it('falha de rede é "error" (não "empty") e "tentar de novo" consulta outra vez', async () => {
    search.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useSquadSearch(true));
    await type(result, 'ddw');
    expect(result.current.phase).toBe('error');

    search.mockResolvedValueOnce([roster('DDWMISSI')]);
    await act(async () => {
      result.current.retry();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('ok');
  });

  it('descarta a resposta antiga quando a busca mudou', async () => {
    let resolveFirst: (v: OnboardingRoster[]) => void = () => {};
    search.mockImplementationOnce(() => new Promise<OnboardingRoster[]>((r) => (resolveFirst = r)));
    search.mockResolvedValueOnce([roster('NOVA')]);
    const { result } = renderHook(() => useSquadSearch(true));
    await type(result, 'ant');
    await type(result, 'nov');
    expect(result.current.results.map((r) => r.projectId)).toEqual(['NOVA']);
    await act(async () => {
      resolveFirst([roster('ANTIGA')]);
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.results.map((r) => r.projectId)).toEqual(['NOVA']);
  });

  it('inativo (fora do passo de busca) não consulta', async () => {
    const { result } = renderHook(() => useSquadSearch(false));
    await type(result, 'ddw');
    expect(search).not.toHaveBeenCalled();
  });
});
