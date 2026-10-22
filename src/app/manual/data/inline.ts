/**
 * Marcação simples dos textos do Manual: **negrito**, `código` e [rótulo](/rota).
 * Parser puro (sem React) para servir a tela e a busca com a mesma leitura do texto.
 */
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

const TOKEN = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const m of source.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) nodes.push({ type: 'text', text: source.slice(last, at) });
    if (m[1] !== undefined) nodes.push({ type: 'bold', text: m[1] });
    else if (m[2] !== undefined) nodes.push({ type: 'code', text: m[2] });
    else nodes.push({ type: 'link', text: m[3], href: m[4] });
    last = at + m[0].length;
  }
  if (last < source.length) nodes.push({ type: 'text', text: source.slice(last) });
  return nodes;
}

/** O texto como a pessoa lê, sem a marcação (usado na busca e na contagem de palavras). */
export function plainText(source: string): string {
  return parseInline(source)
    .map((n) => n.text)
    .join('');
}
