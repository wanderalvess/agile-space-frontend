/**
 * Comparação de saídas Jolt (motor local x Java oficial) pelo CONTEÚDO, não pelo texto.
 * Ordem de chaves num objeto JSON não muda o significado; comparar texto acusava "divergente"
 * quando os dois motores devolviam exatamente os mesmos valores em ordem diferente.
 */

export interface JsonDiff {
  /** Caminho legível: `items[0].vencimentoDias`. */
  path: string;
  kind: 'valor' | 'so-local' | 'so-java';
  local?: unknown;
  java?: unknown;
}

const MAX_DIFFS = 200;

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Diferenças entre duas saídas. Listas comparam posição a posição; objetos ignoram a ordem das chaves. */
export function diffJson(local: unknown, java: unknown): JsonDiff[] {
  const out: JsonDiff[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    if (out.length >= MAX_DIFFS) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) {
        const p = `${path}[${i}]`;
        if (i >= a.length) out.push({ path: p, kind: 'so-java', java: b[i] });
        else if (i >= b.length) out.push({ path: p, kind: 'so-local', local: a[i] });
        else walk(a[i], b[i], p);
      }
      return;
    }
    if (isObject(a) && isObject(b)) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      keys.forEach(k => {
        const p = path ? `${path}.${k}` : k;
        if (!(k in b)) out.push({ path: p, kind: 'so-local', local: a[k] });
        else if (!(k in a)) out.push({ path: p, kind: 'so-java', java: b[k] });
        else walk(a[k], b[k], p);
      });
      return;
    }
    // Tipos diferentes contam: 1 e "1" são saídas diferentes para quem consome o JSON.
    if (a !== b) out.push({ path: path || '(raiz)', kind: 'valor', local: a, java: b });
  };
  walk(local, java, '');
  return out;
}

/** Mostra um valor da diferença de forma curta e sem ambiguidade de tipo (`"1"` x `1`). */
export function describeValue(v: unknown): string {
  if (v === undefined) return '(ausente)';
  const s = JSON.stringify(v);
  return s.length > 60 ? s.slice(0, 59) + '…' : s;
}
