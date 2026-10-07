// Transformações de texto do String Master (funções puras, testáveis).

export interface TextStats {
  chars: number;
  charsNoSpace: number;
  words: number;
  lines: number;
  paragraphs: number;
}

export function textStats(input: string): TextStats {
  const trimmed = input.trim();
  return {
    chars: input.length,
    charsNoSpace: input.replace(/\s/g, '').length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines: input ? input.split('\n').length : 0,
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).length : 0,
  };
}

export const removeAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Separa o texto em palavras (aceita camelCase, snake_case, kebab-case e espaços).
function words(s: string): string[] {
  return removeAccents(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}

export const toCamelCase = (s: string) =>
  words(s).map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
export const toPascalCase = (s: string) => words(s).map(w => w[0].toUpperCase() + w.slice(1)).join('');
export const toSnakeCase = (s: string) => words(s).join('_');
export const toKebabCase = (s: string) => words(s).join('-');
export const toSlug = toKebabCase;

// Fraktur Unicode (𝔄𝔟𝔠…). Algumas maiúsculas ficam fora do bloco matemático.
const FRAKTUR_EXCEPTIONS: Record<string, string> = { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' };
export function toStylized(text: string): string {
  return Array.from(text)
    .map(c => {
      if (FRAKTUR_EXCEPTIONS[c]) return FRAKTUR_EXCEPTIONS[c];
      if (c >= 'a' && c <= 'z') return String.fromCodePoint(0x1d51e + c.charCodeAt(0) - 97);
      if (c >= 'A' && c <= 'Z') return String.fromCodePoint(0x1d504 + c.charCodeAt(0) - 65);
      return c;
    })
    .join('');
}

export function charType(c: string): string {
  if (/[a-zA-Z]/.test(c)) return 'Letra';
  if (/[0-9]/.test(c)) return 'Número';
  if (/\s/.test(c)) return 'Espaço';
  return 'Especial';
}

// ── Número por extenso (pt-BR), inteiros de 0 a 999.999.999.999 ──
const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n: number): string {
  if (n === 100) return 'cem';
  const parts: string[] = [];
  if (n >= 100) parts.push(CENTENAS[Math.floor(n / 100)]);
  const r = n % 100;
  if (r > 0) parts.push(r < 20 ? UNIDADES[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? ' e ' + UNIDADES[r % 10] : ''));
  return parts.join(' e ');
}

export function numeroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const escalas: [number, string, string][] = [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil']];
  const partes: string[] = [];
  let resto = n;
  for (const [valor, sing, plur] of escalas) {
    const q = Math.floor(resto / valor);
    if (q > 0) {
      partes.push(valor === 1e3 && q === 1 ? 'mil' : `${ate999(q)} ${q === 1 ? sing : plur}`);
      resto %= valor;
    }
  }
  if (resto > 0) {
    // "e" antes do último bloco quando ele é < 100 ou centena exata
    const ultimo = ate999(resto);
    partes.push(partes.length && (resto < 100 || resto % 100 === 0) ? `e ${ultimo}` : ultimo);
  }
  return partes.join(' ').replace(/\s+/g, ' ');
}

// Substitui cada número inteiro do texto pelo valor por extenso: "12" -> "12 (doze)".
export function convertNumbersToWords(text: string): string {
  return text.replace(/\d+/g, m => {
    const n = Number(m);
    return n <= 999_999_999_999 ? `${m} (${numeroPorExtenso(n)})` : m;
  });
}

export type ToolId =
  | 'uppercase' | 'lowercase' | 'capitalize' | 'camel' | 'pascal' | 'snake' | 'kebab'
  | 'sort' | 'unique' | 'trim_lines' | 'reverse' | 'remove_accents' | 'remove_newlines'
  | 'text_to_html' | 'extenso' | 'stylized' | 'char_info' | 'occurrence' | 'split' | 'cut';

export interface ToolParams {
  delimiter: string;
  limit: number;
  word: string;
}

export function applyTool(tool: ToolId, input: string, p: ToolParams): string {
  switch (tool) {
    case 'uppercase': return input.toUpperCase();
    case 'lowercase': return input.toLowerCase();
    case 'capitalize': return input.toLowerCase().replace(/(^|\s)(\S)/gu, (_, sp, ch) => sp + ch.toUpperCase());
    case 'camel': return input.split('\n').map(toCamelCase).join('\n');
    case 'pascal': return input.split('\n').map(toPascalCase).join('\n');
    case 'snake': return input.split('\n').map(toSnakeCase).join('\n');
    case 'kebab': return input.split('\n').map(toKebabCase).join('\n');
    case 'sort': return input.split('\n').sort((a, b) => a.localeCompare(b, 'pt-BR')).join('\n');
    case 'unique': return Array.from(new Set(input.split('\n'))).join('\n');
    case 'trim_lines': return input.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    case 'reverse': return Array.from(input).reverse().join('');
    case 'remove_accents': return removeAccents(input);
    case 'remove_newlines': return input.replace(/\r?\n/g, ' ');
    case 'text_to_html':
      return input
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;')
        .split('\n').map(l => `<p>${l}</p>`).join('\n');
    case 'extenso': return convertNumbersToWords(input);
    case 'stylized': return toStylized(input);
    case 'char_info':
      return Array.from(input)
        .map(c => `${c === '\n' ? '\\n' : c} -> Unicode: U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} | Tipo: ${charType(c)}`)
        .join('\n');
    case 'occurrence': {
      if (!p.word) return 'Informe a palavra a procurar.';
      // texto literal: escapa metacaracteres (o legado interpretava como regex)
      const esc = p.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const count = (input.match(new RegExp(esc, 'gi')) || []).length;
      return `"${p.word}" aparece ${count} vez(es) no texto.`;
    }
    case 'split': return input.split(p.delimiter || ',').map(i => i.trim()).join('\n');
    case 'cut': {
      const limit = p.limit > 0 ? p.limit : 100;
      return input.length > limit ? input.slice(0, limit) + '...' : input;
    }
  }
}
