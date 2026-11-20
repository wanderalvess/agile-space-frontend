import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('../../../../app/knowledge/api', () => ({ knowledgeApi: { listVersions: vi.fn() } }));
// O Select do Radix não abre no jsdom: um <select> nativo exercita a mesma lógica de opções.
vi.mock('../../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, id }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; id?: string }) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import { knowledgeApi } from '../../../../app/knowledge/api';
import { ArticleDetailsPanel, type ArticleDetailsPanelProps } from '../ArticleDetailsPanel';
import { LinkDialog } from '../LinkDialog';
import { ImportDialog } from '../ImportDialog';

const api = knowledgeApi as unknown as { listVersions: ReturnType<typeof vi.fn> };

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
});
afterEach(() => cleanup());

function panel(overrides: Partial<ArticleDetailsPanelProps> = {}) {
  const props: ArticleDetailsPanelProps = {
    status: 'published',
    onStatusChange: vi.fn(),
    allowDraftArchived: true,
    category: 'Técnico',
    categoryOptions: ['Técnico', 'Processo', 'Produto'],
    onCategoryChange: vi.fn(),
    fullPath: '',
    onFullPathChange: vi.fn(),
    folderSuggestions: ['Plataforma / APIs', 'Suporte / Runbooks'],
    tags: ['api'],
    onTagsChange: vi.fn(),
    ...overrides,
  };
  render(<ArticleDetailsPanel {...props} />);
  return props;
}

describe('ArticleDetailsPanel', () => {
  it('Publicação é um radiogroup com as três situações e a frase de cada uma', () => {
    const props = panel({ status: 'draft' });
    const group = screen.getByRole('radiogroup', { name: 'Situação' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual([
      'PublicadoTodos da base podem ler e a busca encontra.',
      'RascunhoSó você vê. Não aparece na busca.',
      'ArquivadoSai da busca e da lista; dá para restaurar.',
    ]);
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    fireEvent.click(radios[2]);
    expect(props.onStatusChange).toHaveBeenCalledWith('archived');
  });

  it('enquanto o servidor não aceita rascunho/arquivado, as duas opções ficam desabilitadas', () => {
    const props = panel({ allowDraftArchived: false });
    const [published, draft, archived] = screen.getAllByRole('radio') as HTMLButtonElement[];
    expect(published.disabled).toBe(false);
    expect(draft.disabled).toBe(true);
    expect(archived.disabled).toBe(true);
    fireEvent.click(draft);
    expect(props.onStatusChange).not.toHaveBeenCalled();
  });

  it('categoria, pasta e atalhos de pasta', () => {
    const props = panel();
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Produto' } });
    expect(props.onCategoryChange).toHaveBeenCalledWith('Produto');
    fireEvent.change(screen.getByLabelText('Pasta'), { target: { value: 'Negócio' } });
    expect(props.onFullPathChange).toHaveBeenCalledWith('Negócio');
    fireEvent.click(screen.getByRole('button', { name: 'Suporte / Runbooks' }));
    expect(props.onFullPathChange).toHaveBeenCalledWith('Suporte / Runbooks');
  });

  it('etiquetas: adiciona com Enter (sem repetir) e remove', () => {
    const props = panel();
    const input = screen.getByLabelText('Adicionar etiqueta');
    fireEvent.change(input, { target: { value: '#Pedidos' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onTagsChange).toHaveBeenCalledWith(['api', 'Pedidos']);
    fireEvent.click(screen.getByRole('button', { name: 'Remover etiqueta api' }));
    expect(props.onTagsChange).toHaveBeenLastCalledWith([]);
  });

  it('Versões só aparece ao editar e lista as 3 últimas com link para o histórico', async () => {
    api.listVersions.mockResolvedValue([
      { versionNumber: 1, title: 'A', changedByName: 'Ana', changedAt: '2026-10-01T12:00:00Z', current: false },
      { versionNumber: 4, title: 'A', changedByName: 'Bia', changedAt: '2026-10-12T12:00:00Z', current: true },
      { versionNumber: 3, title: 'A', changedByName: 'Caio', changedAt: '2026-10-10T12:00:00Z', current: false },
      { versionNumber: 2, title: 'A', changedByName: 'Dani', changedAt: '2026-10-05T12:00:00Z', current: false },
    ]);
    cleanup();
    panel();
    expect(screen.queryByRole('heading', { name: 'Versões' })).toBeNull();
    cleanup();
    panel({ documentId: 'doc-9' });
    expect(await screen.findByText('Versão 4 · atual')).toBeTruthy();
    expect(screen.getByText('Versão 3')).toBeTruthy();
    expect(screen.getByText('Versão 2')).toBeTruthy();
    expect(screen.queryByText('Versão 1')).toBeNull();
    expect((screen.getByRole('link', { name: 'Ver histórico' }) as HTMLAnchorElement).getAttribute('href')).toBe('/knowledge/kb?id=doc-9');
  });
});

describe('LinkDialog', () => {
  const setup = (hasLink = false) => {
    const onApply = vi.fn();
    const onRemove = vi.fn();
    const onOpenChange = vi.fn();
    render(<LinkDialog open onOpenChange={onOpenChange} initial={{ href: '', text: 'glossário' }} hasLink={hasLink} onApply={onApply} onRemove={onRemove} />);
    return { onApply, onRemove, onOpenChange };
  };

  it('recusa endereço fora de http(s)/mailto com mensagem na janela', () => {
    const { onApply } = setup();
    fireEvent.change(screen.getByLabelText('Endereço'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('alert').textContent).toContain('http://, https:// ou mailto:');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('aplica com o endereço normalizado e o texto', () => {
    const { onApply, onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText('Endereço'), { target: { value: 'tdn.totvs.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onApply).toHaveBeenCalledWith({ href: 'https://tdn.totvs.com', text: 'glossário' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('"Remover link" só existe quando o cursor está num link', () => {
    setup(false);
    expect(screen.queryByRole('button', { name: 'Remover link' })).toBeNull();
    cleanup();
    const { onRemove } = setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remover link' }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('ImportDialog', () => {
  const file = new File(['conteúdo'], 'guia.md');

  it('arquivo escolhido sem texto no artigo importa direto e fecha', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<ImportDialog open onOpenChange={onOpenChange} hasContent={false} onImport={onImport} />);
    fireEvent.change(screen.getByLabelText('Arquivo para importar'), { target: { files: [file] } });
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(file));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('com texto no artigo pede confirmação antes de substituir', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportDialog open onOpenChange={vi.fn()} hasContent onImport={onImport} />);
    fireEvent.change(screen.getByLabelText('Arquivo para importar'), { target: { files: [file] } });
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByText('Substituir o texto que já está escrito?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Substituir texto' }));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(file));
  });

  it('arquivo solto no diálogo é importado', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<ImportDialog open onOpenChange={vi.fn()} hasContent={false} onImport={onImport} />);
    fireEvent.drop(screen.getByText('Arraste o arquivo para cá'), { dataTransfer: { files: [file] } });
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(file));
  });

  it('mostra o erro da importação na própria janela e mantém o aviso de substituição', async () => {
    const onImport = vi.fn().mockRejectedValue(new Error('Formato não aceito.'));
    const onOpenChange = vi.fn();
    render(<ImportDialog open onOpenChange={onOpenChange} hasContent={false} onImport={onImport} />);
    fireEvent.change(screen.getByLabelText('Arquivo para importar'), { target: { files: [file] } });
    expect(await screen.findByText('Formato não aceito.')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText('substitui')).toBeTruthy();
  });
});
