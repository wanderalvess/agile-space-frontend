import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/verify-auth', () => ({ requireAuth: vi.fn(async () => ({ uid: 'u1' })) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn(() => true) }));

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/verify-auth';
import { POST } from '../route';

const fetchMock = vi.fn();

function call(body: Record<string, unknown>) {
  return POST(new NextRequest('http://localhost/api/jira/testcase', { method: 'POST', body: JSON.stringify(body) }));
}

// IP literal público: o guarda não precisa de DNS, então o teste não depende de rede.
const PUBLIC_HOST = '93.184.216.34';
const base = { testCaseKey: 'PROJ-T123', pat: 'token-de-teste', domain: PUBLIC_HOST };

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ key: 'PROJ-T123' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(requireAuth).mockResolvedValue({ uid: 'u1' } as never);
});
afterEach(() => vi.unstubAllGlobals());

describe('POST /api/jira/testcase: SSRF', () => {
  it.each([
    ['metadata de nuvem', '169.254.169.254'],
    ['rede privada 10.x', '10.0.0.5'],
    ['rede privada 192.168.x', '192.168.1.10'],
    ['loopback', '127.0.0.1'],
    ['localhost', 'localhost'],
    ['localhost com porta do backend', 'localhost:8002'],
  ])('recusa %s e nunca chama o destino', async (_nome, domain) => {
    const res = await call({ ...base, domain });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['caminho', `${PUBLIC_HOST}/rest/api/2/serverInfo?x=`],
    ['usuário@host', `admin@${PUBLIC_HOST}`],
    ['query', `${PUBLIC_HOST}?a=b`],
  ])('recusa domínio com %s (troca o destino da chamada)', async (_nome, domain) => {
    const res = await call({ ...base, domain });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['../../etc', 'PROJ-T1/../../x', 'A B', 'PROJ-T1?x=1', 'a'.repeat(65)])('recusa a chave %j', async (testCaseKey) => {
    const res = await call({ ...base, testCaseKey });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('com domínio e chave válidos chama só o host informado, sem seguir redirecionamento', async () => {
    const res = await call(base);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ key: 'PROJ-T123' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://${PUBLIC_HOST}/rest/atm/1.0/testcase/PROJ-T123`);
    expect(init.redirect).toBe('error');
    expect(init.headers.Authorization).toBe('Bearer token-de-teste');
  });

  it('sem login responde 401 e não chama nada', async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await call(base);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('corta o texto que volta do Jira quando não é JSON', async () => {
    fetchMock.mockResolvedValue(new Response('x'.repeat(5000), { status: 502 }));
    const res = await call(base);
    expect(res.status).toBe(502);
    expect(((await res.json()).error as string).length).toBeLessThan(400);
  });
});
