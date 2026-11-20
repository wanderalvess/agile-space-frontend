import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authClient from '../../lib/auth-client';
import { readApiError, transformJoltBackend } from '../joltService';

const json = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('joltService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('readApiError prefere message, depois error, e esconde HTML/corpos enormes', async () => {
    expect(await readApiError(json(409, { message: 'Alterado por outra pessoa' }), 'Falha')).toBe('Alterado por outra pessoa');
    expect(await readApiError(json(400, { error: 'JSON inválido' }), 'Falha')).toBe('JSON inválido');
    expect(await readApiError(json(502, '<html>bad gateway</html>'), 'Falha')).toBe('Falha (502)');
    expect(await readApiError(json(500, 'x'.repeat(500)), 'Falha')).toBe('Falha (500)');
    expect(await readApiError(json(404, ''), 'Falha')).toBe('Falha (404)');
  });

  it('a execução vai pelo authFetch (com o token da sessão), só com entrada e spec', async () => {
    const spy = vi.spyOn(authClient, 'authFetch').mockResolvedValue(json(200, { success: true, output: { a: 1 }, executionTimeMs: 12 }));
    const result = await transformJoltBackend({ x: 1 }, [{ operation: 'shift', spec: {} }]);
    expect(result).toEqual({ success: true, output: { a: 1 }, executionTimeMs: 12 });
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toMatch(/\/jolt\/transform$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ input: { x: 1 }, spec: [{ operation: 'shift', spec: {} }] });
  });

  it('repassa o sinal de cancelamento', async () => {
    const spy = vi.spyOn(authClient, 'authFetch').mockResolvedValue(json(200, { success: true, output: null, executionTimeMs: 1 }));
    const controller = new AbortController();
    await transformJoltBackend({}, [], controller.signal);
    expect(spy.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('sem login (401) a mensagem manda entrar de novo', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(json(401, { error: 'Token de autenticação ausente' }));
    await expect(transformJoltBackend({}, [])).rejects.toThrow('Entre de novo');
  });

  it('repassa o erro de entrada recusada', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(json(413, { error: 'Payload grande demais (máximo 5 MB).' }));
    await expect(transformJoltBackend({}, [])).rejects.toThrow('Payload grande demais');
  });
});
