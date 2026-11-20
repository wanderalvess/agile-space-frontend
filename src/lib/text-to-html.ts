function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Converte texto puro (docx extraído, .txt, .md) em parágrafos HTML para o editor. Sem isto o texto
 * entrava como HTML: quebras de linha sumiam e "<" virava tag.
 */
export function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return '';
  return normalized
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
