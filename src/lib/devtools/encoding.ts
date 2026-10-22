/**
 * Codificação: Base64, URL e decodificação em camadas (Deep Decoder).
 * O código veio das antigas telas base64, url-encoder e deep-decoder; o comportamento é o mesmo.
 */

// ---- Base64 ---------------------------------------------------------------

/** UTF-8 seguro: btoa/atob sozinhos quebram acentos. `urlSafe` troca +/ por -_ e tira o preenchimento. */
export function encodeBase64(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text);
  const b64 = btoa(Array.from(bytes, (b) => String.fromCodePoint(b)).join(''));
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}

export function decodeBase64(text: string): string {
  // aceita Base64 URL-safe e quebras de linha
  const normalized = text.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const bin = atob(padded);
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.codePointAt(0)!));
}

// Se o resultado for JSON, devolve formatado; senão, o texto cru.
export function prettify(text: string): { text: string; kind: 'json' | 'xml' | 'texto' } {
  try {
    return { text: JSON.stringify(JSON.parse(text), null, 2), kind: 'json' };
  } catch {
    return { text, kind: text.trim().startsWith('<') ? 'xml' : 'texto' };
  }
}

export interface Base64Result { output: string; error: string | null; kind: 'json' | 'xml' | 'texto' }

export function runBase64(input: string, mode: 'encode' | 'decode', urlSafe = false): Base64Result {
  if (!input.trim()) return { output: '', error: null, kind: 'texto' };
  try {
    if (mode === 'encode') return { output: encodeBase64(input, urlSafe), error: null, kind: 'texto' };
    const pretty = prettify(decodeBase64(input));
    return { output: pretty.text, error: null, kind: pretty.kind };
  } catch {
    return { output: '', error: 'Base64 inválido: confira se o texto está completo e sem caracteres estranhos.', kind: 'texto' };
  }
}

// ---- URL ------------------------------------------------------------------
export type UrlScope = 'component' | 'url';

export function runUrl(text: string, mode: 'encode' | 'decode', scope: UrlScope, plusAsSpace: boolean): string {
  if (mode === 'encode') return scope === 'component' ? encodeURIComponent(text) : encodeURI(text);
  // Formulários HTML usam "+" como espaço; só convertemos se o usuário pedir.
  const src = plusAsSpace ? text.replace(/\+/g, ' ') : text;
  return scope === 'component' ? decodeURIComponent(src) : decodeURI(src);
}

export function processUrl(input: string, mode: 'encode' | 'decode', scope: UrlScope, plusAsSpace: boolean): { output: string; error: string | null } {
  if (!input) return { output: '', error: null };
  try {
    return { output: runUrl(input, mode, scope, plusAsSpace), error: null };
  } catch {
    return {
      output: '',
      error: mode === 'decode'
        ? 'Sequência %XX inválida: confira se o texto está completo.'
        : 'Não foi possível codificar: há um caractere Unicode inválido (par substituto solto).',
    };
  }
}

// ---- Camadas (Deep Decoder) -----------------------------------------------
export interface Layer { kind: string; note?: string }
export interface DeepResult { layers: Layer[]; output: string }

const B64_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;
// Texto "legível": ASCII imprimível, whitespace e Latin-1 acentuado (mesmo critério do legado).
const READABLE_RE = /^[\x20-\x7E\sÀ-ÿĀ-￿]+$/;

// Base64 (padrão ou URL-safe) -> texto UTF-8, ou null se não for Base64 legível.
export function tryBase64(s: string): string | null {
  const t = s.trim();
  if (t.length < 8 || !B64_RE.test(t)) return null;
  try {
    const std = t.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(std + '='.repeat((4 - (std.length % 4)) % 4));
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.codePointAt(0)!));
    // evita falso positivo: palavra comum que "calha" de ser Base64 válido e gera lixo
    return text.length > 0 && READABLE_RE.test(text) && !/[\u0000-\u0008\u000E-\u001F]/.test(text) ? text : null;
  } catch {
    return null;
  }
}

// Percorre um JSON e decodifica strings Base64 aninhadas (>20 chars, como no legado), recursivamente.
function decodeNested(node: unknown, counter: { n: number }): unknown {
  if (Array.isArray(node)) return node.map((v) => decodeNested(v, counter));
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, decodeNested(v, counter)]));
  }
  if (typeof node === 'string' && node.length > 20) {
    const dec = tryBase64(node);
    if (dec !== null) {
      counter.n++;
      const trimmed = dec.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { return decodeNested(JSON.parse(trimmed), counter); } catch { /* segue como texto */ }
      }
      return trimmed;
    }
  }
  return node;
}

// Aplica decodificações em cadeia (URL, Base64, string JSON) até nada mais mudar; JSON encerra a cadeia.
export function deepDecode(input: string): DeepResult {
  const layers: Layer[] = [];
  let cur = input.trim();

  for (let i = 0; i < 12; i++) {
    // 1) URL-encoding
    if (/%[0-9A-Fa-f]{2}/.test(cur)) {
      try {
        const dec = decodeURIComponent(cur);
        if (dec !== cur) { layers.push({ kind: 'URL' }); cur = dec.trim(); continue; }
      } catch { /* não era URL-encoding válido */ }
    }
    // 2) JSON
    if (/^[[{"]/.test(cur)) {
      try {
        const parsed = JSON.parse(cur);
        if (typeof parsed === 'string') { layers.push({ kind: 'String JSON' }); cur = parsed.trim(); continue; }
        const counter = { n: 0 };
        const result = decodeNested(parsed, counter);
        layers.push({ kind: 'JSON', note: counter.n ? `${counter.n} campo(s) Base64 decodificado(s)` : undefined });
        return { layers, output: JSON.stringify(result, null, 2) };
      } catch { /* não é JSON */ }
    }
    // 3) Base64
    const b64 = tryBase64(cur);
    if (b64 !== null && b64.trim() !== cur) { layers.push({ kind: 'Base64' }); cur = b64.trim(); continue; }
    break;
  }
  return { layers, output: cur };
}

export function makeDeepSample(): string {
  const inner = encodeBase64(JSON.stringify({ usuario: 'maria', perfil: 'PO', observação: 'conteúdo em camada interna' }));
  const xml = encodeBase64('<pedido><id>42</id><status>aprovado</status></pedido>');
  return JSON.stringify({ id: 1, payload: inner, xml });
}

export const SAMPLE_BASE64_DECODED = '{"projeto":"DDWMISSI","status":"em andamento","pontos":8}';
export const SAMPLE_URL = 'https://exemplo.com/busca?q=ação & reunião&tag=a/b#topo';
