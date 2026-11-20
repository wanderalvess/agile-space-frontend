import { beforeEach, describe, expect, it, vi } from 'vitest';

const { embedText, FakeBusy } = vi.hoisted(() => ({
  embedText: vi.fn(),
  FakeBusy: class FakeBusy extends Error {},
}));

vi.mock('../embeddings', () => ({ embedText: (...a: unknown[]) => embedText(...a), EmbeddingBusyError: FakeBusy }));
vi.mock('../verify-auth', () => ({ requireAuth: vi.fn(async () => ({ uid: 'u1' })) }));
vi.mock('../rate-limit', () => ({ checkRateLimit: vi.fn(() => true) }));

import { POST } from '../../app/api/knowledge/embed/route';

const req = (body: unknown) =>
  new Request('http://localhost/api/knowledge/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];

describe('POST /api/knowledge/embed', () => {
  beforeEach(() => { embedText.mockReset(); });

  it('devolve o vetor quando tudo certo', async () => {
    embedText.mockResolvedValue([0.1, 0.2]);
    const res = await POST(req({ text: 'olá' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ embedding: [0.1, 0.2] });
  });

  it('responde 503 com Retry-After quando a fila de embedding está cheia', async () => {
    embedText.mockImplementation(async () => { throw new FakeBusy(); });
    const res = await POST(req({ text: 'olá' }));
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
  });

  it('segue respondendo 500 para falhas inesperadas', async () => {
    embedText.mockImplementation(async () => { throw new Error('boom'); });
    const res = await POST(req({ text: 'olá' }));
    expect(res.status).toBe(500);
  });

  it('valida o corpo antes de gerar o vetor', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(embedText).not.toHaveBeenCalled();
  });
});
