import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock('../auth-client', () => ({ authFetch: (...a: unknown[]) => h.authFetch(...a) }));

import { createLayout, deleteLayout, importLocalLayouts, listLayouts, updateLayout } from '../jolt-layouts-api';
import { layoutsKey, readLayouts, writeLayouts } from '../jolt-storage';

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const api = (over: Record<string, unknown> = {}) => ({
  id: 'p1', name: 'Pedido', apiUrl: 'https://x', specJson: '[]', inputJson: '{}', authorId: 'u1', authorName: 'Ana', version: 2, updatedAt: '2026-11-24T10:00:00', ...over,
});

beforeEach(() => {
  localStorage.clear();
  h.authFetch.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('layouts do Jolt no servidor', () => {
  it('lista só os layouts da própria pessoa e converte para o formato da tela', async () => {
    h.authFetch.mockResolvedValueOnce(ok([api(), api({ id: 'p2', authorId: 'outra' })]));
    const list = await listLayouts('u1');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'p1', name: 'Pedido', apiUrl: 'https://x', joltSpec: '[]', lastInput: '{}', version: 2 });
  });

  it('cria como projeto privado, com a URL de origem', async () => {
    h.authFetch.mockResolvedValueOnce(ok(api({ id: 'novo' }), 201));
    await createLayout({ name: 'Pedido', apiUrl: 'https://x', joltSpec: '[]', lastInput: '{}' });
    const [url, init] = h.authFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/jolt\/projects$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ name: 'Pedido', apiUrl: 'https://x', specJson: '[]', inputJson: '{}', isPublic: false });
  });

  it('atualiza mandando a versão carregada; 409 vira a mensagem do servidor', async () => {
    h.authFetch.mockResolvedValueOnce(ok({ message: 'Recarregue antes de salvar.' }, 409));
    await expect(updateLayout('p1', { name: 'A', apiUrl: '', joltSpec: '[]', lastInput: '{}' }, 2)).rejects.toThrow('Recarregue antes de salvar.');
    expect(JSON.parse(h.authFetch.mock.calls[0][1].body).expectedVersion).toBe(2);
  });

  it('exclui pelo id', async () => {
    h.authFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await deleteLayout('p1');
    expect(String(h.authFetch.mock.calls[0][0])).toMatch(/\/jolt\/projects\/p1$/);
    expect(h.authFetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('importa os layouts do navegador uma vez e só então apaga a cópia local', async () => {
    writeLayouts('u1', [
      { id: 'a', name: 'A', apiUrl: '', joltSpec: '[]', lastInput: '{}', updatedAt: '' },
      { id: 'b', name: 'B', apiUrl: '', joltSpec: '[]', lastInput: '{}', updatedAt: '' },
    ]);
    h.authFetch.mockImplementation(async () => ok(api(), 201)); // uma resposta nova por chamada: o corpo só lê uma vez
    expect(await importLocalLayouts('u1')).toBe(2);
    expect(h.authFetch).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(layoutsKey('u1'))).toBeNull();
  });

  it('se um envio falha, só os que faltam ficam no navegador (os enviados não duplicam depois)', async () => {
    writeLayouts('u1', [
      { id: 'a', name: 'A', apiUrl: '', joltSpec: '[]', lastInput: '{}', updatedAt: '' },
      { id: 'b', name: 'B', apiUrl: '', joltSpec: '[]', lastInput: '{}', updatedAt: '' },
    ]);
    h.authFetch.mockResolvedValueOnce(ok(api(), 201)).mockResolvedValueOnce(ok({ message: 'x' }, 500));
    expect(await importLocalLayouts('u1')).toBe(1);
    expect(readLayouts('u1').map((l) => l.id)).toEqual(['b']);
  });

  it('sem layouts locais não chama o servidor', async () => {
    expect(await importLocalLayouts('u1')).toBe(0);
    expect(h.authFetch).not.toHaveBeenCalled();
  });
});
