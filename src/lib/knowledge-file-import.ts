import { authFetch } from '@/lib/auth-client';
import { markdownToHtml } from '@/lib/markdown-to-html';
import { plainTextToHtml } from '@/lib/text-to-html';
import { sanitizeHtml } from '@/lib/sanitize-html';

/** Extensões que o importador do editor entende (mesmo `accept` do seletor de arquivo). */
export const IMPORT_ACCEPT = '.txt,.md,.json,.docx,.pdf';
export const IMPORT_FORMATS_LABEL = 'Word (.docx), PDF, Markdown, texto ou JSON';

export type ImportKind = 'docx' | 'pdf' | 'markdown' | 'text';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Que tipo de arquivo é; null quando o formato não é aceito. */
export function importKindOf(file: Pick<File, 'name' | 'type'>): ImportKind | null {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type === DOCX_MIME || name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.md')) return 'markdown';
  if (name.endsWith('.txt') || name.endsWith('.json')) return 'text';
  return null;
}

export const KIND_LABEL: Record<ImportKind, string> = {
  docx: 'Word',
  pdf: 'PDF',
  markdown: 'Markdown',
  text: 'Arquivo',
};

/** Nome do arquivo sem a extensão, usado como título quando o artigo ainda não tem um. */
export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return base || name;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsText(file);
  });
}

/**
 * Converte o arquivo em HTML para o editor. Word e PDF passam pelo servidor (`/api/knowledge/ingest-pdf`):
 * Word devolve `html` com a estrutura (títulos, listas, negrito, links) e PDF só o texto. Markdown vira HTML
 * e o resto é texto puro. Lança Error com mensagem em português quando não dá.
 */
export async function importArticleFile(file: File): Promise<{ html: string; title: string; kind: ImportKind }> {
  const kind = importKindOf(file);
  if (!kind) throw new Error('Formato não aceito. Use Word (.docx), PDF, Markdown (.md), texto (.txt) ou JSON.');
  const title = titleFromFileName(file.name);

  if (kind === 'docx' || kind === 'pdf') {
    const body = new FormData();
    body.append('file', file);
    const response = await authFetch('/api/knowledge/ingest-pdf', { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `Não foi possível ler o arquivo (erro ${response.status}).`);
    }
    if (!data.text) throw new Error('Não encontramos texto neste arquivo.');
    // Word vem com estrutura; sem html (PDF) cai no texto puro.
    const html = typeof data.html === 'string' && data.html.trim() ? sanitizeHtml(data.html) : plainTextToHtml(data.text);
    return { html, title, kind };
  }

  const content = await readAsText(file);
  const html = kind === 'markdown' ? sanitizeHtml(markdownToHtml(content)) : plainTextToHtml(content);
  if (!html.trim()) throw new Error('O arquivo está vazio.');
  return { html, title, kind };
}
