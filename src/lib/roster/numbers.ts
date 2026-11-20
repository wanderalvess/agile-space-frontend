/** Números digitados por gente brasileira: "0,85" e "0.85" valem o mesmo. */

/**
 * Lê um decimal escrito com vírgula ou ponto. "1.234,5" (milhar com ponto) e "1,234.5" (milhar com vírgula) também
 * funcionam: o último separador é o decimal. Devolve NaN quando não é um número.
 */
export function parseDecimal(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  if (typeof input !== 'string') return NaN;
  let s = input.trim().replace(/\s+/g, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    s = s.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (lastComma >= 0) {
    // Mais de uma vírgula sem ponto ("1,234,567") é milhar; uma só é decimal.
    s = s.split(',').length > 2 ? s.split(',').join('') : s.replace(',', '.');
  }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

/** Arredonda para `digits` casas sem arrastar erro de ponto flutuante (27.500000000000004 -> 27.5). */
export function roundTo(value: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Texto pt-BR de um número de horas ("5,5"), sem zeros à direita. */
export function formatHours(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return String(roundTo(value, digits)).replace('.', ',');
}

/** Contagem pluralizada: 1 pessoa / 3 pessoas. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
