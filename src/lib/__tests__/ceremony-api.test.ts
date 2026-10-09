import { describe, expect, it } from 'vitest';
import { CeremonyApiError, ensureOk, errorMessage } from '../ceremony-api';

function response(status: number, body?: unknown, asText = false) {
  const text = body === undefined ? '' : asText ? String(body) : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as Response;
}

describe('ensureOk', () => {
  it('não lança em 2xx', async () => {
    await expect(ensureOk(response(200), 'x')).resolves.toBeUndefined();
    await expect(ensureOk(response(204), 'x')).resolves.toBeUndefined();
  });

  it('usa a mensagem do servidor nos 4xx (já em português)', async () => {
    const error = await ensureOk(response(403, { message: 'Apenas o facilitador pode alterar a sessão.' }), 'padrão').catch(e => e);
    expect(error).toBeInstanceOf(CeremonyApiError);
    expect(error.status).toBe(403);
    expect(error.message).toBe('Apenas o facilitador pode alterar a sessão.');
  });

  it('aceita texto puro curto, mas ignora HTML e corpo ilegível', async () => {
    expect((await ensureOk(response(400, 'Texto inválido', true), 'padrão').catch(e => e)).message).toBe('Texto inválido');
    expect((await ensureOk(response(404, '<html>erro</html>', true), 'padrão').catch(e => e)).message).toBe('padrão');
    const unreadable = { ok: false, status: 400, text: async () => { throw new Error('boom'); } } as unknown as Response;
    expect((await ensureOk(unreadable, 'padrão').catch(e => e)).message).toBe('padrão');
  });

  it('5xx usa o texto padrão (sem vazar stack ou JSON cru)', async () => {
    const error = await ensureOk(response(500, { message: 'java.lang.NullPointerException' }), 'Falha ao salvar').catch(e => e);
    expect(error.status).toBe(500);
    expect(error.message).toBe('Falha ao salvar');
  });
});

describe('errorMessage', () => {
  it('devolve a mensagem do servidor ou o texto padrão', () => {
    expect(errorMessage(new CeremonyApiError('Radar já encerrado.', 409), 'padrão')).toBe('Radar já encerrado.');
    expect(errorMessage(new Error('rede'), 'padrão')).toBe('padrão');
    expect(errorMessage(undefined, 'padrão')).toBe('padrão');
  });
});
