import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../DocumentHistory', () => ({
  DocumentHistory: ({ documentId }: { documentId: string }) => <div data-testid="history">histórico de {documentId}</div>,
}));
vi.mock('../../../lib/copy-to-clipboard', () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }));

import { ArticleReader, type ArticleReaderProps } from '../ArticleReader';
import { copyToClipboard } from '../../../lib/copy-to-clipboard';
import type { KnowledgeDocument } from '../../../lib/knowledge-types';

const content =
  '<h2>Visão geral</h2><p>Texto <strong>importante</strong>.</p>' +
  '<img src="x.png" onerror="alert(1)">' +
  '<h2>Exemplo de chamada</h2><pre class="wiki-code-block"><code class="language-json">{"a": 1}</code></pre>' +
  '<h3>Detalhe</h3><table><tr><td>a</td></tr></table>' +
  '<script>window.hacked = true</script>';

const baseDoc: KnowledgeDocument = {
  id: 'd1',
  title: 'API de Pedidos',
  content,
  category: 'Técnico',
  status: 'published',
  authorId: 'u1',
  tags: ['TDN', 'PTV', 'api'],
  tdnId: '777',
  byteSize: 14541,
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  canEdit: true,
};

function setup(over: Partial<ArticleReaderProps> = {}, docOver: Partial<KnowledgeDocument> = {}) {
  const props: ArticleReaderProps = {
    document: { ...baseDoc, ...docOver },
    isFavorite: false,
    onToggleFavorite: vi.fn(),
    onBack: vi.fn(),
    onSync: vi.fn(),
    isSyncing: false,
    onExport: vi.fn(),
    onEdit: vi.fn(),
    tdnBaseUrl: 'tdn.totvs.com',
    onRestored: vi.fn(),
    ...over,
  };
  return { props, ...render(<ArticleReader {...props} />) };
}

beforeEach(() => vi.clearAllMocks());

describe('ArticleReader', () => {
  it('mostra título sólido, caminho e metadados sem o rótulo "Sync:"', () => {
    setup();
    const h1 = screen.getByRole('heading', { level: 1, name: 'API de Pedidos' });
    expect(h1.className).not.toMatch(/italic|uppercase|font-black/);
    expect(screen.getByRole('navigation', { name: 'Caminho' })).toBeTruthy();
    expect(screen.getByRole('article')).toBeTruthy();
    expect(screen.queryByText(/Sync:/)).toBeNull();
    expect(screen.getAllByText(/Leitura de 1 min/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('14,2 KB').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Atualizado há/).length).toBeGreaterThan(0);
  });

  it('breadcrumb volta à lista; favoritar, exportar e editar chamam os callbacks', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Base de Conhecimento' }));
    expect(props.onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Favoritar artigo' }));
    expect(props.onToggleFavorite).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Exportar/ }));
    expect(props.onExport).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Editar/ }));
    expect(props.onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sincronizar com o TDN/ }));
    expect(props.onSync).toHaveBeenCalled();
  });

  it('favorito marcado vira aria-pressed', () => {
    setup({ isFavorite: true });
    expect(screen.getByRole('button', { name: 'Remover dos favoritos' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('sem tdnId não há sincronizar nem aviso do TDN; sem canEdit não há Editar', () => {
    setup({}, { tdnId: undefined, canEdit: false, tags: ['api'] });
    expect(screen.queryByRole('button', { name: /Sincronizar/ })).toBeNull();
    expect(screen.queryByText(/Importado do TDN/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.getAllByText('Escrito no portal').length).toBeGreaterThan(0);
  });

  it('artigo do TDN mostra o aviso e o link "Abrir original" montado com a URL base', () => {
    setup();
    const link = screen.getByRole('link', { name: /Abrir original/ });
    expect(link.getAttribute('href')).toBe('https://tdn.totvs.com/pages/viewpage.action?pageId=777');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('sem URL base do TDN não inventa o link', () => {
    setup({ tdnBaseUrl: '' });
    expect(screen.getAllByText(/Importado do TDN/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Abrir original/ })).toBeNull();
  });

  it('enquanto sincroniza, o botão fica desabilitado', () => {
    setup({ isSyncing: true });
    expect((screen.getByRole('button', { name: /Sincronizando/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('gera o sumário a partir de H1-H3 com ids e rola ao clicar', () => {
    setup();
    const toc = screen.getAllByRole('navigation', { name: 'Nesta página' })[0];
    const entries = within(toc).getAllByRole('button').map((b) => b.textContent);
    expect(entries).toEqual(['Visão geral', 'Exemplo de chamada', 'Detalhe']);
    expect(document.getElementById('kb-visao-geral')?.tagName).toBe('H2');
    expect(document.getElementById('kb-detalhe')?.tagName).toBe('H3');
    fireEvent.click(within(toc).getByRole('button', { name: 'Detalhe' }));
    expect(within(toc).getByRole('button', { name: 'Detalhe' }).getAttribute('aria-current')).toBe('location');
  });

  it('sanitiza o HTML e não usa white-space pre-wrap no corpo', () => {
    const { container } = setup();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect((window as unknown as { hacked?: boolean }).hacked).toBeUndefined();
    const body = container.querySelector('.kb-article') as HTMLElement;
    expect(body).toBeTruthy();
    expect(body.className).not.toContain('whitespace-pre-wrap');
    expect(body.className).toContain('prose');
  });

  it('bloco de código ganha botão Copiar que copia só o texto do código', async () => {
    const { container } = setup();
    const button = container.querySelector('button[data-kb-copy]') as HTMLButtonElement;
    expect(button).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() => expect(copyToClipboard).toHaveBeenCalledWith('{"a": 1}'));
    await waitFor(() => expect(button.textContent).toBe('Copiado'));
    expect(container.querySelector('.kb-table-wrap table')).not.toBeNull();
  });

  it('abas Documento/Histórico: troca de painel e mantém o DocumentHistory', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Documento', 'Histórico']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tabs[1]);
    expect(screen.getByTestId('history').textContent).toContain('d1');
    expect(screen.queryByRole('article')).toBeNull();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(screen.getByRole('article')).toBeTruthy();
  });

  it('artigo vazio mostra aviso em vez de "Carregando"', () => {
    setup({}, { content: '' });
    expect(screen.getByText('Este artigo ainda não tem conteúdo.')).toBeTruthy();
  });

  it('sem títulos no texto não renderiza sumário', () => {
    setup({}, { content: '<p>só texto</p>' });
    expect(screen.queryByRole('navigation', { name: 'Nesta página' })).toBeNull();
  });
});
