import { normalizeHttpUrl } from '@/lib/safe-url';
import type { KnowledgeDocument } from '@/lib/knowledge-types';

/**
 * Lógica pura do editor de artigos da Base de Conhecimento (sem React, sem rede):
 * contagem de palavras, estado "sujo", validação, links, categorias, pastas e payload.
 */

/** HTML que o TipTap devolve para um documento vazio. */
export const EMPTY_DOC_HTML = '<p></p>';

/**
 * O servidor (KnowledgeService.DOC_STATUS) só aceita "indexed", "published" e "deleted": "draft" e
 * "archived" voltam 400 ("Status inválido"). Enquanto o backend não aceitar, a tela não oferece
 * "Salvar rascunho" nem grava "Arquivado". Quando o backend passar a aceitar, basta virar esta chave.
 */
export const SERVER_SUPPORTS_DRAFT_ARCHIVED = false;

/** Limites do servidor (KnowledgeService.MAX_TAGS / MAX_TAG_LENGTH). */
export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 100;

export const BASE_CATEGORIES = ['Técnico', 'Processo', 'Negócio', 'Suporte'] as const;
export const DEFAULT_CATEGORY = 'Processo';

export type EditorStatus = 'published' | 'draft' | 'archived';

export interface StatusOption {
  id: EditorStatus;
  label: string;
  description: string;
}

export const STATUS_OPTIONS: readonly StatusOption[] = [
  { id: 'published', label: 'Publicado', description: 'Todos da base podem ler e a busca encontra.' },
  { id: 'draft', label: 'Rascunho', description: 'Só você vê. Não aparece na busca.' },
  { id: 'archived', label: 'Arquivado', description: 'Sai da busca e da lista; dá para restaurar.' },
];

export const STATUS_LABEL: Record<EditorStatus, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  archived: 'Arquivado',
};

/** Status do servidor -> status da tela. "indexed" (importado do TDN) e demais contam como publicado. */
export function toEditorStatus(serverStatus: string | null | undefined): EditorStatus {
  return serverStatus === 'draft' || serverStatus === 'archived' ? serverStatus : 'published';
}

/** Status que vai no payload: publicar um artigo "indexed" mantém "indexed" (continua válido no servidor). */
export function statusToSend(selected: EditorStatus, original?: string | null): string {
  if (selected === 'published' && original === 'indexed') return 'indexed';
  return selected;
}

// ---------------------------------------------------------------------------
// Texto, palavras, tamanho, tempo de leitura

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** Texto visível de um trecho de HTML (blocos viram espaço, entidades comuns são decodificadas). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>|<br\s*\/?>|<hr\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(html: string | null | undefined): number {
  const text = htmlToText(html);
  return text ? text.split(' ').length : 0;
}

/** O artigo não tem nenhum texto (só parágrafos vazios, linha divisória etc.). */
export function isContentEmpty(html: string | null | undefined): boolean {
  return htmlToText(html) === '';
}

export function byteSizeOf(content: string): number {
  return new TextEncoder().encode(content).length;
}

/** "1,4 KB" (vírgula decimal, sempre uma casa). */
export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
}

const WORDS_PER_MINUTE = 200;

export function readingMinutes(words: number): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function formatWords(words: number): string {
  return `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
}

export function formatReadingTime(words: number): string {
  const min = readingMinutes(words);
  return min === 0 ? 'Sem texto ainda' : `Leitura de ${min} min`;
}

// ---------------------------------------------------------------------------
// Estado "sujo" e indicador de salvamento

export interface ArticleSnapshot {
  title: string;
  category: string;
  fullPath: string;
  status: EditorStatus;
  tags: readonly string[];
  content: string;
}

function normalizeContent(html: string): string {
  return html.trim() === '' ? EMPTY_DOC_HTML : html;
}

/** Há alteração em relação ao que foi carregado/salvo por último? */
export function isDirty(baseline: ArticleSnapshot, current: ArticleSnapshot): boolean {
  return (
    baseline.title !== current.title ||
    baseline.category !== current.category ||
    baseline.fullPath !== current.fullPath ||
    baseline.status !== current.status ||
    baseline.tags.length !== current.tags.length ||
    baseline.tags.some((tag, i) => tag !== current.tags[i]) ||
    normalizeContent(baseline.content) !== normalizeContent(current.content)
  );
}

export type SaveTone = 'ok' | 'busy' | 'pending';

export function saveIndicator(input: {
  isNew: boolean;
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
}): { label: string; tone: SaveTone } {
  if (input.saving) return { label: 'Salvando…', tone: 'busy' };
  if (input.dirty) return { label: input.isNew ? 'Ainda não salvo' : 'Alterações não salvas', tone: 'pending' };
  if (input.justSaved) return { label: 'Salvo agora', tone: 'ok' };
  if (input.isNew) return { label: 'Ainda não salvo', tone: 'pending' };
  return { label: 'Tudo salvo', tone: 'ok' };
}

// ---------------------------------------------------------------------------
// Validação

export interface ArticleErrors {
  title?: string;
  content?: string;
}

export function validateArticle(input: { title: string; content: string }): ArticleErrors {
  const errors: ArticleErrors = {};
  if (!input.title.trim()) errors.title = 'Dê um título ao artigo.';
  if (isContentEmpty(input.content)) errors.content = 'Escreva o conteúdo do artigo antes de salvar.';
  return errors;
}

// ---------------------------------------------------------------------------
// Link

/**
 * Endereço de um link: http(s) (completa https:// quando falta) ou mailto:. Devolve null para o que não
 * for aceito (javascript:, data:, texto solto...).
 */
export function normalizeLinkHref(raw: string | null | undefined): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  if (/^mailto:/i.test(text)) {
    const address = text.slice(7).split('?')[0];
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? text : null;
  }
  if (/^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/.test(text)) return `mailto:${text}`;
  return normalizeHttpUrl(text);
}

// ---------------------------------------------------------------------------
// Categoria, pasta e etiquetas

/** As quatro categorias de sempre; se o artigo carregado tem outra, ela entra no fim para não se perder. */
export function buildCategoryOptions(current?: string | null): string[] {
  const options: string[] = [...BASE_CATEGORIES];
  const value = (current ?? '').trim();
  if (value && !options.includes(value)) options.push(value);
  return options;
}

/** Pastas já usadas na base (o caminho sem o último trecho), distintas, em ordem alfabética, até `limit`. */
export function suggestFolders(docs: ReadonlyArray<Pick<KnowledgeDocument, 'fullPath'>> | null | undefined, limit = 5): string[] {
  const folders = new Set<string>();
  for (const doc of docs ?? []) {
    const parts = (doc.fullPath ?? '')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, -1);
    if (parts.length > 0) folders.add(parts.join(' / '));
  }
  return Array.from(folders).sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, limit);
}

/** Etiquetas digitadas ("api, #pedidos"): sem "#", sem repetição (ignora maiúsculas), dentro dos limites do servidor. */
export function addTags(existing: readonly string[], raw: string): string[] {
  const result = [...existing];
  const seen = new Set(result.map((tag) => tag.toLowerCase()));
  for (const piece of raw.split(',')) {
    const tag = piece.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH);
    if (!tag || seen.has(tag.toLowerCase()) || result.length >= MAX_TAGS) continue;
    seen.add(tag.toLowerCase());
    result.push(tag);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Payload

export interface SaveInput {
  title: string;
  category: string;
  fullPath: string;
  content: string;
  tags: readonly string[];
  status: EditorStatus;
  /** Status que veio do servidor ao carregar o artigo (para manter "indexed"). */
  originalStatus?: string | null;
  userId: string;
}

/** Corpo do POST/PUT: o mesmo de antes, mais as etiquetas (o servidor aceita e guarda `tags`). */
export function buildSavePayload(input: SaveInput): Partial<KnowledgeDocument> {
  return {
    title: input.title.trim(),
    category: input.category,
    fullPath: input.fullPath.trim(),
    content: input.content,
    status: statusToSend(input.status, input.originalStatus) as KnowledgeDocument['status'],
    tags: [...input.tags],
    updatedBy: input.userId,
    authorId: input.userId,
    byteSize: byteSizeOf(input.content),
  };
}
