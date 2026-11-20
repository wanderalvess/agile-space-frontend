import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchBlob = vi.hoisted(() => vi.fn());
vi.mock('@/lib/user-photo-api', () => ({ userPhotoApi: { fetchBlob } }));

import { __resetUploadedPhotoCache, useUploadedPhoto } from '../useUploadedPhoto';

const revoked: string[] = [];

beforeEach(() => {
  fetchBlob.mockReset();
  __resetUploadedPhotoCache();
  revoked.length = 0;
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:foto-${++n}`);
  URL.revokeObjectURL = vi.fn((u: string) => {
    revoked.push(u);
  });
  // o reset acima revoga o cache anterior; zera o registro depois
  revoked.length = 0;
});

describe('useUploadedPhoto', () => {
  it('sem caminho não busca nada', () => {
    const { result } = renderHook(() => useUploadedPhoto(null));
    expect(result.current).toEqual({ loading: false, failed: false });
    expect(fetchBlob).not.toHaveBeenCalled();
  });

  it('busca os bytes e devolve um blob:', async () => {
    fetchBlob.mockResolvedValue(new Blob(['x']));
    const { result } = renderHook(() => useUploadedPhoto('/api/users/u1/photo?v=1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.url).toBe('blob:foto-1'));
  });

  it('divide o cache entre avatares e revoga só quando o último sai', async () => {
    fetchBlob.mockResolvedValue(new Blob(['x']));
    const a = renderHook(() => useUploadedPhoto('/p?v=1'));
    const b = renderHook(() => useUploadedPhoto('/p?v=1'));
    await waitFor(() => expect(a.result.current.url).toBe('blob:foto-1'));
    await waitFor(() => expect(b.result.current.url).toBe('blob:foto-1'));
    expect(fetchBlob).toHaveBeenCalledTimes(1);
    a.unmount();
    expect(revoked).toEqual([]);
    b.unmount();
    expect(revoked).toEqual(['blob:foto-1']);
  });

  it('troca de caminho busca de novo e 404 vira falha', async () => {
    fetchBlob.mockResolvedValueOnce(new Blob(['x'])).mockResolvedValueOnce(null);
    const { result, rerender } = renderHook(({ p }) => useUploadedPhoto(p), { initialProps: { p: '/p?v=1' } });
    await waitFor(() => expect(result.current.url).toBe('blob:foto-1'));
    rerender({ p: '/p?v=2' });
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(revoked).toContain('blob:foto-1');
  });
});
