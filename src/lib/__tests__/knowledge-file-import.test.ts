import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth-client', () => ({ authFetch: vi.fn() }));

import { authFetch } from '../auth-client';
import { importArticleFile, importKindOf, titleFromFileName } from '../knowledge-file-import';

const fetchMock = authFetch as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

beforeEach(() => fetchMock.mockReset());

describe('importKindOf', () => {
  it('reconhece os formatos aceitos pelo nome ou pelo tipo', () => {
    expect(importKindOf({ name: 'Guia.DOCX', type: '' })).toBe('docx');
    expect(importKindOf({ name: 'x', type: 'application/pdf' })).toBe('pdf');
    expect(importKindOf({ name: 'notas.md', type: '' })).toBe('markdown');
    expect(importKindOf({ name: 'notas.txt', type: 'text/plain' })).toBe('text');
    expect(importKindOf({ name: 'dados.json', type: '' })).toBe('text');
    expect(importKindOf({ name: 'foto.png', type: 'image/png' })).toBeNull();
  });
});

describe('titleFromFileName', () => {
  it('tira só a extensão final', () => {
    expect(titleFromFileName('Guia de API.v2.docx')).toBe('Guia de API.v2');
    expect(titleFromFileName('README')).toBe('README');
  });
});

describe('importArticleFile', () => {
  it('Word usa o html sanitizado do servidor', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ text: 'Título', html: '<h1>Título</h1><img src=x onerror=alert(1)>' }));
    const file = new File(['x'], 'Guia.docx');
    const result = await importArticleFile(file);
    expect(fetchMock).toHaveBeenCalledWith('/api/knowledge/ingest-pdf', expect.objectContaining({ method: 'POST' }));
    expect(result.html).toContain('<h1>Título</h1>');
    expect(result.html).not.toContain('onerror');
    expect(result.title).toBe('Guia');
  });

  it('PDF sem html cai no texto puro em parágrafos', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ text: 'linha 1\n\nlinha <2>' }));
    const result = await importArticleFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    expect(result.html).toBe('<p>linha 1</p><p>linha &lt;2&gt;</p>');
  });

  it('erro do servidor vira mensagem; sem texto também', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Arquivo grande demais' }, false, 413));
    await expect(importArticleFile(new File(['x'], 'a.docx'))).rejects.toThrow('Arquivo grande demais');
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: '' }));
    await expect(importArticleFile(new File(['x'], 'a.docx'))).rejects.toThrow('Não encontramos texto neste arquivo.');
  });

  it('Markdown vira HTML (título e lista)', async () => {
    const result = await importArticleFile(new File(['# Guia\n\n- um\n- dois\n'], 'guia.md'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.html).toContain('<h1');
    expect(result.html).toContain('<li>');
  });

  it('texto simples vira parágrafos, sem passar pelo servidor', async () => {
    const result = await importArticleFile(new File(['um\ndois\n\ntrês'], 'n.txt'));
    expect(result.html).toBe('<p>um<br>dois</p><p>três</p>');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recusa formato desconhecido e arquivo vazio', async () => {
    await expect(importArticleFile(new File(['x'], 'foto.png', { type: 'image/png' }))).rejects.toThrow('Formato não aceito');
    await expect(importArticleFile(new File(['   '], 'vazio.txt'))).rejects.toThrow('O arquivo está vazio.');
  });
});
