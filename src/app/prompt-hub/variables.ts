/**
 * Campos entre chaves duplas ({{nome}}) dentro do conteúdo de um item.
 * `${{x}}` (com cifrão antes) não é campo: aparece em templates de CI e de shell.
 */
const FIELD_SOURCE = String.raw`(?<!\$)\{\{([^}\n]{1,60})\}\}`;

const newRegex = () => new RegExp(FIELD_SOURCE, 'g');

/** Nomes dos campos, sem repetição, na ordem em que aparecem. */
export function extractVariables(content?: string | null): string[] {
  if (!content) return [];
  const names = new Set<string>();
  for (const match of content.matchAll(newRegex())) {
    names.add(match[1].trim());
  }
  return Array.from(names);
}

/**
 * Troca cada campo preenchido pelo valor. Uma passada só e com função: "$&" digitado
 * num valor não é interpretado, e um valor que contenha {{outro}} não é substituído de novo.
 * Campo sem valor fica como está.
 */
export function fillVariables(content: string, values: Record<string, string>): string {
  return content.replace(newRegex(), (full, name: string) => {
    const value = values[name.trim()];
    return value ? value : full;
  });
}

export interface FilledPart {
  text: string;
  kind: 'text' | 'filled' | 'empty';
}

/** Quebra o conteúdo em trechos para destacar o que foi preenchido e o que ainda falta. */
export function splitFilled(content: string, values: Record<string, string>): FilledPart[] {
  const parts: FilledPart[] = [];
  let last = 0;
  for (const match of content.matchAll(newRegex())) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: content.slice(last, start), kind: 'text' });
    const value = values[match[1].trim()];
    parts.push(value ? { text: value, kind: 'filled' } : { text: match[0], kind: 'empty' });
    last = start + match[0].length;
  }
  if (last < content.length) parts.push({ text: content.slice(last), kind: 'text' });
  return parts;
}
