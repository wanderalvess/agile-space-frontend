// Geração e validação de CPF e CNPJ (clássico e alfanumérico, vigente a partir de 2026).
// Documentos gerados são apenas para teste: passam no cálculo dos dígitos, mas não são pessoas/empresas reais.

export type DocType = 'CPF' | 'CNPJ_CLASSIC' | 'CNPJ_ALPHANUM';

const ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

const randomChar = (alphabet: string) => alphabet[Math.floor(Math.random() * alphabet.length)];
const randomString = (n: number, alphabet: string) => Array.from({ length: n }, () => randomChar(alphabet)).join('');

/** Dígito verificador módulo 11. Cada caractere vale (código ASCII - 48): serve para dígitos e letras do CNPJ alfanumérico. */
export function checkDigit(base: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) sum += (base.charCodeAt(i) - 48) * weights[i];
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

const CPF_W1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const CPF_W2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function generateCpf(): string {
  const base = randomString(9, DIGITS);
  const d1 = checkDigit(base, CPF_W1);
  const d2 = checkDigit(base + d1, CPF_W2);
  return base + d1 + d2;
}

/**
 * @param branchIndex número da filial (0001..9999) — por padrão a matriz (0001)
 * @param root raiz de 8 caracteres; se omitida, é sorteada
 */
export function generateCnpj(alphanumeric: boolean, branchIndex = 1, root?: string): string {
  const r = root ?? randomString(8, alphanumeric ? ALPHANUM : DIGITS);
  const branch = String(Math.min(branchIndex, 9999)).padStart(4, '0');
  const base = r + branch;
  const d1 = checkDigit(base, CNPJ_W1);
  const d2 = checkDigit(base + d1, CNPJ_W2);
  return base + d1 + d2;
}

/**
 * Gera `qty` (1..100) documentos. No modo filial (só CNPJ), todos compartilham a mesma raiz
 * e variam o número da filial (0001, 0002...).
 */
export function generateBatch(type: DocType, qty: number, branchMode: boolean): string[] {
  const n = Math.min(Math.max(1, Math.floor(qty) || 1), 100);
  if (type === 'CPF') return Array.from({ length: n }, generateCpf);
  const alpha = type === 'CNPJ_ALPHANUM';
  const root = branchMode ? randomString(8, alpha ? ALPHANUM : DIGITS) : undefined;
  return Array.from({ length: n }, (_, j) => generateCnpj(alpha, branchMode ? j + 1 : 1, root));
}

export function validateCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
  return checkDigit(cpf.slice(0, 9), CPF_W1) === +cpf[9] && checkDigit(cpf.slice(0, 10), CPF_W2) === +cpf[10];
}

export function validateCnpj(cnpj: string): boolean {
  // raiz+filial alfanuméricas, 2 dígitos verificadores numéricos
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1+$/.test(cnpj)) return false;
  return checkDigit(cnpj.slice(0, 12), CNPJ_W1) === +cnpj[12] && checkDigit(cnpj.slice(0, 13), CNPJ_W2) === +cnpj[13];
}

export type ValidationResult = { valid: boolean; kind: 'CPF' | 'CNPJ' | null; message: string };

export function validateDocument(input: string): ValidationResult | null {
  if (!input.trim()) return null;
  const clean = input.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
  if (clean.length === 11) {
    const valid = validateCpf(clean);
    return { valid, kind: 'CPF', message: valid ? 'CPF válido' : 'CPF inválido' };
  }
  if (clean.length === 14) {
    const valid = validateCnpj(clean);
    return { valid, kind: 'CNPJ', message: valid ? 'CNPJ válido' : 'CNPJ inválido' };
  }
  return { valid: false, kind: null, message: 'Tamanho inválido: use 11 caracteres (CPF) ou 14 (CNPJ).' };
}

export function formatDocument(raw: string, type: DocType): string {
  if (type === 'CPF' && raw.length === 11) return raw.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (type !== 'CPF' && raw.length === 14) return raw.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return raw;
}
