import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: { current: '' },
  toast: { success: vi.fn(), error: vi.fn() },
  auth: { session: { id: 'u1' } as { id: string } | null },
  api: {
    getDocumentById: vi.fn(),
    saveOrUpdateDocument: vi.fn(),
    updateDocument: vi.fn(),
    listDocuments: vi.fn(),
    listVersions: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: h.replace }),
  useSearchParams: () => new URLSearchParams(h.search.current),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('../../../../context/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('../../../../app/knowledge/api', () => ({ knowledgeApi: h.api }));
vi.mock('../../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, id }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; id?: string }) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import { ArticleEditor } from '../ArticleEditor';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  // O ProseMirror consulta posições de layout que o jsdom não implementa.
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});

beforeEach(() => {
  vi.clearAllMocks();
  h.search.current = '';
  h.auth.session = { id: 'u1' };
  h.api.listDocuments.mockResolvedValue({ content: [{ fullPath: 'Plataforma / APIs / Pedidos' }] });
  h.api.listVersions.mockResolvedValue([]);
  h.api.saveOrUpdateDocument.mockResolvedValue({ id: 'novo-1' });
  h.api.updateDocument.mockResolvedValue({ id: 'doc-1' });
});
afterEach(() => cleanup());

const existing = {
  id: 'doc-1',
  title: 'API de Pedidos',
  category: 'Produto',
  fullPath: 'Plataforma / APIs',
  content: '<h2>Visão geral</h2><p>Texto do artigo.</p>',
  status: 'published',
  tags: ['api', 'pedidos'],
  canEdit: true,
};

async function renderNew() {
  render(<ArticleEditor />);
  await screen.findByRole('toolbar', { name: 'Formatação' });
}

async function typeInEditor(text: string) {
  const area = document.querySelector('.ProseMirror') as HTMLElement;
  await act(async () => {
    area.focus();
    area.innerHTML = `<p>${text}</p>`;
    // O TipTap lê a mudança do DOM pelo observador de mutações do ProseMirror.
    await new Promise((r) => setTimeout(r, 50));
  });
}

describe('ArticleEditor: barra de formatação', () => {
  it('todo botão tem nome acessível e os de estado têm aria-pressed ligado ao editor', async () => {
    await renderNew();
    const toolbar = screen.getByRole('toolbar', { name: 'Formatação' });
    const names = Array.from(toolbar.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Desfazer', 'Refazer', 'Título 1', 'Título 2', 'Título 3', 'Negrito', 'Itálico', 'Sublinhado', 'Tachado',
      'Lista com marcadores', 'Lista numerada', 'Citação', 'Código em linha', 'Bloco de código', 'Inserir link', 'Linha divisória',
    ]);
    const bold = screen.getByRole('button', { name: 'Negrito' });
    expect(bold.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Desfazer' }).hasAttribute('aria-pressed')).toBe(false);
    await act(async () => {
      fireEvent.click(bold);
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Negrito' }).getAttribute('aria-pressed')).toBe('true'));
  });

  it('"Inserir link" abre a janela própria (não o window.prompt)', async () => {
    const prompt = vi.spyOn(window, 'prompt');
    await renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'Inserir link' }));
    expect(await screen.findByRole('dialog', { name: 'Inserir link' })).toBeTruthy();
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe('ArticleEditor: artigo novo', () => {
  it('sem título e sem texto mostra as mensagens na tela e não salva', async () => {
    await renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText('Dê um título ao artigo.')).toBeTruthy();
    expect(screen.getByText('Escreva o conteúdo do artigo antes de salvar.')).toBeTruthy();
    expect(h.api.saveOrUpdateDocument).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Título do artigo').getAttribute('aria-invalid')).toBe('true');
  });

  it('publica com o payload de sempre mais as etiquetas e abre o artigo', async () => {
    await renderNew();
    fireEvent.change(screen.getByLabelText('Título do artigo'), { target: { value: 'Guia novo' } });
    fireEvent.change(screen.getByLabelText('Pasta'), { target: { value: 'Plataforma / APIs' } });
    const tag = screen.getByLabelText('Adicionar etiqueta');
    fireEvent.change(tag, { target: { value: 'api' } });
    fireEvent.keyDown(tag, { key: 'Enter' });
    await typeInEditor('Corpo do artigo');
    expect(screen.getByText('Ainda não salvo', { selector: '[role="status"]' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(h.api.saveOrUpdateDocument).toHaveBeenCalledTimes(1));
    expect(h.api.saveOrUpdateDocument).toHaveBeenCalledWith({
      title: 'Guia novo',
      category: 'Processo',
      fullPath: 'Plataforma / APIs',
      content: '<p>Corpo do artigo</p>',
      status: 'published',
      tags: ['api'],
      updatedBy: 'u1',
      authorId: 'u1',
      byteSize: new TextEncoder().encode('<p>Corpo do artigo</p>').length,
    });
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/knowledge/kb?id=novo-1'));
  });

  it('enquanto o servidor não aceita rascunho, não oferece "Salvar rascunho"', async () => {
    await renderNew();
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull();
  });

  it('voltar sem alterações sai direto; com alterações pergunta antes', async () => {
    await renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a base' }));
    expect(h.push).toHaveBeenCalledWith('/knowledge/kb');
    h.push.mockClear();

    fireEvent.change(screen.getByLabelText('Título do artigo'), { target: { value: 'Rascunho de ideia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a base' }));
    expect(h.push).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Sair sem salvar?');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(h.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a base' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    expect(h.push).toHaveBeenCalledWith('/knowledge/kb');
  });

  it('com alterações pendentes avisa antes de fechar a aba (beforeunload)', async () => {
    await renderNew();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText('Título do artigo'), { target: { value: 'Algo' } });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('alternador Ler mostra o artigo sanitizado como o leitor verá', async () => {
    await renderNew();
    fireEvent.change(screen.getByLabelText('Título do artigo'), { target: { value: 'Guia' } });
    await typeInEditor('Texto <img src=x onerror=alert(1)> final');
    fireEvent.click(screen.getByRole('button', { name: 'Ler' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Guia' })).toBeTruthy();
    expect(screen.queryByRole('toolbar', { name: 'Formatação' })).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });
});

describe('ArticleEditor: artigo existente', () => {
  beforeEach(() => {
    h.search.current = 'id=doc-1';
    h.api.getDocumentById.mockResolvedValue(existing);
  });

  it('carrega os campos, mantém a categoria que não é das quatro e começa sem alterações', async () => {
    render(<ArticleEditor />);
    expect(await screen.findByDisplayValue('API de Pedidos')).toBeTruthy();
    expect(screen.getByDisplayValue('Plataforma / APIs')).toBeTruthy();
    expect((screen.getByLabelText('Categoria') as HTMLSelectElement).value).toBe('Produto');
    expect(screen.getByText('api')).toBeTruthy();
    expect(screen.getByText('Tudo salvo', { selector: '[role="status"]' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Atualizar artigo' })).toBeTruthy();
    // Etiqueta do topo e opção do painel.
    expect(screen.getAllByText('Publicado')).toHaveLength(2);
    // Versões aparece ao editar.
    expect(await screen.findByRole('heading', { name: 'Versões' })).toBeTruthy();
  });

  it('atualiza pelo PUT com o id e as etiquetas carregadas', async () => {
    render(<ArticleEditor />);
    fireEvent.change(await screen.findByLabelText('Título do artigo'), { target: { value: 'API de Pedidos v2' } });
    expect(screen.getByText('Alterações não salvas', { selector: '[role="status"]' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar artigo' }));
    await waitFor(() => expect(h.api.updateDocument).toHaveBeenCalledTimes(1));
    const [id, payload] = h.api.updateDocument.mock.calls[0];
    expect(id).toBe('doc-1');
    expect(payload).toMatchObject({ title: 'API de Pedidos v2', category: 'Produto', status: 'published', tags: ['api', 'pedidos'], authorId: 'u1', updatedBy: 'u1' });
    expect(h.api.saveOrUpdateDocument).not.toHaveBeenCalled();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/knowledge/kb?id=doc-1'));
  });

  it('publicar um artigo "indexed" (importado do TDN) mantém o status aceito pelo servidor', async () => {
    h.api.getDocumentById.mockResolvedValue({ ...existing, status: 'indexed' });
    render(<ArticleEditor />);
    await screen.findByDisplayValue('API de Pedidos');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar artigo' }));
    await waitFor(() => expect(h.api.updateDocument).toHaveBeenCalled());
    expect(h.api.updateDocument.mock.calls[0][1].status).toBe('indexed');
  });

  it('sem permissão de edição mostra a tela com "Abrir para leitura"', async () => {
    h.api.getDocumentById.mockResolvedValue({ ...existing, canEdit: false });
    render(<ArticleEditor />);
    expect(await screen.findByText('Só o autor ou a liderança editam este artigo')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Abrir para leitura' });
    expect(link.getAttribute('href')).toBe('/knowledge/kb?id=doc-1');
    expect(screen.queryByRole('toolbar', { name: 'Formatação' })).toBeNull();
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    h.api.getDocumentById.mockRejectedValueOnce(new Error('Falha ao carregar o documento'));
    render(<ArticleEditor />);
    expect(await screen.findByText(/Não foi possível abrir o artigo/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByDisplayValue('API de Pedidos')).toBeTruthy();
  });
});
