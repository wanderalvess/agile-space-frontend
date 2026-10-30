import { beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-client', () => ({ authFetch }));

import { userPhotoApi } from '../user-photo-api';

beforeEach(() => authFetch.mockReset());

describe('userPhotoApi.fetchUserBlob (foto de qualquer pessoa)', () => {
  it('pede /users/{id}/photo revalidando pelo ETag e devolve os bytes', async () => {
    const blob = new Blob(['x']);
    authFetch.mockResolvedValue({ ok: true, status: 200, blob: async () => blob });
    await expect(userPhotoApi.fetchUserBlob('ana/1')).resolves.toBe(blob);
    const [url, init] = authFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/users\/ana%2F1\/photo$/);
    expect(init).toEqual({ cache: 'no-cache' });
  });

  it('404 é "sem foto" (null), sem erro', async () => {
    authFetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(userPhotoApi.fetchUserBlob('u1')).resolves.toBeNull();
  });

  it('outros erros viram exceção (o cache trata como falha curta)', async () => {
    authFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(userPhotoApi.fetchUserBlob('u1')).rejects.toThrow();
  });
});
