// Conversão de HTML (formato de armazenamento do `content` de um KnowledgeDocument)
// para markdown/texto puro, usada tanto pelo botão "Baixar" da UI (src/app/knowledge/kb/page.tsx)
// quanto pelas rotas da API pública (src/app/api/v1/knowledge/docs/**). Extraído pra um
// lugar só pra não duplicar a lógica entre os dois usos.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®', trade: '™',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
};

// Decoder de entidades HTML sem depender do DOM (`document`), pra funcionar
// tanto no browser quanto em rota de API server-side (Node) com o mesmo resultado.
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&(\w+);/g, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let markdown = html;

  // Headers
  markdown = markdown.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4>(.*?)<\/h4>/gi, '#### $1\n\n');

  // Paragraphs
  markdown = markdown.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');

  // Bold/Italic
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i>(.*?)<\/i>/gi, '*$1*');

  // Code blocks & inline code
  markdown = markdown.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```\n\n');
  markdown = markdown.replace(/<code>(.*?)<\/code>/gi, '`$1`');

  // Lists
  markdown = markdown.replace(/<li>(.*?)<\/li>/gi, '- $1\n');
  markdown = markdown.replace(/<\/ul>/gi, '\n');
  markdown = markdown.replace(/<\/ol>/gi, '\n');
  markdown = markdown.replace(/<ul[^>]*>/gi, '');
  markdown = markdown.replace(/<ol[^>]*>/gi, '');

  // Line breaks & entities
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<[^>]+>/g, '');

  markdown = decodeHtmlEntities(markdown);

  return markdown.replace(/\n{3,}/g, '\n\n').trim();
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n')
             .replace(/<\/p>/gi, '\n\n')
             .replace(/<\/h[1-6]>/gi, '\n\n')
             .replace(/<\/li>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');

  text = decodeHtmlEntities(text);

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export type KnowledgeExportFormat = 'html' | 'md' | 'txt';

export function exportKnowledgeContent(html: string, format: KnowledgeExportFormat): { body: string; contentType: string; extension: string } {
  switch (format) {
    case 'md':
      return { body: htmlToMarkdown(html), contentType: 'text/markdown; charset=utf-8', extension: 'md' };
    case 'txt':
      return { body: htmlToPlainText(html), contentType: 'text/plain; charset=utf-8', extension: 'txt' };
    case 'html':
    default:
      return { body: html || '', contentType: 'text/html; charset=utf-8', extension: 'html' };
  }
}
