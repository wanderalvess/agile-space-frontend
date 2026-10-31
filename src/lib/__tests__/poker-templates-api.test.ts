import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authFetch = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authFetch: (...a: unknown[]) => authFetch(...a) }));

import { importLocalTemplates, pokerTemplatesApi } from '../poker-templates-api';
import { listTemplates, saveTemplate } from '../poker-templates';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  localStorage.clear();
  authFetch.mockReset();
});
afterEach(() => localStorage.clear());

describe('pokerTemplatesApi', () => {
  it('lista da squad e normaliza settings/backlog ausentes', async () => {
    authFetch.mockResolvedValue(json([{ id: 't1', name: 'Refino', deckType: 'hours', settings: null, backlog: null, createdAt: '2026-10-30T10:00:00' }]));
    const list = await pokerTemplatesApi.list('DDW MISSI');
    expect(authFetch.mock.calls[0][0]).toMatch(/\/squads\/DDW%20MISSI\/poker-templates$/);
    expect(list[0].settings).toEqual({});
    expect(list[0].backlog).toEqual([]);
  });

  it('erro do servidor vira mensagem legível', async () => {
    authFetch.mockResolvedValue(json({ message: 'Só quem salvou o template ou a liderança da squad pode alterá-lo.' }, 403));
    await expect(pokerTemplatesApi.remove('DDW', 't1')).rejects.toMatchObject({ status: 403, message: expect.stringContaining('Só quem salvou') });
  });
});

describe('importLocalTemplates', () => {
  it('envia cada template do navegador e tira do navegador só os aceitos', async () => {
    saveTemplate({ name: 'Antigo', deckType: 'hours', settings: {}, backlog: [] });
    saveTemplate({ name: 'Novo', deckType: 'fibonacci', settings: {}, backlog: [{ title: 'T1' }] });
    // Mais antigo primeiro: "Antigo" é aceito, "Novo" falha.
    authFetch
      .mockResolvedValueOnce(json({ id: 's1', name: 'Antigo', deckType: 'hours', settings: {}, backlog: [] }, 201))
      .mockResolvedValueOnce(json({ message: 'falhou' }, 500));

    const result = await importLocalTemplates('DDW');

    expect(result).toEqual({ imported: 1, failed: 1 });
    expect(JSON.parse(authFetch.mock.calls[0][1].body).name).toBe('Antigo');
    expect(listTemplates().map((t) => t.name)).toEqual(['Novo']);
  });
});
