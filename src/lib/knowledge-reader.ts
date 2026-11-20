import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Funções puras do leitor de artigo da Base de Conhecimento: sumário, tempo de
 * leitura, tamanho, link do TDN e pós-processamento do HTML já sanitizado.
 */

export interface TocItem {
  /** id aplicado no heading (prefixado com `kb-`). */
  id: string;
  text: string;
  /** 1 a 3, conforme H1/H2/H3. */
  level: number;
}

/** Prefixo dos ids de heading: evita colisão com ids da página e o "DOM clobbering" do DOMPurify (ex.: "Links", "Title"). */
export const HEADING_ID_PREFIX = 'kb-';

/** Slug sem acento, em minúsculas, só [a-z0-9-]. Texto vazio vira "secao". */
export function slugify(text: string): string {
  const slug = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'secao';
}

/** Devolve um id ainda não usado em `used` (acrescenta -1, -2... quando há repetição) e o registra. */
export function uniqueId(base: string, used: Set<string>): string {
  let candidate = base;
  let n = 1;
  while (used.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Extrai o sumário (H1 a H3) do HTML e devolve o HTML com `id` em cada heading
 * para as âncoras funcionarem. Não sanitiza: quem renderiza precisa sanitizar o resultado.
 */
export function buildToc(html: string): { items: TocItem[]; html: string } {
  if (!html || typeof DOMParser === 'undefined') return { items: [], html: html || '' };
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const used = new Set<string>();
    const items: TocItem[] = [];
    doc.querySelectorAll('h1, h2, h3').forEach((el) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const id = uniqueId(HEADING_ID_PREFIX + slugify(text), used);
      el.id = id;
      items.push({ id, text, level: Number(el.tagName[1]) });
    });
    return { items, html: doc.body.innerHTML };
  } catch {
    return { items: [], html };
  }
}

/** Contagem de palavras do texto corrido do HTML (tags viram espaço). */
export function htmlWordCount(html: string): number {
  if (!html) return 0;
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** Minutos de leitura a 200 palavras por minuto, no mínimo 1. */
export function estimateReadingMinutes(html: string, wordsPerMinute = 200): number {
  return Math.max(1, Math.ceil(htmlWordCount(html) / wordsPerMinute));
}

/** "14,2 KB"; null quando o tamanho não é conhecido. */
export function formatSizeKb(bytes: number | null | undefined): string | null {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes <= 0) return null;
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
}

/** Link da página original no TDN; null quando falta a URL base ou o id (não inventa link). */
export function buildTdnLink(baseUrl: string | null | undefined, tdnId: string | null | undefined): string | null {
  const base = (baseUrl || '').trim().replace(/\/+$/, '');
  const id = (tdnId || '').trim();
  if (!base || !id) return null;
  const origin = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  return `${origin}/pages/viewpage.action?pageId=${encodeURIComponent(id)}`;
}

/** "há 3 dias"; null quando a data é inválida ou ausente. */
export function formatUpdatedAgo(value: unknown): string | null {
  if (!value) return null;
  try {
    const v = value as { toDate?: () => Date };
    const date = typeof v.toDate === 'function' ? v.toDate() : new Date(value as string | number | Date);
    if (isNaN(date.getTime())) return null;
    return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
  } catch {
    return null;
  }
}

/** Índice do último heading cujo topo já passou da linha de leitura (o primeiro, se nenhum passou); -1 sem headings. */
export function findActiveHeadingIndex(tops: number[], line: number): number {
  if (tops.length === 0) return -1;
  let active = 0;
  tops.forEach((top, i) => {
    if (top <= line) active = i;
  });
  return active;
}

/** Nome mostrado no rótulo do bloco de código. */
function codeLanguage(pre: Element): string {
  const code = pre.querySelector('code');
  const cls = `${code?.className || ''} ${pre.className || ''}`;
  const m = cls.match(/language-([\w+#-]+)/i);
  const lang = m ? m[1].toLowerCase() : '';
  if (!lang || lang === 'plaintext' || lang === 'text' || lang === 'none') return 'código';
  return lang;
}

/**
 * Pós-processa o HTML já renderizado (e já sanitizado): embrulha cada bloco de código
 * com barra e botão "Copiar", embrulha tabelas para rolagem horizontal, abre links externos
 * em nova aba e carrega imagens sob demanda. Idempotente: pode rodar mais de uma vez.
 * Só usa createElement/textContent: nada de HTML em string, então não abre brecha de XSS.
 */
export function enhanceArticleDom(root: HTMLElement): void {
  const doc = root.ownerDocument;

  root.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('.kb-code')) return;
    const wrap = doc.createElement('div');
    wrap.className = 'kb-code';

    const bar = doc.createElement('div');
    bar.className = 'kb-code-bar';
    const label = doc.createElement('span');
    label.textContent = codeLanguage(pre);
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'kb-code-copy';
    button.setAttribute('data-kb-copy', '');
    button.setAttribute('aria-label', 'Copiar bloco de código');
    button.textContent = 'Copiar';
    bar.append(label, button);

    pre.parentNode?.insertBefore(wrap, pre);
    wrap.append(bar, pre);
  });

  root.querySelectorAll('table').forEach((table) => {
    if (table.closest('.kb-table-wrap')) return;
    const wrap = doc.createElement('div');
    wrap.className = 'kb-table-wrap';
    table.parentNode?.insertBefore(wrap, table);
    wrap.appendChild(table);
  });

  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  root.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
  });
}
