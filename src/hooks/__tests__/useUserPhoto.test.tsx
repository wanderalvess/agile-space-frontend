import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchUserBlob = vi.hoisted(() => vi.fn());
const fetchBlob = vi.hoisted(() => vi.fn());
vi.mock('@/lib/user-photo-api', () => ({ userPhotoApi: { fetchUserBlob, fetchBlob } }));

import { useUserPhoto } from '../useUserPhoto';
import { ERROR_TTL_MS, FOUND_TTL_MS, MAX_CONCURRENT, MISSING_TTL_MS, resetUserPhotoCache } from '@/lib/user-photo-cache';
import { resetUploadedPhotoOverrides, setUploadedPhotoOverride } from '@/lib/uploaded-photo-store';

const revoked: string[] = [];

/** Promessa que o teste resolve na hora que quiser (para segurar buscas "em voo"). */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  fetchUserBlob.mockReset();
  fetchBlob.mockReset();
  resetUserPhotoCache();
  resetUploadedPhotoOverrides();
  revoked.length = 0;
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:foto-${++n}`);
  URL.revokeObjectURL = vi.fn((u: string) => {
    revoked.push(u);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe('useUserPhoto', () => {
  it('sem id não busca nada', () => {
    const { result } = renderHook(() => useUserPhoto(undefined));
    expect(result.current).toBeUndefined();
    const vazio = renderHook(() => useUserPhoto('  '));
    expect(vazio.result.current).toBeUndefined();
    expect(fetchUserBlob).not.toHaveBeenCalled();
  });

  it('busca a foto do colega e devolve um blob:', async () => {
    fetchUserBlob.mockResolvedValue(new Blob(['x']));
    const { result } = renderHook(() => useUserPhoto('u1'));
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toBe('blob:foto-1'));
    expect(fetchUserBlob).toHaveBeenCalledWith('u1');
  });

  it('junta chamadas concorrentes da mesma pessoa e divide o blob entre os avatares', async () => {
    const d = deferred<Blob | null>();
    fetchUserBlob.mockReturnValue(d.promise);
    const a = renderHook(() => useUserPhoto('u1'));
    const b = renderHook(() => useUserPhoto('u1'));
    expect(fetchUserBlob).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve(new Blob(['x'])));
    await waitFor(() => expect(a.result.current).toBe('blob:foto-1'));
    expect(b.result.current).toBe('blob:foto-1');
    // Um avatar novo da mesma pessoa já nasce com a foto, sem nova busca.
    const c = renderHook(() => useUserPhoto('u1'));
    expect(c.result.current).toBe('blob:foto-1');
    expect(fetchUserBlob).toHaveBeenCalledTimes(1);
  });

  it('guarda o 404 como "sem foto" e não refaz a cada montagem', async () => {
    fetchUserBlob.mockResolvedValue(null);
    const a = renderHook(() => useUserPhoto('u2'));
    await waitFor(() => expect(fetchUserBlob).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(a.result.current).toBeUndefined();
    a.unmount();

    const b = renderHook(() => useUserPhoto('u2'));
    await act(async () => {});
    expect(b.result.current).toBeUndefined();
    expect(fetchUserBlob).toHaveBeenCalledTimes(1);
    b.unmount();

    // Passado o prazo, pergunta de novo (a pessoa pode ter enviado a foto nesse meio tempo).
    advance(MISSING_TTL_MS + 1);
    fetchUserBlob.mockResolvedValue(new Blob(['x']));
    const c = renderHook(() => useUserPhoto('u2'));
    await waitFor(() => expect(c.result.current).toBe('blob:foto-1'));
    expect(fetchUserBlob).toHaveBeenCalledTimes(2);
  });

  it('falha de rede volta às iniciais, sem insistir a cada render, e tenta de novo depois', async () => {
    fetchUserBlob.mockRejectedValue(new Error('offline'));
    const a = renderHook(() => useUserPhoto('u3'));
    await waitFor(() => expect(fetchUserBlob).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(a.result.current).toBeUndefined();
    a.rerender();
    const b = renderHook(() => useUserPhoto('u3'));
    await act(async () => {});
    expect(b.result.current).toBeUndefined();
    expect(fetchUserBlob).toHaveBeenCalledTimes(1);

    advance(ERROR_TTL_MS + 1);
    fetchUserBlob.mockResolvedValue(new Blob(['x']));
    const c = renderHook(() => useUserPhoto('u3'));
    await waitFor(() => expect(c.result.current).toBe('blob:foto-1'));
  });

  it('limita as buscas simultâneas e libera a fila conforme terminam', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<Blob | null>>>();
    fetchUserBlob.mockImplementation((id: string) => {
      const d = deferred<Blob | null>();
      pending.set(id, d);
      return d.promise;
    });
    const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
    const hooks = ids.map((id) => renderHook(() => useUserPhoto(id)));

    expect(MAX_CONCURRENT).toBe(4);
    expect(fetchUserBlob).toHaveBeenCalledTimes(4);

    await act(async () => pending.get('p0')!.resolve(null));
    await waitFor(() => expect(fetchUserBlob).toHaveBeenCalledTimes(5));
    expect(fetchUserBlob).toHaveBeenLastCalledWith('p4');

    await act(async () => {
      pending.get('p1')!.resolve(null);
      pending.get('p2')!.resolve(null);
    });
    await waitFor(() => expect(fetchUserBlob).toHaveBeenCalledTimes(7));
    hooks.forEach((h) => h.unmount());
  });

  it('quem saiu de cena antes da vez não gera busca', async () => {
    const pending: Array<ReturnType<typeof deferred<Blob | null>>> = [];
    fetchUserBlob.mockImplementation(() => {
      const d = deferred<Blob | null>();
      pending.push(d);
      return d.promise;
    });
    const hooks = Array.from({ length: 6 }, (_, i) => renderHook(() => useUserPhoto(`q${i}`)));
    expect(fetchUserBlob).toHaveBeenCalledTimes(4);
    // q4 e q5 saem (lista rolada) enquanto esperavam na fila.
    hooks[4].unmount();
    hooks[5].unmount();
    await act(async () => pending.forEach((d) => d.resolve(null)));
    await act(async () => {});
    expect(fetchUserBlob).toHaveBeenCalledTimes(4);
    hooks.forEach((h) => h.unmount());
  });

  it('revoga o blob só quando saiu do cache e ninguém mais o usa', async () => {
    fetchUserBlob.mockResolvedValueOnce(new Blob(['a'])).mockResolvedValueOnce(new Blob(['b']));
    const a = renderHook(() => useUserPhoto('u4'));
    await waitFor(() => expect(a.result.current).toBe('blob:foto-1'));

    // Venceu o prazo: um avatar novo revalida e troca a foto do cache, mas o antigo segue em uso.
    advance(FOUND_TTL_MS + 1);
    const b = renderHook(() => useUserPhoto('u4'));
    await waitFor(() => expect(b.result.current).toBe('blob:foto-2'));
    expect(a.result.current).toBe('blob:foto-1');
    expect(revoked).toEqual([]);

    a.unmount();
    expect(revoked).toEqual(['blob:foto-1']);
    b.unmount();
    // O que está no cache fica vivo para o próximo avatar.
    expect(revoked).toEqual(['blob:foto-1']);
  });

  it('reiniciar o cache revoga e descarta busca em andamento sem vazar blob', async () => {
    const d = deferred<Blob | null>();
    fetchUserBlob.mockReturnValue(d.promise);
    renderHook(() => useUserPhoto('u5'));
    resetUserPhotoCache();
    await act(async () => d.resolve(new Blob(['x'])));
    await act(async () => {});
    expect(revoked).toEqual(['blob:foto-1']);
  });

  describe('a própria pessoa', () => {
    it('depois de enviar, usa o caminho novo na hora (sem buscar pelo id)', async () => {
      fetchBlob.mockResolvedValue(new Blob(['novo']));
      const { result } = renderHook(() => useUserPhoto('me'));
      await act(async () => {});
      expect(fetchUserBlob).toHaveBeenCalledTimes(1);

      fetchUserBlob.mockClear();
      await act(async () => setUploadedPhotoOverride('me', '/api/users/me/photo?v=9'));
      await waitFor(() => expect(result.current).toBeDefined());
      expect(fetchBlob).toHaveBeenCalledWith('/api/users/me/photo?v=9');
      expect(fetchUserBlob).not.toHaveBeenCalled();
    });

    it('depois de remover, some na hora', async () => {
      fetchUserBlob.mockResolvedValue(new Blob(['x']));
      const { result } = renderHook(() => useUserPhoto('me'));
      await waitFor(() => expect(result.current).toBe('blob:foto-1'));

      await act(async () => setUploadedPhotoOverride('me', null));
      expect(result.current).toBeUndefined();
    });

    it('a decisão de uma pessoa não vale para outra', async () => {
      setUploadedPhotoOverride('me', null);
      fetchUserBlob.mockResolvedValue(new Blob(['x']));
      const { result } = renderHook(() => useUserPhoto('outra'));
      await waitFor(() => expect(result.current).toBe('blob:foto-1'));
    });
  });
});
