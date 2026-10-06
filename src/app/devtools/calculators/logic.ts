// Cálculos das calculadoras (funções puras, testáveis).

export type Op = '+' | '-' | '*' | '/';

// Remove ruído de ponto flutuante (0.1 + 0.2 -> 0.3).
export function clean(n: number): number {
  return Number(n.toPrecision(12));
}

export function operate(a: number, op: Op, b: number): number {
  switch (op) {
    case '+': return clean(a + b);
    case '-': return clean(a - b);
    case '*': return clean(a * b);
    case '/': return b === 0 ? NaN : clean(a / b);
  }
}

export function formatResult(n: number): string {
  return Number.isFinite(n) ? String(n) : 'Erro';
}

// ── Geometria: devolve null quando algum valor não é um número válido ≥ 0 ──
const num = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export interface GeoResult { area: number; perimeter: number | null }

export function squareCalc(side: string): GeoResult | null {
  const l = num(side);
  return l === null ? null : { area: clean(l * l), perimeter: clean(4 * l) };
}

export function rectangleCalc(w: string, h: string): GeoResult | null {
  const a = num(w), b = num(h);
  return a === null || b === null ? null : { area: clean(a * b), perimeter: clean(2 * (a + b)) };
}

export function circleCalc(r: string): GeoResult | null {
  const x = num(r);
  return x === null ? null : { area: clean(Math.PI * x * x), perimeter: clean(2 * Math.PI * x) };
}

// Triângulo: só a área (o perímetro exigiria os três lados).
export function triangleCalc(base: string, height: string): GeoResult | null {
  const b = num(base), h = num(height);
  return b === null || h === null ? null : { area: clean((b * h) / 2), perimeter: null };
}

// ── Conversor de bytes: base 1024 (binário) e 1000 (decimal) ──
export const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;
export type ByteUnit = (typeof BYTE_UNITS)[number];

export function convertBytes(value: number, from: ByteUnit, base: 1000 | 1024): Record<ByteUnit, number> {
  const bytes = value * Math.pow(base, BYTE_UNITS.indexOf(from));
  const out = {} as Record<ByteUnit, number>;
  BYTE_UNITS.forEach((u, i) => { out[u] = clean(bytes / Math.pow(base, i)); });
  return out;
}
