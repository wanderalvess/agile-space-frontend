import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  search: { current: '' },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  auth: { session: { id: 'u1', name: 'Ana Souza' } },
  api: { listDocuments: vi.fn(), getDocumentById: vi.fn(), setDocumentStatus: vi.fn(), deleteDocument: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(h.search.current),
}));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('../../../../hooks/useTdnSettings', () => ({ useTdnSettings: () => ({ settings: null }) }));
vi.mock('../../api', () => ({ knowledgeApi: h.api }));
vi.mock('../../../../services/tdnService', () => ({ getTdnPageContent: vi.fn(), importTdnToKnowledgeBase: vi.fn(), parseConfluenceMacros: vi.fn() }));
vi.mock('../../../../components/knowledge/TdnImportDialog', () => ({ TdnImportDialog: () => null }));
vi.mock('../../../../components/shared/ModuleIntegrationDialog', () => ({ ModuleIntegrationButton: () => null }));
vi.mock('../../../../components/knowledge/DocumentHistory', () => ({ DocumentHistory: () => null }));

import KBExplorerPage from '../page';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver = globalThis.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});

beforeEach(() => {
  vi.clearAllMocks();
  h.search.current = '';
  h.api.listDocuments.mockResolvedValue({ content: [] });
});
afterEach(() => cleanup());

const doc = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  title: 'API de Pedidos',
  category: 'Técnico',
  fullPath: 'Plataforma',
  content: '<p>texto</p>',
  status: 'published',
  authorId: 'u1',
  byteSize: 10,
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  canEdit: true,
  ...over,
});

describe('Base de Conhecimento: Publicados, Meus rascunhos e Arquivados', () => {
  it('abre em "Publicados" sem filtro de estado e só pede ao servidor o que ele já entrega por padrão', async () => {
    h.api.listDocuments.mockResolvedValue({ content: [doc()] });
    render(<KBExplorerPage />);
    expect(await screen.findByText('API de Pedidos')).toBeTruthy();
    expect(h.api.listDocuments).toHaveBeenCalledWith(undefined, undefined, 0, 200, undefined);
    const group = screen.getByRole('group', { name: 'Estado dos artigos' });
    expect(group.querySelector('[aria-pressed="true"]')?.textContent).toBe('Publicados');
    expect(screen.getByText('Artigos ativos')).toBeTruthy();
  });

  it('"Meus rascunhos" e "Arquivados" mandam ?status= e mostram o selo na linha', async () => {
    render(<KBExplorerPage />);
    await waitFor(() => expect(h.api.listDocuments).toHaveBeenCalledTimes(1));

    h.api.listDocuments.mockResolvedValue({ content: [doc({ id: 'r1', title: 'Ideia solta', status: 'draft' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Meus rascunhos' }));
    expect(await screen.findByText('Ideia solta')).toBeTruthy();
    expect(h.api.listDocuments).toHaveBeenLastCalledWith(undefined, undefined, 0, 200, 'draft');
    expect(screen.getByText('Rascunho', { selector: 'span' })).toBeTruthy();

    h.api.listDocuments.mockResolvedValue({ content: [doc({ id: 'a1', title: 'Guia antigo', status: 'archived' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Arquivados' }));
    expect(await screen.findByText('Guia antigo')).toBeTruthy();
    expect(h.api.listDocuments).toHaveBeenLastCalledWith(undefined, undefined, 0, 200, 'archived');
    expect(screen.getByText('Arquivado', { selector: 'span' })).toBeTruthy();
  });

  it('visões vazias explicam o que fazer', async () => {
    render(<KBExplorerPage />);
    await waitFor(() => expect(h.api.listDocuments).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Meus rascunhos' }));
    expect(await screen.findByText(/Você não tem rascunhos/)).toBeTruthy();
  });

  it('em "Arquivados", quem edita restaura para publicado direto da linha', async () => {
    render(<KBExplorerPage />);
    await waitFor(() => expect(h.api.listDocuments).toHaveBeenCalledTimes(1));
    const archived = doc({ id: 'a1', title: 'Guia antigo', status: 'archived' });
    h.api.listDocuments.mockResolvedValue({ content: [archived] });
    h.api.setDocumentStatus.mockResolvedValue({ ...archived, status: 'published' });
    fireEvent.click(screen.getByRole('button', { name: 'Arquivados' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar Guia antigo' }));
    await waitFor(() => expect(h.api.setDocumentStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'published'));
    expect(h.toast.success).toHaveBeenCalledWith('Artigo restaurado e publicado.');
  });

  it('sem permissão de edição não há "Restaurar" na linha de arquivado', async () => {
    render(<KBExplorerPage />);
    await waitFor(() => expect(h.api.listDocuments).toHaveBeenCalledTimes(1));
    h.api.listDocuments.mockResolvedValue({ content: [doc({ id: 'a1', title: 'Guia antigo', status: 'archived', canEdit: false })] });
    fireEvent.click(screen.getByRole('button', { name: 'Arquivados' }));
    await screen.findByText('Guia antigo');
    expect(screen.queryByRole('button', { name: /Restaurar/ })).toBeNull();
  });

  it('link direto (?id=) para artigo que a lista não traz busca pelo id e mostra o selo e o botão Restaurar', async () => {
    h.search.current = 'id=a1';
    h.api.getDocumentById.mockResolvedValue(doc({ id: 'a1', title: 'Guia antigo', status: 'archived' }));
    render(<KBExplorerPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Guia antigo' })).toBeTruthy();
    expect(h.api.getDocumentById).toHaveBeenCalledWith('a1');
    expect(screen.getAllByText('Arquivado').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Restaurar para publicado' })).toBeTruthy();
  });

  it('link direto para rascunho de outra pessoa (404) avisa em vez de abrir', async () => {
    h.search.current = 'id=x9';
    h.api.getDocumentById.mockRejectedValue(new Error('Falha ao carregar o documento'));
    render(<KBExplorerPage />);
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Não encontramos esse artigo, ou você não tem acesso a ele.'));
  });
});
