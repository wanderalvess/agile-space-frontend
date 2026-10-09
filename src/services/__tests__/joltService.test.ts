import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import * as authClient from '../../lib/auth-client';

const json = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('joltService: erros do backend', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api');
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('readApiError prefere message, depois error, e esconde HTML/corpos enormes', async () => {
    const { readApiError } = await import('../joltService');
    expect(await readApiError(json(409, { message: 'Alterado por outra pessoa' }), 'Falha')).toBe('Alterado por outra pessoa');
    expect(await readApiError(json(400, { error: 'JSON inválido' }), 'Falha')).toBe('JSON inválido');
    expect(await readApiError(json(502, '<html>bad gateway</html>'), 'Falha')).toBe('Falha (502)');
    expect(await readApiError(json(500, 'x'.repeat(500)), 'Falha')).toBe('Falha (500)');
    expect(await readApiError(json(404, ''), 'Falha')).toBe('Falha (404)');
  });

  it('atualizar projeto mostra a mensagem do servidor (409), não o JSON cru', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(json(409, { status: 409, message: 'Recarregue antes de salvar' }));
    const { updateJoltProject } = await import('../joltService');
    await expect(updateJoltProject('p1', { name: 'x', expectedVersion: 1 })).rejects.toThrow('Recarregue antes de salvar');
  });

  it('excluir projeto de outra pessoa mostra o motivo (403)', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(json(403, { message: 'Só quem criou o projeto pode alterá-lo ou excluí-lo.' }));
    const { deleteJoltProject } = await import('../joltService');
    await expect(deleteJoltProject('p1')).rejects.toThrow('Só quem criou');
  });

  it('executar no Java repassa o erro de entrada recusada', async () => {
    vi.spyOn(authClient, 'authFetch').mockResolvedValue(json(413, { error: 'Payload grande demais (máximo 5 MB).' }));
    const { transformJoltBackend } = await import('../joltService');
    await expect(transformJoltBackend({}, [])).rejects.toThrow('Payload grande demais');
  });
});
